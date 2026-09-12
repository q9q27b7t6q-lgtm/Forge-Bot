'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const { csrfSync } = require('csrf-sync');
const { findUserById } = require('./db');
const { escapeHtml } = require('./utils/escape');
const { i18nMiddleware, setLang, normalizeLang } = require('./i18n');

const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

const PORT = Number(process.env.PORT) || 3847;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET === 'change-me') {
  console.warn(
    '[ForgeBot] ATTENTION: définissez un SESSION_SECRET fort dans .env'
  );
}

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
      },
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, '../public')));

const cookieSecure =
  process.env.NODE_ENV === 'production' ||
  process.env.COOKIE_SECURE === 'true';

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: process.env.DATA_DIR
        ? path.resolve(process.env.DATA_DIR)
        : path.join(__dirname, '../data'),
      table: 'sessions',
    }),
    secret: SESSION_SECRET || 'insecure-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // HTTPS tunnel (Cloudflare): COOKIE_SECURE=true in .env
      secure: cookieSecure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    name: 'forgebot.sid',
  })
);

const {
  generateToken,
  csrfSynchronisedProtection,
  invalidCsrfTokenError,
} = csrfSync({
  getTokenFromRequest: (req) =>
    (req.body && req.body._csrf) ||
    (req.headers && req.headers['x-csrf-token']),
});

app.use(i18nMiddleware);

app.use((req, res, next) => {
  res.locals.csrfToken = generateToken(req);
  res.locals.escapeHtml = escapeHtml;
  res.locals.user = null;
  res.locals.isLoggedIn = !!(req.session && req.session.userId);
  if (req.session && req.session.userId) {
    const u = findUserById(req.session.userId);
    if (u) {
      res.locals.user = u;
    } else {
      req.session.destroy(() => {});
      res.locals.isLoggedIn = false;
    }
  }
  next();
});

// Language switcher: /lang/fr | /lang/en
app.get('/lang/:code', (req, res) => {
  const code = normalizeLang(req.params.code) || 'fr';
  setLang(req, res, code);
  const back = req.get('Referer') || '/';
  let dest = '/';
  try {
    const u = new URL(back, `http://localhost:${PORT}`);
    if (u.pathname.startsWith('/')) dest = u.pathname + u.search;
  } catch (_) {
    dest = '/';
  }
  if (dest.startsWith('/lang')) dest = '/';
  const finish = () => res.redirect(dest);
  if (req.session) {
    return req.session.save(finish);
  }
  return finish();
});

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  return csrfSynchronisedProtection(req, res, (err) => {
    if (err) {
      return res.status(403).render('error', {
        title: res.locals.t('errors.csrf_title'),
        message: res.locals.t('errors.csrf_body'),
        status: 403,
      });
    }
    return next();
  });
});

app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    title: res.locals.t('errors.not_found_title'),
    message: res.locals.t('errors.not_found_body'),
    status: 404,
  });
});

app.use((err, req, res, _next) => {
  if (err === invalidCsrfTokenError || err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: res.locals.t('errors.csrf_title'),
      message: res.locals.t('errors.csrf_body'),
      status: 403,
    });
  }
  console.error('Unhandled error:', err.message);
  res.status(err.statusCode || 500).render('error', {
    title: res.locals.t('errors.generic_title'),
    message: res.locals.t('errors.generic_body'),
    status: err.statusCode || 500,
  });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[ForgeBot] Web écoute sur http://${HOST}:${PORT}`);
});

// Sur un seul service Render : lancer le bot Discord à côté du site si token présent.
if (process.env.DISCORD_BOT_TOKEN) {
  const { spawn } = require('child_process');
  const botScript = path.join(__dirname, 'bot/index.js');
  const bot = spawn(process.execPath, [botScript], {
    stdio: 'inherit',
    env: process.env,
  });
  bot.on('exit', (code, signal) => {
    console.error(
      `[ForgeBot] Processus bot arrêté (code=${code}, signal=${signal || 'none'})`
    );
  });
  console.log('[ForgeBot] Bot Discord démarré en parallèle du site');
} else {
  console.log('[ForgeBot] DISCORD_BOT_TOKEN absent — site seul (bot off)');
}

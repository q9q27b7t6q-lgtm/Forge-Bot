'use strict';

const fr = require('./fr');
const en = require('./en');

const CATALOG = { fr, en };
const DEFAULT_LANG = 'fr';
const COOKIE_NAME = 'forgebot_lang';
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function normalizeLang(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'en' || v.startsWith('en-')) return 'en';
  if (v === 'fr' || v.startsWith('fr-')) return 'fr';
  return null;
}

function resolveLang(req) {
  if (req.session && req.session.lang) {
    const s = normalizeLang(req.session.lang);
    if (s) return s;
  }
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    const c = normalizeLang(req.cookies[COOKIE_NAME]);
    if (c) return c;
  }
  // Cookie may be raw string if no cookie-parser — parse Cookie header lightly
  const header = req.headers && req.headers.cookie;
  if (header) {
    const m = header.match(/(?:^|;\s*)forgebot_lang=([^;]+)/);
    if (m) {
      const c = normalizeLang(decodeURIComponent(m[1]));
      if (c) return c;
    }
  }
  return DEFAULT_LANG;
}

function getDict(lang) {
  return CATALOG[lang] || CATALOG[DEFAULT_LANG];
}

function translate(dict, key) {
  if (!key) return '';
  const parts = String(key).split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      // Fallback to French if missing in EN
      let fb = fr;
      for (const q of parts) {
        if (fb && typeof fb === 'object' && q in fb) fb = fb[q];
        else return key;
      }
      return typeof fb === 'string' ? fb : key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}

function cookieSecureFlag() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.COOKIE_SECURE === 'true'
  );
}

function setLang(req, res, lang) {
  const normalized = normalizeLang(lang) || DEFAULT_LANG;
  if (req.session) {
    req.session.lang = normalized;
  }
  res.cookie(COOKIE_NAME, normalized, {
    maxAge: COOKIE_MAX_AGE_MS,
    httpOnly: false,
    sameSite: 'lax',
    secure: cookieSecureFlag(),
    path: '/',
  });
  return normalized;
}

function i18nMiddleware(req, res, next) {
  const lang = resolveLang(req);
  const dict = getDict(lang);
  res.locals.lang = lang;
  res.locals.dict = dict;
  res.locals.t = (key) => translate(dict, key);
  res.locals.htmlLang = lang;
  next();
}

module.exports = {
  DEFAULT_LANG,
  COOKIE_NAME,
  CATALOG,
  normalizeLang,
  resolveLang,
  getDict,
  translate,
  setLang,
  i18nMiddleware,
  cookieSecureFlag,
};

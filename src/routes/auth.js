'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const {
  createUser,
  findUserByEmail,
} = require('../db');
const { isValidEmail, isValidPassword } = require('../utils/validators');
const { guestOnly } = require('../middleware/auth');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives. Réessayez dans 15 minutes.',
});

router.get('/register', guestOnly, (req, res) => {
  res.render('auth/register', {
    title: res.locals.t('auth.title_register'),
    error: null,
    email: '',
  });
});

router.post('/register', guestOnly, authLimiter, async (req, res) => {
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const passwordConfirm = req.body.password_confirm || '';
  const t = res.locals.t;

  const renderErr = (msg) =>
    res.status(400).render('auth/register', {
      title: t('auth.title_register'),
      error: msg,
      email,
    });

  if (!isValidEmail(email)) {
    return renderErr(t('auth.err_email'));
  }
  if (!isValidPassword(password)) {
    return renderErr(t('auth.err_password_len'));
  }
  if (password !== passwordConfirm) {
    return renderErr(t('auth.err_password_mismatch'));
  }

  const existing = findUserByEmail(email);
  if (existing) {
    return renderErr(t('auth.err_exists'));
  }

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = createUser(email, hash);
    req.session.userId = userId;
    req.session.userEmail = email.trim().toLowerCase();
    return req.session.save(() => res.redirect('/dashboard'));
  } catch (err) {
    console.error('Register error:', err.message);
    return renderErr(t('auth.err_create'));
  }
});

router.get('/login', guestOnly, (req, res) => {
  res.render('auth/login', {
    title: res.locals.t('auth.title_login'),
    error: null,
    email: '',
  });
});

router.post('/login', guestOnly, authLimiter, async (req, res) => {
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const t = res.locals.t;

  const renderErr = (msg) =>
    res.status(401).render('auth/login', {
      title: t('auth.title_login'),
      error: msg,
      email,
    });

  if (!isValidEmail(email) || !password) {
    return renderErr(t('auth.err_bad_creds'));
  }

  const user = findUserByEmail(email);
  if (!user) {
    await bcrypt.hash('dummy-password-check', BCRYPT_ROUNDS);
    return renderErr(t('auth.err_bad_creds'));
  }

  try {
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return renderErr(t('auth.err_bad_creds'));
    }
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    const dest = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    return req.session.save(() => res.redirect(dest));
  } catch (err) {
    console.error('Login error:', err.message);
    return renderErr(t('auth.err_login'));
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('forgebot.sid');
    res.redirect('/');
  });
});

module.exports = router;

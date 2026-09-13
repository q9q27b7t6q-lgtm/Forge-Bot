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
    accept_cgv: false,
    accept_privacy: false,
    waive_withdrawal: false,
  });
});

router.post('/register', guestOnly, authLimiter, async (req, res) => {
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const passwordConfirm = req.body.password_confirm || '';
  const t = res.locals.t;

  const acceptCgv = req.body.accept_cgv === '1' || req.body.accept_cgv === 'on';
  const acceptPrivacy = req.body.accept_privacy === '1' || req.body.accept_privacy === 'on';
  const waiveWithdrawal = req.body.waive_withdrawal === '1' || req.body.waive_withdrawal === 'on';

  const renderErr = (msg) =>
    res.status(400).render('auth/register', {
      title: t('auth.title_register'),
      error: msg,
      email,
      accept_cgv: acceptCgv,
      accept_privacy: acceptPrivacy,
      waive_withdrawal: waiveWithdrawal,
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
  if (!acceptCgv || !acceptPrivacy || !waiveWithdrawal) {
    return renderErr(t('auth.err_legal_checks'));
  }

  const existing = findUserByEmail(email);
  if (existing) {
    return renderErr(t('auth.err_exists'));
  }

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date().toISOString();
    const userId = createUser(email, hash, {
      accepted_cgv_at: now,
      accepted_privacy_at: now,
      waived_withdrawal_at: now,
      legal_docs_version: '2026-09-13',
      signup_ip: (req.headers['x-forwarded-for'] || req.ip || '')
        .toString()
        .split(',')[0]
        .trim()
        .slice(0, 64),
    });
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

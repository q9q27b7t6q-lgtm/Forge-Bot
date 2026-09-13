'use strict';

const express = require('express');
const { createContentReport } = require('../db');
const { isValidEmail } = require('../utils/validators');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('landing', {
    title: res.locals.lang === 'en'
      ? 'ForgeBot — Discord bots for game servers'
      : 'ForgeBot — Bots Discord pour serveurs de jeux',
  });
});

router.get('/health', (req, res) => {
  res.json({ ok: true });
});

router.get('/mentions-legales', (req, res) => {
  res.render('legal/mentions', {
    title: res.locals.t('legal.mentions_title') + ' — ForgeBot',
  });
});

function renderCgv(req, res) {
  res.render('legal/cgv', {
    title: res.locals.t('legal.cgv_title') + ' — ForgeBot',
  });
}

router.get('/cgv', renderCgv);
router.get('/conditions-generales', renderCgv);

router.get('/confidentialite', (req, res) => {
  res.render('legal/privacy', {
    title: res.locals.t('legal.privacy_title') + ' — ForgeBot',
  });
});

router.get('/retractation', (req, res) => {
  res.render('legal/retractation', {
    title: res.locals.t('legal.retractation_title') + ' — ForgeBot',
  });
});

router.get('/signalement', (req, res) => {
  res.render('legal/signalement', {
    title: res.locals.t('legal.signalement_title') + ' — ForgeBot',
    error: null,
    success: false,
    email: '',
    localisation: '',
    details: '',
  });
});

router.post('/signalement', (req, res) => {
  const t = res.locals.t;
  const email = (req.body.email || '').trim();
  const motif = (req.body.motif || '').trim();
  const localisation = (req.body.localisation || '').trim();
  const details = (req.body.details || '').trim();
  const bonneFoi = req.body.bonne_foi === '1' || req.body.bonne_foi === 'on';

  const render = (opts) =>
    res.status(opts.status || 400).render('legal/signalement', {
      title: t('legal.signalement_title') + ' — ForgeBot',
      error: opts.error || null,
      success: !!opts.success,
      email,
      localisation,
      details,
    });

  if (!isValidEmail(email) || !motif || !localisation || !details || !bonneFoi) {
    return render({ error: t('legal.signalement_err') });
  }
  try {
    createContentReport({ email, motif, localisation, details });
    return res.status(200).render('legal/signalement', {
      title: t('legal.signalement_title') + ' — ForgeBot',
      error: null,
      success: true,
      email: '',
      localisation: '',
      details: '',
    });
  } catch (err) {
    console.error('signalement error:', err.message);
    return render({ error: t('legal.signalement_err') });
  }
});

module.exports = router;


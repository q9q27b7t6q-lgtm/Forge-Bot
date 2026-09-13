'use strict';

const express = require('express');
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

router.get('/cgv', (req, res) => {
  res.render('legal/cgv', {
    title: res.locals.t('legal.cgv_title') + ' — ForgeBot',
  });
});

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

module.exports = router;

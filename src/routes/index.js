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

module.exports = router;

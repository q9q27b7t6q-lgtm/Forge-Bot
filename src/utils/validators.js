'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { GUILD_ID_RE } = require('../db');

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim()) && email.length <= 254;
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function normalizeStaffRoleIds(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => GUILD_ID_RE.test(s));
  return [...new Set(parts)].join(',');
}

module.exports = {
  isValidEmail,
  isValidPassword,
  normalizeStaffRoleIds,
  EMAIL_RE,
};

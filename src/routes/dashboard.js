'use strict';

const express = require('express');
const {
  listTenantsByUser,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  isValidGuildId,
  guildIdTaken,
} = require('../db');
const { normalizeStaffRoleIds } = require('../utils/validators');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicOnboardingOpen() {
  return String(process.env.SIGNUPS_OPEN || '').toLowerCase() === 'true';
}


router.use(requireAuth);

function parseTenantBody(body) {
  return {
    name: (body.name || '').trim(),
    discord_guild_id: (body.discord_guild_id || '').trim(),
    knowledge_md: body.knowledge_md || '',
    shop_md: body.shop_md || '',
    staff_role_ids: normalizeStaffRoleIds(body.staff_role_ids || ''),
    active: body.active === '1' || body.active === 'on' || body.active === true,
  };
}

function validateTenant(data, excludeId, t) {
  const tr = t || ((k) => k);
  if (!data.name || data.name.length < 2 || data.name.length > 100) {
    return tr('dash.err_name');
  }
  if (!isValidGuildId(data.discord_guild_id)) {
    return tr('dash.err_guild');
  }
  if (guildIdTaken(data.discord_guild_id, excludeId)) {
    return tr('dash.err_taken');
  }
  if (data.knowledge_md.length > 50000 || data.shop_md.length > 50000) {
    return tr('dash.err_too_long');
  }
  return null;
}

router.get('/', (req, res) => {
  const tenants = listTenantsByUser(req.session.userId);
  res.render('dashboard/index', {
    title: res.locals.t('dash.title'),
    tenants,
    flash: req.session.flash || null,
  });
  delete req.session.flash;
});

router.get('/servers/new', (req, res) => {
  if (!publicOnboardingOpen()) {
    req.session.flash = { type: 'error', message: res.locals.t('auth.signups_closed') };
    return req.session.save(() => res.redirect('/dashboard'));
  }
  res.render('dashboard/server-form', {
    title: res.locals.t('dash.form_new_title'),
    tenant: null,
    error: null,
    form: {
      name: '',
      discord_guild_id: '',
      knowledge_md: DEFAULT_KNOWLEDGE,
      shop_md: DEFAULT_SHOP,
      staff_role_ids: '',
      active: true,
    },
  });
});

router.post('/servers/new', (req, res) => {
  if (!publicOnboardingOpen()) {
    req.session.flash = { type: 'error', message: res.locals.t('auth.signups_closed') };
    return req.session.save(() => res.redirect('/dashboard'));
  }
  const data = parseTenantBody(req.body);
  const err = validateTenant(data, null, res.locals.t);
  if (err) {
    return res.status(400).render('dashboard/server-form', {
      title: res.locals.t('dash.form_new_title'),
      tenant: null,
      error: err,
      form: data,
    });
  }
  try {
    createTenant(req.session.userId, data);
    req.session.flash = { type: 'success', message: res.locals.t('dash.created') };
    return req.session.save(() => res.redirect('/dashboard'));
  } catch (e) {
    console.error('Create tenant error:', e.message);
    return res.status(500).render('dashboard/server-form', {
      title: res.locals.t('dash.form_new_title'),
      tenant: null,
      error: res.locals.t('dash.err_create'),
      form: data,
    });
  }
});

router.get('/servers/:id/edit', (req, res) => {
  const id = Number(req.params.id);
  const tenant = getTenantById(id, req.session.userId);
  if (!tenant) {
    return res.status(404).render('error', {
      title: res.locals.t('dash.not_found_title'),
      message: res.locals.t('dash.not_found'),
      status: 404,
    });
  }
  res.render('dashboard/server-form', {
    title: `${res.locals.t('dash.form_edit_h1')} — ${tenant.name}`,
    tenant,
    error: null,
    form: {
      name: tenant.name,
      discord_guild_id: tenant.discord_guild_id,
      knowledge_md: tenant.knowledge_md,
      shop_md: tenant.shop_md,
      staff_role_ids: tenant.staff_role_ids,
      active: !!tenant.active,
    },
  });
});

router.post('/servers/:id/edit', (req, res) => {
  const id = Number(req.params.id);
  const tenant = getTenantById(id, req.session.userId);
  if (!tenant) {
    return res.status(404).render('error', {
      title: res.locals.t('dash.not_found_title'),
      message: res.locals.t('dash.not_found'),
      status: 404,
    });
  }
  const data = parseTenantBody(req.body);
  const err = validateTenant(data, id, res.locals.t);
  if (err) {
    return res.status(400).render('dashboard/server-form', {
      title: `${res.locals.t('dash.form_edit_h1')} — ${tenant.name}`,
      tenant,
      error: err,
      form: data,
    });
  }
  try {
    updateTenant(id, req.session.userId, data);
    req.session.flash = { type: 'success', message: res.locals.t('dash.updated') };
    return req.session.save(() => res.redirect('/dashboard'));
  } catch (e) {
    console.error('Update tenant error:', e.message);
    return res.status(500).render('dashboard/server-form', {
      title: `${res.locals.t('dash.form_edit_h1')} — ${tenant.name}`,
      tenant,
      error: res.locals.t('dash.err_update'),
      form: data,
    });
  }
});

router.post('/servers/:id/delete', (req, res) => {
  const id = Number(req.params.id);
  deleteTenant(id, req.session.userId);
  req.session.flash = { type: 'success', message: res.locals.t('dash.deleted') };
  req.session.save(() => res.redirect('/dashboard'));
});

router.get('/servers/:id/invite', (req, res) => {
  const id = Number(req.params.id);
  const tenant = getTenantById(id, req.session.userId);
  if (!tenant) {
    return res.status(404).render('error', {
      title: res.locals.t('dash.not_found_title'),
      message: res.locals.t('dash.not_found'),
      status: 404,
    });
  }
  const clientId = process.env.DISCORD_CLIENT_ID || '';
  // Basic: View Channels, Send Messages, Embed Links, Read Message History, Add Reactions
  const perms = '274877991936';
  let inviteUrl = null;
  if (clientId && /^\d{17,20}$/.test(clientId)) {
    inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${perms}&scope=bot%20applications.commands&guild_id=${tenant.discord_guild_id}&disable_guild_select=true`;
  }
  res.render('dashboard/invite', {
    title: `${res.locals.t('dash.invite_title')} — ${tenant.name}`,
    tenant,
    clientId,
    inviteUrl,
  });
});

const DEFAULT_KNOWLEDGE = `# FAQ

## Comment rejoindre le serveur ?
Connectez-vous via le launcher / IP indiquée dans #infos.

## Quels sont les horaires de wipe ?
Les wipes ont lieu le premier vendredi du mois à 18h (heure de Paris).

## Règles
Respectez les autres joueurs. Pas de triche. Pas de dump de base AFK abusif.
`;

const DEFAULT_SHOP = `# Boutique

## VIP
- VIP Bronze : 5€ / mois — kit de départ amélioré
- VIP Argent : 10€ / mois — kit + véhicule
- VIP Or : 20€ / mois — kit + véhicule + skin exclusif

## Comment acheter ?
Rendez-vous sur la boutique du serveur ou ouvrez un ticket #support.
`;

module.exports = router;

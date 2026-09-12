'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const {
  findUserByEmail,
  createUser,
  listTenantsByUser,
  createTenant,
  guildIdTaken,
} = require('../src/db');

const DEMO_EMAIL = 'crazy@forgebot.local';
const DEMO_PASSWORD = 'ForgeBot2026!Demo';
const DEMO_GUILD = '000000000000000000';
const LOGIN_FILE = path.join(__dirname, '../DEMO_LOGIN.txt');

const KNOWLEDGE_MD = `# FAQ — Serveur Démo DayZ

## Horaires de raid
Les raids sont autorisés **tous les jours de 18h à 23h** (heure de Paris).
En dehors de ces créneaux : pas de raid de base, pas de griefing de coffres.

## Comment rejoindre ?
1. Ajoutez le serveur via le launcher DayZ / liste communautaire.
2. Nom affiché : **Serveur Démo DayZ**.
3. Mot de passe éventuel : voir le salon #infos.

## Règles principales
- Respectez les autres joueurs et le staff.
- Interdit : triche, duplication, scripts non autorisés.
- Bases AFK abusives / dump massif : avertissement puis ban.
- Tickets support uniquement dans #support.

## Wipes
Wipe complet le **1er vendredi du mois à 18h** (Paris).
Annonces dans #annonces 48h avant.

## Staff
Pour un remboursement, objet perdu ou litige : ouvrez un ticket.
Le bot répond depuis cette FAQ — s’il ne sait pas, pingez le staff.
`;

const SHOP_MD = `# Boutique VIP — Démo

## Packs mensuels
- **VIP Bronze** — 5€ / mois — kit de départ amélioré + 1 skin
- **VIP Argent** — 10€ / mois — kit + véhicule léger
- **VIP Or** — 20€ / mois — kit + véhicule + skin exclusif + priorité file

## Comment acheter ?
1. Ouvrez un ticket dans #support
2. Indiquez le pack souhaité
3. Le staff valide le paiement et applique le rôle VIP

## Remarques
Les prix sont indicatifs pour la démo ForgeBot.
Remplacez ce texte par votre vraie boutique.
`;

async function main() {
  let user = findUserByEmail(DEMO_EMAIL);
  let createdUser = false;
  if (!user) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const id = createUser(DEMO_EMAIL, hash);
    user = { id, email: DEMO_EMAIL };
    createdUser = true;
    console.log('[seed] Utilisateur démo créé:', DEMO_EMAIL);
  } else {
    console.log('[seed] Utilisateur démo déjà présent:', DEMO_EMAIL);
  }

  const tenants = listTenantsByUser(user.id);
  const existing = tenants.find((x) => x.discord_guild_id === DEMO_GUILD);
  if (!existing) {
    if (guildIdTaken(DEMO_GUILD)) {
      console.log('[seed] Guild démo déjà prise par un autre compte — skip tenant');
    } else {
      createTenant(user.id, {
        name: 'Serveur Démo DayZ',
        discord_guild_id: DEMO_GUILD,
        knowledge_md: KNOWLEDGE_MD,
        shop_md: SHOP_MD,
        staff_role_ids: '',
        active: true,
      });
      console.log('[seed] Tenant « Serveur Démo DayZ » créé');
    }
  } else {
    console.log('[seed] Tenant démo déjà présent');
  }

  const body = [
    '═══════════════════════════════════════════',
    '  ForgeBot — identifiants DÉMO (Crazy only)',
    '═══════════════════════════════════════════',
    '',
    `E-mail    : ${DEMO_EMAIL}`,
    `Mot de passe : ${DEMO_PASSWORD}`,
    '',
    'Tenant   : Serveur Démo DayZ',
    `Guild ID : ${DEMO_GUILD}  (placeholder — à remplacer)`,
    '',
    'Fichier local — ne pas committer / ne pas partager.',
    `Généré le : ${new Date().toISOString()}`,
    createdUser ? 'Compte : nouvellement créé' : 'Compte : existait déjà (mdp non réécrit)',
    '',
  ].join('\n');

  fs.writeFileSync(LOGIN_FILE, body, 'utf8');
  console.log('[seed] Identifiants écrits dans', LOGIN_FILE);
  if (createdUser) {
    console.log('[seed] Mot de passe (une fois) :', DEMO_PASSWORD);
  }
}

main().catch((err) => {
  console.error('[seed] Échec:', err);
  process.exit(1);
});

# ForgeBot

**Location de bots Discord** pour serveurs de jeux (FAQ + boutique).  
Prototype MVP — interface FR, dark gaming, multi-tenants SQLite.

## Prérequis

- Node.js ≥ 18
- Compte Discord Developer (token bot + Client ID) pour le runtime bot

## Installation

```bash
cd /workspace/forgebot
cp .env.example .env
# Éditez .env : SESSION_SECRET, DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID
npm install
```

## Variables d’environnement

| Variable | Description |
|---|---|
| `PORT` | Port HTTP (défaut **3847**) |
| `SESSION_SECRET` | Secret fort pour les cookies de session |
| `DISCORD_BOT_TOKEN` | Token du bot Discord |
| `DISCORD_CLIENT_ID` | ID application (URL d’invitation) |
| `BOT_PREFIX` | Préfixe commandes (défaut `!`) |

Ne committez jamais le fichier `.env`.

## Lancer

```bash
# Site web
npm start

# Bot Discord (processus séparé)
npm run bot

# Web avec rechargement (Node --watch)
npm run dev
```

- Accueil : http://localhost:3847/
- Santé : http://localhost:3847/health → `{ "ok": true }`
- Données SQLite : `data/forgebot.db` (+ `data/sessions.db`)

## Utilisation

1. **Inscription** / connexion (e-mail + mot de passe)
2. **Dashboard** → créer un serveur (nom, `discord_guild_id`, knowledge_md, shop_md, rôles staff)
3. Page **Inviter** → URL OAuth Discord préremplie
4. Sur Discord : mentionnez le bot ou `!faq …` / `!shop …` / `!…`

Le bot répond en français via matching local (sections Markdown + mots-clés). Pas de LLM externe. Guilde inconnue → message court ou ignore. Question inconnue → renvoi vers le staff.

## Sécurité

- Mots de passe **bcrypt** (coût ≥ 12)
- Cookies de session **httpOnly**, store SQLite
- **Helmet**, **rate-limit** sur login/register
- **CSRF** (`csrf-sync`) sur tous les POST
- SQL **paramétré** (better-sqlite3)
- Validation `discord_guild_id` : `/^\d{17,20}$/`
- Échappement HTML côté vues (`escapeHtml`)
- Aucun log de mots de passe / tokens

## Scripts

| Script | Rôle |
|---|---|
| `npm start` | Serveur Express |
| `npm run bot` | Runtime discord.js v14 |
| `npm run dev` | Web + `--watch` |
| `npm run check` | `node --check` sur les entrées |

## Stack

Node.js, Express, EJS, better-sqlite3, express-session + connect-sqlite3, bcrypt, helmet, express-rate-limit, csrf-sync, discord.js v14.

## Prochaines étapes

- **Stripe** : abonnements Forge / Network
- **OAuth Discord** : lier le compte propriétaire / auto-guild
- **VPS** : process manager (systemd/pm2), HTTPS, backups SQLite
- Slash commands, analytics, éditeur Markdown live

## Licence

Prototype privé — Crazy.


## Déploiement (sous-domaine gratuit)

- `npm start` / `Procfile` → `web: node src/server.js`
- `PORT` et `HOST` (défaut `0.0.0.0`) lus depuis l’env
- SQLite + sessions dans `DATA_DIR` (sinon `./data`, doit être inscriptible)
- Derrière HTTPS : `COOKIE_SECURE=true` et `SESSION_SECRET` fort
- Seed démo : `npm run seed` → identifiants dans `DEMO_LOGIN.txt` (gitignored)
- Langue : FR par défaut, bascule `/lang/en` | `/lang/fr`

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'forgebot.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    discord_guild_id TEXT NOT NULL,
    knowledge_md TEXT NOT NULL DEFAULT '',
    shop_md TEXT NOT NULL DEFAULT '',
    staff_role_ids TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_guild
    ON tenants(discord_guild_id);
  CREATE INDEX IF NOT EXISTS idx_tenants_user
    ON tenants(user_id);

  CREATE TABLE IF NOT EXISTS content_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    motif TEXT NOT NULL,
    localisation TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations légères (SQLite)
(() => {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  const add = (name, sqlType) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${sqlType}`);
  };
  add('accepted_cgv_at', 'TEXT');
  add('accepted_privacy_at', 'TEXT');
  add('waived_withdrawal_at', 'TEXT');
  add('legal_docs_version', 'TEXT');
  add('signup_ip', 'TEXT');
})();


const GUILD_ID_RE = /^\d{17,20}$/;

function isValidGuildId(id) {
  return typeof id === 'string' && GUILD_ID_RE.test(id.trim());
}

function createUser(email, passwordHash, consent = {}) {
  const stmt = db.prepare(
    `INSERT INTO users (
      email, password_hash,
      accepted_cgv_at, accepted_privacy_at, waived_withdrawal_at,
      legal_docs_version, signup_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const now = new Date().toISOString();
  const info = stmt.run(
    email.trim().toLowerCase(),
    passwordHash,
    consent.accepted_cgv_at || now,
    consent.accepted_privacy_at || now,
    consent.waived_withdrawal_at || now,
    consent.legal_docs_version || '2026-09-13',
    consent.signup_ip || null
  );
  return info.lastInsertRowid;
}

function createContentReport({ email, motif, localisation, details }) {
  const info = db
    .prepare(
      `INSERT INTO content_reports (email, motif, localisation, details)
       VALUES (?, ?, ?, ?)`
    )
    .run(email.trim().toLowerCase(), motif, localisation, details);
  return info.lastInsertRowid;
}

function findUserByEmail(email) {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());
}

function findUserById(id) {
  return db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(id);
}

function listTenantsByUser(userId) {
  return db
    .prepare(
      `SELECT id, name, discord_guild_id, knowledge_md, shop_md,
              staff_role_ids, active, created_at, updated_at
       FROM tenants WHERE user_id = ? ORDER BY name COLLATE NOCASE`
    )
    .all(userId);
}

function getTenantById(id, userId) {
  return db
    .prepare(
      `SELECT * FROM tenants WHERE id = ? AND user_id = ?`
    )
    .get(id, userId);
}

function getTenantByGuildId(guildId) {
  return db
    .prepare(
      `SELECT * FROM tenants WHERE discord_guild_id = ? AND active = 1`
    )
    .get(guildId);
}

function createTenant(userId, data) {
  const stmt = db.prepare(`
    INSERT INTO tenants (
      user_id, name, discord_guild_id, knowledge_md, shop_md, staff_role_ids, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    userId,
    data.name.trim(),
    data.discord_guild_id.trim(),
    data.knowledge_md || '',
    data.shop_md || '',
    data.staff_role_ids || '',
    data.active ? 1 : 0
  );
  return info.lastInsertRowid;
}

function updateTenant(id, userId, data) {
  const stmt = db.prepare(`
    UPDATE tenants SET
      name = ?,
      discord_guild_id = ?,
      knowledge_md = ?,
      shop_md = ?,
      staff_role_ids = ?,
      active = ?,
      updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `);
  const info = stmt.run(
    data.name.trim(),
    data.discord_guild_id.trim(),
    data.knowledge_md || '',
    data.shop_md || '',
    data.staff_role_ids || '',
    data.active ? 1 : 0,
    id,
    userId
  );
  return info.changes;
}

function deleteTenant(id, userId) {
  const info = db
    .prepare('DELETE FROM tenants WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return info.changes;
}

function guildIdTaken(guildId, excludeTenantId) {
  if (excludeTenantId) {
    return db
      .prepare(
        'SELECT id FROM tenants WHERE discord_guild_id = ? AND id != ?'
      )
      .get(guildId, excludeTenantId);
  }
  return db
    .prepare('SELECT id FROM tenants WHERE discord_guild_id = ?')
    .get(guildId);
}

module.exports = {
  db,
  isValidGuildId,
  createUser,
  createContentReport,
  findUserByEmail,
  findUserById,
  listTenantsByUser,
  getTenantById,
  getTenantByGuildId,
  createTenant,
  updateTenant,
  deleteTenant,
  guildIdTaken,
  GUILD_ID_RE,
};

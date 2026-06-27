'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const seedExercises = require('./exercises');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.COMBAT_DB || path.join(DATA_DIR, 'combat.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

// Ensure the data directory exists before SQLite tries to open the file.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Create tables from the schema file.
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Migrate databases created before a column existed.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}
ensureColumn('plans', 'user_id', 'user_id INTEGER');
ensureColumn('plans', 'start_date', 'start_date TEXT');
ensureColumn('sessions', 'phase', "phase TEXT NOT NULL DEFAULT 'off_season'");
db.exec('CREATE INDEX IF NOT EXISTS idx_plans_user ON plans (user_id);');

// Seed the exercise library once (idempotent thanks to the UNIQUE constraint).
function seed() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM exercises').get();
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO exercises (name, category, discipline, detail) VALUES (?, ?, ?, ?)'
  );
  db.exec('BEGIN');
  try {
    for (const ex of seedExercises) {
      insert.run(ex.name, ex.category, ex.discipline, ex.detail);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

seed();

module.exports = db;

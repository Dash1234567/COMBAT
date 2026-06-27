-- COMBAT database schema (SQLite)
-- A relational model linking athletes' plans -> weekly sessions -> exercises,
-- backed by a reusable exercise library, plus user accounts + sessions.

PRAGMA foreign_keys = ON;

-- User accounts. Passwords are stored as a scrypt hash + per-user salt.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  password_salt TEXT    NOT NULL,
  nickname      TEXT,
  avatar        TEXT,                          -- image data URL (optional)
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Login sessions: a random token maps to a user until it expires.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- A training plan created via the "Create Plan" flow. user_id is NULL for
-- plans created by a guest (not logged in).
CREATE TABLE IF NOT EXISTS plans (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER,
  name           TEXT    NOT NULL,
  athlete_name   TEXT,
  discipline     TEXT    NOT NULL,          -- boxing | mma | bjj | muay_thai | wrestling | kickboxing | karate
  goal           TEXT    NOT NULL,          -- conditioning | strength | dieting | weight_cutting
  experience     TEXT    NOT NULL,          -- beginner | intermediate | advanced
  days_per_week  INTEGER NOT NULL,          -- 3..6
  current_weight REAL,
  target_weight  REAL,
  weight_unit    TEXT    NOT NULL DEFAULT 'kg',
  event_date     TEXT,                       -- ISO date of fight / weigh-in (optional)
  start_date     TEXT,                        -- ISO date the training block begins
  xp             INTEGER NOT NULL DEFAULT 0,
  streak         INTEGER NOT NULL DEFAULT 0,
  last_completed TEXT,                        -- ISO date of last completed session
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Reusable library of exercises/drills used to assemble a plan's sessions.
CREATE TABLE IF NOT EXISTS exercises (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,                   -- strength | conditioning | skill | mobility
  discipline TEXT NOT NULL DEFAULT 'all',     -- 'all' or a specific discipline
  detail     TEXT NOT NULL,                   -- prescription, e.g. "4 x 6 reps"
  UNIQUE (name, category, discipline)
);

-- One row per day of the week for each plan (training day or rest day).
CREATE TABLE IF NOT EXISTS sessions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id   INTEGER NOT NULL,
  day_index INTEGER NOT NULL,                 -- 0=Monday .. 6=Sunday
  day_label TEXT    NOT NULL,
  focus     TEXT    NOT NULL,
  title     TEXT    NOT NULL,
  phase     TEXT    NOT NULL DEFAULT 'off_season', -- off_season | pre_season | fight_camp
  completed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE
);

-- Calendar: which date ranges of a plan fall in which training phase.
CREATE TABLE IF NOT EXISTS plan_phases (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL,
  phase      TEXT    NOT NULL,
  week_start INTEGER NOT NULL,                 -- 0-based week index within the plan
  weeks      INTEGER NOT NULL,
  start_date TEXT    NOT NULL,                 -- Monday of the first week (ISO)
  end_date   TEXT    NOT NULL,                 -- Sunday of the last week (ISO)
  FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE
);

-- The exercises assigned to a given session.
CREATE TABLE IF NOT EXISTS session_exercises (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  detail     TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

-- Competitions/events the athlete adds on the calendar. The soonest upcoming
-- event drives the plan's periodization.
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL,
  date       TEXT    NOT NULL,                 -- ISO date
  time       TEXT,                              -- HH:MM (optional)
  type       TEXT    NOT NULL,                  -- dual | tournament | states | ...
  title      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE
);

-- Note: idx_plans_user is created in lib/db.js after the user_id migration,
-- so it also works on databases that predate the user_id column.
CREATE INDEX IF NOT EXISTS idx_sessions_plan       ON sessions (plan_id);
CREATE INDEX IF NOT EXISTS idx_session_ex_session  ON session_exercises (session_id);
CREATE INDEX IF NOT EXISTS idx_plan_phases_plan     ON plan_phases (plan_id);
CREATE INDEX IF NOT EXISTS idx_exercises_category  ON exercises (category, discipline);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user  ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_events_plan          ON events (plan_id);

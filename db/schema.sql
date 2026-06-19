-- COMBAT database schema (SQLite)
-- A relational model linking athletes' plans -> weekly sessions -> exercises,
-- backed by a reusable exercise library.

PRAGMA foreign_keys = ON;

-- A training plan created by an athlete via the "Create Plan" flow.
CREATE TABLE IF NOT EXISTS plans (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
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
  focus     TEXT    NOT NULL,                 -- Strength | Conditioning | Skills & Technique | Sparring & Drills | Mobility & Recovery | Rest
  title     TEXT    NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_sessions_plan       ON sessions (plan_id);
CREATE INDEX IF NOT EXISTS idx_session_ex_session  ON session_exercises (session_id);
CREATE INDEX IF NOT EXISTS idx_exercises_category  ON exercises (category, discipline);

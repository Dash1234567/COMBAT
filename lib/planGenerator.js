'use strict';

// Turns a plan's parameters (discipline, goal, experience, days/week) into a
// concrete weekly schedule of sessions + exercises, pulled from the library.

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Which weekday indexes (0=Mon) are training days for a given days/week count.
const TRAINING_DAYS = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

// Ordered focus priority per goal. We take the first N for N training days.
const FOCUS_PRIORITY = {
  strength:       ['Strength', 'Skills & Technique', 'Conditioning', 'Strength', 'Sparring & Drills', 'Mobility & Recovery'],
  conditioning:   ['Conditioning', 'Skills & Technique', 'Strength', 'Conditioning', 'Sparring & Drills', 'Mobility & Recovery'],
  dieting:        ['Strength', 'Conditioning', 'Skills & Technique', 'Sparring & Drills', 'Conditioning', 'Mobility & Recovery'],
  weight_cutting: ['Conditioning', 'Skills & Technique', 'Conditioning', 'Strength', 'Sparring & Drills', 'Mobility & Recovery'],
};

const FOCUS_TITLES = {
  'Strength': 'Strength & Power',
  'Conditioning': 'Engine Builder',
  'Skills & Technique': 'Technique Lab',
  'Sparring & Drills': 'Live Drills & Sparring',
  'Mobility & Recovery': 'Mobility & Recovery',
  'Rest': 'Rest Day',
};

const EX_COUNT = { beginner: 4, intermediate: 5, advanced: 6 };

// Pull `n` random exercises of a category usable by this discipline.
function pick(db, category, discipline, n) {
  if (n <= 0) return [];
  return db
    .prepare(
      `SELECT name, detail FROM exercises
        WHERE category = ?
          AND (discipline = ? OR discipline = 'all')
        ORDER BY RANDOM()
        LIMIT ?`
    )
    .all(category, discipline, n);
}

// Build the exercise list for a focus, mixing categories where it makes sense.
function exercisesForFocus(db, focus, discipline, count) {
  switch (focus) {
    case 'Strength':
      return pick(db, 'strength', discipline, count);
    case 'Conditioning':
      return pick(db, 'conditioning', discipline, count);
    case 'Skills & Technique':
      return pick(db, 'skill', discipline, count);
    case 'Mobility & Recovery':
      return pick(db, 'mobility', discipline, count);
    case 'Sparring & Drills': {
      const skill = Math.ceil(count * 0.6);
      return [...pick(db, 'skill', discipline, skill), ...pick(db, 'conditioning', discipline, count - skill)];
    }
    default:
      return [];
  }
}

/**
 * Generate and persist the 7-day schedule for an existing plan row.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} planId
 * @param {{discipline:string, goal:string, experience:string, days_per_week:number}} plan
 */
function generatePlan(db, planId, plan) {
  const training = TRAINING_DAYS[plan.days_per_week] || TRAINING_DAYS[3];
  const focuses = (FOCUS_PRIORITY[plan.goal] || FOCUS_PRIORITY.conditioning).slice(0, training.length);
  const count = EX_COUNT[plan.experience] || EX_COUNT.beginner;

  const insertSession = db.prepare(
    'INSERT INTO sessions (plan_id, day_index, day_label, focus, title) VALUES (?, ?, ?, ?, ?)'
  );
  const insertExercise = db.prepare(
    'INSERT INTO session_exercises (session_id, name, detail, position) VALUES (?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    let trainingSlot = 0;
    for (let day = 0; day < 7; day++) {
      const isTraining = training.includes(day);
      const focus = isTraining ? focuses[trainingSlot++] : 'Rest';
      const title = FOCUS_TITLES[focus] || focus;

      const { lastInsertRowid: sessionId } = insertSession.run(
        planId,
        day,
        DAY_LABELS[day],
        focus,
        title
      );

      if (isTraining) {
        const exercises = exercisesForFocus(db, focus, plan.discipline, count);
        exercises.forEach((ex, i) => insertExercise.run(sessionId, ex.name, ex.detail, i));
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { generatePlan, DAY_LABELS };

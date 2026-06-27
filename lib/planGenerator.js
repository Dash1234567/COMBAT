'use strict';

// Turns a plan's parameters into a periodized, calendar-aware program:
// the timeline from start_date to the event is split into training phases
// (off-season -> pre-season -> fight camp), and each phase gets its own weekly
// template of sessions + exercises, with phase-appropriate focus and recovery.

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TRAINING_DAYS = { 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

const PHASE_ORDER = ['off_season', 'pre_season', 'fight_camp'];

// Everything the rest of the app needs to know about each phase.
const PHASE_META = {
  off_season: {
    phase: 'off_season', label: 'Off-Season', emoji: '🌱', color: 'green',
    training: 'Build your base — strength, work capacity and fixing weaknesses, with lower sport-specific intensity.',
    recovery: 'Recovery is generous here — this is when you grow. Take full rest days and easy aerobic work.',
    nutrition: 'Eat to build: a slight calorie surplus with high protein to add strength and muscle. Don\'t diet hard now.',
  },
  pre_season: {
    phase: 'pre_season', label: 'Pre-Season', emoji: '⚡', color: 'blue',
    training: 'Ramp up — convert strength to power and build sport-specific conditioning and skills toward competition pace.',
    recovery: 'Watch fatigue as volume rises; keep one full rest day and a mobility session every week.',
    nutrition: 'Dial in body composition and fuel the rising volume — maintenance calories with carbs around hard sessions.',
  },
  fight_camp: {
    phase: 'fight_camp', label: 'Fight Camp', emoji: '🥊', color: 'red',
    training: 'Peak and sharpen — heavy skills, sparring and sport-specific conditioning; strength drops to low-volume maintenance.',
    recovery: 'Recovery is performance now — prioritise sleep and mobility, and taper/deload in the final week before the event.',
    nutrition: 'Manage weight gradually (~0.5–1%/week), keep protein high, and use a practised rehydration + refuel plan after the weigh-in.',
  },
};

// Weekly focus priority per phase. We take the first N for N training days.
const FOCUS_PRIORITY_BY_PHASE = {
  off_season:  ['Strength', 'Conditioning', 'Strength', 'Skills & Technique', 'Conditioning', 'Mobility & Recovery'],
  pre_season:  ['Strength', 'Conditioning', 'Skills & Technique', 'Sparring & Drills', 'Conditioning', 'Mobility & Recovery'],
  fight_camp:  ['Skills & Technique', 'Sparring & Drills', 'Conditioning', 'Strength', 'Sparring & Drills', 'Mobility & Recovery'],
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

// --------------------------------------------------------------- date helpers
function toUTCDate(iso) { return new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); }
function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function mondayOf(d) { return addDays(d, -((d.getUTCDay() + 6) % 7)); } // Mon=0
function weekdayIndex(d) { return (d.getUTCDay() + 6) % 7; } // Mon=0 .. Sun=6
function diffWeeks(a, b) { return Math.round((b - a) / (7 * 86400000)); }

/**
 * Split [start, event] into phases aligned to Mon–Sun calendar weeks.
 * Without an event date the whole block is off-season.
 */
function periodize(startISO, eventISO) {
  const firstMonday = mondayOf(toUTCDate(startISO || isoDate(new Date())));
  let end = eventISO ? toUTCDate(eventISO) : addDays(firstMonday, 8 * 7 - 1);
  if (end < firstMonday) end = addDays(firstMonday, 6);
  const lastMonday = mondayOf(end);
  const totalWeeks = Math.max(1, diffWeeks(firstMonday, lastMonday) + 1);

  let off, pre, camp;
  if (eventISO) {
    camp = Math.min(6, totalWeeks);
    let rem = totalWeeks - camp;
    pre = Math.min(4, rem); rem -= pre;
    off = rem;
  } else {
    off = totalWeeks; pre = 0; camp = 0;
  }

  const segments = [];
  let wi = 0;
  for (const [phase, weeks] of [['off_season', off], ['pre_season', pre], ['fight_camp', camp]]) {
    if (weeks <= 0) continue;
    segments.push({
      phase,
      week_start: wi,
      weeks,
      start_date: isoDate(addDays(firstMonday, wi * 7)),
      end_date: isoDate(addDays(firstMonday, (wi + weeks) * 7 - 1)),
    });
    wi += weeks;
  }
  return {
    week_start: isoDate(firstMonday),
    week_end: isoDate(addDays(firstMonday, totalWeeks * 7 - 1)),
    total_weeks: totalWeeks,
    segments,
  };
}

/** Where does a given date fall in the plan timeline? */
function locateDate(timeline, dateISO) {
  const first = toUTCDate(timeline.week_start);
  const d = toUTCDate(dateISO);
  if (d < first || d > toUTCDate(timeline.week_end)) return null;
  const weekOfPlan = Math.floor(diffWeeks(first, mondayOf(d)));
  const seg = timeline.segments.find((s) => weekOfPlan >= s.week_start && weekOfPlan < s.week_start + s.weeks);
  if (!seg) return null;
  return { date: dateISO, phase: seg.phase, week_of_plan: weekOfPlan, day_index: weekdayIndex(d) };
}

// ------------------------------------------------------------- exercise pick
function pick(db, category, discipline, n) {
  if (n <= 0) return [];
  return db
    .prepare(
      `SELECT name, detail FROM exercises
        WHERE category = ? AND (discipline = ? OR discipline = 'all')
        ORDER BY RANDOM() LIMIT ?`
    )
    .all(category, discipline, n);
}

function exercisesForFocus(db, focus, discipline, count) {
  switch (focus) {
    case 'Strength': return pick(db, 'strength', discipline, count);
    case 'Conditioning': return pick(db, 'conditioning', discipline, count);
    case 'Skills & Technique': return pick(db, 'skill', discipline, count);
    case 'Mobility & Recovery': return pick(db, 'mobility', discipline, count);
    case 'Sparring & Drills': {
      const skill = Math.ceil(count * 0.6);
      return [...pick(db, 'skill', discipline, skill), ...pick(db, 'conditioning', discipline, count - skill)];
    }
    default: return [];
  }
}

// --------------------------------------------------------------- generation
function buildPhaseWeek(db, planId, plan, phase, insertSession, insertExercise) {
  const training = TRAINING_DAYS[plan.days_per_week] || TRAINING_DAYS[3];
  const focuses = (FOCUS_PRIORITY_BY_PHASE[phase] || FOCUS_PRIORITY_BY_PHASE.off_season).slice(0, training.length);
  const baseCount = EX_COUNT[plan.experience] || EX_COUNT.beginner;

  let slot = 0;
  for (let day = 0; day < 7; day++) {
    const isTraining = training.includes(day);
    const focus = isTraining ? focuses[slot++] : 'Rest';
    const { lastInsertRowid: sessionId } = insertSession.run(planId, day, DAY_LABELS[day], focus, FOCUS_TITLES[focus] || focus, phase);
    if (isTraining) {
      // Strength is maintenance (lower volume) during fight camp.
      const count = phase === 'fight_camp' && focus === 'Strength' ? Math.max(3, baseCount - 1) : baseCount;
      exercisesForFocus(db, focus, plan.discipline, count).forEach((ex, i) => insertExercise.run(sessionId, ex.name, ex.detail, i));
    }
  }
}

/**
 * Generate and persist a plan's periodized schedule + calendar.
 * @param {{discipline:string, goal:string, experience:string, days_per_week:number, start_date?:string, event_date?:string}} plan
 */
function generatePlan(db, planId, plan) {
  const timeline = periodize(plan.start_date, plan.event_date);

  const insertSession = db.prepare(
    'INSERT INTO sessions (plan_id, day_index, day_label, focus, title, phase) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertExercise = db.prepare(
    'INSERT INTO session_exercises (session_id, name, detail, position) VALUES (?, ?, ?, ?)'
  );
  const insertPhase = db.prepare(
    'INSERT INTO plan_phases (plan_id, phase, week_start, weeks, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    for (const seg of timeline.segments) {
      insertPhase.run(planId, seg.phase, seg.week_start, seg.weeks, seg.start_date, seg.end_date);
      buildPhaseWeek(db, planId, plan, seg.phase, insertSession, insertExercise);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return timeline;
}

module.exports = { generatePlan, periodize, locateDate, PHASE_META, PHASE_ORDER, DAY_LABELS };

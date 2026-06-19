'use strict';

const path = require('node:path');
const express = require('express');
const db = require('./lib/db');
const { generatePlan } = require('./lib/planGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------------ validation
const DISCIPLINES = ['boxing', 'mma', 'bjj', 'muay_thai', 'wrestling', 'kickboxing', 'karate'];
const GOALS = ['conditioning', 'strength', 'dieting', 'weight_cutting'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
const UNITS = ['kg', 'lb'];

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN; // NaN signals an invalid (non-empty) value
}

function validatePlanInput(body) {
  const errors = [];
  const name = String(body.name || '').trim();
  if (!name) errors.push('Plan name is required.');
  if (name.length > 60) errors.push('Plan name must be 60 characters or fewer.');

  const athlete = String(body.athlete_name || '').trim().slice(0, 60);

  if (!DISCIPLINES.includes(body.discipline)) errors.push('Pick a valid discipline.');
  if (!GOALS.includes(body.goal)) errors.push('Pick a valid goal.');
  if (!EXPERIENCE.includes(body.experience)) errors.push('Pick a valid experience level.');

  const days = Number(body.days_per_week);
  if (!Number.isInteger(days) || days < 3 || days > 6) errors.push('Training days must be between 3 and 6.');

  const unit = UNITS.includes(body.weight_unit) ? body.weight_unit : 'kg';

  const current = toNumberOrNull(body.current_weight);
  const target = toNumberOrNull(body.target_weight);
  if (Number.isNaN(current) || (current !== null && (current <= 0 || current > 600)))
    errors.push('Current weight looks invalid.');
  if (Number.isNaN(target) || (target !== null && (target <= 0 || target > 600)))
    errors.push('Target weight looks invalid.');

  let eventDate = null;
  if (body.event_date) {
    const d = new Date(body.event_date);
    if (Number.isNaN(d.getTime())) errors.push('Event date is invalid.');
    else eventDate = body.event_date.slice(0, 10);
  }

  return {
    errors,
    value: {
      name,
      athlete_name: athlete || null,
      discipline: body.discipline,
      goal: body.goal,
      experience: body.experience,
      days_per_week: days,
      current_weight: current,
      target_weight: target,
      weight_unit: unit,
      event_date: eventDate,
    },
  };
}

// Compute weight-cut pacing + safety from stored values.
function weightAnalysis(plan) {
  if (plan.current_weight == null || plan.target_weight == null) return null;
  const toLose = Math.round((plan.current_weight - plan.target_weight) * 10) / 10;
  const result = { toLose, unit: plan.weight_unit, weeks: null, perWeek: null, safe: null, daysLeft: null };

  if (plan.event_date) {
    const days = Math.ceil((new Date(plan.event_date + 'T00:00:00') - Date.now()) / 86_400_000);
    result.daysLeft = days;
    const weeks = days / 7;
    result.weeks = Math.max(0, Math.round(weeks * 10) / 10);
    if (weeks > 0 && toLose > 0) {
      result.perWeek = Math.round((toLose / weeks) * 100) / 100;
      const safeRate = plan.weight_unit === 'lb' ? 1.5 : 0.7; // sustainable weekly loss
      result.safe = result.perWeek <= safeRate;
    }
  }
  return result;
}

function progressFor(planId) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN focus <> 'Rest' THEN 1 ELSE 0 END) AS total,
         SUM(CASE WHEN focus <> 'Rest' AND completed = 1 THEN 1 ELSE 0 END) AS done
       FROM sessions WHERE plan_id = ?`
    )
    .get(planId);
  const total = row.total || 0;
  const done = row.done || 0;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

// --------------------------------------------------------------------- routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// List all plans (most recent first) with progress for the dashboard.
app.get('/api/plans', (_req, res) => {
  const plans = db.prepare('SELECT * FROM plans ORDER BY created_at DESC, id DESC').all();
  res.json(
    plans.map((p) => ({ ...p, progress: progressFor(p.id), weight: weightAnalysis(p) }))
  );
});

// Create a plan and generate its weekly schedule.
app.post('/api/plans', (req, res) => {
  const { errors, value } = validatePlanInput(req.body || {});
  if (errors.length) return res.status(400).json({ errors });

  try {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO plans
           (name, athlete_name, discipline, goal, experience, days_per_week,
            current_weight, target_weight, weight_unit, event_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        value.name, value.athlete_name, value.discipline, value.goal, value.experience,
        value.days_per_week, value.current_weight, value.target_weight, value.weight_unit, value.event_date
      );

    const planId = Number(lastInsertRowid);
    generatePlan(db, planId, value);
    res.status(201).json({ id: planId });
  } catch (err) {
    console.error('Failed to create plan:', err);
    res.status(500).json({ errors: ['Could not create plan. Please try again.'] });
  }
});

// Full plan detail: plan + sessions + exercises + computed metrics.
app.get('/api/plans/:id', (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(Number(req.params.id));
  if (!plan) return res.status(404).json({ errors: ['Plan not found.'] });

  const sessions = db
    .prepare('SELECT * FROM sessions WHERE plan_id = ? ORDER BY day_index').all(plan.id)
    .map((s) => ({
      ...s,
      completed: !!s.completed,
      exercises: db
        .prepare('SELECT id, name, detail FROM session_exercises WHERE session_id = ? ORDER BY position')
        .all(s.id),
    }));

  res.json({ ...plan, sessions, progress: progressFor(plan.id), weight: weightAnalysis(plan) });
});

// Toggle a session's completion, updating XP and streak on the parent plan.
app.post('/api/sessions/:id/toggle', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(Number(req.params.id));
  if (!session) return res.status(404).json({ errors: ['Session not found.'] });
  if (session.focus === 'Rest') return res.status(400).json({ errors: ['Rest days cannot be completed.'] });

  const nowCompleted = session.completed ? 0 : 1;
  db.prepare('UPDATE sessions SET completed = ? WHERE id = ?').run(nowCompleted, session.id);

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(session.plan_id);
  const progress = progressFor(plan.id);
  const xp = progress.done * 20; // 20 XP per completed session

  // Streak: bump when completing today, continuing from yesterday.
  let streak = plan.streak;
  let lastCompleted = plan.last_completed;
  if (nowCompleted) {
    const today = new Date().toISOString().slice(0, 10);
    if (lastCompleted === today) {
      // already trained today — streak unchanged
    } else {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      streak = lastCompleted === yesterday ? streak + 1 : 1;
      lastCompleted = today;
    }
  }

  db.prepare('UPDATE plans SET xp = ?, streak = ?, last_completed = ? WHERE id = ?')
    .run(xp, streak, lastCompleted, plan.id);

  res.json({ completed: !!nowCompleted, xp, streak, progress });
});

// Delete a plan (sessions + exercises cascade).
app.delete('/api/plans/:id', (req, res) => {
  const info = db.prepare('DELETE FROM plans WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ errors: ['Plan not found.'] });
  res.json({ ok: true });
});

app.use('/api', (_req, res) => res.status(404).json({ errors: ['Not found.'] }));

app.listen(PORT, () => {
  console.log(`COMBAT running at http://localhost:${PORT}`);
});

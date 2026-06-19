'use strict';

// COMBAT server — uses only Node.js built-ins (no third-party dependencies),
// so it starts with a single `npm start` and no install step.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./lib/db');
const { generatePlan } = require('./lib/planGenerator');
const coach = require('./lib/coach');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

// ------------------------------------------------------------------- helpers
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) { req.destroy(); reject(new Error('Body too large.')); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new SyntaxError('Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.join(PUBLIC_DIR, rel);

  // Block path traversal outside the public directory.
  if (path.relative(PUBLIC_DIR, filePath).startsWith('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 — Not Found</h1><p><a href="/">Back to COMBAT</a></p>');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

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
    else eventDate = String(body.event_date).slice(0, 10);
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

// ------------------------------------------------------------- API handlers
function listPlans(res) {
  const plans = db.prepare('SELECT * FROM plans ORDER BY created_at DESC, id DESC').all();
  sendJson(res, 200, plans.map((p) => ({ ...p, progress: progressFor(p.id), weight: weightAnalysis(p) })));
}

function createPlan(res, body) {
  const { errors, value } = validatePlanInput(body || {});
  if (errors.length) return sendJson(res, 400, { errors });
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
    sendJson(res, 201, { id: planId });
  } catch (err) {
    console.error('Failed to create plan:', err);
    sendJson(res, 500, { errors: ['Could not create plan. Please try again.'] });
  }
}

function getPlan(res, id) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  if (!plan) return sendJson(res, 404, { errors: ['Plan not found.'] });

  const sessions = db
    .prepare('SELECT * FROM sessions WHERE plan_id = ? ORDER BY day_index').all(plan.id)
    .map((s) => ({
      ...s,
      completed: !!s.completed,
      exercises: db
        .prepare('SELECT id, name, detail FROM session_exercises WHERE session_id = ? ORDER BY position')
        .all(s.id),
    }));

  sendJson(res, 200, { ...plan, sessions, progress: progressFor(plan.id), weight: weightAnalysis(plan) });
}

function toggleSession(res, id) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) return sendJson(res, 404, { errors: ['Session not found.'] });
  if (session.focus === 'Rest') return sendJson(res, 400, { errors: ['Rest days cannot be completed.'] });

  const nowCompleted = session.completed ? 0 : 1;
  db.prepare('UPDATE sessions SET completed = ? WHERE id = ?').run(nowCompleted, session.id);

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(session.plan_id);
  const progress = progressFor(plan.id);
  const xp = progress.done * 20; // 20 XP per completed session

  let streak = plan.streak;
  let lastCompleted = plan.last_completed;
  if (nowCompleted) {
    const today = new Date().toISOString().slice(0, 10);
    if (lastCompleted !== today) {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      streak = lastCompleted === yesterday ? streak + 1 : 1;
      lastCompleted = today;
    }
  }

  db.prepare('UPDATE plans SET xp = ?, streak = ?, last_completed = ? WHERE id = ?')
    .run(xp, streak, lastCompleted, plan.id);

  sendJson(res, 200, { completed: !!nowCompleted, xp, streak, progress });
}

function deletePlan(res, id) {
  const info = db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  if (info.changes === 0) return sendJson(res, 404, { errors: ['Plan not found.'] });
  sendJson(res, 200, { ok: true });
}

// --------------------------------------------------------------------- router
async function handleApi(req, res, pathname, method) {
  if (method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true });
  if (method === 'GET' && pathname === '/api/plans') return listPlans(res);
  if (method === 'POST' && pathname === '/api/plans') {
    let body;
    try { body = await readJsonBody(req); }
    catch { return sendJson(res, 400, { errors: ['Invalid request body.'] }); }
    return createPlan(res, body);
  }

  let m;
  if ((m = pathname.match(/^\/api\/plans\/(\d+)$/))) {
    if (method === 'GET') return getPlan(res, Number(m[1]));
    if (method === 'DELETE') return deletePlan(res, Number(m[1]));
  }
  if ((m = pathname.match(/^\/api\/sessions\/(\d+)\/toggle$/)) && method === 'POST') {
    return toggleSession(res, Number(m[1]));
  }
  if (method === 'POST' && pathname === '/api/coach') {
    let body;
    try { body = await readJsonBody(req); }
    catch { return sendJson(res, 400, { errors: ['Invalid request body.'] }); }
    return sendJson(res, 200, coach.respond({ message: body.message, sport: body.sport }));
  }
  return sendJson(res, 404, { errors: ['Not found.'] });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const method = req.method;

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, method).catch((err) => {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { errors: ['Server error.'] });
    });
    return;
  }

  if (method === 'GET' || method === 'HEAD') return serveStatic(req, res, pathname);

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`\n  🥊  COMBAT is running!\n  ➜  Open http://localhost:${PORT} in your browser\n`);
});

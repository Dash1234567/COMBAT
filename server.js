'use strict';

// COMBAT server — uses only Node.js built-ins (no third-party dependencies),
// so it starts with a single `npm start` and no install step.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./lib/db');
const { generatePlan, periodize, locateDate, PHASE_META, PHASE_ORDER } = require('./lib/planGenerator');
const coach = require('./lib/coach');
const auth = require('./lib/auth');
const { createLimiter } = require('./lib/rateLimit');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // bind all interfaces so it's reachable via a shared link
const PUBLIC_DIR = path.join(__dirname, 'public');

const COOKIE_NAME = 'combat_session';
const SESSION_DAYS = 30;
const COOKIE_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

// Brute-force protection: block after repeated failed logins per IP+username,
// and cap account creation per IP.
const loginLimiter = createLimiter({ max: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 });
const registerLimiter = createLimiter({ max: 10, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });

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
function sendJson(res, status, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...(headers || {}) });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) { req.destroy(); reject(new Error('Body too large.')); } // ~2MB (avatars)
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new SyntaxError('Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

async function getBody(req, res) {
  try { return await readJsonBody(req); }
  catch { sendJson(res, 400, { errors: ['Invalid request body.'] }); return null; }
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.join(PUBLIC_DIR, rel);

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

// --------------------------------------------------------------------- auth
// Mark cookies Secure when the request reached us over HTTPS (directly or via
// a proxy such as Codespaces), while still working over plain HTTP locally.
function isSecureRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function sessionCookie(token, secure) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure ? '; Secure' : ''}`;
}
function clearCookie(secure) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

function currentUser(req) {
  const token = auth.parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  if (!token) return null;
  return db
    .prepare(
      `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) || null;
}

function serializeUser(u) {
  return { id: u.id, username: u.username, nickname: u.nickname || u.username, avatar: u.avatar || null, created_at: u.created_at };
}

function startSession(res, user, status, secure) {
  const token = auth.newToken();
  db.prepare(`INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`)
    .run(token, user.id);
  sendJson(res, status, { user: serializeUser(user) }, { 'Set-Cookie': sessionCookie(token, secure) });
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const AVATAR_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
const MAX_AVATAR_CHARS = 900_000; // ~650KB image

function cleanNickname(n) {
  return String(n == null ? '' : n).trim().slice(0, 30);
}

function register(res, body, req, secure) {
  const ip = clientIp(req);
  const wait = registerLimiter.retryAfter(ip);
  if (wait > 0) return sendJson(res, 429, { errors: ['Too many sign-up attempts. Please try again later.'] }, { 'Retry-After': String(wait) });
  registerLimiter.strike(ip);

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const errors = [];
  if (!USERNAME_RE.test(username)) errors.push('Username must be 3–20 letters, numbers or underscores.');
  if (password.length < 6) errors.push('Password must be at least 6 characters.');
  if (password.length > 200) errors.push('Password is too long.');
  if (errors.length) return sendJson(res, 400, { errors });

  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (existing) return sendJson(res, 409, { errors: ['That username is already taken.'] });

  const nickname = cleanNickname(body.nickname) || username;
  const { salt, hash } = auth.hashPassword(password);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password_hash, password_salt, nickname) VALUES (?, ?, ?, ?)')
    .run(username, hash, salt, nickname);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(lastInsertRowid));
  startSession(res, user, 201, secure);
}

function login(res, body, req, secure) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const key = `${clientIp(req)}:${username.toLowerCase()}`;

  const wait = loginLimiter.retryAfter(key);
  if (wait > 0) {
    const mins = Math.max(1, Math.ceil(wait / 60));
    return sendJson(res, 429, { errors: [`Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`] }, { 'Retry-After': String(wait) });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (!user || !auth.verifyPassword(password, user.password_salt, user.password_hash)) {
    loginLimiter.strike(key);
    return sendJson(res, 401, { errors: ['Incorrect username or password.'] });
  }
  loginLimiter.reset(key);
  startSession(res, user, 200, secure);
}

function logout(res, req, secure) {
  const token = auth.parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  if (token) db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookie(secure) });
}

function updateProfile(res, user, body) {
  if (!user) return sendJson(res, 401, { errors: ['Please log in.'] });
  const fields = [];
  const values = [];

  if (body.nickname !== undefined) {
    fields.push('nickname = ?');
    values.push(cleanNickname(body.nickname) || user.username);
  }
  if ('avatar' in body) {
    if (body.avatar === null || body.avatar === '') {
      fields.push('avatar = ?');
      values.push(null);
    } else if (typeof body.avatar === 'string' && body.avatar.length <= MAX_AVATAR_CHARS && AVATAR_RE.test(body.avatar)) {
      fields.push('avatar = ?');
      values.push(body.avatar);
    } else {
      return sendJson(res, 400, { errors: ['Photo must be a PNG, JPG, WebP or GIF under ~650KB.'] });
    }
  }
  if (!fields.length) return sendJson(res, 400, { errors: ['Nothing to update.'] });

  values.push(user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  sendJson(res, 200, { user: serializeUser(updated) });
}

// ------------------------------------------------------------- plan helpers
const DISCIPLINES = ['boxing', 'mma', 'bjj', 'muay_thai', 'wrestling', 'kickboxing', 'karate'];
const GOALS = ['conditioning', 'strength', 'dieting', 'weight_cutting'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
const UNITS = ['kg', 'lb'];

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
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
  if (Number.isNaN(current) || (current !== null && (current <= 0 || current > 600))) errors.push('Current weight looks invalid.');
  if (Number.isNaN(target) || (target !== null && (target <= 0 || target > 600))) errors.push('Target weight looks invalid.');

  let eventDate = null;
  if (body.event_date) {
    const d = new Date(body.event_date);
    if (Number.isNaN(d.getTime())) errors.push('Event date is invalid.');
    else eventDate = String(body.event_date).slice(0, 10);
  }

  let startDate = new Date().toISOString().slice(0, 10);
  if (body.start_date) {
    const d = new Date(body.start_date);
    if (Number.isNaN(d.getTime())) errors.push('Start date is invalid.');
    else startDate = String(body.start_date).slice(0, 10);
  }
  if (eventDate && eventDate < startDate) errors.push('Event date must be after the start date.');

  return {
    errors,
    value: {
      name, athlete_name: athlete || null, discipline: body.discipline, goal: body.goal,
      experience: body.experience, days_per_week: days, current_weight: current,
      target_weight: target, weight_unit: unit, event_date: eventDate, start_date: startDate,
    },
  };
}

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
      const safeRate = plan.weight_unit === 'lb' ? 1.5 : 0.7;
      result.safe = result.perWeek <= safeRate;
    }
  }
  return result;
}

function progressFor(planId) {
  const row = db
    .prepare(
      `SELECT SUM(CASE WHEN focus <> 'Rest' THEN 1 ELSE 0 END) AS total,
              SUM(CASE WHEN focus <> 'Rest' AND completed = 1 THEN 1 ELSE 0 END) AS done
         FROM sessions WHERE plan_id = ?`
    )
    .get(planId);
  const total = row.total || 0;
  const done = row.done || 0;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

// A guest plan (user_id NULL) is public; an owned plan is private to its owner.
function canAccessPlan(plan, userId) {
  return plan.user_id == null || plan.user_id === userId;
}

// ------------------------------------------------------------- plan routes
function listPlans(res, userId) {
  const plans = userId
    ? db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(userId)
    : db.prepare('SELECT * FROM plans WHERE user_id IS NULL ORDER BY created_at DESC, id DESC').all();
  sendJson(res, 200, plans.map((p) => ({ ...p, progress: progressFor(p.id), weight: weightAnalysis(p) })));
}

function createPlan(res, body, userId) {
  const { errors, value } = validatePlanInput(body || {});
  if (errors.length) return sendJson(res, 400, { errors });
  try {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO plans
           (user_id, name, athlete_name, discipline, goal, experience, days_per_week,
            current_weight, target_weight, weight_unit, event_date, start_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId, value.name, value.athlete_name, value.discipline, value.goal, value.experience,
        value.days_per_week, value.current_weight, value.target_weight, value.weight_unit,
        value.event_date, value.start_date
      );
    const planId = Number(lastInsertRowid);
    generatePlan(db, planId, value);
    sendJson(res, 201, { id: planId });
  } catch (err) {
    console.error('Failed to create plan:', err);
    sendJson(res, 500, { errors: ['Could not create plan. Please try again.'] });
  }
}

function getPlan(res, id, userId) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  if (!plan || !canAccessPlan(plan, userId)) return sendJson(res, 404, { errors: ['Plan not found.'] });

  const sessions = db
    .prepare('SELECT * FROM sessions WHERE plan_id = ? ORDER BY phase, day_index').all(plan.id)
    .map((s) => ({
      ...s,
      completed: !!s.completed,
      exercises: db.prepare('SELECT id, name, detail FROM session_exercises WHERE session_id = ? ORDER BY position').all(s.id),
    }));

  // Calendar: phase date ranges. Fall back to a single off-season block for
  // plans created before periodization existed.
  let segments = db.prepare('SELECT phase, week_start, weeks, start_date, end_date FROM plan_phases WHERE plan_id = ? ORDER BY week_start').all(plan.id);
  if (!segments.length) segments = periodize(plan.start_date, null).segments;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const timeline = {
    week_start: first.start_date,
    week_end: last.end_date,
    total_weeks: segments.reduce((a, s) => a + s.weeks, 0),
    segments,
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  const today = locateDate(timeline, todayISO);
  if (today) {
    const s = sessions.find((x) => x.phase === today.phase && x.day_index === today.day_index);
    today.session = s ? { title: s.title, focus: s.focus, day_label: s.day_label } : null;
  }

  const fallbackMeta = (p) => ({ phase: p, label: p, emoji: '•', color: 'blue', training: '', recovery: '', nutrition: '' });
  const phases = segments.map((s) => ({
    ...(PHASE_META[s.phase] || fallbackMeta(s.phase)),
    week_start: s.week_start, weeks: s.weeks, start_date: s.start_date, end_date: s.end_date,
    is_current: today ? today.phase === s.phase : false,
  }));

  const events = db.prepare("SELECT id, date, time, type, title FROM events WHERE plan_id = ? ORDER BY date, COALESCE(time, '')").all(plan.id);

  sendJson(res, 200, { ...plan, sessions, phases, timeline, today, events, progress: progressFor(plan.id), weight: weightAnalysis(plan) });
}

function toggleSession(res, id, userId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) return sendJson(res, 404, { errors: ['Session not found.'] });
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(session.plan_id);
  if (!plan || !canAccessPlan(plan, userId)) return sendJson(res, 404, { errors: ['Session not found.'] });
  if (session.focus === 'Rest') return sendJson(res, 400, { errors: ['Rest days cannot be completed.'] });

  const nowCompleted = session.completed ? 0 : 1;
  db.prepare('UPDATE sessions SET completed = ? WHERE id = ?').run(nowCompleted, session.id);

  const progress = progressFor(plan.id);
  const xp = progress.done * 20;

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

  db.prepare('UPDATE plans SET xp = ?, streak = ?, last_completed = ? WHERE id = ?').run(xp, streak, lastCompleted, plan.id);
  sendJson(res, 200, { completed: !!nowCompleted, xp, streak, progress });
}

function deletePlan(res, id, userId) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  if (!plan || !canAccessPlan(plan, userId)) return sendJson(res, 404, { errors: ['Plan not found.'] });
  db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
}

// ------------------------------------------------------------- events / calendar
const EVENT_TYPES = ['dual', 'tournament', 'states', 'regionals', 'nationals', 'sparring', 'other'];

function validateEvent(body) {
  const errors = [];
  const date = String(body.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T00:00:00Z').getTime())) errors.push('A valid date is required.');
  const type = EVENT_TYPES.includes(body.type) ? body.type : null;
  if (!type) errors.push('Pick a valid event type.');
  let time = null;
  if (body.time) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) time = body.time;
    else errors.push('Time must be in HH:MM format.');
  }
  const title = String(body.title || '').trim().slice(0, 60) || null;
  return { errors, value: { date, type, time, title } };
}

// Rebuild a plan's periodized schedule (deletes the old one) targeting an event.
function regeneratePlan(plan, eventDate) {
  db.prepare('DELETE FROM plan_phases WHERE plan_id = ?').run(plan.id);
  db.prepare('DELETE FROM sessions WHERE plan_id = ?').run(plan.id); // cascades exercises
  db.prepare('UPDATE plans SET event_date = ?, xp = 0 WHERE id = ?').run(eventDate, plan.id);
  generatePlan(db, plan.id, {
    discipline: plan.discipline, goal: plan.goal, experience: plan.experience,
    days_per_week: plan.days_per_week, start_date: plan.start_date, event_date: eventDate,
  });
}

// Periodization targets the soonest upcoming event (or none if all are past).
function syncSchedule(plan) {
  const today = new Date().toISOString().slice(0, 10);
  const next = db.prepare('SELECT date FROM events WHERE plan_id = ? AND date >= ? ORDER BY date ASC LIMIT 1').get(plan.id, today);
  regeneratePlan(plan, next ? next.date : null);
}

function addEvent(res, planId, body, userId) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan || !canAccessPlan(plan, userId)) return sendJson(res, 404, { errors: ['Plan not found.'] });
  const { errors, value } = validateEvent(body || {});
  if (errors.length) return sendJson(res, 400, { errors });
  const { lastInsertRowid } = db
    .prepare('INSERT INTO events (plan_id, date, time, type, title) VALUES (?, ?, ?, ?, ?)')
    .run(planId, value.date, value.time, value.type, value.title);
  try { syncSchedule(plan); } catch (err) { console.error('Failed to regenerate plan:', err); }
  sendJson(res, 201, { id: Number(lastInsertRowid) });
}

function deleteEvent(res, eventId, userId) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!ev) return sendJson(res, 404, { errors: ['Event not found.'] });
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(ev.plan_id);
  if (!plan || !canAccessPlan(plan, userId)) return sendJson(res, 404, { errors: ['Event not found.'] });
  db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
  try { syncSchedule(plan); } catch (err) { console.error('Failed to regenerate plan:', err); }
  sendJson(res, 200, { ok: true });
}

// --------------------------------------------------------------------- router
async function handleApi(req, res, pathname, method) {
  const user = currentUser(req);
  const userId = user ? user.id : null;
  const secure = isSecureRequest(req);

  if (method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true });

  // Accounts
  if (pathname === '/api/auth/register' && method === 'POST') { const b = await getBody(req, res); if (b === null) return; return register(res, b, req, secure); }
  if (pathname === '/api/auth/login' && method === 'POST') { const b = await getBody(req, res); if (b === null) return; return login(res, b, req, secure); }
  if (pathname === '/api/auth/logout' && method === 'POST') return logout(res, req, secure);
  if (pathname === '/api/auth/me' && method === 'GET') return sendJson(res, 200, { user: user ? serializeUser(user) : null });
  if (pathname === '/api/profile' && method === 'POST') { const b = await getBody(req, res); if (b === null) return; return updateProfile(res, user, b); }

  // Plans
  if (method === 'GET' && pathname === '/api/plans') return listPlans(res, userId);
  if (method === 'POST' && pathname === '/api/plans') { const b = await getBody(req, res); if (b === null) return; return createPlan(res, b, userId); }

  let m;
  if ((m = pathname.match(/^\/api\/plans\/(\d+)$/))) {
    if (method === 'GET') return getPlan(res, Number(m[1]), userId);
    if (method === 'DELETE') return deletePlan(res, Number(m[1]), userId);
  }
  if ((m = pathname.match(/^\/api\/sessions\/(\d+)\/toggle$/)) && method === 'POST') return toggleSession(res, Number(m[1]), userId);

  // Calendar events
  if ((m = pathname.match(/^\/api\/plans\/(\d+)\/events$/)) && method === 'POST') { const b = await getBody(req, res); if (b === null) return; return addEvent(res, Number(m[1]), b, userId); }
  if ((m = pathname.match(/^\/api\/events\/(\d+)$/)) && method === 'DELETE') return deleteEvent(res, Number(m[1]), userId);

  // Coach
  if (method === 'POST' && pathname === '/api/coach') { const b = await getBody(req, res); if (b === null) return; return sendJson(res, 200, coach.respond({ message: b.message, sport: b.sport })); }

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

server.listen(PORT, HOST, () => {
  console.log(`\n  🥊  COMBAT is running!\n  ➜  Local:   http://localhost:${PORT}\n  ➜  Network: http://<your-host>:${PORT}  (share this when the port is public)\n`);
});

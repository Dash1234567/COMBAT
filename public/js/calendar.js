// Calendar view — month grid coloured by training phase, with a day modal for
// adding events. Adding an event makes the AI populate the periodized workouts.
import { api, escapeHtml, toast, disciplineMeta, goalMeta, FOCUS_META } from './app.js';

const root = document.querySelector('#calRoot');
const planId = new URLSearchParams(location.search).get('id');

const TYPE_META = {
  dual: { label: 'Dual Meet', emoji: '🤼' },
  tournament: { label: 'Tournament', emoji: '🏆' },
  states: { label: 'States', emoji: '🥇' },
  regionals: { label: 'Regionals', emoji: '🎖️' },
  nationals: { label: 'Nationals', emoji: '🏅' },
  sparring: { label: 'Sparring', emoji: '🥊' },
  other: { label: 'Other', emoji: '📌' },
};
const PHASE_COLOR = { green: 'var(--green)', blue: 'var(--blue)', red: 'var(--red)', orange: 'var(--orange)' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let plan = null;
let phaseMap = {};
let viewY, viewM;            // month being viewed
let selectedDate = null;     // ISO date of the open modal
const todayISO = new Date().toISOString().slice(0, 10);

// ----------------------------------------------------------- date utilities
const toUTC = (iso) => new Date(iso + 'T00:00:00Z');
const isoOf = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const mondayOf = (d) => addDays(d, -((d.getUTCDay() + 6) % 7));
const weekdayIndex = (iso) => (toUTC(iso).getUTCDay() + 6) % 7;
const weeksBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / (7 * 86400000));
const longDate = (iso) => toUTC(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

// Which phase + session falls on a given date (computed from the plan timeline).
function workoutForDate(iso) {
  const tl = plan.timeline;
  if (!tl || !tl.segments.length || iso < tl.week_start || iso > tl.week_end) return null;
  const wk = weeksBetween(tl.week_start, isoOf(mondayOf(toUTC(iso))));
  const seg = tl.segments.find((s) => wk >= s.week_start && wk < s.week_start + s.weeks);
  if (!seg) return null;
  const session = plan.sessions.find((s) => s.phase === seg.phase && s.day_index === weekdayIndex(iso)) || null;
  return { phase: seg.phase, session };
}

const eventsOn = (iso) => plan.events.filter((e) => e.date === iso);

// ------------------------------------------------------------- rendering
function legendHtml() {
  return `<div class="cal-legend">${plan.phases.map((ph) =>
    `<span class="cal-legend__item"><span class="cal-legend__dot" style="background:${PHASE_COLOR[ph.color] || 'var(--blue)'}"></span>${ph.emoji} ${escapeHtml(ph.label)}</span>`).join('')}
    <span class="cal-legend__item muted">Tap a day to add an event</span></div>`;
}

function gridHtml() {
  const firstOfMonth = new Date(Date.UTC(viewY, viewM, 1));
  const start = mondayOf(firstOfMonth);
  const end = addDays(mondayOf(new Date(Date.UTC(viewY, viewM + 1, 0))), 6);
  let cells = '';
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const iso = isoOf(d);
    const inMonth = d.getUTCMonth() === viewM;
    const wk = workoutForDate(iso);
    const evs = eventsOn(iso);
    const trains = wk && wk.session && wk.session.focus !== 'Rest';
    const color = wk ? (PHASE_COLOR[(phaseMap[wk.phase] || {}).color] || 'var(--blue)') : '';
    cells += `
      <button class="cal-cell ${inMonth ? '' : 'cal-cell--out'} ${iso === todayISO ? 'cal-cell--today' : ''} ${wk ? 'has-phase' : ''}"
              data-date="${iso}" ${wk ? `style="--c:${color}"` : ''}>
        <span class="cal-cell__num">${d.getUTCDate()}</span>
        <span class="cal-cell__marks">
          ${trains ? `<span class="cal-dot" title="${escapeHtml(wk.session.focus)}"></span>` : ''}
          ${evs.length ? `<span class="cal-ev">${(TYPE_META[evs[0].type] || TYPE_META.other).emoji}${evs.length > 1 ? '·' + evs.length : ''}</span>` : ''}
        </span>
      </button>`;
  }
  return `<div class="cal-weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
          <div class="cal-grid">${cells}</div>`;
}

function render() {
  const d = disciplineMeta(plan.discipline);
  const g = goalMeta(plan.goal);
  const monthName = new Date(Date.UTC(viewY, viewM, 1)).toLocaleString(undefined, { month: 'long', timeZone: 'UTC' });
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1 style="font-size:clamp(24px,4vw,32px);font-weight:900">📅 ${escapeHtml(plan.name)}</h1>
        <p class="muted" style="font-weight:800">${d.emoji} ${escapeHtml(d.label)} · ${g.emoji} ${escapeHtml(g.label)}</p>
      </div>
      <a class="btn btn--ghost btn--sm" href="/plan.html?id=${plan.id}">Program details</a>
    </div>
    <div class="cal-controls">
      <button class="btn btn--ghost btn--sm" data-nav="-1" aria-label="Previous month">‹</button>
      <div class="cal-month">${monthName} ${viewY}</div>
      <button class="btn btn--ghost btn--sm" data-nav="1" aria-label="Next month">›</button>
      <button class="btn btn--ghost btn--sm" data-nav="today">Today</button>
    </div>
    ${legendHtml()}
    ${gridHtml()}
  `;
}

// --------------------------------------------------------------- day modal
function ensureModal() {
  let m = document.querySelector('#dayModal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'dayModal';
  m.className = 'modal-backdrop';
  m.hidden = true;
  m.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalDate">
      <div class="modal__head">
        <div><div class="modal__date" id="modalDate"></div><div class="modal__phase" id="modalPhase"></div></div>
        <div class="modal__actions">
          <button class="iconbtn" id="addEventBtn" title="Add event" aria-label="Add event">+</button>
          <button class="iconbtn" id="closeModal" title="Close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="modal__body" id="modalBody"></div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
  m.querySelector('#closeModal').addEventListener('click', closeModal);
  m.querySelector('#addEventBtn').addEventListener('click', () => { m.querySelector('#modalBody').innerHTML = addFormHtml(); wireForm(); });
  return m;
}

function agendaHtml(iso) {
  const evs = eventsOn(iso);
  const wk = workoutForDate(iso);
  const evHtml = evs.length
    ? evs.map((e) => {
        const t = TYPE_META[e.type] || TYPE_META.other;
        return `<div class="agenda-item event">
          <div class="agenda-item__main">
            <span class="agenda-item__icon">${t.emoji}</span>
            <div>
              <div class="agenda-item__title">${escapeHtml(e.title || t.label)}</div>
              <div class="agenda-item__sub">${e.time ? escapeHtml(e.time) + ' · ' : ''}${escapeHtml(t.label)}</div>
            </div>
          </div>
          <button class="iconbtn iconbtn--sm" data-del-event="${e.id}" title="Remove">🗑️</button>
        </div>`;
      }).join('')
    : '';

  let workoutHtml;
  if (!wk) {
    workoutHtml = `<div class="agenda-empty">No workout scheduled — this day is outside your current plan. Add an event to extend it.</div>`;
  } else if (!wk.session || wk.session.focus === 'Rest') {
    workoutHtml = `<div class="agenda-item rest"><div class="agenda-item__main"><span class="agenda-item__icon">😴</span><div><div class="agenda-item__title">Rest &amp; recover</div><div class="agenda-item__sub">Active recovery only</div></div></div></div>`;
  } else {
    const s = wk.session;
    const ex = s.exercises.map((e) => `<li class="ex"><span>${escapeHtml(e.name)}</span><span class="detail">${escapeHtml(e.detail)}</span></li>`).join('');
    workoutHtml = `
      <div class="agenda-item workout">
        <div class="agenda-item__main"><span class="agenda-item__icon">${(FOCUS_META[s.focus] || {}).emoji || '🏋️'}</span>
          <div><div class="agenda-item__title">${escapeHtml(s.title)}</div><div class="agenda-item__sub">${escapeHtml(s.focus)}</div></div></div>
        <ul class="exlist">${ex}</ul>
      </div>`;
  }
  return `
    ${evs.length ? `<h4 class="agenda-h">Events</h4>${evHtml}` : ''}
    <h4 class="agenda-h">Training</h4>
    ${workoutHtml}`;
}

function addFormHtml() {
  const opts = Object.entries(TYPE_META).map(([id, t]) => `<option value="${id}">${t.emoji} ${t.label}</option>`).join('');
  return `
    <form id="eventForm" class="event-form">
      <h4 class="agenda-h">Add an event</h4>
      <div class="field"><label for="evType">Type</label><select class="select" id="evType">${opts}</select></div>
      <div class="input-row">
        <div class="field"><label for="evTime">Time <span class="muted">(optional)</span></label><input class="input" id="evTime" type="time" /></div>
      </div>
      <div class="field"><label for="evTitle">Title <span class="muted">(optional)</span></label><input class="input" id="evTitle" maxlength="60" placeholder="e.g. State Qualifier" /></div>
      <p class="hint">COMBAT will rebuild your calendar's off-season → pre-season → fight-camp workouts around your soonest event.</p>
      <p class="form-error" id="evError" role="alert"></p>
      <div class="wizard__footer">
        <button type="button" class="btn btn--ghost" id="cancelEvent">Cancel</button>
        <button type="submit" class="btn btn--green" id="saveEvent">Add event</button>
      </div>
    </form>`;
}

function wireForm() {
  document.querySelector('#cancelEvent').addEventListener('click', () => openDay(selectedDate));
  document.querySelector('#eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.querySelector('#saveEvent');
    const errEl = document.querySelector('#evError');
    errEl.textContent = '';
    const payload = { date: selectedDate, type: document.querySelector('#evType').value, time: document.querySelector('#evTime').value || null, title: document.querySelector('#evTitle').value.trim() || null };
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await api(`/api/plans/${plan.id}/events`, { method: 'POST', body: JSON.stringify(payload) });
      await reload();
      toast('Event added — calendar updated! 🗓️', 'success');
      openDay(selectedDate);
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false; btn.textContent = 'Add event';
    }
  });
}

function openDay(iso) {
  selectedDate = iso;
  const m = ensureModal();
  const wk = workoutForDate(iso);
  const ph = wk ? phaseMap[wk.phase] : null;
  m.querySelector('#modalDate').textContent = longDate(iso);
  m.querySelector('#modalPhase').innerHTML = ph ? `${ph.emoji} ${escapeHtml(ph.label)}` : '<span class="muted">Not in plan range</span>';
  m.querySelector('#modalBody').innerHTML = agendaHtml(iso);
  m.querySelector('#modalBody').querySelectorAll('[data-del-event]').forEach((b) =>
    b.addEventListener('click', () => removeEvent(b.dataset.delEvent)));
  m.hidden = false;
}

function closeModal() { const m = document.querySelector('#dayModal'); if (m) m.hidden = true; selectedDate = null; }

async function removeEvent(id) {
  if (!confirm('Remove this event?')) return;
  try {
    await api(`/api/events/${id}`, { method: 'DELETE' });
    await reload();
    toast('Event removed.', 'success');
    if (selectedDate) openDay(selectedDate);
  } catch (err) { toast(err.message, 'error'); }
}

// --------------------------------------------------------------- events
root.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    const v = nav.dataset.nav;
    if (v === 'today') { viewY = new Date().getFullYear(); viewM = new Date().getMonth(); }
    else { viewM += Number(v); if (viewM < 0) { viewM = 11; viewY--; } else if (viewM > 11) { viewM = 0; viewY++; } }
    render();
    return;
  }
  const cell = e.target.closest('.cal-cell');
  if (cell) openDay(cell.dataset.date);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// --------------------------------------------------------------- load
async function reload() {
  plan = await api(`/api/plans/${planId}`);
  phaseMap = Object.fromEntries(plan.phases.map((p) => [p.phase, p]));
  render();
}

async function load() {
  if (!planId) {
    root.innerHTML = `<div class="empty"><div class="empty__emoji">🤔</div><h2>No plan selected</h2><p>Pick a plan to see its calendar.</p><a class="btn btn--red" href="/plans.html">My Plans</a></div>`;
    return;
  }
  try {
    await reload();
    const now = new Date();
    viewY = now.getFullYear();
    viewM = now.getMonth();
    render();
    openDay(todayISO); // land on today, "the day of the year"
  } catch (err) {
    root.innerHTML = `<div class="empty"><div class="empty__emoji">⚠️</div><h2>Calendar unavailable</h2><p>${escapeHtml(err.message)}</p><a class="btn btn--red" href="/plans.html">My Plans</a></div>`;
  }
}

load();

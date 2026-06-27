// Plan detail — periodized calendar, phase programming, and tracking.
import {
  api, toast, escapeHtml, formatDate,
  disciplineMeta, goalMeta, experienceMeta, FOCUS_META,
} from './app.js';

const root = document.querySelector('#planRoot');
const planId = new URLSearchParams(location.search).get('id');
let plan = null;
let selectedPhase = null;

const PHASE_COLOR = { green: 'var(--green)', blue: 'var(--blue)', red: 'var(--red)', orange: 'var(--orange)' };

function monthDay(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ------------------------------------------------------------- HTML builders
function completeBtnHtml(s) {
  if (s.focus === 'Rest') return '';
  return s.completed
    ? `<button class="btn btn--ghost btn--sm" data-session="${s.id}">Completed ✓</button>`
    : `<button class="btn btn--green btn--sm" data-session="${s.id}">Mark complete</button>`;
}

function dayCardHtml(s) {
  const meta = FOCUS_META[s.focus] || FOCUS_META.Rest;
  if (s.focus === 'Rest') {
    return `
      <div class="day-card rest" data-session="${s.id}">
        <div class="day-card__head">
          <div class="day-card__day"><span class="d">${s.day_label}</span>
            <span class="fc ${meta.cls}">${meta.emoji} Rest</span></div>
        </div>
        <p class="rest-note">😴 Active recovery only — light walk, stretch, or mobility. Rest is where you grow.</p>
      </div>`;
  }
  const exercises = s.exercises
    .map((e) => `<li class="ex"><span>${escapeHtml(e.name)}</span><span class="detail">${escapeHtml(e.detail)}</span></li>`).join('');
  return `
    <div class="day-card ${s.completed ? 'done' : ''}" data-session="${s.id}">
      <div class="day-card__head">
        <div class="day-card__day"><span class="d">${s.day_label}</span>
          <span class="fc ${meta.cls}">${meta.emoji} ${escapeHtml(s.focus)}</span></div>
        ${completeBtnHtml(s)}
      </div>
      <div class="day-card__title">${escapeHtml(s.title)}</div>
      <ul class="exlist">${exercises}</ul>
    </div>`;
}

function weightCardHtml(p) {
  const w = p.weight;
  let badge, note;
  if (w.toLose <= 0) {
    badge = '<span class="badge badge--safe">At target ✓</span>';
    note = "You're at or below your target — shift focus to performance.";
  } else if (w.weeks == null) {
    badge = '<span class="badge badge--warn">No date set</span>';
    note = `You have <strong>${w.toLose} ${w.unit}</strong> to lose. Add an event date for safe pacing.`;
  } else if (w.perWeek == null) {
    badge = '<span class="badge badge--danger">Date passed</span>';
    note = w.daysLeft < 0 ? 'Your event date has passed.' : 'Your event is today — good luck! 🍀';
  } else if (w.safe) {
    badge = '<span class="badge badge--safe">Safe pace ✓</span>';
    note = `Losing about <strong>${w.perWeek} ${w.unit}/week</strong> is a sustainable cut.`;
  } else {
    badge = '<span class="badge badge--danger">Aggressive ⚠️</span>';
    note = `This needs about <strong>${w.perWeek} ${w.unit}/week</strong> — faster than recommended. Consult your coach.`;
  }
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h3 style="font-size:20px">⚖️ Weight cut</h3>${badge}
      </div>
      <div class="weight-scale"><span>${p.current_weight} ${w.unit}</span><span class="to">→</span><span>${p.target_weight} ${w.unit}</span></div>
      ${w.weeks != null && w.daysLeft >= 0 ? `<p class="muted" style="font-weight:800;margin-top:4px">${w.daysLeft} days · ${w.weeks} weeks to go</p>` : ''}
      <p style="margin-top:10px">${note}</p>
    </div>`;
}

function timelineHtml(p) {
  return `<div class="timeline">${p.phases.map((ph) => `
    <div class="timeline__block ${ph.is_current ? 'is-current' : ''}" style="flex:${ph.weeks};--c:${PHASE_COLOR[ph.color] || 'var(--blue)'}">
      <div class="timeline__label">${ph.emoji} ${escapeHtml(ph.label)}</div>
      <div class="timeline__meta">${ph.weeks} wk · ${monthDay(ph.start_date)} – ${monthDay(ph.end_date)}</div>
    </div>`).join('')}</div>`;
}

function todayCardHtml(p) {
  if (!p.today) {
    return `<div class="today-card"><div class="today-card__date">Calendar</div>
      <div class="today-card__session muted">This plan runs ${monthDay(p.timeline.week_start)} – ${monthDay(p.timeline.week_end)} (${p.timeline.total_weeks} weeks).</div></div>`;
  }
  const t = p.today;
  const ph = p.phases.find((x) => x.phase === t.phase) || {};
  const s = t.session;
  const line = s
    ? (s.focus === 'Rest' ? '😴 Rest &amp; recover' : `${(FOCUS_META[s.focus] || {}).emoji || ''} ${escapeHtml(s.title)} — ${escapeHtml(s.day_label)}`)
    : 'Rest day';
  return `
    <div class="today-card" style="--c:${PHASE_COLOR[ph.color] || 'var(--blue)'}">
      <div class="today-card__date">Today · ${formatDate(t.date)}</div>
      <div class="today-card__phase">${ph.emoji || ''} ${escapeHtml(ph.label || '')} · Week ${t.week_of_plan + 1} of ${p.timeline.total_weeks}</div>
      <div class="today-card__session">${line}</div>
    </div>`;
}

function phaseDetailHtml(p, phaseKey) {
  const ph = p.phases.find((x) => x.phase === phaseKey) || p.phases[0];
  const week = p.sessions.filter((s) => s.phase === ph.phase).sort((a, b) => a.day_index - b.day_index);
  return `
    <div class="phase-tabs">${p.phases.map((x) => `
      <button class="phase-tab ${x.phase === ph.phase ? 'active' : ''}" data-phase="${x.phase}" style="--c:${PHASE_COLOR[x.color] || 'var(--blue)'}">${x.emoji} ${escapeHtml(x.label)}</button>`).join('')}</div>
    <p class="muted" style="font-weight:800;margin-top:12px">Weeks ${ph.week_start + 1}–${ph.week_start + ph.weeks} · ${monthDay(ph.start_date)} – ${monthDay(ph.end_date)}</p>
    <div class="phase-info">
      <div class="phase-info__card"><h4>🏋️ Training</h4><p>${escapeHtml(ph.training)}</p></div>
      <div class="phase-info__card"><h4>🛌 Recovery</h4><p>${escapeHtml(ph.recovery)}</p></div>
      <div class="phase-info__card"><h4>🥗 Nutrition</h4><p>${escapeHtml(ph.nutrition)}</p></div>
    </div>
    <div class="week">${week.map(dayCardHtml).join('')}</div>`;
}

function render() {
  const p = plan;
  const d = disciplineMeta(p.discipline);
  const g = goalMeta(p.goal);
  const x = experienceMeta(p.experience);
  const pr = p.progress;

  root.innerHTML = `
    <div class="page-head">
      <div class="plan-head accent-${p.goal}">
        <div class="plan-head__emoji" aria-hidden="true">${d.emoji}</div>
        <div class="plan-head__info">
          <h1>${escapeHtml(p.name)}</h1>
          ${p.athlete_name ? `<p class="muted" style="font-weight:800">for ${escapeHtml(p.athlete_name)}</p>` : ''}
          <div class="plan-head__chips">
            <span class="chip">${d.emoji} ${escapeHtml(d.label)}</span>
            <span class="chip">${g.emoji} ${escapeHtml(g.label)}</span>
            <span class="chip">${x.emoji} ${escapeHtml(x.label)}</span>
            <span class="chip">📅 ${p.days_per_week} days/week</span>
            ${p.event_date ? `<span class="chip">🎯 Event ${escapeHtml(formatDate(p.event_date))}</span>` : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn--ghost btn--sm" href="/calendar.html?id=${p.id}">📅 Calendar</a>
        <button class="btn btn--ghost btn--sm" data-action="delete">🗑️ Delete</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat__num" id="statStreak" style="color:var(--orange)">${p.streak}</div><div class="stat__label">🔥 Day streak</div></div>
      <div class="stat"><div class="stat__num" id="statXp" style="color:var(--blue)">${p.xp}</div><div class="stat__label">XP earned</div></div>
      <div class="stat"><div class="stat__num" id="statProgress" style="color:var(--green)">${pr.percent}%</div><div class="stat__label">Complete</div></div>
      <div class="stat"><div class="stat__num" id="statSessions">${pr.done}/${pr.total}</div><div class="stat__label">Sessions</div></div>
    </div>
    <div class="bar" style="margin-top:16px"><div class="bar__fill" style="width:${pr.percent}%"></div></div>

    ${p.weight ? `<div style="margin-top:22px">${weightCardHtml(p)}</div>` : ''}

    <div class="page-head" style="margin-top:34px;margin-bottom:10px"><h1 style="font-size:26px">📅 Your calendar</h1>
      <span class="muted" style="font-weight:800">Created ${formatDate(p.created_at)}</span>
    </div>
    ${timelineHtml(p)}
    ${todayCardHtml(p)}

    <div class="page-head" style="margin-top:30px;margin-bottom:6px"><h1 style="font-size:26px">Training phases</h1></div>
    <p class="muted" style="font-weight:800;margin-bottom:12px">Each phase trains differently. Tap a phase to see its week.</p>
    <div id="phaseDetail">${phaseDetailHtml(p, selectedPhase)}</div>
  `;
}

// ----------------------------------------------------------------- events
root.addEventListener('click', async (e) => {
  const tab = e.target.closest('.phase-tab');
  if (tab) { selectedPhase = tab.dataset.phase; document.querySelector('#phaseDetail').innerHTML = phaseDetailHtml(plan, selectedPhase); return; }

  const toggleBtn = e.target.closest('button[data-session]');
  if (toggleBtn) {
    const id = toggleBtn.dataset.session;
    toggleBtn.disabled = true;
    try {
      const r = await api(`/api/sessions/${id}/toggle`, { method: 'POST' });
      const s = plan.sessions.find((x) => String(x.id) === String(id));
      s.completed = r.completed;
      plan.xp = r.xp; plan.streak = r.streak; plan.progress = r.progress;
      render();
      if (r.completed) toast('Session complete! +20 XP 🔥', 'success');
    } catch (err) {
      toast(err.message, 'error');
      toggleBtn.disabled = false;
    }
    return;
  }

  const deleteBtn = e.target.closest('[data-action="delete"]');
  if (deleteBtn) {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    try {
      await api(`/api/plans/${plan.id}`, { method: 'DELETE' });
      toast('Plan deleted.', 'success');
      location.href = '/plans.html';
    } catch (err) { toast(err.message, 'error'); }
  }
});

// --------------------------------------------------------------------- load
async function load() {
  if (!planId) {
    root.innerHTML = `<div class="empty"><div class="empty__emoji">🤔</div><h2>No plan selected</h2><p>Head to your plans to pick one.</p><a class="btn btn--red" href="/plans.html">My Plans</a></div>`;
    return;
  }
  try {
    plan = await api(`/api/plans/${planId}`);
    selectedPhase = (plan.today && plan.today.phase) || (plan.phases[0] && plan.phases[0].phase);
    render();
  } catch (err) {
    root.innerHTML = `<div class="empty"><div class="empty__emoji">⚠️</div><h2>Plan not found</h2><p>${escapeHtml(err.message)}</p><a class="btn btn--red" href="/create.html">Create a Plan</a></div>`;
  }
}

load();

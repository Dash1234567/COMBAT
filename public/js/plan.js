// Plan detail page — schedule, stats, weight-cut analysis, and tracking.
import {
  api, toast, escapeHtml, formatDate,
  disciplineMeta, goalMeta, experienceMeta, FOCUS_META, DIET_TIPS,
} from './app.js';

const root = document.querySelector('#planRoot');
const planId = new URLSearchParams(location.search).get('id');

let plan = null;

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
          <div class="day-card__day">
            <span class="d">${s.day_label}</span>
            <span class="fc ${meta.cls}">${meta.emoji} Rest</span>
          </div>
        </div>
        <p class="rest-note">😴 Active recovery only — light walk, stretch, or mobility. Rest is where you grow.</p>
      </div>`;
  }
  const exercises = s.exercises
    .map((e) => `<li class="ex"><span>${escapeHtml(e.name)}</span><span class="detail">${escapeHtml(e.detail)}</span></li>`)
    .join('');
  return `
    <div class="day-card ${s.completed ? 'done' : ''}" data-session="${s.id}">
      <div class="day-card__head">
        <div class="day-card__day">
          <span class="d">${s.day_label}</span>
          <span class="fc ${meta.cls}">${meta.emoji} ${escapeHtml(s.focus)}</span>
        </div>
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
    note = "You're at or below your target — shift focus to performance and staying sharp.";
  } else if (w.weeks == null) {
    badge = '<span class="badge badge--warn">No date set</span>';
    note = `You have <strong>${w.toLose} ${w.unit}</strong> to lose. Add a fight or weigh-in date to see safe weekly pacing.`;
  } else if (w.perWeek == null) {
    badge = '<span class="badge badge--danger">Date passed</span>';
    note = w.daysLeft < 0
      ? 'Your event date has passed — create a new plan for your next camp.'
      : 'Your event is today — good luck on the scale! 🍀';
  } else if (w.safe) {
    badge = '<span class="badge badge--safe">Safe pace ✓</span>';
    note = `Losing about <strong>${w.perWeek} ${w.unit}/week</strong> is a sustainable cut. Stay consistent and hydrate.`;
  } else {
    badge = '<span class="badge badge--danger">Aggressive ⚠️</span>';
    note = `This needs about <strong>${w.perWeek} ${w.unit}/week</strong> — faster than recommended. Consider more time or a higher target, and consult your coach.`;
  }
  const timeline = w.weeks != null && w.daysLeft >= 0
    ? `<p class="muted" style="font-weight:800;margin-top:4px">${w.daysLeft} days · ${w.weeks} weeks to go</p>`
    : '';
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h3 style="font-size:20px">⚖️ Weight cut</h3>${badge}
      </div>
      <div class="weight-scale">
        <span>${p.current_weight} ${w.unit}</span>
        <span class="to">→</span>
        <span>${p.target_weight} ${w.unit}</span>
      </div>
      ${timeline}
      <p style="margin-top:10px">${note}</p>
    </div>`;
}

function dietCardHtml(p) {
  const g = goalMeta(p.goal);
  const tips = (DIET_TIPS[p.goal] || DIET_TIPS.dieting)
    .map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  return `
    <div class="card accent-${p.goal}">
      <h3 style="font-size:20px">🥗 Nutrition focus</h3>
      <p class="muted" style="margin:6px 0 12px;font-weight:800">Tuned for ${escapeHtml(g.label.toLowerCase())}</p>
      <ul class="tips">${tips}</ul>
    </div>`;
}

function render(p) {
  const d = disciplineMeta(p.discipline);
  const g = goalMeta(p.goal);
  const x = experienceMeta(p.experience);
  const pr = p.progress;

  const infoCards = p.weight
    ? `<div class="split">${weightCardHtml(p)}${dietCardHtml(p)}</div>`
    : `<div style="margin-top:22px">${dietCardHtml(p)}</div>`;

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
          </div>
        </div>
      </div>
      <button class="btn btn--ghost btn--sm" data-action="delete">🗑️ Delete</button>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat__num" id="statStreak" style="color:var(--orange-d)">${p.streak}</div><div class="stat__label">🔥 Day streak</div></div>
      <div class="stat"><div class="stat__num" id="statXp" style="color:var(--blue-d)">${p.xp}</div><div class="stat__label">XP earned</div></div>
      <div class="stat"><div class="stat__num" id="statProgress" style="color:var(--green-d)">${pr.percent}%</div><div class="stat__label">Complete</div></div>
      <div class="stat"><div class="stat__num" id="statSessions">${pr.done}/${pr.total}</div><div class="stat__label">Sessions</div></div>
    </div>
    <div class="bar" style="margin-top:16px"><div class="bar__fill" id="planBar" style="width:${pr.percent}%"></div></div>

    ${infoCards}

    <div class="page-head" style="margin-top:34px;margin-bottom:12px"><h1 style="font-size:26px">Your week</h1>
      <span class="muted" style="font-weight:800">Created ${formatDate(p.created_at)}</span>
    </div>
    <div class="week">${p.sessions.map(dayCardHtml).join('')}</div>
  `;
}

function updateStats(xp, streak, progress) {
  document.querySelector('#statXp').textContent = xp;
  document.querySelector('#statStreak').textContent = streak;
  document.querySelector('#statProgress').textContent = progress.percent + '%';
  document.querySelector('#statSessions').textContent = `${progress.done}/${progress.total}`;
  document.querySelector('#planBar').style.width = progress.percent + '%';
}

// ----------------------------------------------------------------- handlers
root.addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('button[data-session]');
  const deleteBtn = e.target.closest('[data-action="delete"]');

  if (toggleBtn) {
    const id = toggleBtn.dataset.session;
    toggleBtn.disabled = true;
    try {
      const r = await api(`/api/sessions/${id}/toggle`, { method: 'POST' });
      const s = plan.sessions.find((x) => String(x.id) === String(id));
      s.completed = r.completed;
      const card = root.querySelector(`.day-card[data-session="${id}"]`);
      card.classList.toggle('done', r.completed);
      toggleBtn.outerHTML = completeBtnHtml(s);
      updateStats(r.xp, r.streak, r.progress);
      if (r.completed) toast('Session complete! +20 XP 🔥', 'success');
    } catch (err) {
      toast(err.message, 'error');
      toggleBtn.disabled = false;
    }
    return;
  }

  if (deleteBtn) {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    try {
      await api(`/api/plans/${plan.id}`, { method: 'DELETE' });
      toast('Plan deleted.', 'success');
      location.href = '/plans.html';
    } catch (err) {
      toast(err.message, 'error');
    }
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
    render(plan);
  } catch (err) {
    root.innerHTML = `<div class="empty"><div class="empty__emoji">⚠️</div><h2>Plan not found</h2><p>${escapeHtml(err.message)}</p><a class="btn btn--red" href="/create.html">Create a Plan</a></div>`;
  }
}

load();

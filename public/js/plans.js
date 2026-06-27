// "My Plans" dashboard — lists all saved plans.
import { api, disciplineMeta, goalMeta, escapeHtml, toast } from './app.js';

const root = document.querySelector('#plansRoot');

function planCard(p) {
  const d = disciplineMeta(p.discipline);
  const g = goalMeta(p.goal);
  const pct = p.progress.percent;
  return `
    <a class="plan-card accent-${p.goal}" href="/calendar.html?id=${p.id}">
      <div class="plan-card__top">
        <span class="plan-card__emoji" aria-hidden="true">${d.emoji}</span>
        <div>
          <div class="plan-card__name">${escapeHtml(p.name)}</div>
          <div class="muted" style="font-weight:800;font-size:13px">${g.emoji} ${escapeHtml(g.label)} · ${escapeHtml(d.label)}</div>
        </div>
      </div>
      <div class="bar" style="margin-top:16px"><div class="bar__fill" style="width:${pct}%"></div></div>
      <div class="plan-card__foot">
        <span>${pct}% complete</span>
        <span>🔥 ${p.streak} · ${p.xp} XP</span>
      </div>
    </a>`;
}

function emptyState() {
  return `
    <div class="empty">
      <div class="empty__emoji">🥊</div>
      <h2>No plans yet</h2>
      <p>Create your first training plan and start building your camp today.</p>
      <a class="btn btn--red btn--lg" href="/create.html">Create Plan</a>
    </div>`;
}

async function load() {
  try {
    const plans = await api('/api/plans');
    root.innerHTML = plans.length
      ? `<div class="plan-grid">${plans.map(planCard).join('')}</div>`
      : emptyState();
  } catch (err) {
    root.innerHTML = `<div class="empty"><div class="empty__emoji">⚠️</div><h2>Couldn't load plans</h2><p>${escapeHtml(err.message)}</p><a class="btn btn--ghost" href="/plans.html">Retry</a></div>`;
    toast(err.message, 'error');
  }
}

load();

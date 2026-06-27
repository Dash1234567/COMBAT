// Create Plan wizard logic.
import { DISCIPLINES, GOALS, EXPERIENCE, disciplineMeta, goalMeta, experienceMeta, api, toast, escapeHtml } from './app.js';

const TOTAL = 7;
let current = 0;

const state = {
  name: '',
  athlete_name: '',
  discipline: null,
  goal: null,
  experience: null,
  days_per_week: null,
  weight_unit: 'kg',
  current_weight: '',
  target_weight: '',
};

const $ = (sel) => document.querySelector(sel);
const progressBar = $('#progressBar');
const backBtn = $('#backBtn');
const nextBtn = $('#nextBtn');
const formError = $('#formError');

const DAY_OPTIONS = [
  { id: 3, emoji: '3', label: '3 days', sub: 'Foundations' },
  { id: 4, emoji: '4', label: '4 days', sub: 'Balanced' },
  { id: 5, emoji: '5', label: '5 days', sub: 'Serious' },
  { id: 6, emoji: '6', label: '6 days', sub: 'Pro camp' },
];

// ---------------------------------------------------------------- rendering
function renderChoices(containerId, items, key, valueMap = (x) => x.id) {
  const container = $('#' + containerId);
  container.innerHTML = items
    .map(
      (item) => `
      <button type="button" class="choice" role="radio" aria-checked="false" data-id="${escapeHtml(item.id)}">
        <span class="emoji" aria-hidden="true">${item.emoji}</span>
        <span>${escapeHtml(item.label)}</span>
        ${item.sub ? `<span class="sub">${escapeHtml(item.sub)}</span>` : ''}
      </button>`
    )
    .join('');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.choice');
    if (!btn) return;
    container.querySelectorAll('.choice').forEach((c) => {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('selected');
    btn.setAttribute('aria-checked', 'true');
    const raw = btn.dataset.id;
    const picked = items.find((i) => String(i.id) === raw);
    state[key] = valueMap(picked);
    clearError();
  });
}

renderChoices('disciplineChoices', DISCIPLINES, 'discipline');
renderChoices('goalChoices', GOALS, 'goal');
renderChoices('experienceChoices', EXPERIENCE, 'experience');
renderChoices('daysChoices', DAY_OPTIONS, 'days_per_week');

// Unit toggle
$('#unitToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-unit]');
  if (!btn) return;
  state.weight_unit = btn.dataset.unit;
  $('#unitToggle').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
});

// ----------------------------------------------------------------- navigation
function clearError() { formError.textContent = ''; }

function showStep(i) {
  current = i;
  document.querySelectorAll('.step-screen').forEach((s) => {
    s.classList.toggle('active', Number(s.dataset.step) === i);
  });
  progressBar.style.width = `${((i + 1) / TOTAL) * 100}%`;
  backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = i === TOTAL - 1 ? 'Create Plan' : i === TOTAL - 2 ? 'Review' : 'Continue';
  if (i === TOTAL - 1) renderReview();
  clearError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function readInputs() {
  state.name = $('#planName').value.trim();
  state.athlete_name = $('#athleteName').value.trim();
  state.current_weight = $('#currentWeight').value.trim();
  state.target_weight = $('#targetWeight').value.trim();
}

function validateStep(i) {
  readInputs();
  switch (i) {
    case 0:
      if (!state.name) return 'Please name your plan to continue.';
      break;
    case 1:
      if (!state.discipline) return 'Pick your sport to continue.';
      break;
    case 2:
      if (!state.goal) return 'Choose a main goal to continue.';
      break;
    case 3:
      if (!state.experience) return 'Select your experience level.';
      break;
    case 4:
      if (!state.days_per_week) return 'Choose how many days you train.';
      break;
    case 5: {
      const c = state.current_weight, t = state.target_weight;
      if ((c && !t) || (!c && t)) return 'Enter both weights, or leave both blank.';
      if (c && t && Number(t) > Number(c)) return 'For a cut, target weight should be below current weight.';
      break;
    }
  }
  return null;
}

function renderReview() {
  const d = disciplineMeta(state.discipline);
  const g = goalMeta(state.goal);
  const x = experienceMeta(state.experience);
  let weightLine = '<span class="muted">No weight target set</span>';
  if (state.current_weight && state.target_weight) {
    const diff = (Number(state.current_weight) - Number(state.target_weight)).toFixed(1);
    weightLine = `${state.current_weight} → ${state.target_weight} ${state.weight_unit} <span class="muted">(${diff} ${state.weight_unit} to lose)</span>`;
  }
  const rows = [
    ['Plan', escapeHtml(state.name)],
    ['Athlete', state.athlete_name ? escapeHtml(state.athlete_name) : '<span class="muted">—</span>'],
    ['Sport', `${d.emoji} ${escapeHtml(d.label)}`],
    ['Goal', `${g.emoji} ${escapeHtml(g.label)}`],
    ['Experience', `${x.emoji} ${escapeHtml(x.label)}`],
    ['Days / week', `${state.days_per_week}`],
    ['Weight', weightLine],
  ];
  $('#reviewCard').innerHTML = rows
    .map(([k, v]) => `<div class="ex"><span>${k}</span><span class="detail" style="color:var(--ink)">${v}</span></div>`)
    .join('');
}

async function submit() {
  nextBtn.disabled = true;
  nextBtn.textContent = 'Creating…';
  try {
    const payload = {
      name: state.name,
      athlete_name: state.athlete_name || null,
      discipline: state.discipline,
      goal: state.goal,
      experience: state.experience,
      days_per_week: state.days_per_week,
      weight_unit: state.weight_unit,
      current_weight: state.current_weight === '' ? null : Number(state.current_weight),
      target_weight: state.target_weight === '' ? null : Number(state.target_weight),
    };
    const { id } = await api('/api/plans', { method: 'POST', body: JSON.stringify(payload) });
    toast('Plan created! 🥊', 'success');
    location.href = `/calendar.html?id=${id}`;
  } catch (err) {
    formError.textContent = err.message;
    toast(err.message, 'error');
    nextBtn.disabled = false;
    nextBtn.textContent = 'Create Plan';
  }
}

nextBtn.addEventListener('click', () => {
  const error = validateStep(current);
  if (error) { formError.textContent = error; return; }
  if (current === TOTAL - 1) submit();
  else showStep(current + 1);
});

backBtn.addEventListener('click', () => { if (current > 0) showStep(current - 1); });

// Enter key advances on text steps.
$('#wizardForm').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && current < TOTAL - 1) { e.preventDefault(); nextBtn.click(); }
});

showStep(0);

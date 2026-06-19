// AI Coach chat front-end.
import { api, escapeHtml } from './app.js';

const SUGGESTIONS = {
  wrestling: [
    'How do I build my gas tank for wrestling?',
    'How do I maintain strength during the season?',
    'How do I handle pre-match nerves?',
    'What should I eat before a tournament?',
  ],
  boxing: [
    'How do I improve conditioning for the later rounds?',
    'How do I build punch power?',
    'How should I cut weight safely?',
    'What should I do right after the weigh-in?',
  ],
  general: [
    'How much protein should I eat?',
    'How do I build an aerobic base?',
    'How should I lift around hard practices?',
    'How important is sleep for recovery?',
  ],
};
const SPORT_LABELS = { wrestling: 'Wrestling 🤼', boxing: 'Boxing 🥊', general: 'General 🧠' };

const state = { sport: 'general' };

const log = document.querySelector('#chatLog');
const input = document.querySelector('#chatInput');
const form = document.querySelector('#chatForm');
const seg = document.querySelector('#sportSeg');
const suggestionsEl = document.querySelector('#suggestions');
const learnBtn = document.querySelector('#learnBtn');
const learnEl = document.querySelector('#coachLearn');

// ------------------------------------------------------------------ rendering
function scrollDown() { log.scrollIntoView(false); window.scrollTo(0, document.body.scrollHeight); }

function addUserMsg(text) {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  log.appendChild(el);
  scrollDown();
}

function panelsHtml(panels) {
  return panels
    .map(
      (p) => `
      <div class="who-group">
        <div class="who-group-label">${p.emoji} ${escapeHtml(p.label)}</div>
        <div class="coach-panel">
          ${p.coaches.map((c) => `<div class="who"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(c.focus)}</span></div>`).join('')}
        </div>
      </div>`
    )
    .join('');
}

function addCoachMsg(data) {
  const el = document.createElement('div');
  el.className = 'msg coach';
  el.innerHTML = `
    <div class="coach-avatar"><span class="a" aria-hidden="true">🥊</span> AI Coach</div>
    ${data.title ? `<div class="m-title">${escapeHtml(data.title)}</div>` : ''}
    <div class="m-body">${escapeHtml(data.reply || '')}</div>
    ${data.panels ? panelsHtml(data.panels) : ''}
    ${data.sources && data.sources.length
      ? `<div class="m-sources">📚 ${data.sources.map((s) => `<span class="src">${escapeHtml(s)}</span>`).join('')}</div>`
      : ''}
  `;
  log.appendChild(el);
  scrollDown();
}

function addTyping() {
  const el = document.createElement('div');
  el.className = 'msg coach typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  log.appendChild(el);
  scrollDown();
  return el;
}

function renderSuggestions(list) {
  const items = list && list.length ? list : SUGGESTIONS[state.sport] || SUGGESTIONS.general;
  suggestionsEl.innerHTML = items
    .map((q) => `<button type="button" class="suggestion">${escapeHtml(q)}</button>`)
    .join('');
}

// --------------------------------------------------------------------- chat
async function ask(text, { showUser = true } = {}) {
  if (showUser) addUserMsg(text);
  const typing = addTyping();
  try {
    const r = await api('/api/coach', { method: 'POST', body: JSON.stringify({ message: text, sport: state.sport }) });
    typing.remove();
    addCoachMsg(r);
    renderSuggestions(r.suggestions);
  } catch (err) {
    typing.remove();
    addCoachMsg({ type: 'chat', reply: 'Hmm, I had trouble responding just now. Please try again.' });
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  ask(text);
});

suggestionsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.suggestion');
  if (btn) ask(btn.textContent);
});

// ------------------------------------------------------------- sport selector
function setSport(sport, { announce = true } = {}) {
  state.sport = sport;
  localStorage.setItem('combat_coach_sport', sport);
  seg.querySelectorAll('button').forEach((b) => {
    const active = b.dataset.sport === sport;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  renderSuggestions();
  if (learnBtn.getAttribute('aria-expanded') === 'true') showLearn();
  if (announce) addCoachMsg({ type: 'chat', reply: `Now coaching for ${SPORT_LABELS[sport]}. What do you want to work on?` });
}

seg.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-sport]');
  if (btn) setSport(btn.dataset.sport);
});

// --------------------------------------------------------- "who I learn from"
async function showLearn() {
  try {
    const r = await api('/api/coach', { method: 'POST', body: JSON.stringify({ message: 'who do you learn from', sport: state.sport }) });
    learnEl.innerHTML = panelsHtml(r.panels || []);
    learnEl.classList.remove('hidden');
    learnBtn.setAttribute('aria-expanded', 'true');
  } catch { /* ignore */ }
}

learnBtn.addEventListener('click', () => {
  if (learnBtn.getAttribute('aria-expanded') === 'true') {
    learnEl.classList.add('hidden');
    learnBtn.setAttribute('aria-expanded', 'false');
  } else {
    showLearn();
  }
});

// --------------------------------------------------------------------- init
async function init() {
  const stored = localStorage.getItem('combat_coach_sport');
  if (stored) {
    state.sport = stored;
  } else {
    try {
      const plans = await api('/api/plans');
      const d = plans[0] && plans[0].discipline;
      state.sport = d === 'wrestling' || d === 'boxing' ? d : 'general';
    } catch { state.sport = 'general'; }
  }
  setSport(state.sport, { announce: false });
  ask('hello', { showUser: false }); // coach greets first
}

init();

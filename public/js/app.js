// Shared constants + helpers for COMBAT (ES module, imported by each page).

export const DISCIPLINES = [
  { id: 'boxing',     label: 'Boxing',      emoji: '🥊' },
  { id: 'mma',        label: 'MMA',         emoji: '👊' },
  { id: 'bjj',        label: 'BJJ',         emoji: '🥋' },
  { id: 'muay_thai',  label: 'Muay Thai',   emoji: '🦵' },
  { id: 'wrestling',  label: 'Wrestling',   emoji: '🤼' },
  { id: 'kickboxing', label: 'Kickboxing',  emoji: '🦶' },
  { id: 'karate',     label: 'Karate',      emoji: '🥷' },
];

export const GOALS = [
  { id: 'conditioning',   label: 'Conditioning',   emoji: '🫀', accent: 'conditioning', blurb: 'Build a gas tank that never quits.' },
  { id: 'strength',       label: 'Strength',       emoji: '💪', accent: 'strength',     blurb: 'Hit harder and control the clinch.' },
  { id: 'dieting',        label: 'Dieting',        emoji: '🥗', accent: 'dieting',      blurb: 'Fuel performance and recover faster.' },
  { id: 'weight_cutting', label: 'Weight Cutting', emoji: '⚖️', accent: 'weight_cutting', blurb: 'Make weight safely on fight week.' },
];

export const EXPERIENCE = [
  { id: 'beginner',     label: 'Beginner',     emoji: '🌱', sub: '0–1 yrs' },
  { id: 'intermediate', label: 'Intermediate', emoji: '⚡', sub: '1–3 yrs' },
  { id: 'advanced',     label: 'Advanced',     emoji: '🔥', sub: '3+ yrs' },
];

// focus name -> { class for the chip, emoji }
export const FOCUS_META = {
  'Strength':            { cls: 'fc--strength',    emoji: '💪' },
  'Conditioning':        { cls: 'fc--conditioning',emoji: '🫀' },
  'Skills & Technique':  { cls: 'fc--skill',       emoji: '🎯' },
  'Sparring & Drills':   { cls: 'fc--spar',        emoji: '🥊' },
  'Mobility & Recovery': { cls: 'fc--mobility',    emoji: '🧘' },
  'Rest':                { cls: 'fc--rest',        emoji: '😴' },
};

// Nutrition guidance shown on the plan page, tailored to the goal.
export const DIET_TIPS = {
  conditioning: [
    'Eat 4–6g of carbs per kg bodyweight on hard conditioning days.',
    'Hydrate early — aim for pale-yellow urine before every session.',
    'Add a banana or rice cake 30–60 min before high-intensity work.',
    'Prioritise sleep: 7–9 hrs to absorb the conditioning load.',
  ],
  strength: [
    'Hit 1.6–2.2g of protein per kg bodyweight daily.',
    'Eat a protein + carb meal within 2 hrs of lifting.',
    'Creatine monohydrate (3–5g/day) supports power output.',
    'Don\'t train heavy fasted — fuel the nervous system.',
  ],
  dieting: [
    'Aim for a modest deficit (~300–500 kcal) to keep performance high.',
    'Keep protein high to protect muscle while leaning out.',
    'Fill half your plate with vegetables for fullness and micros.',
    'Limit liquid calories — they add up fast and don\'t satiate.',
  ],
  weight_cutting: [
    'Do the bulk of the cut through diet over weeks, not water in days.',
    'A safe rate is ~0.5–1% of bodyweight per week.',
    'Reduce sodium and fibre in the final days, then water-load early.',
    'Always rehydrate and refuel immediately after the weigh-in.',
    'Never cut weight without coach or medical supervision.',
  ],
};

const byId = (list, id) => list.find((x) => x.id === id);
export const disciplineMeta = (id) => byId(DISCIPLINES, id) || { label: id, emoji: '🥊' };
export const goalMeta = (id) => byId(GOALS, id) || { label: id, emoji: '🎯', accent: 'red' };
export const experienceMeta = (id) => byId(EXPERIENCE, id) || { label: id, emoji: '🌱' };

// --------------------------------------------------------------------- fetch
export async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const msg = data && data.errors ? data.errors.join(' ') : `Request failed (${res.status}).`;
    throw new Error(msg);
  }
  return data;
}

// --------------------------------------------------------------------- utils
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toast(message, type = '') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${type ? 'toast--' + type : ''}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

// ------------------------------------------------------------------ account
let _mePromise = null;
export function getMe() {
  if (!_mePromise) _mePromise = api('/api/auth/me').then((r) => r.user).catch(() => null);
  return _mePromise;
}

export function avatarHtml(user, size = 40) {
  const dim = `width:${size}px;height:${size}px`;
  if (user && user.avatar) return `<img class="avatar" style="${dim}" src="${user.avatar}" alt="">`;
  const initial = String((user && (user.nickname || user.username)) || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="avatar avatar--initial" style="${dim};font-size:${Math.round(size * 0.42)}px">${escapeHtml(initial)}</span>`;
}

async function initAccount() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const links = nav.querySelector('.nav__links');
  const toggle = nav.querySelector('.nav__toggle');
  let user = null;
  try { user = await getMe(); } catch { /* offline */ }
  if (user) {
    const a = document.createElement('a');
    a.className = 'nav-acct';
    a.href = '/profile.html';
    a.innerHTML = `${avatarHtml(user, 28)}<span>${escapeHtml(user.nickname)}</span>`;
    if (toggle) nav.insertBefore(a, toggle); else nav.appendChild(a);
  } else if (links) {
    const a = document.createElement('a');
    a.className = 'navlink';
    a.href = '/login.html';
    a.textContent = 'Log in';
    links.appendChild(a);
  }
}

// ---------------------------------------------------------- shared chrome
function initChrome() {
  // Mobile nav toggle
  const toggle = document.querySelector('.nav__toggle');
  const links = document.querySelector('.nav__links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => links.classList.remove('open'))
    );
  }

  // Highlight active nav link by path
  const here = location.pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('.navlink').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === here || (href !== '/' && here.startsWith(href))) a.classList.add('active');
  });

  // Footer year
  const yr = document.querySelector('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();

  initAccount();
}

if (document.readyState !== 'loading') initChrome();
else document.addEventListener('DOMContentLoaded', initChrome);

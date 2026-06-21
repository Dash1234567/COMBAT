// Login / sign-up page.
import { api, toast } from './app.js';

const $ = (s) => document.querySelector(s);
const titleEl = $('#authTitle');
const subEl = $('#authSub');
const nicknameField = $('#nicknameField');
const submitBtn = $('#authSubmit');
const errorEl = $('#authError');
const noteEl = $('#authToggleNote');
const modeSeg = $('#authMode');

let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';

const COPY = {
  login: { title: 'Welcome back', sub: 'Log in to sync your plans across every device.', btn: 'Log in', note: 'New here?', link: 'Create an account' },
  signup: { title: 'Create your account', sub: 'Your username and plans are saved and follow you everywhere.', btn: 'Sign up', note: 'Already have an account?', link: 'Log in' },
};

function applyMode() {
  const c = COPY[mode];
  titleEl.textContent = c.title;
  subEl.textContent = c.sub;
  submitBtn.textContent = c.btn;
  nicknameField.hidden = mode !== 'signup';
  $('#password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  noteEl.innerHTML = `${c.note} <a id="authToggle">${c.link}</a>`;
  modeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  errorEl.textContent = '';
}

function setMode(next) { mode = next; applyMode(); }

modeSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (btn) setMode(btn.dataset.mode);
});
noteEl.addEventListener('click', (e) => {
  if (e.target.id === 'authToggle') setMode(mode === 'login' ? 'signup' : 'login');
});

$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const payload = {
    username: $('#username').value.trim(),
    password: $('#password').value,
  };
  if (mode === 'signup') payload.nickname = $('#nickname').value.trim();

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'signup' ? 'Creating…' : 'Logging in…';
  try {
    await api(`/api/auth/${mode === 'signup' ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(payload) });
    toast(mode === 'signup' ? 'Account created! 🥊' : 'Welcome back! 🥊', 'success');
    location.href = '/profile.html';
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled = false;
    submitBtn.textContent = COPY[mode].btn;
  }
});

applyMode();

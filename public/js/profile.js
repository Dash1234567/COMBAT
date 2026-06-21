// Profile page — view/edit nickname, upload a photo, log out.
import { api, escapeHtml, formatDate, avatarHtml, toast } from './app.js';

const root = document.querySelector('#profileRoot');
const MAX_BYTES = 500 * 1024; // 500KB client-side cap
let me = null;

function loggedOutView() {
  root.innerHTML = `
    <div class="empty">
      <div class="empty__emoji">🔒</div>
      <h2>You're not logged in</h2>
      <p>Create an account or log in to set up your profile and save your plans across devices.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn--blue" href="/login.html?mode=signup">Sign up</a>
        <a class="btn btn--ghost" href="/login.html">Log in</a>
      </div>
    </div>`;
}

function render() {
  root.innerHTML = `
    <div class="page-head"><h1>Profile</h1>
      <button class="btn btn--ghost btn--sm" id="logoutBtn">Log out</button>
    </div>
    <div class="card profile-card">
      <div style="text-align:center;flex:none">
        ${avatarHtml(me, 110)}
        <div class="profile-actions" style="justify-content:center">
          <button class="btn btn--blue btn--sm" id="photoBtn" type="button">Change photo</button>
          ${me.avatar ? '<button class="btn btn--ghost btn--sm" id="removePhoto" type="button">Remove</button>' : ''}
        </div>
        <input type="file" id="photoInput" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
      </div>
      <div class="profile-id">
        <h1>${escapeHtml(me.nickname)}</h1>
        <p class="profile-meta">@${escapeHtml(me.username)} · member since ${escapeHtml(formatDate(me.created_at))}</p>
      </div>
    </div>

    <div class="card profile-edit">
      <h3 style="font-size:18px;font-weight:900">Display nickname</h3>
      <p class="hint">This is the name shown around COMBAT.</p>
      <div class="field" style="margin-top:12px">
        <input class="input" id="nickInput" maxlength="30" value="${escapeHtml(me.nickname)}" />
      </div>
      <p class="form-error" id="profileError" role="alert"></p>
      <button class="btn btn--green" id="saveNick" type="button">Save nickname</button>
    </div>`;

  document.querySelector('#logoutBtn').addEventListener('click', logout);
  document.querySelector('#saveNick').addEventListener('click', saveNickname);
  const photoBtn = document.querySelector('#photoBtn');
  const photoInput = document.querySelector('#photoInput');
  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', onPhoto);
  const removeBtn = document.querySelector('#removePhoto');
  if (removeBtn) removeBtn.addEventListener('click', removePhoto);
}

async function saveNickname() {
  const nickname = document.querySelector('#nickInput').value.trim();
  const err = document.querySelector('#profileError');
  err.textContent = '';
  try {
    const r = await api('/api/profile', { method: 'POST', body: JSON.stringify({ nickname }) });
    me = r.user;
    render();
    toast('Profile saved!', 'success');
  } catch (e) {
    err.textContent = e.message;
  }
}

function onPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please choose an image file.', 'error'); return; }
  if (file.size > MAX_BYTES) { toast('Image must be under 500KB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const r = await api('/api/profile', { method: 'POST', body: JSON.stringify({ avatar: reader.result }) });
      me = r.user;
      render();
      toast('Photo updated! 📸', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  reader.onerror = () => toast('Could not read that image.', 'error');
  reader.readAsDataURL(file);
}

async function removePhoto() {
  try {
    const r = await api('/api/profile', { method: 'POST', body: JSON.stringify({ avatar: null }) });
    me = r.user;
    render();
    toast('Photo removed.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  location.href = '/';
}

async function init() {
  try {
    const r = await api('/api/auth/me');
    me = r.user;
  } catch { me = null; }
  if (me) render();
  else loggedOutView();
}

init();

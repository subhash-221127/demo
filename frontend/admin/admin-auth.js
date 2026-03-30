/* ============================================================
   admin-auth.js — Shared auth guard + dynamic user info
   Include this BEFORE other scripts on every admin page.
   ============================================================ */

(function adminAuthGuard() {
  'use strict';

  // 1. Check session
  const raw = sessionStorage.getItem('cityfix_user');
  if (!raw) { window.location.replace('../login.html'); return; }

  let user;
  try { user = JSON.parse(raw); } catch (e) { window.location.replace('../login.html'); return; }
  if (user.role !== 'admin') { window.location.replace('../login.html'); return; }

  // 2. Populate profile UI once DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    const nameEl    = document.getElementById('admin-name');
    const avatarEl  = document.getElementById('admin-avatar');
    const computed  = (user.name || '').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0,2) || 'AD';
    if (nameEl)   nameEl.textContent   = user.name || 'Admin User';
    if (avatarEl) avatarEl.textContent = computed;
  });
})();

/* Shared logout helper — called by sidebar & dropdown logout links */
function doLogout(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  sessionStorage.removeItem('cityfix_user');
  window.location.href = '../login.html';
}

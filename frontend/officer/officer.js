// =============================================
// officer-portal.js
// Single JS file for all officer portal pages.
// Handles: complaints.html, mystats.html, profile.html
// =============================================

const BASE_URL = '';

// ── Auth Guard ────────────────────────────────
const _raw = sessionStorage.getItem('cityfix_user') || localStorage.getItem('cityfix_user');
if (!_raw) window.location.replace('../login.html');

let SESSION;
try {
  SESSION = JSON.parse(_raw);
  if (SESSION.role !== 'officer') window.location.replace('../login.html');
} catch { window.location.replace('../login.html'); }

// =============================================
// SHARED UTILITIES
// =============================================

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function statusBadge(s) {
  const map = {
    assigned:    '<span class="badge badge-pending"><i class="fa-solid fa-user-tie"></i> Assigned</span>',
    in_progress: '<span class="badge badge-progress"><i class="fa-solid fa-rotate"></i> In Progress</span>',
    resolved:    '<span class="badge badge-resolved"><i class="fa-solid fa-circle-check"></i> Resolved</span>',
    rejected:    '<span class="badge" style="background:#fef2f2;color:#dc2626;"><i class="fa-solid fa-ban"></i> Rejected</span>',
    pending:     '<span class="badge badge-pending"><i class="fa-solid fa-clock"></i> Pending</span>',
  };
  return map[s] || `<span class="badge badge-pending">${s}</span>`;
}

function severityBadge(s) {
  const classes = { critical:'badge-critical', high:'badge-high', medium:'badge-medium', low:'badge-low' };
  const label   = s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  return `<span class="badge ${classes[s] || 'badge-medium'}">${label}</span>`;
}

function normalizeComplaint(c) {
  const citizenObj = c.citizenId && typeof c.citizenId === 'object' ? c.citizenId : null;
  return {
    _id:         c._id,
    id:          c.complaintId || c._id,
    title:       c.title       || 'Untitled',
    description: c.description || '',
    department:  c.department  || '—',
    severity:    c.severity    || 'medium',
    status:      c.status      || 'assigned',
    location:    c.location?.address || c.location || '—',
    lat:         c.location?.lat  || null,
    lng:         c.location?.lng  || null,
    date:        c.createdAt
                   ? new Date(c.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                   : '—',
    assignedAt:  c.assignedAt
                   ? new Date(c.assignedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                   : '—',
    resolvedAt:  c.resolvedAt || null,
    _rawDate:    c.createdAt  || null,
    evidence:    c.evidencePaths?.[0] || null,
    citizen: {
      name:  citizenObj?.name  || '—',
      email: citizenObj?.email || '—',
      phone: citizenObj?.phone || '—',
    },
  };
}

async function fetchOfficerComplaints() {
  const targetId = SESSION.officerId || SESSION.id;
  const resp = await fetch(`${BASE_URL}/api/officers/${targetId}/complaints`);
  if (!resp.ok) throw new Error('Failed to fetch complaints');
  const raw = await resp.json();
  return raw.map(normalizeComplaint);
}

function showToast(msg, type = '') {
  const tc = document.getElementById('toast-container');
  if (!tc) return;
  const div = document.createElement('div');
  div.className = 'toast' + (type ? ' ' + type : '');
  div.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${msg}`;
  tc.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ── Topbar: populate from session ─────────────
function populateTopbar() {
  const initials = SESSION.name
    ? SESSION.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'OF';

  setEl('topbar-username',   SESSION.name       || 'Officer');
  setEl('avatar-initials',   initials);
  setEl('dropdown-initials', initials);
  setEl('dropdown-name',     SESSION.name       || 'Officer');
  setEl('dropdown-email',    SESSION.email      || '—');
  setEl('dropdown-dept',     SESSION.department || '—');
  setEl('hero-initials',     initials); // profile page only
}

// ── Dropdown / logout ─────────────────────────
function toggleUserMenu(e) {
  e.stopPropagation();
  const dd  = document.getElementById('user-dropdown');
  const btn = document.getElementById('user-btn');
  dd?.classList.toggle('open');
  btn?.classList.toggle('open', dd?.classList.contains('open'));
}

function closeDropdowns() {
  document.getElementById('user-dropdown')?.classList.remove('open');
  document.getElementById('user-btn')?.classList.remove('open');
}

function handleLogout() {
  sessionStorage.removeItem('cityfix_user');
  localStorage.removeItem('cityfix_user');
  window.location.href = '../login.html';
}

document.addEventListener('click', closeDropdowns);

// =============================================
// PAGE: complaints.html
// =============================================

let allComplaints = [];

async function loadComplaints() {
  try {
    allComplaints = await fetchOfficerComplaints();
    updateComplaintStats();
    filterComplaints();
  } catch {
    document.getElementById('error-state').style.display   = 'block';
    document.getElementById('error-msg').textContent       = 'Could not connect to server. Is the backend running on port 5000?';
  }
}

function updateComplaintStats() {
  const total = allComplaints.length;
  setEl('stat-total',    total);
  setEl('stat-assigned', allComplaints.filter(c => c.status === 'assigned').length);
  setEl('stat-progress', allComplaints.filter(c => c.status === 'in_progress').length);
  setEl('stat-resolved', allComplaints.filter(c => c.status === 'resolved').length);
  setEl('queue-sub',     `${total} complaint${total !== 1 ? 's' : ''} assigned to you`);
  setEl('topbar-sub',    `${total} total · ${allComplaints.filter(c => c.status !== 'resolved').length} active`);
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function filterComplaints() {
  const q      = document.getElementById('search-input')?.value.toLowerCase() || '';
  const st     = document.getElementById('filter-status')?.value  || '';
  const sev    = document.getElementById('filter-severity')?.value || '';
  const sortBy = document.getElementById('sort-by')?.value || '';

  let filtered = allComplaints.filter(c =>
    (!q   || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)) &&
    (!st  || c.status   === st) &&
    (!sev || c.severity === sev)
  );

  // Apply sort
  if (sortBy === 'time-recent') {
    filtered = filtered.slice().sort((a, b) => new Date(b._rawDate || 0) - new Date(a._rawDate || 0));
  } else if (sortBy === 'time-oldest') {
    filtered = filtered.slice().sort((a, b) => new Date(a._rawDate || 0) - new Date(b._rawDate || 0));
  } else if (sortBy.startsWith('sev-')) {
    const targetSev = sortBy.replace('sev-', ''); // e.g. 'critical'
    filtered = filtered.slice().sort((a, b) => {
      const aMatch = a.severity === targetSev ? -1 : 1;
      const bMatch = b.severity === targetSev ? -1 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    });
  }

  const list  = document.getElementById('complaint-list');
  const empty = document.getElementById('empty-state');
  if (!list) return;

  if (!filtered.length) {
    list.style.display  = 'none';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  list.style.display  = 'flex';

  list.innerHTML = filtered.map(c => `
    <div class="complaint-card" onclick="window.location.href='officer_view_complaint.html?id=${c._id}'" style="cursor:pointer;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div class="complaint-card-left" style="flex:1;">
          <div style="font-size:0.72rem;font-weight:700;color:var(--slate-400);margin-bottom:4px;">${c.id}</div>
          <div class="complaint-title">${c.title}</div>
          <div class="complaint-meta">
            <span><i class="fa-solid fa-location-dot"></i> ${c.location}</span>
            <span><i class="fa-regular fa-calendar"></i> ${c.date}</span>
            <span><i class="fa-solid fa-building"></i> ${c.department}</span>
          </div>
          <p class="complaint-desc" style="margin:8px 0 0;">${c.description.substring(0, 120)}${c.description.length > 120 ? '…' : ''}</p>
          <div class="complaint-tags" style="margin-top:10px;">
            ${statusBadge(c.status)}
            ${severityBadge(c.severity)}
          </div>
        </div>
        <div style="flex-shrink:0;color:var(--slate-400);">
          <i class="fa-solid fa-chevron-right"></i>
        </div>
      </div>
    </div>
  `).join('');
}

async function updateStatus(mongoId, newStatus) {
  try {
    const resp = await fetch(`${BASE_URL}/api/complaint/${mongoId}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: newStatus }),
    });
    if (!resp.ok) throw new Error();

    const c = allComplaints.find(x => x._id === mongoId);
    if (c) c.status = newStatus;

    updateComplaintStats();
    filterComplaints();
    document.getElementById('modal-overlay')?.classList.remove('open');
    showToast(
      newStatus === 'in_progress' ? '▶ Marked In Progress' : '✓ Complaint Resolved',
      newStatus === 'resolved' ? 'success' : ''
    );
  } catch {
    showToast('Failed to update status. Try again.', 'error');
  }
}

function openModal(mongoId) {
  const c = allComplaints.find(x => x._id === mongoId);
  if (!c) return;

  setEl('modal-title',    c.title);
  setEl('modal-id-sub',   c.id);
  setEl('modal-dept',     c.department);
  setEl('modal-loc',      c.location);
  setEl('modal-date',     c.date);
  setEl('modal-assigned', c.assignedAt);
  setEl('modal-desc',     c.description);

  document.getElementById('modal-badges').innerHTML = statusBadge(c.status) + severityBadge(c.severity);

  setEl('citizen-name',  c.citizen.name);
  setEl('citizen-email', c.citizen.email);
  setEl('citizen-phone', c.citizen.phone || '—');

  const evidSec = document.getElementById('evidence-section');
  if (c.evidence) {
    evidSec.style.display = 'block';
    document.getElementById('evidence-link').href = `${BASE_URL}/uploads/${c.evidence}`;
  } else {
    evidSec.style.display = 'none';
  }

  const mapsSec = document.getElementById('maps-section');
  if (c.lat && c.lng) {
    mapsSec.style.display = 'block';
    document.getElementById('maps-link').href = `https://www.google.com/maps?q=${c.lat},${c.lng}`;
  } else {
    mapsSec.style.display = 'none';
  }

  let actions = `<button class="btn-modal btn-modal-outline" onclick="document.getElementById('modal-overlay').classList.remove('open')">Close</button>`;
  if (c.status === 'assigned')
    actions = `<button class="btn-modal btn-modal-primary" onclick="updateStatus('${c._id}','in_progress')"><i class="fa-solid fa-play"></i> Start Working</button><button class="btn-modal btn-modal-outline" style="color:var(--red);border-color:var(--red-light);" onclick="rejectAssignment('${c._id}')"><i class="fa-solid fa-ban"></i> Decline Assignment</button>` + actions;
  if (c.status === 'in_progress')
    actions = `<button class="btn-modal btn-modal-green" onclick="updateStatus('${c._id}','resolved')"><i class="fa-solid fa-check"></i> Mark Resolved</button>` + actions;

  document.getElementById('modal-actions').innerHTML = actions;
  document.getElementById('modal-overlay').classList.add('open');
}

async function rejectAssignment(mongoId) {
  if (!confirm('Are you sure you want to decline this assignment? It will be sent back to the admin queue.')) return;
  
  try {
    const resp = await fetch(`${BASE_URL}/api/complaint/${mongoId}/reject-assignment`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ officerId: SESSION.officerId })
    });
    if (!resp.ok) throw new Error();

    // Remove from local array
    allComplaints = allComplaints.filter(x => x._id !== mongoId);
    
    updateComplaintStats();
    filterComplaints();
    document.getElementById('modal-overlay')?.classList.remove('open');
    showToast('Assignment declined', 'success');
  } catch {
    showToast('Failed to decline assignment. Try again.', 'error');
  }
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay')?.classList.remove('open');
}

// =============================================
// PAGE: mystats.html
// =============================================

async function loadStats() {
  try {
    const complaints = await fetchOfficerComplaints();

    const total    = complaints.length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;
    const progress = complaints.filter(c => c.status === 'in_progress').length;
    const assigned = complaints.filter(c => c.status === 'assigned').length;
    const rate     = total ? Math.round((resolved / total) * 100) : 0;

    setEl('perf-total',      total);
    setEl('perf-resolved',   resolved);
    setEl('perf-progress',   progress);
    setEl('perf-rate',       rate + '%');
    setEl('donut-pct',       rate + '%');
    setEl('legend-resolved', resolved);
    setEl('legend-progress', progress);
    setEl('legend-assigned', assigned);

    requestAnimationFrame(() => {
      const arc = document.getElementById('donut-arc');
      if (arc) arc.style.strokeDashoffset = (2 * Math.PI * 60) * (1 - rate / 100);
    });

    // Severity breakdown
    const SEVERITY_COLORS = { critical:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#22c55e' };
    const counts = { critical:0, high:0, medium:0, low:0 };
    complaints.forEach(c => { if (counts[c.severity] !== undefined) counts[c.severity]++; });
    const maxCount = Math.max(...Object.values(counts), 1);

    const breakdownEl = document.getElementById('breakdown-rows');
    if (breakdownEl) {
      breakdownEl.innerHTML = Object.entries(counts).map(([sev, count]) => `
        <div class="breakdown-row">
          <div class="breakdown-label" style="text-transform:capitalize;">${sev}</div>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar" style="width:0%;background:${SEVERITY_COLORS[sev]};" data-width="${Math.round(count / maxCount * 100)}"></div>
          </div>
          <div class="breakdown-count">${count}</div>
        </div>`).join('');

      requestAnimationFrame(() => {
        document.querySelectorAll('.breakdown-bar').forEach(b => { b.style.width = b.dataset.width + '%'; });
      });
    }

    // Recently resolved
    const recent = complaints
      .filter(c => c.status === 'resolved')
      .sort((a, b) => new Date(b.resolvedAt || 0) - new Date(a.resolvedAt || 0))
      .slice(0, 5);

    const resolvedEl = document.getElementById('resolved-list');
    if (resolvedEl) {
      resolvedEl.innerHTML = recent.length
        ? recent.map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--slate-100);">
              <div>
                <div style="font-size:0.85rem;font-weight:600;color:var(--slate-800);">${c.title}</div>
                <div style="font-size:0.75rem;color:var(--slate-500);margin-top:2px;">${c.id} · ${c.department}</div>
              </div>
              ${statusBadge('resolved')}
            </div>`).join('')
        : '<p style="font-size:0.85rem;color:var(--slate-400);padding:16px 0;">No resolved complaints yet.</p>';
    }

    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('stats-content').style.display = 'block';

  } catch {
    const ls = document.getElementById('loading-state');
    if (ls) ls.innerHTML = '<p style="color:var(--red);">Could not load stats. Is the backend running?</p>';
  }
}

// =============================================
// DARK MODE
// =============================================

function toggleOfficerTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cityfix-theme', next);
  const icon = document.getElementById('officer-theme-icon');
  if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
}

// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('cityfix-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('officer-theme-icon');
    if (icon) icon.textContent = saved === 'dark' ? '☀️' : '🌙';
  });
})();

// =============================================
// PAGE: profile.html
// =============================================

let _officerData = null; // cached officer object

async function loadProfile() {
  try {
    const targetId = SESSION.officerId || SESSION.id;
    const resp = await fetch(`${BASE_URL}/api/officers/${targetId}`);
    if (!resp.ok) throw new Error();
    const o = await resp.json();
    _officerData = o;

    const initials = o.name
      ? o.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
      : 'OF';

    // Hero
    setEl('hero-initials',    initials);
    setEl('hero-name',        o.name);
    setEl('hero-designation', o.designation    || '—');
    setEl('hero-dept',        o.departmentName || '—');
    setEl('hero-id-tag',      o.officerId);

    const statusTag = document.getElementById('hero-status-tag');
    if (statusTag) {
      statusTag.innerHTML = `<span class="status-dot-circle"></span> ${o.status || 'Active'}`;
      statusTag.className = 'hero-tag ' + (o.status === 'Active' ? 'hero-tag-green' : 'hero-tag-default');
    }
    updateStatusBadge(o.status || 'Active');

    const handled  = o.casesHandled  || 0;
    const resolved = o.casesResolved || 0;
    const rate     = handled > 0 ? Math.round((resolved / handled) * 100) : 0;
    setEl('stat-handled',  handled);
    setEl('stat-resolved', resolved);
    setEl('stat-rate',     rate + '%');

    // Info rows
    setEl('info-name',        o.name);
    setEl('info-email',       o.email);
    setEl('info-phone',       o.phone          || '—');
    setEl('info-officerId',   o.officerId);
    setEl('info-dept',        o.departmentName || '—');
    setEl('info-designation', o.designation    || '—');
    setEl('info-joindate',    o.joinDate        || '—');

    const infoStatus = document.getElementById('info-status');
    if (infoStatus) {
      infoStatus.innerHTML = o.status === 'Active'
        ? '<span class="status-dot active"><span class="status-dot-circle"></span> Active</span>'
        : '<span class="status-dot" style="background:rgba(245,158,11,0.12);color:#b45309;"><span class="status-dot-circle" style="background:#f59e0b;"></span> On Leave</span>';
    }

    setEl('block-handled',  handled);
    setEl('block-resolved', resolved);

    setEl('topbar-username',   o.name       || 'Officer');
    setEl('avatar-initials',   initials);
    setEl('dropdown-initials', initials);
    setEl('dropdown-name',     o.name       || 'Officer');
    setEl('dropdown-email',    o.email      || '—');
    setEl('dropdown-dept',     o.departmentName || '—');

    document.getElementById('loading-state').style.display   = 'none';
    const profileContent = document.getElementById('profile-content');
    if (profileContent) profileContent.style.display = 'block';

  } catch {
    const ls = document.getElementById('loading-state');
    if (ls) { ls.style.display = 'block'; ls.innerHTML = '<p style="color:var(--red);">Could not load profile. Is the backend running?</p>'; }
  }
}

// ── Edit Profile (collapsed) ───────────────────
function toggleEditSection() {
  const section = document.getElementById('edit-profile-section');
  const pwSection = document.getElementById('change-pw-section');
  if (!section) return;
  const isOpen = section.style.display !== 'none';
  section.style.display = isOpen ? 'none' : 'block';
  if (!isOpen && pwSection) pwSection.style.display = 'none';
  if (!isOpen && _officerData) {
    const nameEl = document.getElementById('edit-name');
    const phoneEl = document.getElementById('edit-phone');
    const desigEl = document.getElementById('edit-designation');
    if (nameEl)  nameEl.value  = _officerData.name        || '';
    if (phoneEl) phoneEl.value = _officerData.phone       || '';
    if (desigEl) desigEl.value = _officerData.designation || '';
  }
}

async function saveOfficerProfile() {
  const name  = (document.getElementById('edit-name')  || {}).value?.trim();
  const phone = (document.getElementById('edit-phone') || {}).value?.trim();
  const desig = (document.getElementById('edit-designation') || {}).value?.trim();
  if (!name) { showToast('Name cannot be empty.', 'error'); return; }

  const btn = document.getElementById('edit-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const targetId = (_officerData && _officerData.officerId) || SESSION.officerId || SESSION.id;
    const resp = await fetch(`${BASE_URL}/api/officers/${targetId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, phone, designation: desig }),
    });
    const data = await resp.json();
    if (resp.ok) {
      _officerData = data.officer || _officerData;
      SESSION.name = name;
      sessionStorage.setItem('cityfix_user', JSON.stringify(SESSION));
      localStorage.setItem('cityfix_user', JSON.stringify(SESSION));
      showToast('Profile updated!', 'success');
      document.getElementById('edit-profile-section').style.display = 'none';
      await loadProfile();
    } else {
      showToast(data.message || 'Failed to save.', 'error');
    }
  } catch {
    showToast('Cannot connect to server.', 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
}

// ── Change Password (collapsed) ────────────────
function togglePwSection() {
  const section   = document.getElementById('change-pw-section');
  const editSection = document.getElementById('edit-profile-section');
  if (!section) return;
  const isOpen = section.style.display !== 'none';
  section.style.display = isOpen ? 'none' : 'block';
  if (!isOpen && editSection) editSection.style.display = 'none';
}

async function changePassword() {
  const current   = (document.getElementById('pwd-current') || {}).value;
  const newPwd    = (document.getElementById('pwd-new')     || {}).value;
  const confirm   = (document.getElementById('pwd-confirm') || {}).value;
  const btn       = document.getElementById('pwd-btn');

  if (!current || !newPwd || !confirm) { showToast('Please fill all fields.', 'error'); return; }
  if (newPwd.length < 8) { showToast('New password must be at least 8 characters.', 'error'); return; }
  if (newPwd !== confirm) { showToast('Passwords do not match.', 'error'); return; }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating…'; }

  try {
    const targetId = (_officerData && _officerData.officerId) || SESSION.officerId || SESSION.id;
    const resp = await fetch(`${BASE_URL}/api/officers/${targetId}/change-password`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ currentPassword: current, newPassword: newPwd }),
    });
    const data = await resp.json();
    if (resp.ok) {
      showToast('Password updated successfully!', 'success');
      document.getElementById('change-pw-section').style.display = 'none';
      ['pwd-current','pwd-new','pwd-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    } else {
      showToast(data.message || 'Failed to update password.', 'error');
    }
  } catch {
    showToast('Server error. Try again later.', 'error');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Change Password'; }
}

// =============================================
// ROUTER — detect current page and init
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  populateTopbar();

  // Show level-based sidebar links
  const level = SESSION.level || 1;
  const levelRoleEl = document.getElementById('topbar-level-role');
  if (levelRoleEl) levelRoleEl.textContent = `Level ${level} Officer`;

  if (level >= 2) {
    const escLink = document.getElementById('sidebar-escalated');
    if (escLink) escLink.style.display = '';
  }
  if (level >= 3) {
    const l3Link = document.getElementById('sidebar-l3');
    if (l3Link) l3Link.style.display = '';
  }

  const page = window.location.pathname.split('/').pop();

  if (page === 'complaints.html') {
    loadComplaints();
  } else if (page === 'mystats.html') {
    loadStats();
  } else if (page === 'profile.html') {
    loadProfile();
  } else if (page === 'officer_view_complaint.html') {
    // detail page handled by officer_view_complaint.js
  }
  // escalated.html and l3_pending.html have their own inline scripts
});
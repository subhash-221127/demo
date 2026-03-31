// =============================================
// officer_view_complaint.js
// Officer's full complaint detail page
// Reads ?id= from URL (MongoDB _id)
// =============================================

// BASE_URL and SESSION are already set by officer.js

// ── Badge helpers ──────────────────────────────────────────────
function statusBadgeHTML(s) {
  const map = {
    pending:     '<span class="badge-status pending"><i class="fa-solid fa-clock"></i> Pending</span>',
    assigned:    '<span class="badge-status assigned"><i class="fa-solid fa-user-tie"></i> Assigned</span>',
    in_progress: '<span class="badge-status in_progress"><i class="fa-solid fa-rotate"></i> In Progress</span>',
    inprogress:  '<span class="badge-status in_progress"><i class="fa-solid fa-rotate"></i> In Progress</span>',
    resolved:    '<span class="badge-status resolved"><i class="fa-solid fa-circle-check"></i> Resolved</span>',
    rejected:    '<span class="badge-status rejected"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>',
  };
  return map[s] || map.pending;
}

function sevBadgeHTML(s) {
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
  return `<span class="sev-badge sev-${s}"><span class="sev-dot"></span>${label}</span>`;
}

// ── Timeline step icons ────────────────────────────────────────
const STEP_ICONS = {
  'Submitted':   'fa-paper-plane',
  'Verified':    'fa-shield-halved',
  'Assigned':    'fa-user-tie',
  'In Progress': 'fa-screwdriver-wrench',
  'Resolved':    'fa-circle-check',
  'Closed':      'fa-lock',
};

function buildBasicTimeline(status, raw) {
  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }
  const createdDate  = raw ? fmt(raw.createdAt)  : '—';
  const assignedDate = raw ? fmt(raw.assignedAt) : '—';
  const resolvedDate = raw ? fmt(raw.resolvedAt) : '—';

  const steps = [
    { step: 'Submitted',   state: 'done',    date: createdDate,  desc: 'Complaint received by system.' },
    { step: 'Verified',    state: 'pending', date: '—',          desc: 'Under admin review.' },
    { step: 'Assigned',    state: 'pending', date: assignedDate, desc: 'Assigned to field officer.' },
    { step: 'In Progress', state: 'pending', date: '—',          desc: 'Officer working on it.' },
    { step: 'Resolved',    state: 'pending', date: resolvedDate, desc: 'Issue resolved.' },
    { step: 'Closed',      state: 'pending', date: '—',          desc: 'Case closed.' },
  ];
  if (status === 'pending')    { steps[1].state = 'active'; }
  if (status === 'assigned')   { steps[1].state = 'done'; steps[2].state = 'active'; }
  if (status === 'in_progress' || status === 'inprogress') {
    steps[1].state = 'done'; steps[2].state = 'done'; steps[3].state = 'active';
  }
  if (status === 'resolved') { steps.slice(0, 5).forEach(s => s.state = 'done'); steps[5].state = 'active'; }
  if (status === 'rejected') {
    return [
      { step: 'Submitted', state: 'done',   date: '—', desc: 'Complaint received.' },
      { step: 'Rejected',  state: 'done',   date: '—', desc: 'Rejected / case declined.' },
      { step: 'Closed',    state: 'active', date: '—', desc: 'Case closed.' },
    ];
  }
  return steps;
}

function buildTimeline(timeline) {
  return timeline.map((t, i) => {
    let stateClass = t.state === 'pending' ? 'pending-step' : t.state;
    if (t.step === 'Rejected' && t.state === 'done') stateClass += ' rejected-step';

    const dotIcon = t.state === 'done'
      ? 'fa-check'
      : t.state === 'active'
        ? (STEP_ICONS[t.step] || 'fa-rotate')
        : 'fa-circle';

    const pipeHTML = (i < timeline.length - 1) ? `
      <div class="flow-pipe"><div class="flow-liquid"></div></div>` : '';

    return `
      <div class="flow-step ${stateClass}" data-state="${stateClass}">
        ${pipeHTML}
        <div class="flow-dot"><i class="fa-solid ${dotIcon}"></i></div>
        <div class="flow-body">
          <div class="flow-title">${t.step}</div>
          <div class="flow-desc">${t.desc}</div>
          ${t.date && t.date !== '—' ? `<div class="flow-date"><i class="fa-regular fa-clock"></i> ${t.date}</div>` : ''}
          ${t.note ? `<div class="flow-note"><i class="fa-solid fa-circle-info"></i> ${t.note}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function initLiquidAnimation() {
  const timeline = document.getElementById('flowTimeline');
  if (!timeline) return;
  const steps = Array.from(timeline.querySelectorAll('.flow-step'));
  const POUR_DURATION = 600;
  const STEP_DELAY    = 180;

  function animateSteps() {
    steps.forEach((step, i) => {
      const state  = step.dataset.state;
      const liquid = step.querySelector('.flow-liquid');
      const delay  = i * (POUR_DURATION * 0.55 + STEP_DELAY);
      setTimeout(() => step.classList.add('dot-visible'), delay + 80);
      if (liquid && state !== 'pending-step') {
        setTimeout(() => {
          if (state === 'done') {
            liquid.style.transition = `height ${POUR_DURATION}ms cubic-bezier(0.25,0.8,0.25,1)`;
            step.classList.add('liquid-done');
          } else if (state === 'active') {
            liquid.style.transition = `height ${POUR_DURATION * 1.3}ms cubic-bezier(0.25,0.8,0.25,1)`;
            step.classList.add('liquid-active');
          }
        }, delay + 120);
      }
    });
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { setTimeout(animateSteps, 200); obs.unobserve(entry.target); }
      });
    },
    { threshold: 0.15 }
  );
  observer.observe(timeline);
}

// ── Normalize raw complaint ────────────────────────────────────
function normalizeComplaintOfficer(c) {
  const locationStr = c.location?.address || c.location || '—';
  const lat = c.location?.lat || null;
  const lng = c.location?.lng || null;
  return {
    id:          c.complaintId || c._id,
    _id:         c._id,
    title:       c.title       || 'Untitled',
    description: c.description || '',
    department:  c.department  || '—',
    severity:    c.severity    || 'medium',
    status:      c.status      || 'assigned',
    location:    locationStr,
    lat, lng,
    mapsUrl: (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null,
    date: c.createdAt
      ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—',
    assignedAt: c.assignedAt
      ? new Date(c.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—',
    resolvedAt: c.resolvedAt
      ? new Date(c.resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : null,
    citizen: {
      name:  c.citizenId?.name  || '—',
      email: c.citizenId?.email || '—',
      phone: c.citizenId?.phone || '—',
    },
    evidencePaths:          c.evidencePaths || [],
    resolutionEvidencePaths: c.resolutionEvidencePaths || [],
    comments:               c.comments      || [],
    timeline:               c.timeline      || buildBasicTimeline(c.status, c),
    rejectionReason:        c.rejectionReason || '',
    isAnonymous:            c.isAnonymous || false,
    aiVerification:         c.aiVerification || null,
    _rawCreatedAt:          c.createdAt || null,
    _rawAssignedAt:         c.assignedAt || null,
    _rawResolvedAt:         c.resolvedAt || null,
    escalationLevel:        c.escalationLevel || 1,
    escalatedAt:            c.escalatedAt || null,
    escalatedToL3At:        c.escalatedToL3At || null,
    escalationNote:         c.escalationNote || '',
    escalationHistory:      c.escalationHistory || [],
    level2Officer: c.level2OfficerId && typeof c.level2OfficerId === 'object' ? c.level2OfficerId : null,
    level3Officer: c.level3OfficerId && typeof c.level3OfficerId === 'object' ? c.level3OfficerId : null,
  };
}

// ── Render the full page ───────────────────────────────────────
function renderOfficerDetail(c) {
  const headerSub = document.getElementById('headerSub');
  if (headerSub) headerSub.textContent = c.id + ' · ' + c.department;

  // Comments HTML
  const commentsHTML = (c.comments || []).map(cm => `
    <div class="comment-item">
      <div class="comment-meta"><strong>${cm.author || 'Officer'}</strong><span>${cm.date || 'Earlier'}</span></div>
      <div class="comment-text">${cm.text}</div>
    </div>`).join('') || '<p style="font-size:0.82rem;color:var(--slate-400);padding:8px 0;">No messages yet.</p>';

  // Evidence HTML
  const evidenceHTML = c.evidencePaths.length > 0
    ? c.evidencePaths.map(e => `
        <a href="${e}" target="_blank" class="evidence-link">
          <i class="fa-solid fa-file-image"></i> View Evidence File
        </a>`).join('')
    : '<p style="font-size:0.82rem;color:var(--slate-400);">No evidence uploaded yet.</p>';

  // Rejection notice
  const rejectionHTML = (c.status === 'rejected' && c.rejectionReason) ? `
    <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:14px;padding:16px 20px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:1rem;">❌</span>
        <span style="font-size:0.75rem;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;">Rejection Reason</span>
      </div>
      <div style="font-size:0.9rem;color:#7f1d1d;line-height:1.6;">${c.rejectionReason}</div>
    </div>` : '';

  // Resolved banner
  const resolvedBanner = c.status === 'resolved' ? `
    <div class="resolved-banner">
      <i class="fa-solid fa-circle-check"></i>
      <div>
        <div class="resolved-banner-text">Complaint Resolved</div>
        <div class="resolved-banner-sub">Resolved on ${c.resolvedAt || '—'}</div>
      </div>
    </div>` : '';

  // Escalation banner — shown to L2/L3 officers viewing an escalated complaint
  let escalationBannerHTML = '';
  if (c.escalationLevel >= 2) {
    const escDate  = c.escalationLevel === 3
      ? (c.escalatedToL3At ? new Date(c.escalatedToL3At).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—')
      : (c.escalatedAt    ? new Date(c.escalatedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—');
    const levelLabel = c.escalationLevel === 3 ? 'Level 3 – Director Review' : 'Level 2 – Senior Officer';

    // Build handler history timeline from escalationHistory array
    const histList = c.escalationHistory || [];
    const historyTimelineHTML = histList.length > 0 ? `
      <div style="margin-top:14px;padding-top:12px;border-top:1.5px dashed #fed7aa;">
        <div style="font-size:0.7rem;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">
          <i class="fa-solid fa-clock-rotate-left"></i>&nbsp; Handler History
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${histList.map((h, idx) => {
            const isLast = idx === histList.length - 1;
            const levelColors = {1:'#2563eb',2:'#f97316',3:'#dc2626'};
            const dColor = levelColors[h.level] || '#6b7280';
            const assignedStr = h.assignedAt
              ? new Date(h.assignedAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
              : '—';
            return `<div style="display:flex;align-items:flex-start;gap:10px;">
              <div style="width:26px;height:26px;border-radius:50%;background:${dColor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:900;flex-shrink:0;margin-top:1px;">L${h.level}</div>
              <div style="flex:1;">
                <div style="font-size:0.82rem;font-weight:800;color:#1e3a5f;">${h.officerName || '—'}</div>
                <div style="font-size:0.72rem;color:#78350f;margin-top:1px;">Assigned: ${assignedStr}</div>
                ${h.reason ? `<div style="font-size:0.7rem;color:#9a3412;margin-top:2px;font-style:italic;">${h.reason.substring(0,120)}${h.reason.length>120?'…':''}</div>` : ''}
              </div>
              <div style="font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:10px;flex-shrink:0;${isLast ? 'background:#fef2f2;color:#dc2626;' : 'background:#f0fdf4;color:#15803d;'}">
                ${isLast ? '🔴 Current' : '✅ Escalated'}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : '';

    escalationBannerHTML = `
      <div style="background:linear-gradient(135deg,#fff7ed,#fef2f2);border:2px solid #fed7aa;border-radius:16px;padding:16px 22px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:44px;height:44px;background:linear-gradient(135deg,#f97316,#dc2626);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;flex-shrink:0;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:0.75rem;font-weight:800;color:#c2410c;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">
              🔺 Escalated — ${levelLabel}
            </div>
            <div style="font-size:0.88rem;font-weight:700;color:#92400e;">
              This complaint was not resolved within SLA and escalated to you on <strong>${escDate}</strong>.
            </div>
            ${c.escalationNote ? `<div style="margin-top:8px;font-size:0.8rem;color:#9a3412;background:#fef3c7;border-radius:8px;padding:6px 10px;"><strong>Director Note:</strong> ${c.escalationNote}</div>` : ''}
          </div>
        </div>
        ${historyTimelineHTML}
      </div>`;
  }

  // Citizen initials for avatar
  const citizenInitials = c.citizen.name !== '—'
    ? c.citizen.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'CI';

  // Action panel HTML (based on status)
  let actionPanelHTML = '';
  if (c.status === 'assigned') {
    actionPanelHTML = `
      <div class="action-panel">
        <div class="action-panel-title"><i class="fa-solid fa-bolt"></i> Quick Actions</div>
        <div class="action-panel-body">
          <button class="btn-full btn-full-primary" onclick="startWork('${c._id}')">
            <i class="fa-solid fa-play"></i> Start Working on Complaint
          </button>
          <button class="btn-full btn-full-red" onclick="showRejectPanel()">
            <i class="fa-solid fa-ban"></i> Decline Assignment
          </button>
          <div id="reject-panel" style="display:none;border-top:1px solid var(--slate-100);padding-top:12px;">
            <label style="font-size:0.78rem;font-weight:700;color:var(--slate-500);display:block;margin-bottom:6px;">
              Reason for declining <span style="color:var(--red);">*</span>
            </label>
            <textarea class="rejection-textarea" id="reject-reason" placeholder="Explain why you are declining this assignment…" rows="3"></textarea>
            <button class="btn-full btn-full-red" style="margin-top:10px;" onclick="submitDecline('${c._id}')">
              <i class="fa-solid fa-circle-xmark"></i> Confirm Decline
            </button>
          </div>
        </div>
      </div>`;
  } else if (c.status === 'in_progress') {
    actionPanelHTML = `
      <div class="action-panel">
        <div class="action-panel-title"><i class="fa-solid fa-bolt"></i> Close Complaint</div>
        <div class="action-panel-body">
          <div>
            <label style="font-size:0.78rem;font-weight:700;color:var(--slate-500);display:block;margin-bottom:8px;">
              Upload Resolution Photo (Required — AI will verify before/after)
            </label>
            <div class="upload-area" onclick="document.getElementById('resolve-evidence').click()">
              <input type="file" id="resolve-evidence" accept="image/*,video/*,.pdf" onchange="previewUpload(this)"/>
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.4rem;color:var(--slate-400);margin-bottom:8px;display:block;"></i>
              <div class="upload-label"><strong>Click to upload</strong> or drag &amp; drop<br/>Images, videos, or PDFs</div>
              <div class="upload-preview" id="upload-preview-text" style="display:none;"></div>
            </div>
          </div>
          <button class="btn-full btn-full-green" id="resolve-btn" onclick="submitResolve('${c._id}')">
            <i class="fa-solid fa-circle-check"></i> Mark as Resolved &amp; Close
          </button>
        </div>
      </div>`;
  } else if (c.status === 'resolved') {
    actionPanelHTML = `
      <div class="action-panel">
        <div class="action-panel-title"><i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Completed</div>
        <div class="action-panel-body" style="text-align:center;padding:20px;">
          <i class="fa-solid fa-circle-check" style="font-size:2rem;color:var(--green);margin-bottom:10px;display:block;"></i>
          <div style="font-weight:800;color:#15803d;margin-bottom:4px;">Successfully Resolved</div>
          <div style="font-size:0.82rem;color:var(--slate-500);">Resolved on ${c.resolvedAt || '—'}</div>
        </div>
      </div>`;
  } else if (c.status === 'rejected') {
    actionPanelHTML = `
      <div class="action-panel">
        <div class="action-panel-title"><i class="fa-solid fa-ban" style="color:var(--red);"></i> Rejected</div>
        <div class="action-panel-body" style="text-align:center;padding:20px;">
          <i class="fa-solid fa-ban" style="font-size:2rem;color:var(--red);margin-bottom:10px;display:block;"></i>
          <div style="font-weight:800;color:#dc2626;margin-bottom:4px;">Complaint Rejected</div>
          ${c.rejectionReason ? `<div style="font-size:0.82rem;color:var(--slate-500);">${c.rejectionReason}</div>` : ''}
        </div>
      </div>`;
  }

  // Send message section
  const messageHTML = `
    <div class="info-section">
      <div class="info-section-title">💬 Message Citizen</div>
      <div style="padding:14px 18px;">
        <div class="comment-list" id="commentList">${commentsHTML}</div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <input type="text" id="commentInput" placeholder="Type a message to the citizen…"
            style="flex:1;padding:10px 14px;border:1.5px solid var(--slate-200);border-radius:10px;font-family:var(--font);font-size:0.875rem;outline:none;background:var(--slate-50);"
            onkeydown="if(event.key==='Enter') sendMessage('${c._id}')"
            onfocus="this.style.borderColor='var(--navy)';this.style.background='#fff'"
            onblur="this.style.borderColor='var(--slate-200)';this.style.background='var(--slate-50)'"/>
          <button onclick="sendMessage('${c._id}')"
            style="padding:10px 16px;background:var(--navy);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>`;

  document.getElementById('detailWrap').innerHTML = `
    <button class="back-btn" onclick="window.location.href='complaints.html'">
      <i class="fa-solid fa-arrow-left"></i> Back to My Complaints
    </button>

    ${resolvedBanner}
    ${rejectionHTML}
    ${escalationBannerHTML}

    <!-- Hero Card -->
    <div class="detail-hero">
      <div class="hero-top">
        <div>
          <span class="hero-id">${c.id}</span>
          <div class="hero-title">${c.title}</div>
          <div class="hero-meta">
            ${statusBadgeHTML(c.status)}
            ${sevBadgeHTML(c.severity)}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:0.72rem;color:var(--slate-400);margin-bottom:4px;">Filed on</div>
          <div style="font-weight:800;font-size:0.95rem;">${c.date}</div>
        </div>
      </div>
      <div class="hero-grid">
        <div class="hg-item">
          <span class="hg-label"><i class="fa-solid fa-building"></i> Department</span>
          <span class="hg-val">${c.department}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label"><i class="fa-solid fa-location-dot"></i> Location</span>
          <span class="hg-val">
            ${c.location}
            ${c.mapsUrl ? `<a href="${c.mapsUrl}" target="_blank" class="maps-link" style="margin-left:8px;font-size:0.72rem;">
              <i class="fa-solid fa-map-location-dot"></i> Open in Maps</a>` : ''}
          </span>
        </div>
        <div class="hg-item">
          <span class="hg-label"><i class="fa-regular fa-calendar"></i> Assigned On</span>
          <span class="hg-val">${c.assignedAt}</span>
        </div>
      </div>
    </div>

    <!-- Citizen Info Strip -->
    <div class="citizen-strip">
      <div class="citizen-av">${citizenInitials}</div>
      <div style="flex:1;">
        <div class="citizen-name"><i class="fa-solid fa-user" style="margin-right:6px;opacity:0.65;"></i>${c.isAnonymous ? 'Anonymous Citizen' : c.citizen.name}</div>
        <div class="citizen-meta">Complainant</div>
        <div class="citizen-contacts">
          ${c.isAnonymous
            ? '<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;color:#92400e;background:#fffbeb;padding:4px 10px;border-radius:8px;border:1px solid #fde68a;"><i class=\"fa-solid fa-user-secret\"></i> Identity hidden</span>'
            : `${c.citizen.email && c.citizen.email !== '—' ? '<a href="mailto:'+c.citizen.email+'"><i class="fa-solid fa-envelope"></i>'+c.citizen.email+'</a>' : ''}
               ${c.citizen.phone && c.citizen.phone !== '—' ? '<a href="tel:'+c.citizen.phone+'"><i class="fa-solid fa-phone"></i>'+c.citizen.phone+'</a>' : ''}`
          }
        </div>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="detail-cols">
      <div class="detail-col-left">

        <!-- Timeline -->
        <div class="info-section">
          <div class="info-section-title">📦 Complaint Progress</div>
          <div style="padding:20px 18px 16px;">
            <div class="flow-timeline" id="flowTimeline">
              ${buildTimeline(c.timeline)}
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="info-section">
          <div class="info-section-title">📝 Description</div>
          <div style="padding:14px 18px;">
            <div class="desc-box">${c.description}</div>
          </div>
        </div>

        <!-- Citizen Evidence -->
        <div class="info-section">
          <div class="info-section-title">📎 Citizen-Submitted Evidence</div>
          <div class="evidence-grid">${evidenceHTML}</div>
        </div>

        <!-- Message Citizen -->
        ${messageHTML}

      </div>

      <div class="detail-col-right">

        <!-- Action Panel -->
        ${actionPanelHTML}

        <!-- Complaint Meta -->
        <div class="info-section">
          <div class="info-section-title">📋 Complaint Info</div>
          <div class="info-section-body">
            <div class="info-row-detail"><span class="lbl">Complaint ID</span><span class="val" style="font-family:monospace;">${c.id}</span></div>
            <div class="info-row-detail"><span class="lbl">Status</span><span class="val">${statusBadgeHTML(c.status)}</span></div>
            <div class="info-row-detail"><span class="lbl">Severity</span><span class="val">${sevBadgeHTML(c.severity)}</span></div>
            <div class="info-row-detail"><span class="lbl">Department</span><span class="val">${c.department}</span></div>
            <div class="info-row-detail"><span class="lbl">Filed On</span><span class="val">${c.date}</span></div>
            <div class="info-row-detail">
              <span class="lbl">Location</span>
              <span class="val" style="text-align:right;">
                ${c.location}
                ${c.mapsUrl ? `<br><a href="${c.mapsUrl}" target="_blank" class="maps-link" style="margin-top:4px;font-size:0.72rem;display:inline-flex;">
                  <i class="fa-solid fa-map-location-dot"></i> Open Maps</a>` : ''}
              </span>
            </div>
          </div>
        </div>

        <!-- Citizen Contact -->
        <div class="info-section">
          <div class="info-section-title">👤 Citizen Contact</div>
          <div class="info-section-body">
            <div class="info-row-detail"><span class="lbl">Name</span><span class="val">${c.isAnonymous ? 'Anonymous' : c.citizen.name}</span></div>
            <div class="info-row-detail"><span class="lbl">Email</span><span class="val" style="font-size:0.8rem;">${c.isAnonymous ? '<span style=\"display:inline-flex;align-items:center;gap:4px;color:#92400e;font-size:0.78rem;\"><i class=\"fa-solid fa-user-secret\"></i> Hidden</span>' : (c.citizen.email || '—')}</span></div>
            <div class="info-row-detail"><span class="lbl">Phone</span><span class="val">${c.isAnonymous ? '<span style=\"display:inline-flex;align-items:center;gap:4px;color:#92400e;font-size:0.78rem;\"><i class=\"fa-solid fa-user-secret\"></i> Hidden</span>' : (c.citizen.phone || '—')}</span></div>
          </div>
        </div>

      </div>
    </div>
  `;

  initLiquidAnimation();
}

// ── Actions ────────────────────────────────────────────────────

function showRejectPanel() {
  const panel = document.getElementById('reject-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function startWork(mongoId) {
  try {
    const resp = await fetch(`${BASE_URL}/api/complaint/${mongoId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    if (!resp.ok) throw new Error();
    showOfficerToast('▶ Complaint marked In Progress!', 'success');
    setTimeout(() => location.reload(), 1200);
  } catch {
    showOfficerToast('Failed to update status. Try again.', 'error');
  }
}

async function submitDecline(mongoId) {
  const reason = document.getElementById('reject-reason')?.value.trim();
  if (!reason) { showOfficerToast('Please enter a reason for declining.', 'error'); return; }

  try {
    const resp = await fetch(`${BASE_URL}/api/complaint/${mongoId}/reject-assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officerId: SESSION.officerId }),
    });
    if (!resp.ok) throw new Error();
    showOfficerToast('Assignment declined. Returning to queue.', 'success');
    setTimeout(() => window.location.href = 'complaints.html', 1400);
  } catch {
    showOfficerToast('Failed to decline. Try again.', 'error');
  }
}

function previewUpload(input) {
  const preview = document.getElementById('upload-preview-text');
  if (preview && input.files[0]) {
    preview.textContent = '✓ ' + input.files[0].name;
    preview.style.display = 'block';
  }
}

async function submitResolve(mongoId) {
  const btn       = document.getElementById('resolve-btn');
  const fileInput = document.getElementById('resolve-evidence');

  // ── Require a resolution photo ──────────────────────────────
  if (!fileInput || !fileInput.files[0]) {
    showOfficerToast('Please upload a photo showing the resolved issue before closing.', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying with AI…'; }

  try {
    const formData = new FormData();
    formData.append('evidence', fileInput.files[0]);

    const resp = await fetch(`${BASE_URL}/api/complaint/${mongoId}/resolve`, {
      method: 'PATCH',
      body: formData,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || 'Server error');

    if (data.aiPassed) {
      showOfficerToast('✓ Resolved! AI verification passed (score: ' + data.aiScore + '/100). Complaint marked as RESOLVED.', 'success');
    } else {
      showOfficerToast('📋 Evidence submitted. AI score: ' + data.aiScore + '/100 (below 70% threshold). Complaint remains IN PROGRESS. Sent to admin for review.', '');
    }
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    showOfficerToast(err.message || 'Failed to resolve complaint. Try again.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark as Resolved & Close'; }
  }
}

async function submitReject(mongoId) {
  const reason = document.getElementById('reject-reason')?.value.trim();
  if (!reason) { showOfficerToast('Please enter a rejection reason.', 'error'); return; }

  try {
    const resp = await fetch(`${BASE_URL}/api/complaint/${mongoId}/officer-reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    if (!resp.ok) throw new Error();
    showOfficerToast('Complaint rejected with reason.', 'success');
    setTimeout(() => location.reload(), 1400);
  } catch {
    showOfficerToast('Failed to reject complaint. Try again.', 'error');
  }
}

async function sendMessage(mongoId) {
  const input = document.getElementById('commentInput');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  const authorName = SESSION.name || SESSION.email || 'Officer';

  // Disable input while sending
  input.disabled = true;

  try {
    const resp = await fetch(`${BASE_URL}/api/complaint/${mongoId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: authorName, role: 'officer', text }),
    });
    if (!resp.ok) throw new Error('Failed to send');

    input.value = '';
    const list = document.getElementById('commentList');
    // Remove the "no messages" placeholder if present
    const emptyMsg = list.querySelector('p');
    if (emptyMsg) emptyMsg.remove();

    const now = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const div = document.createElement('div');
    div.className = 'comment-item comment-officer';
    div.innerHTML = `
      <div class="comment-meta"><strong>${authorName}</strong><span>${now}</span></div>
      <div class="comment-text">${text}</div>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    showOfficerToast('Message sent.');
  } catch (err) {
    showOfficerToast('Failed to send message. Try again.', 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ── Toast ──────────────────────────────────────────────────────
function showOfficerToast(msg, type = '') {
  const tc = document.getElementById('toast-container');
  if (!tc) return;
  const div = document.createElement('div');
  div.className = 'toast' + (type ? ' ' + type : '');
  div.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'}"></i> ${msg}`;
  tc.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // populateTopbar() is already called by officer.js DOMContentLoaded
  // but officer.js router won't find 'officer_view_complaint.html' in its switch,
  // so we handle init here

  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) {
    document.getElementById('detailWrap').innerHTML = `
      <div style="text-align:center;padding:80px 20px;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:3rem;color:var(--slate-300);display:block;margin-bottom:16px;"></i>
        <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:8px;">No Complaint ID Provided</h2>
        <a href="complaints.html" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--orange);color:#fff;border-radius:12px;font-weight:700;text-decoration:none;font-size:0.875rem;">
          ← Back to My Complaints</a>
      </div>`;
    return;
  }

  try {
    // Fetch by MongoDB _id — populate citizenId for contact info
    const res = await fetch(`${BASE_URL}/api/complaint/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Not found');
    const raw = await res.json();
    renderOfficerDetail(normalizeComplaintOfficer(raw));
  } catch (err) {
    console.error('Failed to load complaint:', err);
    document.getElementById('detailWrap').innerHTML = `
      <div style="text-align:center;padding:80px 20px;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:3rem;color:var(--slate-300);display:block;margin-bottom:16px;"></i>
        <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:8px;">Complaint Not Found</h2>
        <p style="color:var(--slate-500);margin-bottom:20px;">Could not load complaint "${id}".</p>
        <a href="complaints.html" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--orange);color:#fff;border-radius:12px;font-weight:700;text-decoration:none;font-size:0.875rem;">
          ← Back to My Complaints</a>
      </div>`;
  }
});
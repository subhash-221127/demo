// =============================================
// view_complaint.js  —  Complaint Detail page
// Reads ?id= from URL, fetches complaint from
// backend, and renders the liquid-pour timeline
// =============================================

// -----------------------------------------------
// 1. Badge helpers
// -----------------------------------------------

function statusBadgeHTML(s) {
  const map = {
    pending:    '<span class="badge-status pending"><i class="fa-solid fa-clock"></i> Pending</span>',
    in_progress:'<span class="badge-status inprogress"><i class="fa-solid fa-rotate"></i> In Progress</span>',
    inprogress: '<span class="badge-status inprogress"><i class="fa-solid fa-rotate"></i> In Progress</span>',
    resolved:   '<span class="badge-status resolved"><i class="fa-solid fa-circle-check"></i> Resolved</span>',
    rejected:   '<span class="badge-status rejected"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>',
  };
  return map[s] || map.pending;
}

function sevBadgeHTML(s) {
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
  return `<span class="sev-badge sev-${s}"><span class="sev-dot"></span>${label}</span>`;
}

// -----------------------------------------------
// 2. Step icons for the liquid timeline
// -----------------------------------------------

const STEP_ICONS = {
  "Submitted":   "fa-paper-plane",
  "Verified":    "fa-shield-halved",
  "Assigned":    "fa-user-tie",
  "In Progress": "fa-screwdriver-wrench",
  "Resolved":    "fa-circle-check",
  "Closed":      "fa-lock",
};

// -----------------------------------------------
// 3. Build the liquid-pour timeline HTML
//    (exact same structure as before)
// -----------------------------------------------

function buildTimeline(timeline) {
  return timeline.map((t, i) => {
    let stateClass = t.state === "pending" ? "pending-step" : t.state;
    if (t.step === "Rejected" && t.state === "done") stateClass += " rejected-step";
    const dotIcon = t.state === "done"
      ? "fa-check"
      : t.state === "active"
        ? (STEP_ICONS[t.step] || "fa-rotate")
        : "fa-circle";

    const pipeHTML = (i < timeline.length - 1) ? `
      <div class="flow-pipe">
        <div class="flow-liquid"></div>
      </div>` : "";

    return `
      <div class="flow-step ${stateClass}" data-state="${stateClass}">
        ${pipeHTML}
        <div class="flow-dot">
          <i class="fa-solid ${dotIcon}"></i>
        </div>
        <div class="flow-body">
          <div class="flow-title">${t.step}</div>
          <div class="flow-desc">${t.desc}</div>
          ${t.date && t.date !== "—" ? `<div class="flow-date"><i class="fa-regular fa-clock"></i> ${t.date}</div>` : ""}
          ${t.note ? `<div class="flow-note"><i class="fa-solid fa-circle-info"></i> ${t.note}</div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// -----------------------------------------------
// 4. Scroll-triggered liquid pour animation
//    (same as before — no change)
// -----------------------------------------------

function initLiquidAnimation() {
  const timeline = document.getElementById("flowTimeline");
  if (!timeline) return;

  const steps = Array.from(timeline.querySelectorAll(".flow-step"));
  const POUR_DURATION = 600;
  const STEP_DELAY    = 180;

  function animateSteps() {
    steps.forEach((step, i) => {
      const state  = step.dataset.state;
      const liquid = step.querySelector(".flow-liquid");
      const delay  = i * (POUR_DURATION * 0.55 + STEP_DELAY);

      setTimeout(() => { step.classList.add("dot-visible"); }, delay + 80);

      if (liquid && state !== "pending-step") {
        setTimeout(() => {
          if (state === "done") {
            liquid.style.transition = `height ${POUR_DURATION}ms cubic-bezier(0.25,0.8,0.25,1)`;
            step.classList.add("liquid-done");
          } else if (state === "active") {
            liquid.style.transition = `height ${POUR_DURATION * 1.3}ms cubic-bezier(0.25,0.8,0.25,1)`;
            step.classList.add("liquid-active");
          }
        }, delay + 120);
      } else if (state === "pending-step") {
        setTimeout(() => { step.classList.add("dot-visible"); }, delay + 80);
      }
    });
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(animateSteps, 200);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  observer.observe(timeline);
}

// -----------------------------------------------
// 5. Normalize backend complaint
// -----------------------------------------------

function normalizeComplaint(c) {
  // Read real user from session for the contact info panel
  const sessionUser = JSON.parse(sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user") || "{}");
  const locationStr = c.location?.address || c.location || "—";
  const lat = c.location?.lat || null;
  const lng = c.location?.lng || null;

  return {
    id:          c.complaintId || c._id,
    _id:         c._id,
    title:       c.title || "Untitled",
    description: c.description || "",
    department:  c.department || "—",
    severity:    c.severity || "medium",
    location:    locationStr,
    lat,
    lng,
    mapsUrl: (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null,
    date:        c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    status:      c.status === "in_progress" ? "inprogress" : (c.status || "pending"),
    officer: c.officerId?.name || "—",
    dept:       c.department || "—",
    officerPhone: c.officerId?.phone || null,
    officerEmail: c.officerId?.email || null,
    evidence:    c.evidencePaths?.[0] || null,
    resolutionEvidence: c.resolutionEvidencePaths?.[0] || null,
    rated:       c.rated || false,
    canReopen:   c.status === "resolved",
    upvotes:     c.upvotes || 0,
    rating:      c.rating || null,
    comments:    c.comments || [],
    // Contact info — pulled from session, not from complaint doc
    name:        sessionUser.name  || "—",
    mobile:      sessionUser.phone || "—",
    email:       sessionUser.email || "—",
    timeline:         c.timeline || buildBasicTimeline(c.status, c),
    rejectionReason:  c.rejectionReason || '',
    isAnonymous:      c.isAnonymous || false,
    _rawCreatedAt:    c.createdAt  || null,
    _rawAssignedAt:   c.assignedAt || null,
    _rawResolvedAt:   c.resolvedAt || null,
  };
}

function buildBasicTimeline(status, raw) {
  function fmtD(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }
  const createdDate  = raw ? fmtD(raw.createdAt)  : '—';
  const assignedDate = raw ? fmtD(raw.assignedAt) : '—';
  const resolvedDate = raw ? fmtD(raw.resolvedAt) : '—';

  const steps = [
    { step: "Submitted",   icon: "fa-paper-plane",       state: "done",    date: createdDate,  desc: "Complaint received.", note: "" },
    { step: "Verified",    icon: "fa-shield-check",       state: "pending", date: "—",         desc: "Under review.",       note: "" },
    { step: "Assigned",    icon: "fa-user-tie",           state: "pending", date: assignedDate, desc: "Pending assignment.", note: "" },
    { step: "In Progress", icon: "fa-screwdriver-wrench", state: "pending", date: "—",         desc: "Not yet started.",    note: "" },
    { step: "Resolved",    icon: "fa-circle-check",       state: "pending", date: resolvedDate, desc: "Pending.",            note: "" },
    { step: "Closed",      icon: "fa-lock",               state: "pending", date: "—",         desc: "Pending.",            note: "" },
  ];
  if (status === "pending")   { steps[0].state = "done"; steps[1].state = "active"; }
  if (status === "assigned")  { steps[0].state = "done"; steps[1].state = "done"; steps[2].state = "active"; }
  if (status === "in_progress" || status === "inprogress") {
    steps[0].state = "done"; steps[1].state = "done"; steps[2].state = "done"; steps[3].state = "active";
  }
  if (status === "resolved") { steps.slice(0, 5).forEach(s => s.state = "done"); steps[5].state = "active"; }
  if (status === "rejected") {
    return [
      { step: "Submitted", icon: "fa-paper-plane",  state: "done",   date: "—", desc: "Complaint received.", note: "" },
      { step: "Rejected",  icon: "fa-circle-xmark", state: "done",   date: "—", desc: "Rejected by admin.",  note: "" },
      { step: "Closed",    icon: "fa-lock",          state: "active", date: "—", desc: "Case closed.",        note: "" },
    ];
  }
  return steps;
}

// -----------------------------------------------
// 6. Render full detail page
//    (same HTML layout as before)
// -----------------------------------------------

function renderDetail(c) {
  const headerSub = document.getElementById("headerSub");
  if (headerSub) headerSub.textContent = c.id + " · " + c.department;

  const commentsHTML = (c.comments || []).map(cm => `
    <div class="comment-item">
      <div class="comment-meta"><strong>${cm.author}</strong><span>${cm.date}</span></div>
      <div class="comment-text">${cm.text}</div>
    </div>`).join("") || '<p style="font-size:0.82rem;color:var(--light);padding:8px 0;">No comments yet.</p>';

  const officerHTML = (c.officer && c.officer !== "—") ? `
    <div class="officer-strip">
      <div class="officer-av">${c.officer.split(" ").map(n => n[0]).join("")}</div>
      <div>
        <div class="officer-name"><i class="fa-solid fa-user-tie" style="margin-right:6px;opacity:0.6;"></i>${c.officer}</div>
        <div class="officer-dept">${c.dept || ""}</div>
        <div class="officer-contacts">
          ${c.officerPhone ? '<a href="tel:'+c.officerPhone+'"><i class="fa-solid fa-phone"></i>'+c.officerPhone+'</a>' : ''}
          ${c.officerEmail ? '<a href="mailto:'+c.officerEmail+'"><i class="fa-solid fa-envelope"></i>'+c.officerEmail+'</a>' : ''}
        </div>
      </div>
    </div>` : "";

  const ratingHTML = (c.status === "resolved" && !c.rated) ? `
    <div class="info-section" id="ratingSection">
      <div class="info-section-title">⭐ Rate the Resolution</div>
      <div style="padding:20px;text-align:center;">
        <p style="font-size:0.85rem;color:var(--muted);margin-bottom:14px;">How satisfied are you with how this was handled?</p>
        <div class="stars" id="starRow">
          ${[1,2,3,4,5].map(n => `<span class="star" data-v="${n}" onclick="setRating(${n})">★</span>`).join("")}
        </div>
        <textarea class="input textarea" id="ratingComment" placeholder="Share your feedback (optional)…" style="margin-top:14px;min-height:70px;"></textarea>
        <div style="margin-top:12px;">
          <button class="btn btn-orange" onclick="submitRating('${c._id}')">
            <i class="fa-solid fa-paper-plane"></i> Submit Rating
          </button>
        </div>
      </div>
    </div>` : "";

  const actionBar = `
    <div class="action-bar">
      <button class="btn btn-outline" onclick="window.location.href='citizen_mycomplaints.html'">
        <i class="fa-solid fa-arrow-left"></i> Back to My Complaints
      </button>
      ${c.status === "pending" ? `
        <button class="btn btn-danger" onclick="withdrawComplaint('${c._id}')">
          <i class="fa-solid fa-ban"></i> Withdraw
        </button>` : ""}
      ${c.status === "resolved" && c.canReopen ? `
        <button class="btn btn-outline" onclick="reopenComplaint('${c._id}')">
          <i class="fa-solid fa-rotate-left"></i> Re-open Issue
        </button>` : ""}
    </div>`;

  document.getElementById("detailWrap").innerHTML = `
    <button class="back-btn" onclick="window.location.href='citizen_mycomplaints.html'">
      <i class="fa-solid fa-arrow-left"></i> Back to My Complaints
    </button>

    <div class="detail-hero">
      <div class="hero-top">
        <div>
          <span class="hero-id">${c.id}</span>
          <div class="hero-title">${c.title}</div>
          <div class="hero-meta">
            ${statusBadgeHTML(c.status)}
            ${sevBadgeHTML(c.severity)}
            ${c.eta ? `<span class="eta-chip"><i class="fa-solid fa-calendar-check"></i> ETA: ${c.eta}</span>` : ""}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:0.75rem;color:var(--light);margin-bottom:4px;">Filed on</div>
          <div style="font-weight:700;font-size:0.9rem;">${c.date}</div>
        </div>
      </div>
      <div class="hero-grid">
        <div class="hg-item"><span class="hg-label"><i class="fa-solid fa-building"></i> Department</span><span class="hg-val">${c.department}</span></div>
        <div class="hg-item"><span class="hg-label"><i class="fa-solid fa-location-dot"></i> Location</span><span class="hg-val">
          ${c.location}
          ${c.mapsUrl ? `<a href="${c.mapsUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;margin-left:8px;font-size:0.75rem;color:var(--navy);font-weight:600;text-decoration:none;">
            <i class="fa-solid fa-map-location-dot"></i> View on Map</a>` : ""}
        </span></div>
        <div class="hg-item"><span class="hg-label"><i class="fa-solid fa-building"></i> Department</span><span class="hg-val">${c.dept || "—"}</span></div>
      </div>
    </div>

    ${c.status === 'rejected' && c.rejectionReason ? `
    <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:14px;padding:16px 20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:1rem;">❌</span>
        <span style="font-size:0.75rem;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;">Rejection Reason</span>
      </div>
      <div style="font-size:0.9rem;color:#7f1d1d;line-height:1.6;">${c.rejectionReason}</div>
    </div>` : ''}

    ${officerHTML}

    <div class="detail-cols">
      <div class="detail-col-left">

        <div class="info-section">
          <div class="info-section-title">📦 Complaint Progress</div>
          <div style="padding:20px 18px 16px;">
            <div class="flow-timeline" id="flowTimeline">
              ${buildTimeline(c.timeline)}
            </div>
          </div>
        </div>

        <div class="info-section">
          <div class="info-section-title">📝 Description</div>
          <div style="padding:14px 18px;">
            <div class="desc-box">${c.description}</div>
          </div>
        </div>

        ${c.evidence ? `
        <div class="info-section">
          <div class="info-section-title">📎 Evidence</div>
          <div style="padding:14px 18px;">
            <a href="${BASE_URL}/uploads/${c.evidence}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-file"></i> View Attached File
            </a>
          </div>
        </div>` : ""}

        ${(c.resolutionEvidence && c.status === "resolved") ? `
        <div class="info-section" style="border:1.5px solid var(--green-light);background:#f0fdf4;">
          <div class="info-section-title" style="color:var(--green-dark);">✅ Resolution Evidence</div>
          <div style="padding:14px 18px;">
            <p style="font-size:0.85rem;color:var(--muted);margin-bottom:10px;">Officer submitted proof of resolution:</p>
            <a href="${BASE_URL}/uploads/${c.resolutionEvidence}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-image"></i> View Resolution Photo
            </a>
          </div>
        </div>` : ""}

        <div class="info-section">
          <div class="info-section-title">💬 Comments &amp; Updates</div>
          <div style="padding:14px 18px;">
            <div class="comment-list" id="commentList">${commentsHTML}</div>
            <div style="display:flex;gap:8px;">
              <input class="input" type="text" id="commentInput"
                placeholder="Add a comment or update…" style="flex:1;"
                onkeydown="if(event.key==='Enter') addComment('${c._id}')"/>
              <button class="btn btn-primary btn-sm" onclick="addComment('${c._id}')">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>

        ${actionBar}

      </div>

      <div class="detail-col-right">

        <div class="info-section">
          <div class="info-section-title">📋 Complaint Info</div>
          <div class="info-section-body">
            <div class="info-row-detail"><span class="lbl">Complaint ID</span><span class="val" style="font-family:monospace;">${c.id}</span></div>
            <div class="info-row-detail"><span class="lbl">Status</span><span class="val">${statusBadgeHTML(c.status)}</span></div>
            <div class="info-row-detail"><span class="lbl">Severity</span><span class="val">${sevBadgeHTML(c.severity)}</span></div>
            <div class="info-row-detail"><span class="lbl">Department</span><span class="val">${c.department}</span></div>
            <div class="info-row-detail"><span class="lbl">Date Filed</span><span class="val">${c.date}</span></div>
            <div class="info-row-detail"><span class="lbl">Location</span><span class="val">
              ${c.location}
              ${c.mapsUrl ? `<a href="${c.mapsUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:0.75rem;color:var(--navy);font-weight:600;text-decoration:none;">
                <i class="fa-solid fa-map-location-dot"></i> Open in Maps</a>` : ""}
            </span></div>
            ${c.eta ? `<div class="info-row-detail"><span class="lbl">ETA</span><span class="val"><span class="eta-chip"><i class="fa-solid fa-calendar-check"></i> ${c.eta}</span></span></div>` : ""}
            ${c.upvotes ? `<div class="info-row-detail"><span class="lbl">Community Votes</span><span class="val"><i class="fa-solid fa-thumbs-up" style="color:var(--orange);margin-right:4px;"></i>${c.upvotes} others affected</span></div>` : ""}
            ${c.rating ? `<div class="info-row-detail"><span class="lbl">Your Rating</span><span class="val">${"★".repeat(c.rating)}${"☆".repeat(5 - c.rating)}</span></div>` : ""}
          </div>
        </div>

        <div class="info-section">
          <div class="info-section-title">👤 Your Contact Info</div>
          <div class="info-section-body">
            <div class="info-row-detail"><span class="lbl">Name</span><span class="val">${c.name}</span></div>
            <div class="info-row-detail"><span class="lbl">Mobile</span><span class="val">${c.mobile}</span></div>
            <div class="info-row-detail"><span class="lbl">Email</span><span class="val">${c.email}</span></div>
          </div>
        </div>

        ${ratingHTML}

      </div>
    </div>
  `;

  initLiquidAnimation();
}

// -----------------------------------------------
// 7. Actions — withdraw, reopen, comment, rating
// -----------------------------------------------

let currentRating = 0;

function setRating(n) {
  currentRating = n;
  document.querySelectorAll(".star").forEach(s => s.classList.toggle("filled", +s.dataset.v <= n));
}

async function submitRating(mongoId) {
  if (!currentRating) { alert("Please select a rating."); return; }

  try {
    await fetch(`${BASE_URL}/api/complaint/${mongoId}/rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: currentRating, comment: document.getElementById("ratingComment")?.value }),
    });
  } catch (err) {
    console.warn("Rating API not available:", err);
  }

  const sec = document.getElementById("ratingSection");
  if (sec) sec.innerHTML = `
    <div class="info-section-title">⭐ Rating Submitted</div>
    <div style="padding:20px 18px;text-align:center;color:var(--green-dark);font-weight:700;">
      <i class="fa-solid fa-circle-check" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>
      Thanks! You gave ${currentRating} star${currentRating > 1 ? "s" : ""}.
    </div>`;
  showToast("Thank you for your feedback!");
}

async function withdrawComplaint(mongoId) {
  const reason = prompt("Reason for withdrawing (optional):");
  if (reason === null) return;

  try {
    await fetch(`${BASE_URL}/api/complaint/${mongoId}/withdraw`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  } catch (err) {
    console.warn("Withdraw API not available:", err);
  }

  showToast("Complaint withdrawn");
  setTimeout(() => window.location.href = "citizen_mycomplaints.html", 1500);
}

async function reopenComplaint(mongoId) {
  if (!confirm("Re-open this complaint?")) return;

  try {
    await fetch(`${BASE_URL}/api/complaint/${mongoId}/reopen`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.warn("Reopen API not available:", err);
  }

  showToast("Complaint re-opened");
  setTimeout(() => window.location.href = "citizen_mycomplaints.html", 1500);
}

async function addComment(mongoId) {
  const input = document.getElementById("commentInput");
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();

  const sessionUser = JSON.parse(sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user") || "{}");
  const authorName  = sessionUser.name || sessionUser.email || "Citizen";

  try {
    await fetch(`${BASE_URL}/api/complaint/${mongoId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: authorName, text }),
    });
  } catch (err) {
    console.warn("Comment API not available:", err);
  }

  input.value = "";
  const list = document.getElementById("commentList");
  const div  = document.createElement("div");
  div.className = "comment-item";
  div.innerHTML = `
    <div class="comment-meta"><strong>${authorName}</strong><span>Just now</span></div>
    <div class="comment-text">${text}</div>`;
  list.appendChild(div);
  showToast("Comment added");
}

// -----------------------------------------------
// 8. Toast
// -----------------------------------------------

function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

// -----------------------------------------------
// 9. Profile dropdown
// -----------------------------------------------

// Profile dropdown handled by citizen-shell.js

function populateUserUI() {
  const user = JSON.parse(sessionStorage.getItem('cityfix_user') || localStorage.getItem('cityfix_user') || '{}');
  if (!user || !user.name) return;
  const initials = user.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const chipAvatar = document.querySelector('.chip-avatar');
  if (chipAvatar) chipAvatar.textContent = initials;
  const profileBtnName = document.querySelector('.profile-btn-name');
  if (profileBtnName) profileBtnName.textContent = user.name;
  const dropAvatar = document.querySelector('.dropdown-user-avatar');
  if (dropAvatar) dropAvatar.textContent = initials;
  const dropName = document.querySelector('.dropdown-user-name');
  if (dropName) dropName.textContent = user.name;
  const dropEmail = document.querySelector('.dropdown-user-email');
  if (dropEmail) dropEmail.textContent = user.email || '';
}

function toggleProfile(e) {
  e.stopPropagation();
  document.getElementById('profileBtn').classList.toggle('open');
  document.getElementById('profileDropdown').classList.toggle('open');
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = isDark ? '🌙' : '☀️';
}

document.addEventListener('click', () => {
  document.getElementById('profileBtn')?.classList.remove('open');
  document.getElementById('profileDropdown')?.classList.remove('open');
});

// -----------------------------------------------
// 10. INIT — read ?id= and fetch from backend
// -----------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  populateUserUI();
  const params  = new URLSearchParams(window.location.search);
  const id      = params.get("id");  // this is MongoDB _id

  if (!id) {
    document.getElementById("detailWrap").innerHTML = `
      <div style="text-align:center;padding:80px 20px;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:3rem;color:var(--border);display:block;margin-bottom:16px;"></i>
        <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:8px;">No Complaint ID Provided</h2>
        <a href="citizen_mycomplaints.html" class="btn btn-primary">← Back to My Complaints</a>
      </div>`;
    return;
  }

  try {
    // Fetch by MongoDB _id — backend should support GET /api/complaint/:id
    // Pass userId so backend knows this is the owner — full data returned even if anonymous
    const sessionUserRaw = sessionStorage.getItem('cityfix_user') || localStorage.getItem('cityfix_user') || '{}';
    const sessionUser    = JSON.parse(sessionUserRaw);
    const res = await fetch(`${BASE_URL}/api/complaint/${encodeURIComponent(id)}?userId=${sessionUser.id || ''}`);

    if (!res.ok) throw new Error("Not found");

    const raw = await res.json();
    renderDetail(normalizeComplaint(raw));

  } catch (err) {
    console.error("Failed to load complaint:", err);
    document.getElementById("detailWrap").innerHTML = `
      <div style="text-align:center;padding:80px 20px;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:3rem;color:var(--border);display:block;margin-bottom:16px;"></i>
        <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:8px;">Complaint Not Found</h2>
        <p style="color:var(--muted);margin-bottom:20px;">Could not load complaint "${id}".</p>
        <a href="citizen_mycomplaints.html" class="btn btn-primary">← Back to My Complaints</a>
      </div>`;
  }
});
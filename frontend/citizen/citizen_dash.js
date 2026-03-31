// =============================================
// citizen_dash.js  —  Dashboard page logic
// =============================================

// -----------------------------------------------
// 1. Badge helpers
// -----------------------------------------------

function statusBadgeHTML(s) {
  const map = {
    pending: ["badge-status pending", "fa-clock", "Pending"],
    in_progress: ["badge-status inprogress", "fa-rotate", "In Progress"],
    inprogress: ["badge-status inprogress", "fa-rotate", "In Progress"],
    resolved: ["badge-status resolved", "fa-circle-check", "Resolved"],
    rejected: ["badge-status rejected", "fa-circle-xmark", "Withdrawn"],
    assigned: ["badge-status inprogress", "fa-user-tie", "Assigned"],
  };
  const [cls, ico, lbl] = map[s] || map.pending;
  return `<span class="${cls}"><i class="fa-solid ${ico}"></i> ${lbl}</span>`;
}

function sevBadgeHTML(s) {
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
  return `<span class="sev-badge sev-${s}"><span class="sev-dot"></span>${label}</span>`;
}

function officerChipHTML(c) {
  if (!c.officer || c.officer === "—") return "";
  const ini = c.officer.split(" ").map(n => n[0]).join("");
  return `<span class="officer-chip"><span class="officer-chip-avatar">${ini}</span>${c.officer}</span>`;
}

function etaHTML(c) {
  const active = c.status === "in_progress" || c.status === "inprogress";
  if (!active || !c.eta) return "";
  return `<span class="eta-chip"><i class="fa-solid fa-calendar-check"></i> ETA: ${c.eta}</span>`;
}

// -----------------------------------------------
// 2. Normalize backend → frontend
// -----------------------------------------------

function normalizeComplaint(c) {
  // location is stored as { address, lat, lng } in MongoDB
  const locationStr = c.location?.address || c.location || "—";

  return {
    id: c.complaintId || c._id,
    _id: c._id,
    title: c.title || "Untitled",
    description: c.description || "",
    category: c.department || c.category || "Other",
    severity: c.severity || "medium",
    location: locationStr,
    date: c.createdAt
      ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "—",
    rawDate: c.createdAt || "",
    status: c.status === "in_progress" ? "inprogress" : (c.status || "pending"),
    officer: c.officerId?.name || "—",
    dept: c.department || "—",
    eta: c.eta || null,
    progress: c.progress || 0,
    upvotes: c.upvotes || 0,
    upvoted: false,
    rated: c.rated || false,
    canReopen: c.status === "resolved",
    evidence: c.evidencePaths?.[0] || null,
    timeline: c.timeline || buildBasicTimeline(c.status),
    comments: c.comments || [],
  };
}

function buildBasicTimeline(status) {
  const steps = [
    { step: "Submitted", icon: "fa-paper-plane", state: "done", date: "—", desc: "Complaint received.", note: "" },
    { step: "Verified", icon: "fa-shield-check", state: "pending", date: "—", desc: "Under review.", note: "" },
    { step: "Assigned", icon: "fa-user-tie", state: "pending", date: "—", desc: "Pending assignment.", note: "" },
    { step: "In Progress", icon: "fa-screwdriver-wrench", state: "pending", date: "—", desc: "Not yet started.", note: "" },
    { step: "Resolved", icon: "fa-circle-check", state: "pending", date: "—", desc: "Pending.", note: "" },
    { step: "Closed", icon: "fa-lock", state: "pending", date: "—", desc: "Pending.", note: "" },
  ];
  if (status === "pending") { steps[0].state = "done"; steps[1].state = "active"; }
  else if (status === "assigned") { steps[0].state = "done"; steps[1].state = "done"; steps[2].state = "active"; }
  else if (status === "in_progress" || status === "inprogress") { steps[0].state = "done"; steps[1].state = "done"; steps[2].state = "done"; steps[3].state = "active"; }
  else if (status === "resolved") { steps.slice(0, 5).forEach(s => s.state = "done"); steps[5].state = "active"; }
  return steps;
}

// -----------------------------------------------
// 3. Render complaint cards
// -----------------------------------------------

function renderComplaints(data) {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const sf = document.getElementById("statusFilter").value;
  const cf = document.getElementById("categoryFilter").value;
  const df = document.getElementById("dateFilter").value;
  const list = document.getElementById("complaintList");
  const empty = document.getElementById("emptyState");

  let filtered = [...data];
  if (q) filtered = filtered.filter(c => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.location.toLowerCase().includes(q));
  if (sf) filtered = filtered.filter(c => c.status === sf);
  if (cf) filtered = filtered.filter(c => c.category === cf);
  if (df === "week") filtered = filtered.filter(c => new Date(c.rawDate) >= new Date(Date.now() - 7 * 864e5));
  if (df === "month") filtered = filtered.filter(c => new Date(c.rawDate) >= new Date(Date.now() - 30 * 864e5));

  document.getElementById("listCount").textContent = `${filtered.length} complaint${filtered.length !== 1 ? "s" : ""}`;

  if (!filtered.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = filtered.map(c => `
    <div class="complaint-card" onclick="openModal('${c._id}', allComplaints)">
      <div class="complaint-card-top">
        <div style="flex:1;">
          <div class="complaint-id">${c.id}</div>
          <div class="complaint-title">${c.title}</div>
          <div class="complaint-meta">
            <span><i class="fa-solid fa-location-dot"></i> ${c.location}</span>
            <span><i class="fa-regular fa-calendar"></i> ${c.date}</span>
            <span><i class="fa-solid fa-tag"></i> ${c.category}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
          ${statusBadgeHTML(c.status)}
          ${sevBadgeHTML(c.severity)}
        </div>
      </div>
      <p class="complaint-desc">${c.description.substring(0, 100)}…</p>
      <div class="complaint-footer">
        <div class="complaint-tags">
          ${officerChipHTML(c)}
          ${etaHTML(c)}
        </div>
      </div>
      ${c.status === "inprogress" ? `
        <div style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--muted);margin-bottom:4px;">
            <span>Resolution progress</span><span>${c.progress || 40}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar" style="width:${c.progress || 40}%;background:var(--orange);"></div>
          </div>
        </div>` : ""}
    </div>
  `).join("");
}

// -----------------------------------------------
// 4. Stats
// -----------------------------------------------

function renderStats(data) {
  document.getElementById("s-total").textContent = data.length;
  document.getElementById("s-pending").textContent = data.filter(c => c.status === "pending").length;
  document.getElementById("s-progress").textContent = data.filter(c => c.status === "inprogress" || c.status === "assigned").length;
  document.getElementById("s-resolved").textContent = data.filter(c => c.status === "resolved").length;
}


// -----------------------------------------------
// 7. Detail modal
// -----------------------------------------------

function openModal(mongoId, data) {
  const c = data.find(x => x._id === mongoId || x.id === mongoId);
  if (!c) return;

  document.getElementById("modalId").textContent = c.id;
  document.getElementById("modalTitle").textContent = c.title;

  const tlHTML = c.timeline.map(t => `
    <div class="tl-step ${t.state}">
      <div class="tl-dot"><i class="fa-solid ${t.state === "done" ? "fa-check" : t.state === "active" ? t.icon : "fa-circle"}"></i></div>
      <div class="tl-content">
        <div class="tl-title">${t.step}</div>
        <div class="tl-desc">${t.desc}</div>
        ${t.date && t.date !== "—" ? `<div class="tl-date"><i class="fa-regular fa-clock"></i> ${t.date}</div>` : ""}
        ${t.note ? `<div class="tl-note"><i class="fa-solid fa-circle-info"></i> ${t.note}</div>` : ""}
      </div>
    </div>`).join("");

  document.getElementById("modalBody").innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">Complaint Details</div>
      <div class="modal-grid">
        <div class="modal-field"><label>Category</label><span>${c.category}</span></div>
        <div class="modal-field"><label>Severity</label><span>${sevBadgeHTML(c.severity)}</span></div>
        <div class="modal-field"><label>Status</label><span>${statusBadgeHTML(c.status)}</span></div>
        <div class="modal-field"><label>Date Filed</label><span>${c.date}</span></div>
        <div class="modal-field"><label>Officer</label><span>${c.officer || "Not assigned"}</span></div>
        <div class="modal-field"><label>Department</label><span>${c.dept || "—"}</span></div>
        <div class="modal-field"><label>Location</label><span>${c.location}</span></div>
      </div>
      <div style="margin-top:12px;">
        <div class="modal-section-title">Description</div>
        <div class="modal-desc-box">${c.description}</div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Progress Timeline</div>
      <div class="timeline">${tlHTML}</div>
    </div>
    ${c.evidence ? `
    <div class="modal-section">
      <div class="modal-section-title">Evidence</div>
      <a href=c.evidence target="_blank" class="btn btn-outline btn-sm">
        <i class="fa-solid fa-file"></i> View Attached File
      </a>
    </div>` : ""}
  `;

  document.getElementById("modalOverlay").classList.add("show");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("show");
}

// -----------------------------------------------
// 8. Toast
// -----------------------------------------------

function showToast(msg, sub) {
  const t = document.getElementById("toast");
  if (!t) return;
  document.getElementById("toastMsg").textContent = msg;
  document.getElementById("toastSub").textContent = sub || "";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

// -----------------------------------------------
// 9. Profile dropdown + populate user info
// -----------------------------------------------

function populateUserUI() {
  const user = JSON.parse(sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user") || "{}");
  if (!user.name) return;

  const initials = user.initials || user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const pageSub = document.querySelector(".page-sub");
  if (pageSub) pageSub.textContent = `${greeting}, ${user.name.split(" ")[0]} 👋`;

  // Profile button
  const chipAvatar = document.querySelector(".chip-avatar");
  if (chipAvatar) chipAvatar.textContent = initials;
  const profileBtnName = document.querySelector(".profile-btn-name");
  if (profileBtnName) profileBtnName.textContent = user.name;

  // Dropdown
  const dropAvatar = document.querySelector(".dropdown-user-avatar");
  if (dropAvatar) dropAvatar.textContent = initials;
  const dropName = document.querySelector(".dropdown-user-name");
  if (dropName) dropName.textContent = user.name;
  const dropEmail = document.querySelector(".dropdown-user-email");
  if (dropEmail) dropEmail.textContent = user.email || "";
}

function toggleProfile(e) {
  e.stopPropagation();
  document.getElementById("profileBtn").classList.toggle("open");
  document.getElementById("profileDropdown").classList.toggle("open");
}

document.addEventListener("click", () => {
  document.getElementById("profileBtn")?.classList.remove("open");
  document.getElementById("profileDropdown")?.classList.remove("open");
});

// -----------------------------------------------
// 10. MAIN — fetch from backend using userId
// -----------------------------------------------

let allComplaints = [];

async function loadDashboard() {
  try {
    const user = JSON.parse(sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user") || "{}");
    const userId = user.id || "";

    if (!userId) {
      // Not logged in — redirect to login
      window.location.href = "../login.html";
      return;
    }

    const res = await fetch(`${BASE_URL}/api/mycomplaints?userId=${encodeURIComponent(userId)}`);
    const raw = await res.json();

    if (!Array.isArray(raw)) {
      console.error("Expected array from /api/mycomplaints, got:", raw);
      return;
    }

    allComplaints = raw.map(normalizeComplaint);

    renderStats(allComplaints);
    renderComplaints(allComplaints);

  } catch (err) {
    console.error("Failed to load dashboard:", err);
    showToast("Could not connect to server. Is the backend running?", "");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  populateUserUI();
  loadDashboard();

  document.getElementById("searchInput")?.addEventListener("input", () => renderComplaints(allComplaints));
  ["statusFilter", "categoryFilter", "dateFilter"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", () => renderComplaints(allComplaints))
  );

  document.getElementById("modalClose")?.addEventListener("click", closeModal);
  document.getElementById("modalOverlay")?.addEventListener("click", e => {
    if (e.target.id === "modalOverlay") closeModal();
  });
});
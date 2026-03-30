// =============================================
// citizen_mycomplaints.js  —  My Complaints
// =============================================

const CAT_ICONS = {
  "Roads & Potholes":       "fa-road",
  "Roads & Infrastructure":  "fa-road",
  "Electricity & Lighting":  "fa-bolt",
  "Electricity":             "fa-bolt",
  "Garbage & Sanitation":    "fa-trash",
  "Sanitation":              "fa-trash",
  "Water & Sewage":          "fa-droplet",
  "Water Supply":            "fa-droplet",
  "Parks & Recreation":      "fa-tree",
  "Public Safety":           "fa-shield-halved",
  "Noise Pollution":         "fa-volume-high",
  "Parks & Recreation":     "fa-tree",
  "Noise Pollution":        "fa-volume-high",
  "Public Safety":          "fa-shield-halved",
};

// -----------------------------------------------
// 1. Badge helpers
// -----------------------------------------------

function statusBadgeHTML(s) {
  const map = {
    pending:    ["badge-status pending",    "fa-clock",        "Pending"],
    in_progress:["badge-status inprogress", "fa-rotate",       "In Progress"],
    inprogress: ["badge-status inprogress", "fa-rotate",       "In Progress"],
    assigned:   ["badge-status inprogress", "fa-user-tie",     "Assigned"],
    resolved:   ["badge-status resolved",   "fa-circle-check", "Resolved"],
    rejected:   ["badge-status rejected",   "fa-circle-xmark", "Rejected"],
  };
  const [cls, ico, lbl] = map[s] || map.pending;
  return `<span class="${cls}"><i class="fa-solid ${ico}"></i> ${lbl}</span>`;
}

function sevBadgeHTML(s) {
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
  return `<span class="sev-badge sev-${s}"><span class="sev-dot"></span>${label}</span>`;
}

// -----------------------------------------------
// 2. Normalize backend → frontend
// -----------------------------------------------

function normalizeComplaint(c) {
  // location is stored as { address, lat, lng } object in MongoDB

  return {
    id:          c.complaintId || c._id,
    _id:         c._id,
    title:       c.title || "Untitled",
    description: c.description || "",
    category:    c.department || c.category || "Other",
    severity:    c.severity || "medium",
    location:    c.location?.address || (typeof c.location === 'string' ? c.location : '') || "—",
    date:        c.createdAt
                   ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                   : "—",
    rawDate:     c.createdAt || "",
    status:      c.status === "in_progress" ? "inprogress" : (c.status || "pending"),
    officer: c.officerId?.name || "—",
    dept:        c.department || "—",
    eta:         c.eta || null,
    rated:       c.rated || false,
    canReopen:   c.status === "resolved",
    evidence:    c.evidencePaths?.[0] || null,
    upvotes:     c.upvotes || 0,
    upvoted:     false,
    timeline:    c.timeline || buildBasicTimeline(c.status),
    comments:    c.comments || [],
  };
}

function buildBasicTimeline(status) {
  const steps = [
    { step: "Submitted",   icon: "fa-paper-plane",       state: "done",    date: "—", desc: "Complaint received.", note: "" },
    { step: "Verified",    icon: "fa-shield-check",       state: "pending", date: "—", desc: "Under review.",        note: "" },
    { step: "Assigned",    icon: "fa-user-tie",           state: "pending", date: "—", desc: "Pending assignment.",  note: "" },
    { step: "In Progress", icon: "fa-screwdriver-wrench", state: "pending", date: "—", desc: "Not yet started.",     note: "" },
    { step: "Resolved",    icon: "fa-circle-check",       state: "pending", date: "—", desc: "Pending.",             note: "" },
    { step: "Closed",      icon: "fa-lock",               state: "pending", date: "—", desc: "Pending.",             note: "" },
  ];
  if (status === "pending")                                     { steps[0].state = "done"; steps[1].state = "active"; }
  else if (status === "assigned")                               { steps[0].state = "done"; steps[1].state = "done"; steps[2].state = "active"; }
  else if (status === "in_progress" || status === "inprogress") { steps[0].state = "done"; steps[1].state = "done"; steps[2].state = "done"; steps[3].state = "active"; }
  else if (status === "resolved")                               { steps.slice(0, 5).forEach(s => s.state = "done"); steps[5].state = "active"; }
  return steps;
}

// -----------------------------------------------
// 3. Render table
// -----------------------------------------------

let allComplaints = [];
let withdrawTarget = null;

function renderTable() {
  const q  = document.getElementById("searchInput").value.toLowerCase();
  const sf = document.getElementById("statusFilter").value;
  const cf = document.getElementById("categoryFilter").value;
  const df = document.getElementById("dateFilter").value;

  let data = [...allComplaints];
  if (q)  data = data.filter(c => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.location.toLowerCase().includes(q));
  if (sf) data = data.filter(c => c.status === sf);
  if (cf) data = data.filter(c => c.category === cf);
  if (df === "week")  data = data.filter(c => new Date(c.rawDate) >= new Date(Date.now() - 7 * 864e5));
  if (df === "month") data = data.filter(c => new Date(c.rawDate) >= new Date(Date.now() - 30 * 864e5));

  document.getElementById("totalCount").textContent = `${data.length} complaint${data.length !== 1 ? "s" : ""}`;

  const tbody = document.getElementById("tableBody");

  if (!data.length) {
    tbody.innerHTML = "";
    document.getElementById("emptyState").style.display = "block";
    document.getElementById("complaintsTable").style.display = "none";
    return;
  }

  document.getElementById("emptyState").style.display = "none";
  document.getElementById("complaintsTable").style.display = "table";

  tbody.innerHTML = data.map(c => `
    <tr style="cursor:pointer;" onclick="window.location.href='view_complaint.html?id=${encodeURIComponent(c._id)}'">
      <td><span style="font-family:monospace;font-weight:700;color:var(--navy);font-size:0.78rem;">${c.id}</span></td>
      <td>
        <div style="font-weight:700;font-size:0.875rem;">${c.title}</div>
      </td>
      <td><span style="font-size:0.78rem;"><i class="fa-solid ${CAT_ICONS[c.category] || "fa-circle-dot"}" style="color:var(--navy);margin-right:5px;"></i>${c.category}</span></td>
      <td>${sevBadgeHTML(c.severity)}</td>
      <td>
        <div style="font-size:0.8rem;font-weight:600;">${c.location.split(",")[0]}</div>
        <div style="font-size:0.72rem;color:var(--muted);">${c.location.split(",").slice(1).join(",").trim()}</div>
      </td>
      <td style="font-size:0.8rem;white-space:nowrap;">${c.date}</td>
      <td>${statusBadgeHTML(c.status)}</td>
      <td>
        ${c.officer && c.officer !== "—"
          ? `<div style="font-size:0.8rem;font-weight:600;">${c.officer}</div><div style="font-size:0.72rem;color:var(--muted);">${c.dept}</div>`
          : `<span style="font-size:0.75rem;color:var(--light);">Not assigned</span>`}
      </td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          ${c.status === "pending" ? `<button class="btn btn-danger btn-sm" onclick="openWithdraw('${c._id}')"><i class="fa-solid fa-ban"></i></button>` : ""}
          ${c.status === "resolved" && !c.rated ? `<button class="btn btn-green btn-sm" onclick="openRating('${c._id}')"><i class="fa-solid fa-star"></i></button>` : ""}
          ${c.status === "resolved" && c.canReopen ? `<button class="btn btn-outline btn-sm" onclick="reopenComplaint('${c._id}')"><i class="fa-solid fa-rotate-left"></i></button>` : ""}
        </div>
      </td>
    </tr>`).join("");
}

// -----------------------------------------------
// 4. Withdraw
// -----------------------------------------------

function openWithdraw(mongoId) {
  withdrawTarget = mongoId;
  document.getElementById("withdrawReason").value = "";
  document.getElementById("withdrawOverlay").classList.add("show");
}

async function confirmWithdraw() {
  const reason = document.getElementById("withdrawReason").value.trim();
  try {
    await fetch(`${BASE_URL}/api/complaint/${withdrawTarget}/withdraw`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  } catch (err) {
    console.warn("Withdraw API not available, updating locally:", err);
  }
  const c = allComplaints.find(x => x._id === withdrawTarget);
  if (c) c.status = "rejected";
  document.getElementById("withdrawOverlay").classList.remove("show");
  renderTable();
  showToast("Complaint withdrawn", "");
}

// -----------------------------------------------
// 5. Reopen
// -----------------------------------------------

async function reopenComplaint(mongoId) {
  if (!confirm("Re-open this complaint? A new investigation will be initiated.")) return;
  try {
    await fetch(`${BASE_URL}/api/complaint/${mongoId}/reopen`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.warn("Reopen API not available, updating locally:", err);
  }
  const c = allComplaints.find(x => x._id === mongoId);
  if (c) { c.status = "pending"; c.canReopen = false; }
  renderTable();
  showToast("Complaint re-opened", "New investigation started");
}

// -----------------------------------------------
// 6. Rating modal
// -----------------------------------------------

let ratingTarget = null, currentRating = 0;

function openRating(mongoId) {
  ratingTarget = mongoId;
  currentRating = 0;
  const c = allComplaints.find(x => x._id === mongoId);
  document.getElementById("modalId").textContent    = "Rate Resolution";
  document.getElementById("modalTitle").textContent = c ? c.title : "";
  document.getElementById("modalBody").innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">How satisfied are you with the resolution?</div>
      <div class="stars" id="starRow">
        ${[1,2,3,4,5].map(n => `<span class="star" data-v="${n}" onclick="setRating(${n})">★</span>`).join("")}
      </div>
      <textarea class="input textarea" id="ratingComment" placeholder="Share your feedback (optional)…" style="margin-top:14px;min-height:80px;"></textarea>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-orange" onclick="submitRating()"><i class="fa-solid fa-paper-plane"></i> Submit Rating</button>
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </div>`;
  document.getElementById("modalOverlay").classList.add("show");
}

function setRating(n) {
  currentRating = n;
  document.querySelectorAll(".star").forEach(s => s.classList.toggle("filled", +s.dataset.v <= n));
}

async function submitRating() {
  if (!currentRating) { alert("Please select a rating."); return; }
  try {
    await fetch(`${BASE_URL}/api/complaint/${ratingTarget}/rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: currentRating, comment: document.getElementById("ratingComment")?.value }),
    });
  } catch (err) {
    console.warn("Rating API not available, updating locally:", err);
  }
  const c = allComplaints.find(x => x._id === ratingTarget);
  if (c) { c.rated = true; c.rating = currentRating; }
  closeModal();
  renderTable();
  showToast("Thank you for your feedback!", "");
}

// -----------------------------------------------
// 7. Modal / Toast / Profile
// -----------------------------------------------

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("show");
}

function showToast(msg, sub) {
  const t = document.getElementById("toast");
  if (!t) return;
  document.getElementById("toastMsg").textContent = msg;
  document.getElementById("toastSub").textContent = sub || "";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function populateUserUI() {
  const user = JSON.parse(sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user") || "{}");
  if (!user.name) return;
  const initials = user.initials || user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const chipAvatar = document.querySelector(".chip-avatar");
  if (chipAvatar) chipAvatar.textContent = initials;
  const profileBtnName = document.querySelector(".profile-btn-name");
  if (profileBtnName) profileBtnName.textContent = user.name;
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
// 8. MAIN — fetch from backend using userId
// -----------------------------------------------

async function loadMyComplaints() {
  try {
    const user = JSON.parse(sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user") || "{}");
    const userId = user.id || "";

    if (!userId) {
      window.location.href = "../login.html";
      return;
    }

    const res = await fetch(`${BASE_URL}/api/mycomplaints?userId=${encodeURIComponent(userId)}`);
    const raw = await res.json();

    if (!Array.isArray(raw)) {
      document.getElementById("emptyState").style.display = "block";
      document.getElementById("complaintsTable").style.display = "none";
      return;
    }

    allComplaints = raw.map(normalizeComplaint);
    renderTable();

  } catch (err) {
    console.error("Failed to load complaints:", err);
    showToast("Could not connect to server. Is the backend running?", "");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  populateUserUI();
  loadMyComplaints();

  document.getElementById("searchInput")?.addEventListener("input", renderTable);
  ["statusFilter", "categoryFilter", "dateFilter"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", renderTable)
  );
  document.getElementById("modalClose")?.addEventListener("click", closeModal);
  document.getElementById("modalOverlay")?.addEventListener("click", e => {
    if (e.target.id === "modalOverlay") closeModal();
  });
});
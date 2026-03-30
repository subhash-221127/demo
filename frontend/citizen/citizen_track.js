// =============================================
// citizen_track.js  —  Track Status page
// Searches backend for complaint by ID and
// renders the Flipkart-style stepper + details
// =============================================

// -----------------------------------------------
// 1. Badge helpers (same as other pages)
// -----------------------------------------------

function statusBadgeHTML(s) {
  const map = {
    pending:    '<span class="badge-status pending"><i class="fa-solid fa-clock"></i> Pending</span>',
    in_progress:'<span class="badge-status inprogress"><i class="fa-solid fa-rotate"></i> In Progress</span>',
    inprogress: '<span class="badge-status inprogress"><i class="fa-solid fa-rotate"></i> In Progress</span>',
    resolved:   '<span class="badge-status resolved"><i class="fa-solid fa-circle-check"></i> Resolved</span>',
    rejected:   '<span class="badge-status rejected"><i class="fa-solid fa-circle-xmark"></i> Withdrawn</span>',
  };
  return map[s] || map.pending;
}

function sevBadgeHTML(s) {
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
  return `<span class="sev-badge sev-${s}"><span class="sev-dot"></span>${label}</span>`;
}

// Step icons for the stepper
const STEP_ICONS = {
  "Submitted":   "fa-paper-plane",
  "Verified":    "fa-shield-halved",
  "Assigned":    "fa-user-tie",
  "In Progress": "fa-screwdriver-wrench",
  "Resolved":    "fa-circle-check",
  "Closed":      "fa-lock",
};

// -----------------------------------------------
// 2. Normalize complaint from backend
// -----------------------------------------------

function normalizeComplaint(c) {
  return {
    id:       c.complaintId || c._id,
    _id:      c._id,
    title:    c.title || "Untitled",
    category: c.department || c.category || "—",
    severity: c.severity || "medium",
    location: c.location?.address || (typeof c.location === 'string' ? c.location : '') || "—",
    date:     c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    status:   c.status === "in_progress" ? "inprogress" : (c.status || "pending"),
    officer:  c.officerId?.name || "—",
    dept:     c.department || "—",
    rated:    c.rated || false,
    officerPhone: c.officerId?.phone || null,
    officerEmail: c.officerId?.email || null,
    timeline: c.timeline || buildBasicTimeline(c.status === "in_progress" ? "inprogress" : (c.status || "pending"), c),
  };
}

function fmtStepDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function buildBasicTimeline(status, complaint) {
  const raw = complaint || {};
  const submittedDate  = fmtStepDate(raw.createdAt);
  const assignedDate   = fmtStepDate(raw.assignedAt);
  const resolvedDate   = fmtStepDate(raw.resolvedAt);

  const steps = [
    { step: "Submitted",   icon: "fa-paper-plane",       state: "done",    date: submittedDate, desc: "Complaint received by CityFix.", note: "" },
    { step: "Verified",    icon: "fa-shield-check",       state: "pending", date: "",  desc: "Under admin review.", note: "" },
    { step: "Assigned",    icon: "fa-user-tie",           state: "pending", date: assignedDate,  desc: "Assigned to field officer.", note: "" },
    { step: "In Progress", icon: "fa-screwdriver-wrench", state: "pending", date: "",  desc: "Officer is working on it.", note: "" },
    { step: "Resolved",    icon: "fa-circle-check",       state: "pending", date: resolvedDate,  desc: "Issue resolved.", note: "" },
    { step: "Closed",      icon: "fa-lock",               state: "pending", date: resolvedDate,  desc: "Case closed.", note: "" },
  ];

  if (status === "pending") {
    steps[0].state = "done";
    steps[1].state = "active";
  } else if (status === "assigned") {
    steps[0].state = "done"; steps[1].state = "done";
    steps[2].state = "active";
  } else if (status === "in_progress" || status === "inprogress") {
    steps[0].state = "done"; steps[1].state = "done"; steps[2].state = "done";
    steps[3].state = "active";
  } else if (status === "resolved") {
    steps.slice(0, 5).forEach(s => s.state = "done");
    steps[5].state = "active";
  } else if (status === "rejected") {
    return [
      { step: "Submitted", icon: "fa-paper-plane",    state: "done",   date: submittedDate, desc: "Complaint received.", note: "" },
      { step: "Reviewed",  icon: "fa-magnifying-glass", state: "done",  date: "", desc: "Reviewed by admin.", note: "" },
      { step: "Rejected",  icon: "fa-circle-xmark",   state: "done",   date: "", desc: "Could not be processed.", note: "" },
      { step: "Closed",    icon: "fa-lock",            state: "active", date: "", desc: "Case closed.", note: "" },
    ];
  }
  return steps;
}

// -----------------------------------------------
// 3. Build stepper HTML
// -----------------------------------------------

function buildStepper(timeline) {
  return timeline.map(t => {
    const icon = t.state === "done"
      ? "fa-check"
      : t.state === "active"
        ? (STEP_ICONS[t.step] || t.icon || "fa-circle-dot")
        : "fa-circle";

    return `
      <div class="stepper-step ${t.state === "pending" ? "pending-step" : t.state}">
        <div class="stepper-line"></div>
        <div class="stepper-dot">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="stepper-body">
          <div class="stepper-title">${t.step}</div>
          <div class="stepper-desc">${t.desc}</div>
          ${t.date && t.date !== "—" ? `<div class="stepper-date"><i class="fa-regular fa-clock"></i> ${t.date}</div>` : ""}
          ${t.note ? `<div class="stepper-note"><i class="fa-solid fa-circle-info"></i> ${t.note}</div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// -----------------------------------------------
// 4. Populate result section with complaint data
// -----------------------------------------------

function populateResult(c) {
  const result = document.getElementById("resultSection");
  const error  = document.getElementById("errorMsg");

  error.style.display = "none";

  // Summary card
  document.getElementById("sId").textContent     = c.id;
  document.getElementById("sTitle").textContent  = c.title;
  document.getElementById("sCat").textContent    = c.category;
  document.getElementById("sBadge").innerHTML    = statusBadgeHTML(c.status);
  document.getElementById("sCatVal").textContent = c.category;
  document.getElementById("sSev").innerHTML      = sevBadgeHTML(c.severity);
  document.getElementById("sLoc").textContent    = c.location;
  document.getElementById("sDate").textContent   = c.date;
  document.getElementById("sDept").textContent   = c.dept;

  // Officer card (show only if assigned)
  const oc = document.getElementById("officerCard");
  if (c.officer && c.officer !== "—") {
    oc.style.display = "flex";
    document.getElementById("officerInitials").textContent = c.officer.split(" ").map(n => n[0]).join("");
    document.getElementById("officerName").textContent     = c.officer;
    document.getElementById("officerDept").textContent     = c.dept;

    if (c.officerPhone) {
      const ph = document.getElementById("officerPhone");
      ph.style.display = "inline-flex";
      ph.href = "tel:" + c.officerPhone;
      document.getElementById("officerPhoneTxt").textContent = c.officerPhone;
    }
    if (c.officerEmail) {
      const em = document.getElementById("officerEmail");
      em.style.display = "inline-flex";
      em.href = "mailto:" + c.officerEmail;
      document.getElementById("officerEmailTxt").textContent = c.officerEmail;
    }
  } else {
    oc.style.display = "none";
  }

  // Stepper
  document.getElementById("stepper").innerHTML = buildStepper(c.timeline);

  // Rating card — show only for resolved, unrated complaints
  document.getElementById("ratingCard").style.display =
    (c.status === "resolved" && !c.rated) ? "block" : "none";

  result.style.display = "block";
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

// -----------------------------------------------
// 5. Search backend by complaint ID
// -----------------------------------------------

async function track(inputId) {
  const id     = inputId.trim().toUpperCase();
  const result = document.getElementById("resultSection");
  const error  = document.getElementById("errorMsg");

  if (!id) return;

  // Show loading
  const btn = document.getElementById("trackBtn");
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching…';
  btn.disabled  = true;

  try {
    // Try to fetch complaint by ID from backend
    // Backend should support GET /api/complaint/:complaintId
    const res = await fetch(`${BASE_URL}/api/complaint/${encodeURIComponent(id)}`);

    if (res.status === 404 || !res.ok) {
      result.style.display = "none";
      error.style.display  = "flex";
      return;
    }

    const raw = await res.json();
    const c = normalizeComplaint(raw);
    populateResult(c);

  } catch (err) {
    console.error("Track error:", err);
    // If backend has no /api/complaint/:id route, show a clear message
    error.innerHTML = `
      <i class="fa-solid fa-circle-exclamation"></i>
      <span>Could not connect to server. Is the backend running on port 5000?</span>`;
    error.style.display = "flex";
    result.style.display = "none";
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-search"></i> Track';
    btn.disabled  = false;
  }
}

// -----------------------------------------------
// 6. Rating for track page
// -----------------------------------------------

let trackRating = 0;

function setTrackRating(n) {
  trackRating = n;
  document.querySelectorAll("#trackStars .star").forEach(s =>
    s.classList.toggle("filled", +s.dataset.v <= n)
  );
}

async function submitTrackRating() {
  if (!trackRating) { alert("Please select a rating."); return; }

  const id = document.getElementById("trackInput").value.trim().toUpperCase();

  try {
    await fetch(`${BASE_URL}/api/complaint/${id}/rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating:  trackRating,
        comment: document.getElementById("trackFeedback")?.value,
      }),
    });
  } catch (err) {
    console.warn("Rating API not available:", err);
  }

  document.getElementById("ratingCard").style.display = "none";
  showToast("Thank you for your feedback!", "");
}

// -----------------------------------------------
// 7. Toast
// -----------------------------------------------

function showToast(msg, sub) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  document.getElementById("toastSub").textContent = sub || "";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// -----------------------------------------------
// 8. Profile dropdown + populate user info
// -----------------------------------------------

function populateUserUI() {
  const user = getUser(); // from api.js
  if (!user || !user.name) return;
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
// 9. Init
// -----------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  populateUserUI();

  const input = document.getElementById("trackInput");
  document.getElementById("trackBtn").addEventListener("click", () => track(input.value));
  input.addEventListener("keydown", e => { if (e.key === "Enter") track(input.value); });

  // Quick chips
  document.querySelectorAll(".quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.id;
      track(chip.dataset.id);
    });
  });
});

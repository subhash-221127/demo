// =============================================
// api.js  —  Central API configuration
// Change BASE_URL here if your server moves
// =============================================

const BASE_URL = "";

// ── Get the current logged-in user ──────────
// Returns the full user object saved at login
// { id, name, email, role, department, phone, initials }
function getUser() {
  const raw = sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Convenience helpers
function getUserId()    { return getUser()?.id    || ""; }
function getUserEmail() { return getUser()?.email || "guest@example.com"; }
function getUserName()  { return getUser()?.name  || "Citizen"; }

// ── Generic fetch helper ─────────────────────
async function apiFetch(path, options = {}) {
  const res  = await fetch(BASE_URL + path, options);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}
// =============================================
// citizen_submit.js  —  Submit Complaint page
// Sends form data to backend POST /api/create
// =============================================

// -----------------------------------------------
// 1. Severity toggle
// -----------------------------------------------

let selectedSeverity = "medium";

document.querySelectorAll(".sev").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sev").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedSeverity = btn.dataset.sev;
  });
});

// -----------------------------------------------
// 2. Character counter for description
// -----------------------------------------------

const descBox = document.getElementById("descBox");
const cc = document.getElementById("cc");

descBox?.addEventListener("input", () => {
  cc.textContent = descBox.value.length;
  cc.style.color = descBox.value.length > 500 ? "var(--red)" : "";
});

// -----------------------------------------------
// 3. Leaflet map (same as before — no change)
// -----------------------------------------------

let map, marker;

document.addEventListener("DOMContentLoaded", () => {
  populateUserUI();

  // Default center — Vijayawada, India
  map = L.map("leafletMap").setView([16.5062, 80.6480], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);

  const pinIcon = L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:var(--red,#ef4444);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconAnchor: [10, 20],
    popupAnchor: [0, -20]
  });

  // Click map to drop pin
  map.on("click", e => placeMarker(e.latlng.lat, e.latlng.lng));

  // "Use my location" button
  document.getElementById("locateBtn").addEventListener("click", () => {
    const btn = document.getElementById("locateBtn");
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating…';
    btn.disabled = true;

    if (!navigator.geolocation) {
      alert("Geolocation not supported by your browser.");
      resetLocateBtn(btn);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        placeMarker(pos.coords.latitude, pos.coords.longitude);
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Location found!';
        btn.style.background = "var(--green-light)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "var(--green-dark)";
        setTimeout(() => resetLocateBtn(btn), 3000);
      },
      err => {
        alert("Could not get your location: " + err.message);
        resetLocateBtn(btn);
      }
    );
  });

  function resetLocateBtn(btn) {
    btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Use My Current Location';
    btn.style.cssText = "";
    btn.disabled = false;
  }

  function placeMarker(lat, lng) {
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
    map.setView([lat, lng], 16);
    reverseGeocode(lat, lng);
    marker.on("dragend", e => {
      const pos = e.target.getLatLng();
      reverseGeocode(pos.lat, pos.lng);
    });
  }

  // Reverse geocode using Nominatim (free, no key needed)
  async function reverseGeocode(lat, lng) {
    const bar = document.getElementById("addressBar");
    const txt = document.getElementById("addressText");
    bar.style.display = "flex";
    txt.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      const addr = data.address || {};
      txt.textContent = data.display_name || txt.textContent;

      const road = addr.road || addr.pedestrian || addr.footway || "";
      const city = addr.city || addr.town || addr.village || "";
      const dist = addr.county || addr.state_district || "";
      const pin = addr.postcode || "";
      const house = addr.house_number || "";

      if (document.getElementById("addr")) document.getElementById("addr").value = [house, road].filter(Boolean).join(", ");
      if (document.getElementById("pincode")) document.getElementById("pincode").value = pin;
      if (document.getElementById("city")) document.getElementById("city").value = city;
      if (document.getElementById("dist")) document.getElementById("dist").value = dist;
    } catch (e) { }
  }
});

// -----------------------------------------------
// 4. File upload (same as before — no change)
// -----------------------------------------------

const uploadBox = document.getElementById("uploadBox");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const uploadIcon = document.getElementById("uploadIcon");
const uploadText = document.getElementById("uploadText");
const uploadSub = document.getElementById("uploadSub");

function handleFiles(files) {
  const valid = [], MAX = 10 * 1024 * 1024;
  const errors = [];
  Array.from(files).forEach(f => { f.size > MAX ? errors.push(f.name) : valid.push(f); });
  if (errors.length) alert("Skipped (too large):\n" + errors.join("\n"));
  if (!valid.length) return;

  uploadIcon.className = "fa-solid fa-circle-check";
  uploadIcon.style.color = "var(--green-dark)";
  uploadText.innerHTML = `<strong>${valid.length} file${valid.length > 1 ? "s" : ""} selected</strong>`;
  uploadSub.textContent = "Click to change files";
  uploadBox.style.borderColor = "var(--green)";
  uploadBox.style.background = "var(--green-light)";
  fileList.innerHTML = "";

  valid.forEach(f => {
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    const icon = isImage ? "fa-image" : isVideo ? "fa-film" : "fa-file";
    const size = f.size < 1024 * 1024
      ? (f.size / 1024).toFixed(0) + " KB"
      : (f.size / (1024 * 1024)).toFixed(1) + " MB";

    const chip = document.createElement("div");
    chip.className = "file-chip";
    chip.innerHTML = `<i class="fa-solid ${icon}"></i><span class="file-chip-name">${f.name}</span><span class="file-chip-size">${size}</span><button class="file-chip-remove"><i class="fa-solid fa-xmark"></i></button>`;
    chip.querySelector(".file-chip-remove").addEventListener("click", e => {
      e.stopPropagation();
      chip.remove();
      if (!fileList.children.length) resetUpload();
    });

    if (isImage) {
      const r = new FileReader();
      r.onload = ev => {
        const t = document.createElement("img");
        t.src = ev.target.result;
        t.className = "file-thumb";
        chip.prepend(t);
      };
      r.readAsDataURL(f);
    }

    fileList.appendChild(chip);
  });
}

function resetUpload() {
  uploadIcon.className = "fa-solid fa-cloud-arrow-up";
  uploadIcon.style.color = "";
  uploadText.innerHTML = 'Drag &amp; drop or <span class="upload-link">browse files</span>';
  uploadSub.textContent = "JPG, PNG, MP4 · Max 10 MB";
  uploadBox.style.borderColor = "";
  uploadBox.style.background = "";
  fileInput.value = "";
}

uploadBox?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", () => handleFiles(fileInput.files));
uploadBox?.addEventListener("dragover", e => { e.preventDefault(); uploadBox.style.borderColor = "var(--navy)"; });
uploadBox?.addEventListener("dragleave", () => { if (!fileList.children.length) uploadBox.style.borderColor = ""; });
uploadBox?.addEventListener("drop", e => { e.preventDefault(); handleFiles(e.dataTransfer.files); });

// -----------------------------------------------
// 5. Profile dropdown + populate user info
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

  // Also pre-fill Contact Info fields
  const contactNameInput = document.querySelector('input[type="text"][value="Jane Doe"]');
  if (contactNameInput) contactNameInput.value = user.name;
  const emailField = document.querySelector('input[type="email"]');
  if (emailField && !emailField.value) emailField.value = user.email || "";
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
// 6. Toast
// -----------------------------------------------

function showToast(msg, sub) {
  const toast = document.getElementById("toast");
  const toastId = document.getElementById("toastId");
  if (toastId) toastId.textContent = sub || "";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// -----------------------------------------------
// 7. FAB — Submit complaint to backend
// -----------------------------------------------

const isAnonymous = document.getElementById("anonCheckbox")?.checked || false;

const fab = document.getElementById("fabBtn");

fab?.addEventListener("click", async () => {
  // Validate required fields
  const category = document.getElementById("categorySelect")?.value?.trim();
  const title = document.getElementById("titleInput")?.value?.trim();
  const desc = document.getElementById("descBox")?.value?.trim();
  const location = document.getElementById("addr")?.value?.trim();

  if (!category) {
    const sel = document.getElementById("categorySelect");
    sel.style.borderColor = "var(--red)";
    sel.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => sel.style.borderColor = "", 2000);
    return;
  }
  if (!title) {
    const inp = document.getElementById("titleInput");
    inp.style.borderColor = "var(--red)";
    inp.focus();
    setTimeout(() => inp.style.borderColor = "", 2000);
    return;
  }
  if (!desc) {
    document.getElementById("descBox").focus();
    return;
  }
  if (!location) {
    alert("Please pin your location on the map or type an address.");
    return;
  }

  // Show loading state
  fab.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting…';
  fab.disabled = true;

  // Build FormData for multipart (supports file upload)
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", desc);
  formData.append("location", location);
  formData.append("department", category);   // backend uses "department"
  formData.append("severity", selectedSeverity);
  const isAnonymous = document.getElementById("anonCheckbox")?.checked || false;
  formData.append("contactEmail", getUserEmail());
formData.append("isAnonymous", isAnonymous ? "true" : "false");
  // Attach the logged-in citizen's MongoDB _id — required by backend
  const sessionUser = JSON.parse(sessionStorage.getItem("cityfix_user") || localStorage.getItem("cityfix_user") || "{}");
  const citizenId = sessionUser.id || "";
  if (!citizenId) {
    alert("You are not logged in. Please log in first.");
    resetFab();
    return;
  }
  formData.append("citizenId", citizenId);

  // Attach evidence files if any
  Array.from(fileInput.files).forEach(file => {
    formData.append("evidence", file);
  });

  try {
    const res = await fetch(`${BASE_URL}/api/create`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      // Show success toast with the new complaint ID
      const newId = data.complaintId || data._id || "—";
      showToast("Complaint Submitted!", "ID: " + newId);
      fab.innerHTML = '<i class="fa-solid fa-circle-check"></i> Submitted!';
      resetForm();
      // Redirect to My Complaints after a short delay
      setTimeout(() => {
        window.location.href = "citizen_mycomplaints.html";
      }, 3000);
    } else {
      alert(data.message || "Error submitting complaint. Please try again.");
      resetFab();
    }

  } catch (err) {
    console.error("Submit error:", err);
    alert("Could not connect to server. Is the backend running on port 5000?");
    resetFab();
  }
});

function resetFab() {
  fab.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Submit Complaint</span>';
  fab.disabled = false;
}

function resetForm() {
  document.getElementById("categorySelect").value = "";
  document.getElementById("titleInput").value = "";
  document.getElementById("descBox").value = "";
  document.getElementById("addr").value = "";
  cc.textContent = "0";
  document.querySelectorAll(".sev").forEach(b => b.classList.remove("active"));
  document.querySelector(".sev.medium")?.classList.add("active");
  selectedSeverity = "medium";
  resetUpload();
}
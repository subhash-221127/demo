// signup.js

const form = document.getElementById("signup-form");
const errorBox = document.getElementById("error-box");
const successSection = document.getElementById("success-section");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;
  const role = document.getElementById("role").value;

  // Client-side validation
  if (!name || !email || !password || !confirm || !role) {
    return showError("Please fill in all fields");
  }
  if (password.length < 6) {
    return showError("Password must be at least 6 characters");
  }
  if (password !== confirm) {
    return showError("Passwords do not match");
  }

  hideError();

  const btn = form.querySelector(".submit-btn");
  btn.textContent = "Creating account…";
  btn.disabled = true;

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });

    const data = await res.json();

    if (res.ok) {
      // Show brief success message then redirect to login
      if (successSection) {
        const msgEl = document.getElementById("success-msg");
        if (msgEl) msgEl.textContent = "Account created! Redirecting to login…";
        successSection.style.display = "block";
      }
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } else {
      showError(data.message || "Signup failed. Please try again.");
      btn.textContent = "Create Account";
      btn.disabled = false;
    }

  } catch (err) {
    console.error("Signup error:", err);
    showError("Cannot connect to server. Is the backend running on port 5000?");
    btn.textContent = "Create Account";
    btn.disabled = false;
  }
});

function showError(msg) {
  if (!errorBox) return;
  errorBox.style.display = "flex";
  const txt = document.getElementById("error-text");
  if (txt) txt.innerText = msg;
}

function hideError() {
  if (errorBox) errorBox.style.display = "none";
}
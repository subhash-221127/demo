// theme.js — Light / Dark theme toggle
(function () {
  const saved = localStorage.getItem('cityfix-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  // Update icon once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = saved === 'dark' ? '☀️' : '🌙';
  });
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cityfix-theme', next);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
}

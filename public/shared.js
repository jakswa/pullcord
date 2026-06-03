// Shared client-side utilities.
// Loaded before page-specific scripts (explore.js, ride.js).

/** DOM-based HTML escaping (safe for user-supplied text in innerHTML). */
window.esc = function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
};

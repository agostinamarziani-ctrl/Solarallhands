// Small DOM helpers shared by the host and phone screens.
export const LOGO = fetch('/superside.svg').then((r) => r.text());

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Accent- and case-insensitive text for search.
export function fold(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}

export const loadTeammates = () =>
  fetch('/teammates.json').then((r) => r.json()).then((names) => names.sort((a, b) => a.localeCompare(b)));

// Winners are everyone tied for the most votes.
export function winnersOf(results) {
  if (!results.length) return [];
  return results.filter((r) => r.count === results[0].count).map((r) => r.name);
}

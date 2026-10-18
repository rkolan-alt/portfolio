console.log('IT’S ALIVE!');

export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// The module lives at the site root, both locally and under /portfolio/.
const BASE_URL = new URL('./', import.meta.url);
const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/rkolan-alt', title: 'GitHub' },
];

function pagePath(pathname) {
  return pathname.replace(/index\.html$/, '').replace(/\/$/, '');
}

const nav = document.createElement('nav');
nav.setAttribute('aria-label', 'Main navigation');

for (const page of pages) {
  const link = document.createElement('a');
  link.href = new URL(page.url, BASE_URL).href;
  link.textContent = page.title;

  if (link.host === location.host && pagePath(link.pathname) === pagePath(location.pathname)) {
    link.classList.add('current');
    link.setAttribute('aria-current', 'page');
  }

  if (link.host !== location.host) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  nav.append(link);
}

document.body.prepend(nav);

// Create the same theme control on every page, with Automatic as the default.
const themeControl = document.createElement('label');
themeControl.className = 'color-scheme';
themeControl.append('Theme: ');

const select = document.createElement('select');
for (const [value, title] of [['light dark', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']]) {
  select.add(new Option(title, value));
}
themeControl.append(select);
document.body.prepend(themeControl);

function setColorScheme(colorScheme) {
  const validScheme = ['light dark', 'light', 'dark'].includes(colorScheme)
    ? colorScheme
    : 'light dark';
  document.documentElement.style.setProperty('color-scheme', validScheme);
  select.value = validScheme;
}

// Storage may be unavailable in a browser with restricted site storage.
let savedScheme;
try {
  savedScheme = localStorage.getItem('colorScheme');
} catch {
  // The selector still works for this page when storage is unavailable.
}
setColorScheme(savedScheme);

select.addEventListener('input', (event) => {
  setColorScheme(event.target.value);
  try {
    localStorage.setItem('colorScheme', select.value);
  } catch {
    // Keep the selected theme even if the browser cannot persist it.
  }
});

// Percent encoding preserves spaces, plus signs, newlines, and special characters.
export function buildMailto(action, data) {
  const parameters = [];
  for (const [name, value] of data) {
    parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  return `${action}?${parameters.join('&')}`;
}

const form = document.querySelector('form[action^="mailto:"]');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  location.href = buildMailto(form.action, data);
});

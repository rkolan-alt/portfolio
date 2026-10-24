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

// Fetch and parse JSON once; callers decide which message to show on failure.
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load ${url}: HTTP ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
    throw error;
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
}

// Reuse the same card template on the homepage and the full Projects page.
export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!(containerElement instanceof HTMLElement)) {
    throw new TypeError('A project container element is required.');
  }
  if (!Array.isArray(projects)) {
    throw new TypeError('Projects must be an array.');
  }
  if (!/^h[1-6]$/.test(headingLevel)) {
    throw new TypeError('The project heading level must be h1 through h6.');
  }

  // Clear previous cards so rendering again does not duplicate them.
  containerElement.replaceChildren();
  if (projects.length === 0) {
    const message = document.createElement('p');
    message.className = 'data-status';
    message.textContent = 'No projects to display yet.';
    containerElement.append(message);
    return;
  }

  const placeholder = new URL('images/project-placeholder.svg', BASE_URL).href;

  for (const project of projects) {
    const article = document.createElement('article');
    const heading = document.createElement(headingLevel);
    heading.textContent = project.title || 'Untitled project';

    if (project.url) {
      const url = new URL(project.url, BASE_URL);
      if (['http:', 'https:'].includes(url.protocol)) {
        const link = document.createElement('a');
        link.href = url.href;
        link.textContent = heading.textContent;
        heading.replaceChildren(link);
      }
    }

    const image = document.createElement('img');
    image.src = project.image ? new URL(project.image, BASE_URL).href : placeholder;
    image.alt = project.imageAlt ?? `Preview of ${heading.textContent}`;
    image.width = 640;
    image.height = 400;
    image.addEventListener('error', () => {
      image.src = placeholder;
      image.alt = 'Project preview unavailable; placeholder illustration shown.';
    }, { once: true });

    const description = document.createElement('p');
    description.textContent = project.description || 'Description coming soon.';
    const metadata = document.createElement('span');
    metadata.className = 'project-status';
    metadata.textContent = `${project.year ?? 'Year not specified'}${project.status ? ` · ${project.status}` : ''}`;
    description.append(metadata);

    article.append(heading, image, description);
    containerElement.append(article);
  }
}

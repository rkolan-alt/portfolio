import { fetchJSON, renderProjects } from '../global.js';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

try {
  const projects = await fetchJSON(new URL('../lib/projects.json', import.meta.url));
  renderProjects(projects, projectsContainer, 'h2');
  projectsTitle.textContent = `${projects.length} Projects`;
} catch {
  projectsContainer.textContent = 'Projects could not be loaded. Please refresh the page to try again.';
} finally {
  projectsContainer.setAttribute('aria-busy', 'false');
}

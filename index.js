import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

async function loadLatestProjects() {
  const projectsContainer = document.querySelector('.projects');
  if (!projectsContainer) return;

  try {
    const projects = await fetchJSON(new URL('./lib/projects.json', import.meta.url));
    const latestProjects = projects.slice(0, 3);
    renderProjects(latestProjects, projectsContainer, 'h3');
  } catch {
    projectsContainer.textContent = 'Latest projects could not be loaded. Please refresh the page to try again.';
  } finally {
    projectsContainer.setAttribute('aria-busy', 'false');
  }
}

async function loadGitHubStats() {
  const profileStats = document.querySelector('#profile-stats');
  if (!profileStats) return;

  try {
    const githubData = await fetchGitHubData('rkolan-alt');
    const fields = [
      ['Public repos', githubData.public_repos],
      ['Public gists', githubData.public_gists],
      ['Followers', githubData.followers],
      ['Following', githubData.following],
    ];
    if (!fields.every(([, value]) => Number.isInteger(value) && value >= 0)) {
      throw new TypeError('The GitHub response is missing profile statistics.');
    }

    const stats = document.createElement('dl');
    for (const [label, value] of fields) {
      const term = document.createElement('dt');
      const count = document.createElement('dd');
      term.textContent = label;
      count.textContent = value.toLocaleString();
      stats.append(term, count);
    }
    profileStats.replaceChildren(stats);
  } catch {
    profileStats.textContent = 'GitHub statistics are temporarily unavailable. You can still view my GitHub profile below.';
  } finally {
    profileStats.setAttribute('aria-busy', 'false');
  }
}

// Load independently so a slow or unavailable API does not delay project cards.
await Promise.all([loadLatestProjects(), loadGitHubStats()]);

import { fetchJSON, renderProjects } from '../global.js?v=6';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const resultsSummary = document.querySelector('#results-summary');
const chartSummary = document.querySelector('#chart-summary');
const yearLabel = document.querySelector('#selected-year');
const clearYear = document.querySelector('.clear-year');
const clearFilters = document.querySelector('.clear-filters');
const svg = d3.select('#projects-plot');
const legend = d3.select('.legend');

let projects = [];
let query = '';
let selectedYear = null;

// Fix the extra-credit pitfall: both input methods share these two filters.
function searchMatches(project) {
  return Object.values(project).join('\n').toLowerCase().includes(query.trim().toLowerCase());
}

function toggleYear(year) {
  selectedYear = selectedYear === year ? null : year;
  updateResults();
}

function updateSelection() {
  svg.selectAll('path')
    .classed('selected', (d) => d.data.label === selectedYear)
    .attr('aria-pressed', (d) => String(d.data.label === selectedYear));
  legend.selectAll('li')
    .classed('selected', (d) => d.label === selectedYear);
  legend.selectAll('button')
    .attr('aria-pressed', (d) => String(d.label === selectedYear));
}

function renderPieChart(projectsGiven) {
  const data = d3.rollups(projectsGiven, (group) => group.length, (project) => String(project.year))
    .map(([year, count]) => ({ label: year, value: count }))
    .sort((a, b) => d3.descending(a.label, b.label));

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(48);
  const slices = d3.pie().sort(null).value((d) => d.value)(data);

  // A fixed domain keeps each year's color stable as search results change.
  const colors = d3.scaleOrdinal()
    .domain([...new Set(projects.map((project) => String(project.year)))].sort().reverse())
    .range(d3.schemeTableau10);

  // Keyed joins update existing controls, preserving keyboard focus on selection.
  const paths = svg.selectAll('path').data(slices, (d) => d.data.label).join('path')
    .attr('d', arcGenerator)
    .attr('fill', (d) => colors(d.data.label))
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.data.label}: ${d.data.value} ${d.data.value === 1 ? 'project' : 'projects'}. Filter by year.`)
    .on('click', (_, d) => toggleYear(d.data.label))
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleYear(d.data.label);
      }
    });
  paths.selectAll('title').data((d) => [d]).join('title')
    .text((d) => `${d.data.label}: ${d.data.value} ${d.data.value === 1 ? 'project' : 'projects'}`);

  const items = legend.selectAll('li').data(data, (d) => d.label).join('li')
    .attr('class', 'legend-item')
    .style('--color', (d) => colors(d.label));
  const buttons = items.selectAll('button').data((d) => [d]).join('button')
    .attr('type', 'button')
    .attr('aria-label', (d) => `${d.label}: ${d.value} ${d.value === 1 ? 'project' : 'projects'}. Filter by year.`)
    .on('click', (_, d) => toggleYear(d.label));
  buttons.selectAll('.swatch').data((d) => [d]).join('span')
    .attr('class', 'swatch').attr('aria-hidden', 'true');
  buttons.selectAll('.legend-label').data((d) => [d]).join('span')
    .attr('class', 'legend-label').text((d) => d.label);
  buttons.selectAll('em').data((d) => [d]).join('em').text((d) => `(${d.value})`);

  chartSummary.textContent = projectsGiven.length
    ? `${projectsGiven.length} search ${projectsGiven.length === 1 ? 'match' : 'matches'} across ${data.length} ${data.length === 1 ? 'year' : 'years'}.`
    : 'No matching projects to chart.';
  svg.attr('hidden', data.length ? null : '');
  updateSelection();
}

// Both handlers call this function rather than filtering the original list alone.
function updateResults() {
  const matchingProjects = projects.filter(searchMatches);
  const visibleProjects = matchingProjects.filter((project) =>
    selectedYear === null || String(project.year) === selectedYear);

  renderProjects(visibleProjects, projectsContainer, 'h2');
  renderPieChart(matchingProjects);
  projectsTitle.textContent = `${visibleProjects.length} ${visibleProjects.length === 1 ? 'Project' : 'Projects'}`;
  resultsSummary.textContent = `Showing ${visibleProjects.length} of ${projects.length} projects${query.trim() ? ` matching “${query.trim()}”` : ''}${selectedYear ? ` from ${selectedYear}` : ''}.`;
  yearLabel.hidden = selectedYear === null;
  yearLabel.textContent = selectedYear ? `Year: ${selectedYear}` : '';
  clearYear.hidden = selectedYear === null;
  clearFilters.hidden = selectedYear === null && !query;
}

searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  updateResults();
});
clearYear.addEventListener('click', () => {
  selectedYear = null;
  updateResults();
});
clearFilters.addEventListener('click', () => {
  query = '';
  selectedYear = null;
  searchInput.value = '';
  updateResults();
  searchInput.focus();
});

try {
  projects = await fetchJSON(new URL('../lib/projects.json', import.meta.url));
  updateResults();
  searchInput.disabled = false;
} catch {
  projectsContainer.textContent = 'Projects could not be loaded. Please refresh the page to try again.';
  chartSummary.textContent = 'Project years could not be loaded.';
} finally {
  projectsContainer.setAttribute('aria-busy', 'false');
}

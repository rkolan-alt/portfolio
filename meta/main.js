import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const chart = document.querySelector('#chart');
const tooltip = document.querySelector('#commit-tooltip');
const picker = document.querySelector('#commit-picker');
const selectAll = document.querySelector('#select-all-commits');
const clearSelection = document.querySelector('#clear-selection');
let commits = [];
let selectedIds = new Set();
let brush;
let brushGroup;
let hideTimer;

export function processCommits(data) {
  return d3.groups(data, (d) => d.commit).map(([id, lines]) => {
    const first = lines[0];
    const [hour, minute, second = 0] = first.time.split(':').map(Number);
    const commit = {
      id,
      url: `https://github.com/rkolan-alt/portfolio/commit/${id}`,
      author: first.author,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: first.datetime,
      hourFrac: hour + minute / 60 + second / 3600,
      totalLines: lines.length,
    };
    Object.defineProperty(commit, 'lines', {
      value: lines, enumerable: false, writable: false, configurable: false,
    });
    return commit;
  }).sort((a, b) => a.datetime - b.datetime);
}

function renderCommitInfo(data) {
  const fileLengths = d3.rollups(data, (rows) => d3.max(rows, (d) => d.line), (d) => d.file);
  const statistics = [
    ['Lines of code', data.length.toLocaleString()],
    ['Represented commits', commits.length.toLocaleString()],
    ['Source files', fileLengths.length.toLocaleString()],
    ['Average file length', d3.format('.1f')(d3.mean(fileLengths, (d) => d[1]) ?? 0)],
    ['Longest line (characters)', d3.max(data, (d) => d.length) ?? 0],
    ['Maximum indentation depth', d3.max(data, (d) => d.depth) ?? 0],
  ];
  const dl = d3.select('#stats').selectAll('dl').data([null]).join('dl').attr('class', 'stats');
  const cards = dl.selectAll('div').data(statistics).join('div');
  cards.selectAll('dt').data((d) => [d[0]]).join('dt').text((d) => d);
  cards.selectAll('dd').data((d) => [d[1]]).join('dd').text((d) => d);
}

function hideTooltip() {
  clearTimeout(hideTimer);
  tooltip.hidden = true;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!tooltip.matches(':hover, :focus-within')) hideTooltip();
  }, 180);
}

function positionTooltip(x, y) {
  const bounds = tooltip.getBoundingClientRect();
  tooltip.style.left = `${Math.max(8, Math.min(x + 14, innerWidth - bounds.width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(y + 14, innerHeight - bounds.height - 8))}px`;
}

function showTooltip(event, commit) {
  clearTimeout(hideTimer);
  const link = document.querySelector('#commit-link');
  link.href = commit.url;
  link.textContent = commit.id.slice(0, 8);
  document.querySelector('#commit-date').textContent = commit.date.toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'long' });
  document.querySelector('#commit-time').textContent = `${commit.time} (UTC${commit.timezone})`;
  document.querySelector('#commit-author').textContent = commit.author;
  document.querySelector('#commit-lines').textContent = `${commit.totalLines.toLocaleString()} attributed lines`;
  tooltip.hidden = false;
  const bounds = event.currentTarget.getBoundingClientRect();
  positionTooltip(event.clientX ?? bounds.right, event.clientY ?? bounds.top);
}

function renderSelection() {
  const selected = commits.filter((d) => selectedIds.has(d.id));
  d3.select(chart).selectAll('.dots circle')
    .classed('selected', (d) => selectedIds.has(d.id))
    .attr('aria-pressed', (d) => String(selectedIds.has(d.id)));
  document.querySelector('#selection-count').textContent = selected.length
    ? `${selected.length} ${selected.length === 1 ? 'commit' : 'commits'} selected`
    : 'No commits selected';
  clearSelection.disabled = selected.length === 0 && !d3.brushSelection(brushGroup.node());

  const lines = selected.flatMap((d) => d.lines);
  const breakdown = d3.rollups(lines, (rows) => rows.length, (d) => d.type)
    .sort((a, b) => b[1] - a[1]);
  const container = d3.select('#language-breakdown');
  container.selectAll('*').remove();
  for (const [language, count] of breakdown) {
    container.append('dt').text(language.toUpperCase());
    container.append('dd').text(`${count.toLocaleString()} lines (${d3.format('.1%')(count / lines.length)})`);
  }
  document.querySelector('#language-help').hidden = selected.length > 0;
}

function toggleCommit(commit) {
  const next = new Set(selectedIds);
  if (next.has(commit.id)) next.delete(commit.id);
  else next.add(commit.id);
  brushGroup.call(brush.move, null);
  selectedIds = next;
  renderSelection();
}

function renderScatterPlot() {
  hideTooltip();
  const width = Math.max(280, chart.clientWidth);
  const height = width < 500 ? 360 : 460;
  const margin = { top: 24, right: 30, bottom: 60, left: 58 };
  const usableArea = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const svg = d3.select(chart).selectAll('svg').data([null]).join('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'group').attr('aria-labelledby', 'commit-chart-heading').attr('aria-describedby', 'commit-chart-help');
  svg.selectAll('*').remove();
  let [start, end] = d3.extent(commits, (d) => d.datetime);
  if (+start === +end) {
    start = new Date(+start - 86400000);
    end = new Date(+end + 86400000);
  }
  const xScale = d3.scaleTime().domain([start, end]).nice()
    .range([usableArea.left + 28, usableArea.right - 28]);
  const yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);
  // A zero-based square-root scale makes circle area proportional to line count.
  const rScale = d3.scaleSqrt().domain([0, d3.max(commits, (d) => d.totalLines)])
    .range([0, width < 500 ? 18 : 26]);

  svg.append('g').attr('class', 'meta-gridlines').attr('aria-hidden', 'true')
    .attr('transform', `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).ticks(6).tickFormat('').tickSize(-(usableArea.right - usableArea.left)));
  svg.append('g').attr('class', 'meta-axis x-axis').attr('aria-hidden', 'true')
    .attr('transform', `translate(0,${usableArea.bottom})`)
    .call(d3.axisBottom(xScale).ticks(width < 500 ? 3 : 6).tickFormat(d3.timeFormat('%b %d')));
  svg.append('g').attr('class', 'meta-axis y-axis').attr('aria-hidden', 'true')
    .attr('transform', `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).ticks(6).tickFormat((hour) => `${String(hour).padStart(2, '0')}:00`));
  svg.append('text').attr('class', 'axis-label').attr('x', width / 2).attr('y', height - 12).attr('text-anchor', 'middle').text('Commit date');
  svg.append('text').attr('class', 'axis-label').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', 13).attr('text-anchor', 'middle').text('Time of day');

  brush = d3.brush().extent([[usableArea.left, usableArea.top], [usableArea.right, usableArea.bottom]])
    .on('start brush end', (event) => {
      hideTooltip();
      selectedIds = new Set(commits.filter((commit) => {
        if (!event.selection) return false;
        const [[x0, y0], [x1, y1]] = event.selection;
        const x = xScale(commit.datetime);
        const y = yScale(commit.hourFrac);
        return x >= x0 && x <= x1 && y >= y0 && y <= y1;
      }).map((d) => d.id));
      renderSelection();
    });
  brushGroup = svg.append('g').attr('class', 'commit-brush').call(brush);

  // Draw after the brush overlay to keep the dots hoverable. Largest dots go first.
  const circles = svg.append('g').attr('class', 'dots').selectAll('circle')
    .data(d3.sort(commits, (d) => -d.totalLines)).join('circle')
    .attr('cx', (d) => xScale(d.datetime)).attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines)).attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `Commit ${d.id.slice(0, 8)}, ${d.date.toISOString().slice(0, 10)}, ${d.time}, ${d.totalLines} lines. Toggle selection.`)
    .on('mouseenter', showTooltip).on('mousemove', (event) => positionTooltip(event.clientX, event.clientY))
    .on('mouseleave', scheduleHide).on('focus', showTooltip).on('blur', scheduleHide)
    .on('click', (_, commit) => toggleCommit(commit))
    .on('keydown', (event, commit) => {
      if (event.key === 'Escape') hideTooltip();
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleCommit(commit);
      }
    });
  circles.append('title').text((d) => `${d.id.slice(0, 8)}: ${d.totalLines} lines`);
  renderSelection();
}

tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
tooltip.addEventListener('mouseleave', scheduleHide);
tooltip.addEventListener('focusout', scheduleHide);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTooltip(); });
window.addEventListener('scroll', hideTooltip, { passive: true });
clearSelection.addEventListener('click', () => { brushGroup.call(brush.move, null); });
selectAll.addEventListener('click', () => {
  brushGroup.call(brush.move, null);
  selectedIds = new Set(commits.map((d) => d.id));
  renderSelection();
});
picker.addEventListener('change', (event) => {
  const commit = commits.find((d) => d.id === event.target.value);
  if (commit) showTooltip(event, commit);
  else hideTooltip();
});

try {
  const data = await d3.csv(new URL('./loc.csv', import.meta.url), (row) => ({
    ...row, line: Number(row.line), depth: Number(row.depth), length: Number(row.length),
    date: new Date(`${row.date}T00:00:00Z`), datetime: new Date(row.datetime),
  }));
  if (!data.length) throw new Error('No code analysis data available.');
  commits = processCommits(data);
  renderCommitInfo(data);
  renderScatterPlot();
  for (const commit of commits) {
    picker.add(new Option(`${commit.id.slice(0, 8)} · ${commit.date.toISOString().slice(0, 10)} · ${commit.totalLines} lines`, commit.id));
  }
  picker.disabled = false;
  selectAll.disabled = false;
  document.querySelector('#meta-status').textContent = `Analysis includes ${commits.length} commits represented in the current source files.`;
  let previousWidth = chart.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(chart.clientWidth - previousWidth) < 1) return;
    previousWidth = chart.clientWidth;
    renderScatterPlot();
  }).observe(chart);
} catch (error) {
  console.error('Unable to load code analysis:', error);
  document.querySelector('#meta-status').textContent = 'Code analysis could not be loaded. Please refresh to try again.';
  chart.textContent = 'The commit visualization is temporarily unavailable.';
} finally {
  chart.setAttribute('aria-busy', 'false');
}

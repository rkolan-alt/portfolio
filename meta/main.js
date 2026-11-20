import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const chart = document.querySelector('#chart');
const tooltip = document.querySelector('#commit-tooltip');
const picker = document.querySelector('#commit-picker');
const selectAll = document.querySelector('#select-all-commits');
const clearSelection = document.querySelector('#clear-selection');
let commits = [];
let filteredCommits = [];
let timeScale;
let xScale;
let yScale;
let rScale;
let scroller;
let viewportChapter;
let scrollFrame;
let selectedIds = new Set();
const progress = document.querySelector('#commit-progress');
const colors = d3.scaleOrdinal().domain(['html', 'css', 'js']).range(d3.schemeTableau10);
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
  const fileLengths = d3.rollups(data, (rows) => rows.length, (d) => d.file);
  const statistics = [
    ['Visible lines of code', data.length.toLocaleString()],
    ['Visible commits', filteredCommits.length.toLocaleString()],
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
  document.querySelector('#commit-tooltip-time').textContent = `${commit.time} (UTC${commit.timezone})`;
  document.querySelector('#commit-author').textContent = commit.author;
  document.querySelector('#commit-lines').textContent = `${commit.totalLines.toLocaleString()} attributed lines`;
  tooltip.hidden = false;
  const bounds = event.currentTarget.getBoundingClientRect();
  positionTooltip(event.clientX ?? bounds.right, event.clientY ?? bounds.top);
}

function renderSelection() {
  const selected = filteredCommits.filter((d) => selectedIds.has(d.id));
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
  const height = Math.max(240, Math.min(width < 500 ? 320 : 380, innerHeight * 0.43));
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
  xScale = d3.scaleTime().domain([start, end]).nice()
    .range([usableArea.left + 28, usableArea.right - 28]);
  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);
  // A zero-based square-root scale makes circle area proportional to line count.
  rScale = d3.scaleSqrt().domain([0, d3.max(commits, (d) => d.totalLines)])
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
      selectedIds = new Set(filteredCommits.filter((commit) => {
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
  svg.append('g').attr('class', 'dots');
  updateScatterPlot();
}

function updateScatterPlot() {
  const circles = d3.select(chart).select('.dots').selectAll('circle')
    .data(d3.sort(filteredCommits, (d) => -d.totalLines), (d) => d.id).join('circle')
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
  circles.selectAll('title').data((d) => [d]).join('title').text((d) => `${d.id.slice(0, 8)}: ${d.totalLines} lines`);
  renderSelection();
}

function setCutoff(date) {
  hideTooltip();
  // Round to a millisecond so the latest commit is included at the slider endpoint.
  const commitMaxTime = new Date(Math.round(+date));
  progress.value = timeScale(commitMaxTime);
  const time = document.querySelector('#commit-time');
  time.dateTime = commitMaxTime.toISOString();
  time.textContent = commitMaxTime.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
  progress.setAttribute('aria-valuetext', time.textContent);
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  brushGroup.call(brush.move, null);
  updateScatterPlot();
  const lines = filteredCommits.flatMap((d) => d.lines);
  renderCommitInfo(lines);
  updateFileDisplay(lines);
  document.querySelector('#timeline-summary').textContent = `${filteredCommits.length} of ${commits.length} commits · ${lines.length.toLocaleString()} surviving lines`;
  picker.replaceChildren(new Option('Choose a commit…', ''));
  for (const commit of filteredCommits) {
    picker.add(new Option(`${commit.id.slice(0, 8)} · ${commit.totalLines} lines`, commit.id));
  }
  picker.disabled = selectAll.disabled = filteredCommits.length === 0;
  const current = filteredCommits.at(-1);
  d3.select('#scatter-story').selectAll('.step')
    .classed('is-active', (d) => d.id === current?.id)
    .attr('aria-current', (d) => d.id === current?.id ? 'step' : null);
}

function updateFileDisplay(lines) {
  const files = d3.groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length || a.name.localeCompare(b.name));
  const rows = d3.select('#files').selectAll(':scope > div').data(files, (d) => d.name)
    .join((enter) => enter.append('div').call((row) => {
      const dt = row.append('dt');
      dt.append('code');
      dt.append('small');
      row.append('dd');
    })).order();
  rows.select('code').text((d) => d.name);
  rows.select('small').text((d) => `${d.lines.length.toLocaleString()} lines`);
  rows.select('dd').attr('aria-label', (d) => `${d.lines.length} lines in ${d.name}`)
    .selectAll('.loc').data((d) => d.lines, (d) => `${d.file}:${d.line}`)
    .join('div').attr('class', 'loc').attr('aria-hidden', 'true')
    .style('--color', (d) => colors(d.type))
    .attr('title', (d) => `${d.file}:${d.line} · ${d.type.toUpperCase()} · ${d.datetime.toLocaleDateString()}`);
  const types = d3.rollups(lines, (d) => d.length, (d) => d.type).sort((a, b) => a[0].localeCompare(b[0]));
  const legend = d3.select('#file-legend').selectAll('li').data(types, (d) => d[0]).join('li');
  legend.selectAll('span').data((d) => [d]).join('span').attr('class', 'swatch').style('--color', (d) => colors(d[0]));
  legend.selectAll('b').data((d) => [d]).join('b').text((d) => `${d[0].toUpperCase()} · ${d[1].toLocaleString()} lines`);
  document.querySelector('#file-summary').textContent = `${files.length} files · ${lines.length.toLocaleString()} dots at the selected time`;
}

function syncStoryToViewport() {
  const steps = [...document.querySelectorAll('#scatter-story .step')];
  const reached = steps.filter((step) => step.getBoundingClientRect().top <= innerHeight * 0.6);
  const current = reached.at(-1);
  if (!current) {
    viewportChapter = null;
    return;
  }
  if (viewportChapter === current.__data__.id) return;
  viewportChapter = current.__data__.id;
  setCutoff(current.__data__.datetime);
}

function renderStory() {
  const steps = d3.select('#scatter-story').selectAll('.step').data(commits, (d) => d.id)
    .join('article').attr('class', 'step');
  steps.append('p').attr('class', 'eyebrow').text((d, i) => `Chapter ${i + 1} / ${commits.length}`);
  steps.append('h3').text((d) => d.datetime.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }));
  steps.append('p').text((d, i) => {
    const files = new Set(d.lines.map((line) => line.file));
    const largest = d3.rollups(d.lines, (rows) => rows.length, (line) => line.file).sort((a, b) => b[1] - a[1])[0];
    return `${i === 0 ? 'The story begins' : 'The next chapter arrives'} at ${d.datetime.toLocaleTimeString(undefined, { timeStyle: 'short' })}. This commit accounts for ${d.totalLines} surviving lines across ${files.size} files. Its largest contribution is in ${largest[0]}.`;
  });
  steps.append('a').attr('href', (d) => d.url).attr('target', '_blank').attr('rel', 'noopener noreferrer')
    .text((d) => `View commit ${d.id.slice(0, 8)} ↗`);
}

progress.addEventListener('input', () => setCutoff(timeScale.invert(Number(progress.value))));
document.querySelector('#show-all-commits').addEventListener('click', () => setCutoff(d3.max(commits, (d) => d.datetime)));

tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
tooltip.addEventListener('mouseleave', scheduleHide);
tooltip.addEventListener('focusout', scheduleHide);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTooltip(); });
window.addEventListener('scroll', hideTooltip, { passive: true });
clearSelection.addEventListener('click', () => { brushGroup.call(brush.move, null); });
selectAll.addEventListener('click', () => {
  brushGroup.call(brush.move, null);
  selectedIds = new Set(filteredCommits.map((d) => d.id));
  renderSelection();
});
picker.addEventListener('change', (event) => {
  const commit = filteredCommits.find((d) => d.id === event.target.value);
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
  filteredCommits = commits;
  timeScale = d3.scaleTime().domain(d3.extent(commits, (d) => d.datetime)).range([0, 100]);
  renderScatterPlot();
  renderStory();
  setCutoff(d3.max(commits, (d) => d.datetime));
  progress.disabled = false;
  document.querySelector('#show-all-commits').disabled = false;
  scroller = scrollama();
  scroller.setup({ step: '#scatter-story .step', offset: 0.6 })
    .onStepEnter(syncStoryToViewport);
  // Anchor jumps may skip every intersection observed by Scrollama.
  window.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      syncStoryToViewport();
    });
  }, { passive: true });
  document.querySelector('#meta-status').textContent = `Analysis includes ${commits.length} commits represented in the current source files.`;
  let previousWidth = chart.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(chart.clientWidth - previousWidth) < 1) return;
    previousWidth = chart.clientWidth;
    renderScatterPlot();
    scroller.resize();
  }).observe(chart);
} catch (error) {
  console.error('Unable to load code analysis:', error);
  document.querySelector('#meta-status').textContent = 'Code analysis could not be loaded. Please refresh to try again.';
  chart.textContent = 'The commit visualization is temporarily unavailable.';
} finally {
  chart.setAttribute('aria-busy', 'false');
}

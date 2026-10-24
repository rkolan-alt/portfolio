# Rishab Kolan’s portfolio

Personal portfolio for DSC 106, built with HTML, a shared CSS stylesheet, and JavaScript modules.

- Website: https://rkolan-alt.github.io/portfolio/
- Repository: https://github.com/rkolan-alt/portfolio
- Lab instructions: https://dsc106.com/labs/lab02/
- Lab 3 instructions: https://dsc106.com/labs/lab03/
- Lab 4 instructions: https://dsc106.com/labs/lab04/

## Lab 2 implementation

- Centered content with a `100ch` maximum width and padding for narrow screens.
- Flexbox navigation with equal-width links, current-page indicators, hover styles, and a shared teal accent color.
- Contact form with inherited typography, a two-column grid, and labels using column subgrid; labels stack above inputs on small screens.
- Twelve project cards in an auto-fill responsive grid. Row subgrid aligns headings, images, and descriptions. Two projects come from the resume; ten cards are explicitly labeled as future coursework placeholders.
- Responsive images, balanced headings, visible keyboard focus, and a larger page heading.
- A semantic resume page containing education, technical skills, experience, and projects from the supplied resume, with responsive and print styling.

The contact form uses `mailto:` and requires a configured email application. It opens a draft with the recipient left blank; LinkedIn is the direct contact channel. The owner’s email address and phone number are omitted from the public site.

## Lab 3 implementation

- Every page loads `global.js` as a module. It creates the shared navigation from an array of pages, highlights the current page automatically, and opens external navigation links in a new tab.
- Navigation URLs resolve from the module’s location, so the same code works at a local server’s root and under `/portfolio/` on GitHub Pages. Explicit `index.html` URLs highlight the corresponding page too.
- A theme selector at the top right offers Automatic, Light, and Dark. Automatic follows the operating system; manual choices override it. The selected mode is saved in `localStorage` and restored on refresh and navigation.
- Text, surfaces, borders, form controls, and navigation hover styles adapt to both color schemes. The selector remains usable if the browser blocks storage.
- The optional contact-form improvement removes the redundant sender field and builds a percent-encoded `mailto:` URL using `FormData`, preserving spaces, newlines, plus signs, and special characters in the subject and message.

## Lab 4 implementation

- `lib/projects.json` is the shared source for 12 project records, including the completed portfolio labs, resume projects, and six explicitly labeled future-work placeholders. Each record has a numeric year; the gesture mapping project started in 2025, while the other entries are completed or planned for 2026.
- `fetchJSON()` checks HTTP responses, parses JSON, and reports errors. `renderProjects()` clears existing content before rendering, supports configurable heading levels, handles empty lists, and supplies defaults for missing text and images.
- `projects/projects.js` loads all project records and derives the project count in the page heading. `index.js` uses the same renderer for the first three records on the homepage, with `h3` headings under the Latest Projects section.
- `fetchGitHubData()` loads public repository, gist, follower, and following counts for `rkolan-alt`. The homepage displays them in a responsive definition list. Project data and GitHub statistics load independently, with loading and error messages.
- Relative resource URLs resolve from the JavaScript modules, so cards and images work locally and on GitHub Pages under `/portfolio/`.

To add or edit a project, update `lib/projects.json`. Put the latest entries first; the homepage displays the first three. Use paths relative to the site root for project images and internal links. Keep placeholder projects labeled until the work is completed.

## Local preview

Run `python3 -m http.server 8000` from the repository, then open http://localhost:8000/. Use an HTTP server rather than opening HTML files directly, because JavaScript modules require it.

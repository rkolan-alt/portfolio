# Rishab Kolan’s portfolio

Personal portfolio for DSC 106, built with HTML and a shared CSS stylesheet.

- Website: https://rkolan-alt.github.io/portfolio/
- Repository: https://github.com/rkolan-alt/portfolio
- Lab instructions: https://dsc106.com/labs/lab02/

## Lab 2 implementation

- Centered content with a `100ch` maximum width and padding for narrow screens.
- Flexbox navigation with equal-width links, current-page indicators, hover styles, and a shared teal accent color.
- Contact form with inherited typography, a two-column grid, and labels using column subgrid; labels stack above inputs on small screens.
- Twelve project cards in an auto-fill responsive grid. Row subgrid aligns headings, images, and descriptions. Two projects come from the resume; ten cards are explicitly labeled as future coursework placeholders.
- Responsive images, balanced headings, visible keyboard focus, and a larger page heading.
- A semantic resume page containing education, technical skills, experience, and projects from the supplied resume, with responsive and print styling.

The contact form uses `mailto:` and requires a configured email application. It opens a draft with the recipient left blank; LinkedIn is the direct contact channel. The owner’s email address and phone number are omitted from the public site.

## Local preview

Run `python3 -m http.server 8000` from the repository, then open http://localhost:8000/.

## Submission still required

Submit the repository link and a screen recording in MP4 format, no longer than one minute, to Gradescope. Speak aloud while presenting the personalized site, showing its responsive behavior, and explaining the most interesting concept you learned.

Suggested recording sequence:

1. **0–15 seconds:** Show the homepage and Resume page. Explain how your education, experience, and projects personalize the portfolio.
2. **15–35 seconds:** Open Projects and resize the browser from wide to narrow. Show the cards changing from multiple columns to one, then briefly show the contact form stacking its labels.
3. **35–55 seconds:** Explain a concept in your own words. For example, describe how subgrid lets project cards share row sizes so images stay aligned even when headings wrap onto different numbers of lines.

Record the screen on your laptop and keep the entire video under 60 seconds.

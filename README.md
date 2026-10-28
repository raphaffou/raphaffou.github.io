# raphaffou.github.io

My portfolio. Angular 21, prerendered to static HTML, published on GitHub Pages.

## Editing the content

All the content lives in **one file: [`content/portfolio.ttl`](content/portfolio.ttl)** (Turtle, schema.org vocabulary plus a small `site:` namespace). Texts, projects, the paper, the About page and the Graph page all come from it.

- **Add a project:** copy an existing `schema:SoftwareSourceCode` block. With `site:featured true` it gets its own page (it then needs `site:slug`, `site:problem`, `site:approach`, `site:result`); with `false` it goes to the archive.
- **Add a note:** the template is in the "Notes" section of the file. `schema:articleBody` takes a small Markdown: `## titles`, paragraphs, `- lists`, ```` ``` ```` code blocks, `` `code` ``, `**bold**`, `*italic*`, `[links](https://…)`, `![images](/images/…)` (put images in `public/images/`).
- **Topics** (`schema:DefinedTerm`) are the hubs of the Graph page; link a work to them with `schema:about`.
- Values are shown in the order they are written.

`scripts/build-content.mjs` reads the Turtle file and writes `src/app/content/*.generated.ts`, `public/data/portfolio.jsonld` and `public/data/portfolio.ttl`. It stops with a clear message if a required field is missing, a slug is reused or a topic is not declared, and warns about unknown `site:` properties (typos).

## Commands

```bash
npm install          # once (Node 22.12+ or 20.19+)
npm start            # http://localhost:4200, reloads when portfolio.ttl or the code changes
npm run build        # static site in dist/portfolio/browser
npm run preview      # build, then serve the static site on http://localhost:4300
```

## Where things are

| | |
|---|---|
| `content/portfolio.ttl` | all the content |
| `src/styles.css` | the whole design (colours, fonts, the negative-rainbow hover, layout) |
| `src/app/app.html` | the frame: name, menu, footer |
| `src/app/pages/` | one component per page |
| `src/app/shared/` | the hover text (`span[t]`), contact buttons, toast, page titles and meta tags |
| `scripts/` | content generation, `npm start` wrapper, post-build steps for GitHub Pages |
| `public/` | fonts (Cochineal, Rubik Mono One, both OFL), CV, favicon |

## Accessibility notes

- The site follows the visitor's settings: light or dark theme (`prefers-color-scheme`), the text size chosen in the browser (all sizes are in `rem`), "increase contrast" (`prefers-contrast`), "reduce motion" and Windows high-contrast mode. The colours of both themes are the variables at the top of `styles.css`.
- In the light theme, the hover uses the inverse of the negative rainbow (the old rainbow), darkened so each colour is at least 5:1 on the background.

- Every link and button has the same effect on hover and on keyboard focus, plus a visible focus outline. Links inside text stay underlined.
- At rest the text is pure white; the colours only appear on hover/focus. `prefers-reduced-motion` stops all animation; `forced-colors` (Windows high contrast) falls back to system colours.
- The two dots of the Ë drift continuously. Strictly, WCAG 2.2.2 asks that automatic motion lasting more than 5 s can be paused; to be strict, change `infinite` to `1` in the `.e .dots` rule of `styles.css`.
- After each client-side navigation, focus moves to the page title, and the page `<title>` changes.
- The Graph page is a static SVG of real links, preceded by a link to skip it; the list under it carries the same links.

## Deployment

`.github/workflows/deploy.yml` builds and publishes at every push to `new` (`main` keeps the old site's history, untouched). One-time setup: *Settings → Pages → Build and deployment → Source: GitHub Actions*, and *Settings → Environments → github-pages → Deployment branches*: add `new`.

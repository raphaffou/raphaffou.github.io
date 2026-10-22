// Runs after `ng build`. Prepares dist/portfolio/browser for GitHub Pages:
//   - 404.html from the prerendered /404 page (GitHub Pages serves it for unknown URLs)
//   - the JSON-LD inlined in the home page, for search engines
//   - .nojekyll, so GitHub Pages serves the files as they are
import { existsSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'dist/portfolio/browser');

if (!existsSync(OUT)) {
  console.error(`postbuild: ${OUT} not found (did ng build run?)`);
  process.exit(1);
}

const notFound = resolve(OUT, '404/index.html');
if (existsSync(notFound)) {
  renameSync(notFound, resolve(OUT, '404.html'));
  rmSync(resolve(OUT, '404'), { recursive: true, force: true });
}

const home = resolve(OUT, 'index.html');
const jsonld = readFileSync(resolve(ROOT, 'public/data/portfolio.jsonld'), 'utf8');
const html = readFileSync(home, 'utf8');
if (!html.includes('application/ld+json')) {
  const tag = `<script type="application/ld+json">${JSON.stringify(JSON.parse(jsonld)).replace(/</g, '\\u003c')}</script>`;
  writeFileSync(home, html.replace('</head>', `${tag}</head>`));
}

writeFileSync(resolve(OUT, '.nojekyll'), '');
rmSync(resolve(OUT, 'index.csr.html'), { force: true }); // not needed: every page is prerendered
console.log('postbuild: 404.html, JSON-LD and .nojekyll ready in dist/portfolio/browser');

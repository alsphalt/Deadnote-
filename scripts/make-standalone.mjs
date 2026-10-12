// Builds a single-file DARKNOTE.html from the Vite production build
// (inlines CSS + JS so the app can be opened directly or served).
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('web/dist');
const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf-8');

// inline stylesheet
let html = index.replace(
  /<link rel="stylesheet" crossorigin href="([^"]+)">/,
  (m, href) => {
    const css = fs.readFileSync(path.join(dist, href.replace(/^\//, '')), 'utf-8');
    return `<style>\n${css}\n</style>`;
  }
);

// inline module script
html = html.replace(
  /<script type="module" crossorigin src="([^"]+)">\s*<\/script>/,
  (m, src) => {
    const js = fs.readFileSync(path.join(dist, src.replace(/^\//, '')), 'utf-8');
    return `<script type="module">\n${js}\n</script>`;
  }
);

// remove leftover empty module script tags if any
html = html.replace(/<script type="module" crossorigin src="[^"]+"><\/script>/g, '');

const out = path.resolve('DARKNOTE.html');
fs.writeFileSync(out, html);
// also make it servable from the production server
fs.copyFileSync(out, path.join(dist, 'DARKNOTE.html'));
console.log(`DARKNOTE.html written: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);

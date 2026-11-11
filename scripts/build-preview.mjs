// Crea un'anteprima del gioco in un unico file HTML (tutto incluso), da aprire nel browser o condividere.
//   npm run preview:file   → dist-preview/sky-squadron-idle.html
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-preview', 'sky-squadron-idle.html');
const res = await build({ root, base: './', logLevel: 'warn',
  build: { write: false, target: 'es2020', assetsInlineLimit: 1e8, rollupOptions: { output: { codeSplitting: false } } } });
const items = (Array.isArray(res) ? res[0] : res).output;
const js = items.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n');
const css = items.filter((o) => o.fileName.endsWith('.css')).map((o) => o.source).join('\n');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Sky Squadron Idle</title><style>${css}</style></head><body>
${body}<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script></body></html>
`);
console.log(`Anteprima: ${path.relative(root, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);

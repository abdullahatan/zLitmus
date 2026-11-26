// Builds web/dist/zlitmus.html: one file, no external resources (SAP GUI may be offline).
// Directives in web/src/index.html (and in included files):
//   <!-- @include file -->      raw content of web/src/file
//   <!-- @svg path -->          inline SVG (path relative to the repository root)
//   <!-- @favicon path -->      <link rel="icon"> with the SVG as data URL
//   <!-- @fixtures dir -->      JSON map of the files under dir (browser mock mode only)
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = join(here, 'src');
const distFile = join(here, 'dist', 'zlitmus.html');
const directive = /<!--\s*@(include|svg|favicon|fixtures)\s+(\S+)\s*-->/g;
// "<" inside JSON that sits in a script element: written as a JSON escape built at run time
const jsonLessThan = '\\' + 'u003c';

function svg(path) {
  return readFileSync(resolve(root, path), 'utf8').replace(/<\?xml[^>]*\?>\s*/, '').trim();
}

function favicon(path) {
  const data = readFileSync(resolve(root, path)).toString('base64');
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${data}">`;
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function fixtures(dir) {
  const base = resolve(root, dir);
  const map = {};
  for (const file of filesUnder(base)) {
    map[relative(base, file).split('\\').join('/')] = readFileSync(file, 'utf8');
  }
  const json = JSON.stringify(map).replace(/</g, jsonLessThan);
  return `<script id="zlitmus-fixtures" type="application/json">${json}</script>`;
}

function expand(text, depth = 0) {
  if (depth > 5) throw new Error('Include nesting too deep');
  return text.replace(directive, (match, kind, arg) => {
    switch (kind) {
      case 'include': return expand(readFileSync(join(srcDir, arg), 'utf8'), depth + 1);
      case 'svg': return svg(arg);
      case 'favicon': return favicon(arg);
      case 'fixtures': return fixtures(arg);
      default: return match;
    }
  });
}

export function build() {
  const html = expand(readFileSync(join(srcDir, 'index.html'), 'utf8'));
  mkdirSync(dirname(distFile), { recursive: true });
  writeFileSync(distFile, html, 'utf8');
  const bytes = Buffer.byteLength(html, 'utf8');
  const sha256 = createHash('sha256').update(html, 'utf8').digest('hex');
  return { file: distFile, bytes, sha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = build();
  console.log(`${relative(root, result.file)}: ${result.bytes} bytes, sha256 ${result.sha256}`);
}

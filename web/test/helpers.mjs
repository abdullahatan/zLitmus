// Loads web/dist/zlitmus.html into jsdom (browser mock mode) for the tests.
import { existsSync, readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

export const webDir = join(dirname(fileURLToPath(import.meta.url)), '..');
export const distFile = join(webDir, 'dist', 'zlitmus.html');

// seed: { key: value } written to localStorage before the page starts (e.g. the mock store of an earlier page)
// boot: object put in place of __ZLITMUS_BOOT__ as ABAP does (SAP mode: runtime "sap")
export function loadPage({ lang = 'en', storage = true, seed = null, boot = null } = {}) {
  const errors = [];
  let html = readFileSync(distFile, 'utf8');
  if (boot) html = html.replace('__ZLITMUS_BOOT__', () => JSON.stringify(boot).replace(/</g, '\\u' + '003c'));
  const dom = new JSDOM(html, {
    url: 'http://localhost/zlitmus.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      if (!window.crypto || !window.crypto.getRandomValues) {
        Object.defineProperty(window, 'crypto', { value: webcrypto });
      }
      Object.defineProperty(window.navigator, 'language', { value: lang === 'tr' ? 'tr-TR' : 'en-US' });
      if (seed) Object.keys(seed).forEach((key) => window.localStorage.setItem(key, seed[key]));
      if (!storage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('no storage'); } });
      window.addEventListener('error', (event) => errors.push(event.message));
    }
  });
  return { dom, window: dom.window, document: dom.window.document, ZL: dom.window.ZL, errors };
}

// ABAP sources: src/ in the published repository (abapGit layout), abap/src/ in the development repository
export function abapSource(name) {
  for (const folder of [['..', 'src'], ['..', 'abap', 'src']]) {
    const path = join(webDir, ...folder, name);
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error(`ABAP source ${name} not found`);
}

export function fixture(name) {
  return readFileSync(join(webDir, 'test', 'fixtures', name), 'utf8');
}

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits until the busy overlay is hidden (mock answers are asynchronous)
export async function settled(page, timeout = 3000) {
  const end = Date.now() + timeout;
  await tick(5);
  while (!page.document.getElementById('busy').hidden) {
    if (Date.now() > end) throw new Error('page stayed busy');
    await tick(10);
  }
  await tick(5);
}

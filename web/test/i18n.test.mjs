import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadPage, webDir } from './helpers.mjs';

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : [path];
  });
}

test('tr and en dictionaries have the same keys', () => {
  const { ZL } = loadPage();
  const tr = Object.keys(ZL.i18n.dict.tr).sort();
  const en = Object.keys(ZL.i18n.dict.en).sort();
  assert.deepEqual(tr.filter((k) => !en.includes(k)), [], 'only in tr');
  assert.deepEqual(en.filter((k) => !tr.includes(k)), [], 'only in en');
  for (const key of en) {
    assert.ok(ZL.i18n.dict.tr[key].trim(), `empty tr text: ${key}`);
    assert.ok(ZL.i18n.dict.en[key].trim(), `empty en text: ${key}`);
  }
});

test('every text key used in the sources exists', () => {
  const { ZL } = loadPage();
  const missing = new Set();
  for (const file of sources(join(webDir, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) {
      if (match[1].endsWith('.')) continue; // dynamic key prefix, checked below
      if (!(match[1] in ZL.i18n.dict.en)) missing.add(`${match[1]} (${file})`);
    }
    for (const match of text.matchAll(/data-i18n="([a-zA-Z0-9_.]+)"/g)) {
      if (!(match[1] in ZL.i18n.dict.en)) missing.add(`${match[1]} (${file})`);
    }
    for (const match of text.matchAll(/label: '((?:menu|cmd|tb)\.[a-zA-Z0-9_.]+)'/g)) {
      if (!(match[1] in ZL.i18n.dict.en)) missing.add(`${match[1]} (${file})`);
    }
  }
  for (const id of Object.keys(ZL.Commands)) {
    if (!(`cmd.${id}` in ZL.i18n.dict.en)) missing.add(`cmd.${id}`);
  }
  for (const result of ['waiting', 'pass', 'fail']) {
    if (!(`result.${result}` in ZL.i18n.dict.en)) missing.add(`result.${result}`);
  }
  for (const section of ['start', 'request', 'save', 'auth', 'errors']) {
    for (const part of ['title', 'text']) {
      if (!(`guide.${section}.${part}` in ZL.i18n.dict.en)) missing.add(`guide.${section}.${part}`);
    }
  }
  assert.deepEqual([...missing], []);
});

test('Turkish texts are shown for tr, English otherwise', () => {
  const tr = loadPage({ lang: 'tr' });
  assert.equal(tr.document.querySelector('[data-menu="file"]').textContent, 'Dosya');
  assert.equal(tr.document.documentElement.lang, 'tr');
  const en = loadPage({ lang: 'de' });
  assert.equal(en.document.querySelector('[data-menu="file"]').textContent, 'File');
});

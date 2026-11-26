// Sample requests generated from the WSDL fixtures, compared with snapshots in test/snapshots.
// A missing snapshot is written on the first run (review it, then commit it).
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fixture, loadPage, webDir } from './helpers.mjs';

const snapshotDir = join(webDir, 'test', 'snapshots');

/* The documents ABAP would download for a fixture (the WSDL and its import chain) */
export function bundle(ZL, name) {
  const documents = [];
  const visit = (url) => {
    if (documents.some((d) => d.url === url)) return;
    const path = url.replace('mock://fixtures/', '');
    const text = fixture(path);
    documents.push({ url, status: 200, contentType: 'text/xml; charset=utf-8', error: '',
                     b64: Buffer.from(text, 'utf8').toString('base64') });
    for (const reference of ZL.Wsdl.Refs.extract(text)) visit(ZL.Wsdl.Refs.resolve(url, reference));
  };
  visit(`mock://fixtures/${name}`);
  return { url: `mock://fixtures/${name}`, documents };
}

function render(ZL, name) {
  const model = new ZL.Wsdl(bundle(ZL, name));
  const out = [];
  for (const entry of model.interfaces()) {
    for (const op of entry.ops) {
      const sample = ZL.Generator.sample(model, entry.binding, op);
      const headers = ZL.Generator.autoHeaders(sample.version, sample.soapAction);
      out.push(`### ${entry.name} / ${op} (SOAP ${sample.version}, ${sample.style})`);
      out.push(`### endpoints: ${entry.endpoints.join(' ')}`);
      for (const h of headers) out.push(`### ${h.name}: ${h.value}`);
      out.push(sample.xml, '');
    }
  }
  if (model.errors.length) out.push(`### errors: ${model.errors.join(' | ')}`);
  return out.join('\n');
}

function matchesSnapshot(name, actual) {
  mkdirSync(snapshotDir, { recursive: true });
  const file = join(snapshotDir, name.replace(/\.wsdl$/, '.txt'));
  if (!existsSync(file)) writeFileSync(file, actual, 'utf8');
  assert.equal(actual, readFileSync(file, 'utf8'));
}

for (const name of ['calc.wsdl', 'sap.wsdl', 'rpc.wsdl', 'imp.wsdl']) {
  test(`templates of ${name} match the snapshot`, () => {
    const { ZL } = loadPage();
    matchesSnapshot(name, render(ZL, name));
  });
}

test('calc: qualified elements get the target namespace prefix', () => {
  const { ZL } = loadPage();
  const text = render(ZL, 'calc.wsdl');
  assert.match(text, /<tem:intA>\?<\/tem:intA>/);
  assert.match(text, /xmlns:tem="http:\/\/tempuri.org\/"/);
});

test('SOAP 1.2 binding gets application/soap+xml with action', () => {
  const { ZL } = loadPage();
  const text = render(ZL, 'calc.wsdl');
  assert.match(text, /SOAP 1\.2.*\n.*\n### Content-Type: application\/soap\+xml;charset=UTF-8;action="http:\/\/tempuri.org\/Add"/);
  assert.match(text, /xmlns:soapenv="http:\/\/www.w3.org\/2003\/05\/soap-envelope"/);
});

test('imp: import chain, header part, recursion guard and optional comments', () => {
  const { ZL } = loadPage();
  const model = new ZL.Wsdl(bundle(ZL, 'imp.wsdl'));
  assert.equal(model.docs.length, 4);
  const text = render(ZL, 'imp.wsdl');
  assert.match(text, /<soapenv:Header>\n/);
  assert.match(text, /<!--Optional:-->/);
  assert.match(text, /Recursive type|<!--Zero or more repetitions:-->/);
});

test('rpc: operation wrapper with part accessors', () => {
  const { ZL } = loadPage();
  const text = render(ZL, 'rpc.wsdl');
  assert.match(text, /rpc\)/);
});

test('effective headers: a user header replaces the automatic one', () => {
  const { ZL } = loadPage();
  const auto = ZL.Generator.autoHeaders('1.1', 'urn:a');
  const result = Array.from(ZL.Generator.effectiveHeaders(auto, [{ name: 'soapaction', value: '"urn:b"' }]))
    .map((h) => `${h.name}=${h.value}`);
  assert.deepEqual(result, ['Content-Type=text/xml;charset=UTF-8', 'soapaction="urn:b"']);
});

test('XML helpers: pretty print, highlight, fault', () => {
  const { ZL } = loadPage();
  assert.equal(ZL.Xml.pretty('<a><b>1</b><c/></a>'), '<a>\n   <b>1</b>\n   <c/>\n</a>');
  assert.equal(ZL.Xml.pretty('not xml'), null);
  assert.match(ZL.Xml.highlight('<a x="1"/>'), /<span class="a">x<\/span>=<span class="v">&quot;1&quot;<\/span>/);
  const fault = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault>' +
    '<faultcode>s:Client</faultcode><faultstring>Bad</faultstring></s:Fault></s:Body></s:Envelope>';
  assert.equal(ZL.Xml.faultOf(fault), 'SOAP Fault [s:Client]: Bad');
  assert.equal(ZL.Xml.faultOf('<ok/>'), '');
});

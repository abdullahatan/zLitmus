// The same payloads are parsed by ABAP (ZCL_LITMUS_BRIDGE test class): keep both sides in step.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPage } from './helpers.mjs';

const BACKSLASH = String.fromCharCode(92);

export const REFERENCE_PAYLOAD = 'Vgl1aQlleUpoSWpvaXhaN0VuOFN3WEhRaWZRPT0KVglib2R5CVBIZytDZ25EcDhPMlBDOTRQZz09CkgJU09BUEFj' +
  'dGlvbglJblZ5YmpwaElnPT0KVgllbXB0eQk=';

export const SEND_PAYLOAD = 'Vgl1aQlleUoyWlhKemFXOXVJam94TENKMFlXSnpJanBiWFgwPQpWCXByb2plY3RfaWQJTURFeU16UTFOamM0T1VGQ1Ew' +
  'UkZSakF4TWpNME5UWTNPRGxCUWtORVJVWT0KVglyZXF1ZXN0X2lkCVJrVkVRMEpCT1RnM05qVTBNekl4TUVaRlJFTkNRVGs0TnpZMU5ETXlNVEE9ClYJdXJs' +
  'CWFIUjBjSE02THk5b2IzTjBPamcwTkRNdmMyRndMMkpqTDNOeWRDOTRQM05oY0MxamJHbGxiblE5TVRBdwpWCWJvZHkJUEdFK1NjU2ZaTVN4Y2lBbUlDTERw' +
  'MkY1SWlBOEwyRSsKVglhdXRoX3R5cGUJUWtGVFNVTT0KVgl1c2VyCVFVeEpRMFU9ClYJcGFzcwljRUJ6Y3pwM01ISmtLeTg5ClYJdGltZW91dAlNekE9CkgJ' +
  'U09BUEFjdGlvbglJblZ5YmpwNElnPT0KSAlDb250ZW50LVR5cGUJZEdWNGRDOTRiV3c3WTJoaGNuTmxkRDFWVkVZdE9BPT0=';

test('Bridge.encode gives the reference payload of the ABAP test', () => {
  const { ZL } = loadPage();
  const payload = ZL.Bridge.encode([
    ['V', 'ui', '{"a":"Şğİ' + BACKSLASH + 't"}'],
    ['V', 'body', '<x>\n\tçö</x>'],
    ['H', 'SOAPAction', '"urn:a"'],
    ['V', 'empty', '']
  ]);
  assert.equal(payload, REFERENCE_PAYLOAD);
});

test('Bridge.encode of a REQUEST_SEND gives the payload of the ABAP test', () => {
  const { ZL } = loadPage();
  const payload = ZL.Bridge.encode([
    ['V', 'ui', '{"version":1,"tabs":[]}'],
    ['V', 'project_id', '0123456789ABCDEF0123456789ABCDEF'],
    ['V', 'request_id', 'FEDCBA9876543210FEDCBA9876543210'],
    ['V', 'url', 'https://host:8443/sap/bc/srt/x?sap-client=100'],
    ['V', 'body', '<a>Iğdır & "çay" </a>'],
    ['V', 'auth_type', 'BASIC'],
    ['V', 'user', 'ALICE'],
    ['V', 'pass', 'p@ss:w0rd+/='],
    ['V', 'timeout', '30'],
    ['H', 'SOAPAction', '"urn:x"'],
    ['H', 'Content-Type', 'text/xml;charset=UTF-8']
  ]);
  assert.equal(payload, SEND_PAYLOAD);
});

test('the page posts to sapevent:<ACTION> with the payload field', async () => {
  const { readFileSync } = await import('node:fs');
  const { abapSource } = await import('./helpers.mjs');
  const bridge = abapSource('zcl_litmus_bridge.clas.abap');
  const abapVersion = /CONSTANTS version TYPE string VALUE `([^`]+)`/.exec(bridge)[1];
  const { document } = loadPage();
  const form = document.getElementById('bridgeForm');
  assert.equal(form.method.toLowerCase(), 'post');
  assert.ok(form.elements.payload);
  assert.equal(document.querySelectorAll('script#zlitmus-boot').length, 1);
  assert.equal(document.querySelector('meta[name="zlitmus"]').content, abapVersion, 'page and ABAP version');
});

test('every action the page sends is handled by ZCL_LITMUS_ACTION_HANDLER', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { webDir } = await import('./helpers.mjs');
  const { abapSource } = await import('./helpers.mjs');
  const abap = abapSource('zif_litmus_action_handler.intf.abap');
  const handled = [...abap.matchAll(/VALUE `([A-Z_]+)`/g)].map((m) => m[1]);
  const app = readFileSync(join(webDir, 'src', 'app.js'), 'utf8');
  const sent = new Set([...app.matchAll(/(?:send\(|action: )'([A-Z_]+)'/g)].map((m) => m[1]));
  const bridge = readFileSync(join(webDir, 'src', 'bridge.js'), 'utf8');
  for (const m of bridge.matchAll(/'sapevent:([A-Z_]+)'/g)) sent.add(m[1]);
  assert.ok(sent.has('UI_SYNC'), 'the quiet state update is checked too');
  assert.ok(sent.size >= 10, `found ${[...sent]}`);
  for (const action of sent) assert.ok(handled.includes(action), `${action} is not handled by ABAP`);
});

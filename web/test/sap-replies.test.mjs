// The page in SAP mode with replies recorded from a real SAP service (2026-11-26, end-to-end check
// ZCL_LITMUS_E2E_CHECK): protected WSDL -> Basic Authentication dialog, SOAP call without credentials -> 401.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPage, settled } from './helpers.mjs';

const WSDL_URL = 'http://zlitmusdevs.com.tr:8000/sap/bc/srt/wsdl/flv_10002A101AD1/bndg_url/sap/bc/srt/rfc/sap/' +
  'zsecure_srv/100/zsecure_ws/secure_bnd?sap-client=100';
const ENDPOINT = 'http://zlitmusdevs.com.tr:8000/sap/bc/srt/rfc/sap/zsecure_srv/100/zsecure_ws/secure_bnd' +
  '?sap-client=100';
const REALM = 'SAP NetWeaver Application Server [DEV/100]';

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

function sapBoot(fields) {
  return Object.assign({ runtime: 'sap', version: '1.1.0', lang: 'tr', user: 'TESTER', system: 'DEV/100',
                         settings: { timeoutSec: 60, sslId: 'ANONYM', proxyHost: '', proxyPort: '', uiPrefs: '' },
                         ui64: '', workspace64: '', projects: [], message: null, reply: null }, fields);
}

function click(page, element) {
  element.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true }));
}

function type(page, element, value) {
  element.value = value;
  element.dispatchEvent(new page.window.Event('input', { bubbles: true }));
}

// Captures the SAPEVENT form posts instead of navigating
function capturePosts(page) {
  const posts = [];
  const form = page.document.getElementById('bridgeForm');
  form.submit = () => {
    const lines = Buffer.from(form.elements.payload.value, 'base64').toString('utf8').split('\n').map((row) => {
      const [key, name, value] = row.split('\t');
      return { key, name, value: Buffer.from(value || '', 'base64').toString('utf8') };
    });
    posts.push({ action: form.action, lines });
  };
  return posts;
}

test('real auth_required reply of the protected WSDL opens the Basic Authentication dialog', () => {
  const ui = { version: 1, pending: { action: 'PROJECT_CREATE',
                                     values: { name: 'zlitmusdevs.com', wsdl_url: WSDL_URL, create_samples: 'true' } } };
  const page = loadPage({ lang: 'tr', boot: sapBoot({
    ui64: b64(JSON.stringify(ui)),
    message: { type: 'W', text: 'WSDL için yetki gerekli: zlitmusdevs.com.tr:8000' },
    reply: { kind: 'auth_required', ok: false, message: 'WSDL için yetki gerekli: zlitmusdevs.com.tr:8000',
             action: 'PROJECT_CREATE', url: WSDL_URL, host: 'zlitmusdevs.com.tr:8000', realm: REALM }
  }) });
  assert.equal(page.ZL.Bridge.isSap(), true);
  const dialog = page.document.querySelector('#modalRoot .dialog');
  assert.ok(dialog, 'dialog is open');
  assert.match(dialog.textContent, /zlitmusdevs\.com\.tr:8000 için yetki gerekli/);
  assert.match(dialog.textContent, /SAP NetWeaver Application Server \[DEV\/100\]/);

  const posts = capturePosts(page);
  const inputs = dialog.querySelectorAll('input');
  type(page, inputs[0], 'TESTER');
  type(page, inputs[1], 'not-a-real-password');
  click(page, page.document.querySelector('#modalRoot .btn.primary'));
  return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
    assert.equal(posts.length, 1);
    assert.equal(posts[0].action, 'sapevent:PROJECT_CREATE');
    const value = (name) => (posts[0].lines.find((l) => l.key === 'V' && l.name === name) || {}).value;
    assert.equal(value('wsdl_url'), WSDL_URL);
    assert.equal(value('name'), 'zlitmusdevs.com');
    assert.equal(value('wsdl_user'), 'TESTER');
    assert.equal(value('wsdl_pass'), 'not-a-real-password');
    assert.equal(value('create_samples'), 'true');
    // The WSDL password stays in the session state ("ui", ABAP session memory only, D-013); never in a project
    assert.ok(!JSON.stringify(page.ZL.State.get().projects).includes('not-a-real-password'));
    page.window.close();
  });
});

test('the default name of the real WSDL address is the host without its last label', () => {
  const page = loadPage({ boot: sapBoot({}) });
  page.ZL.App.run('file.new');
  type(page, page.document.getElementById('newProjectUrl'), WSDL_URL);
  assert.equal(page.document.getElementById('newProjectName').value, 'zlitmusdevs.com');
  page.window.close();
});

test('real 401 reply of the SOAP call turns the request red and logs the status', async () => {
  // A request window in mock mode gives the UI state that ABAP returns as ui64
  const mock = loadPage();
  mock.ZL.App.run('file.new');
  type(mock, mock.document.getElementById('newProjectUrl'), 'mock://fixtures/calc.wsdl');
  click(mock, mock.document.querySelector('#modalRoot .btn.primary'));
  await settled(mock);
  const request = mock.ZL.State.get().projects[0].requests[0];
  request.endpoint = ENDPOINT;
  mock.ZL.App.openRequest(request.requestId);
  mock.ZL.State.setResponse(request.requestId, { waiting: true });
  const ui = mock.ZL.State.snapshot();

  const html = '<html><body>401 Unauthorized</body></html>';
  const page = loadPage({ lang: 'tr', boot: sapBoot({
    ui64: b64(ui),
    message: { type: 'W', text: 'HTTP 401 Unauthorized - 73 ms' },
    reply: { kind: 'response', ok: true, message: 'HTTP 401 Unauthorized - 73 ms', projectId: '', requestId: request.requestId,
             status: 401, reason: 'Unauthorized', timeMs: 73, size: 9321,
             headers: [{ n: 'content-type', v: 'text/html; charset=utf-8' }, { n: 'content-length', v: '9321' },
                       { n: 'sap-system', v: 'DEV' }, { n: 'www-authenticate', v: 'Basic realm="' + REALM + '"' },
                       { n: 'sap-client', v: '100' }],
             body64: b64(html), hint: '',
             request: { method: 'POST', url: ENDPOINT, headers: [{ n: 'Content-Type', v: 'text/xml;charset=UTF-8' }] } }
  }) });
  const status = page.document.querySelector('.statusline');
  assert.equal(status.dataset.result, 'fail');
  assert.match(status.textContent, /HTTP 401 Unauthorized/);
  assert.ok(page.ZL.State.get().logs.http.some((l) => /401/.test(l.text)));
  assert.match(page.document.querySelector('.response-pane').textContent, /www-authenticate|401/);
  assert.deepEqual(Array.from(page.errors), []);
  page.window.close();
  mock.window.close();
});

// Demo service without authentication (ZDEMO_SERVICE, read-only SELECT on T001), answer recorded 2026-11-26
const DEMO_ENDPOINT = 'http://zlitmusdevs.com.tr:8000/sap/bc/srt/rfc/sap/zdemo/100/zdemo_srv/demo_bnd?sap-client=100';
const DEMO_ANSWER = '<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"><soap-env:Header/>' +
  '<soap-env:Body><n0:ZDEMO_SERVICEResponse xmlns:n0="urn:sap-com:document:sap:rfc:functions"><ES_MESSAGE><TYPE>S</TYPE>' +
  '<ID>00</ID><NUMBER>000</NUMBER><MESSAGE>1 adet kayıt listelendi</MESSAGE></ES_MESSAGE><ET_RESULT><item><MANDT>100</MANDT>' +
  '<BUKRS>1000</BUKRS><BUTXT>DEMO ŞİRKETİ A.Ş.</BUTXT><LAND1>TR</LAND1><WAERS>TRY</WAERS></item></ET_RESULT>' +
  '</n0:ZDEMO_SERVICEResponse></soap-env:Body></soap-env:Envelope>';

test('real 200 answer of the demo service turns the request green and shows the formatted XML', async () => {
  const mock = loadPage();
  mock.ZL.App.run('file.new');
  type(mock, mock.document.getElementById('newProjectUrl'), 'mock://fixtures/calc.wsdl');
  click(mock, mock.document.querySelector('#modalRoot .btn.primary'));
  await settled(mock);
  const request = mock.ZL.State.get().projects[0].requests[0];
  request.endpoint = DEMO_ENDPOINT;
  mock.ZL.App.openRequest(request.requestId);
  mock.ZL.State.setResponse(request.requestId, { waiting: true });

  const page = loadPage({ lang: 'tr', boot: sapBoot({
    ui64: b64(mock.ZL.State.snapshot()),
    message: { type: 'S', text: 'HTTP 200 OK - 11421 ms' },
    reply: { kind: 'response', ok: true, message: 'HTTP 200 OK - 11421 ms', projectId: '', requestId: request.requestId,
             status: 200, reason: 'OK', timeMs: 11421, size: Buffer.byteLength(DEMO_ANSWER),
             headers: [{ n: 'content-type', v: 'text/xml; charset=utf-8' }, { n: 'sap-system', v: 'DEV' }],
             body64: b64(DEMO_ANSWER), hint: '',
             request: { method: 'POST', url: DEMO_ENDPOINT, headers: [{ n: 'Content-Type', v: 'text/xml;charset=UTF-8' }] } }
  }) });
  const status = page.document.querySelector('.statusline');
  assert.equal(status.dataset.result, 'pass');
  assert.match(status.textContent, /HTTP 200 OK/);
  const response = page.document.querySelector('.response-pane .xmlview').textContent;
  assert.match(response, /ZDEMO_SERVICEResponse/);
  assert.match(response, /1 adet kayıt listelendi/);
  assert.match(response, /DEMO ŞİRKETİ A\.Ş\./, 'UTF-8 Turkish characters are decoded');
  assert.match(response, /\n\s+<ES_MESSAGE>/, 'the answer is pretty printed');
  assert.deepEqual(Array.from(page.errors), []);
  page.window.close();
  mock.window.close();
});

test('an error document instead of a WSDL is refused (SAP "<error>" answer of ?wsdl)', async () => {
  const page = loadPage();
  page.ZL.App.run('file.new');
  type(page, page.document.getElementById('newProjectUrl'), 'mock://fixtures/sap-error.xml');
  click(page, page.document.querySelector('#modalRoot .btn.primary'));
  await settled(page);
  assert.equal(page.ZL.State.get().projects.length, 0);
  assert.match(page.document.getElementById('statusbar').textContent,
               /did not return a WSDL \(root element: error\)\. WSP Exception caught/);
  page.window.close();
});

// Real WSDL of the demo service (from the project cache of the SAP system); SAP mode answer of PROJECT_CREATE after Basic auth
test('SAP mode: a new project gets one "Request 1" per operation and binding, saved once the page has loaded', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { webDir } = await import('./helpers.mjs');
  const wsdl = readFileSync(join(webDir, 'test', 'recorded', 'zdemo.wsdl'), 'utf8');
  const url = 'http://host:8000/sap/bc/srt/wsdl/flv/bndg_url/zdemo?sap-client=100';
  const ui = { version: 1, pending: { action: 'PROJECT_CREATE',
    values: { name: 'zlitmusdevs.com', wsdl_url: url, create_samples: 'true' } }, lastAction: 'PROJECT_CREATE' };
  const workspace = { projects: [{ projectId: 'AA', wsdl: { url, loadedAt: '', documents: [
    { url, status: 200, contentType: 'text/xml; charset=utf-8', error: '', b64: b64(wsdl) }] } }] };
  const page = loadPage({ lang: 'tr', boot: sapBoot({
    ui64: b64(JSON.stringify(ui)), workspace64: b64(JSON.stringify(workspace)),
    message: { type: 'S', text: 'WSDL yüklendi (1 belge, 812 ms).' },
    reply: { kind: 'project', ok: true, message: 'WSDL yüklendi (1 belge, 812 ms).', createSamples: true,
             project: { header: { projectId: 'AA', name: 'zlitmusdevs.com', wsdlUrl: url }, requests: [] } } }) });
  const posts = capturePosts(page);
  const project = page.ZL.State.get().projects[0];
  assert.deepEqual(Array.from(project.requests, (r) => r.interfaceName + '/' + r.operation + '/' + r.name),
                   ['demo_bnd/ZDEMO_SERVICE/Request 1', 'demo_bnd_soap12/ZDEMO_SERVICE/Request 1']);
  assert.match(project.requests[0].body, /<urn:ZDEMO_SERVICE>/);
  assert.match(project.requests[0].body, /<IV_BUKRS>\?<\/IV_BUKRS>/);
  assert.equal(posts.length, 0, 'nothing is sent while the page is still loading');
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(posts.length, 1, 'the samples are saved after the page has loaded');
  assert.equal(posts[0].action, 'sapevent:PROJECT_SAVE');
  const saved = JSON.parse(posts[0].lines.find((l) => l.name === 'project').value);
  assert.equal(saved.requests.length, 2);
  assert.match(page.document.getElementById('statusbar').textContent, /812 ms/);
  page.window.close();
});

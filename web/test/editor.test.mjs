// Fourth feedback round: coloured request editor, resizable request | response divider, XML export
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPage, settled, tick } from './helpers.mjs';

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

function click(page, element) {
  element.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true }));
}

function type(page, element, value) {
  element.value = value;
  element.dispatchEvent(new page.window.Event('input', { bubbles: true }));
}

function mouse(page, target, kind, x) {
  target.dispatchEvent(new page.window.MouseEvent(kind, { bubbles: true, cancelable: true, clientX: x, clientY: x }));
}

async function openRequest(page) {
  page.ZL.App.run('file.new');
  type(page, page.document.getElementById('newProjectUrl'), 'mock://fixtures/calc.wsdl');
  click(page, page.document.querySelector('#modalRoot .btn.primary'));
  await settled(page);
  const project = page.ZL.State.get().projects[0];
  const request = project.requests.find((r) => r.interfaceName === 'CalculatorSoap' && r.operation === 'Add');
  page.ZL.App.openRequest(request.requestId);
  return request;
}

test('the highlighter keeps every character (the colour layer must match the textarea)', () => {
  const { ZL, document } = loadPage();
  const samples = ['<a  b="1"  c = \'2\' >x</a >', '<IV_BUKRS>10', '<!--Optional:-->\n\t<x/>', '<?xml version="1.0"?><r/>',
                   '<a><![CDATA[<b>]]></a>', 'text < more & <unfinished attr="', '<soapenv:Envelope\n   xmlns:s="u">'];
  for (const sample of samples) {
    const box = document.createElement('pre');
    box.innerHTML = ZL.Xml.highlight(sample);
    assert.equal(box.textContent, sample, sample);
  }
});

test('the request editor shows coloured XML and follows typing', async () => {
  const page = loadPage();
  const { document } = page;
  await openRequest(page);
  const area = document.getElementById('requestEditor');
  const layer = document.querySelector('.code-editor .code-layer');
  assert.ok(area.classList.contains('code-input'));
  assert.ok(layer.querySelector('.t'), 'tags are coloured');
  assert.equal(layer.textContent.replace(/\n $/, ''), area.value);
  type(page, area, '<a x="1"><!--c--></a>');
  assert.ok(layer.querySelector('.a') && layer.querySelector('.v') && layer.querySelector('.c'));
  assert.equal(layer.textContent.replace(/\n $/, ''), '<a x="1"><!--c--></a>');
});

test('the divider between request and response is draggable; the ratio is kept, double-click resets', async () => {
  const page = loadPage();
  const { document, ZL } = page;
  await openRequest(page);
  const left = document.querySelector('.panes > .request-pane');
  assert.match(left.style.flex, /50(\.00)?%/);
  const split = document.querySelector('.panes > .pane-split');
  mouse(page, split, 'mousedown', 500);
  mouse(page, document, 'mousemove', 300);
  mouse(page, document, 'mouseup', 300);
  assert.equal(ZL.State.get().prefs.paneRatio, 0.3);
  assert.match(document.querySelector('.panes > .request-pane').style.flex, /30(\.00)?%/);
  assert.equal(ZL.State.get().prefsDirty, true);

  mouse(page, split, 'mousedown', 500);
  mouse(page, document, 'mousemove', -1000);
  mouse(page, document, 'mouseup', -1000);
  assert.equal(ZL.State.get().prefs.paneRatio, 0.15, 'never narrower than 15 %');

  ZL.App.renderAll();
  assert.match(document.querySelector('.panes > .request-pane').style.flex, /15(\.00)?%/, 'kept after a new render');
  document.querySelector('.panes > .pane-split').dispatchEvent(new page.window.MouseEvent('dblclick', { bubbles: true }));
  assert.equal(ZL.State.get().prefs.paneRatio, 0.5);
});

test('request and response can be exported as XML (browser: download)', async () => {
  const page = loadPage();
  const { document, ZL, window } = page;
  const downloads = [];
  window.URL.createObjectURL = (blob) => { downloads.push(blob); return 'blob:x'; };
  window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.getAttribute('download')); };
  const blobText = (blob) => new Promise((resolve) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
  const request = await openRequest(page);
  const buttons = () => Array.from(document.querySelectorAll('.pane-head [data-action="export"]'));
  assert.equal(buttons().length, 2);
  assert.equal(buttons()[1].disabled, true, 'no response yet');
  assert.equal(ZL.Commands['request.exportResponse'].enabled(), false);

  click(page, buttons()[0]);
  assert.equal(downloads[1], 'Request 1-request.xml');
  assert.equal(await blobText(downloads[0]), request.body);

  ZL.App.run('request.send');
  await settled(page);
  assert.equal(buttons()[1].disabled, false);
  click(page, buttons()[1]);
  assert.equal(downloads[3], 'Request 1-response.xml');
  assert.match(await blobText(downloads[2]), /AddResponse/);
});

test('SAP mode: export sends FILE_EXPORT with the file name and the XML', async () => {
  const mock = loadPage();
  const request = await openRequest(mock);
  const ui = mock.ZL.State.snapshot();
  mock.window.close();
  const page = loadPage({ boot: { runtime: 'sap', version: '1.1.0', lang: 'en', user: 'T', system: 'DEV/100',
    settings: { timeoutSec: 60, sslId: 'ANONYM', proxyHost: '', proxyPort: '', uiPrefs: '' },
    ui64: b64(ui), workspace64: '', projects: [], message: null, reply: null } });
  const posts = [];
  const form = page.document.getElementById('bridgeForm');
  form.submit = () => posts.push({ action: form.action, payload: form.elements.payload.value });
  page.ZL.App.run('request.exportRequest');
  await tick(5);
  assert.equal(posts[0].action, 'sapevent:FILE_EXPORT');
  const lines = Buffer.from(posts[0].payload, 'base64').toString('utf8').split('\n').map((row) => {
    const [key, name, value] = row.split('\t');
    return { key, name, value: Buffer.from(value || '', 'base64').toString('utf8') };
  });
  assert.equal(lines.find((l) => l.name === 'file_name').value, 'Request 1-request.xml');
  assert.equal(lines.find((l) => l.name === 'content').value, request.body);
  page.window.close();
});

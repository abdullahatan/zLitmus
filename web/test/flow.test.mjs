// End-to-end flow in browser mock mode: new project -> edit request -> send -> save -> close -> open
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPage, settled } from './helpers.mjs';

function click(page, element) {
  element.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true }));
}

function type(page, element, value) {
  element.value = value;
  element.dispatchEvent(new page.window.Event('input', { bubbles: true }));
}

function primaryButton(page) {
  const buttons = page.document.querySelectorAll('#modalRoot .btn.primary');
  return buttons[buttons.length - 1];
}

async function createProject(page, name, url) {
  page.ZL.App.run('file.new');
  type(page, page.document.getElementById('newProjectName'), name);
  type(page, page.document.getElementById('newProjectUrl'), url);
  click(page, primaryButton(page));
  await settled(page);
}

test('new project, edit, send, save, close and open again', async () => {
  const page = loadPage();
  const { ZL, document } = page;
  const State = ZL.State;

  await createProject(page, 'Calc', 'mock://fixtures/calc.wsdl');
  let project = State.get().projects[0];
  assert.equal(project.header.name, 'Calc');
  assert.equal(project.requests.length, 4, 'one sample request per operation and binding');
  assert.equal(project.dirty, false, 'samples are saved automatically (K-7)');
  assert.match(document.getElementById('tree').textContent, /Calc/);

  const add = project.requests.find((r) => r.interfaceName === 'CalculatorSoap' && r.operation === 'Add');
  ZL.App.openRequest(add.requestId);
  const editor = document.getElementById('requestEditor');
  type(page, editor, editor.value.replace('<tem:intA>?</tem:intA>', '<tem:intA>40</tem:intA>'));
  assert.equal(State.project(project.header.projectId).dirty, true);
  assert.match(document.querySelector('.tab.active .title').textContent, /^\*/);

  click(page, document.querySelector('[data-action="add-header"]'));
  const inputs = document.querySelectorAll('.request-pane .kv input');
  type(page, inputs[0], 'X-Api-Key');
  type(page, inputs[1], 'abc123');

  ZL.App.run('request.send');
  await settled(page);
  const response = State.get().responses[add.requestId];
  assert.equal(response.status, 200);
  assert.equal(document.querySelector('.statusline').dataset.result, 'pass');
  assert.match(document.querySelector('.statusline').textContent, /response time: \d+ms \(\d+ bytes\)/);
  assert.ok(response.request.headers.some((h) => h.n === 'X-Api-Key'));
  assert.ok(response.request.headers.some((h) => h.n === 'SOAPAction'));
  assert.ok(State.get().logs.http.length >= 1);

  ZL.App.run('file.save');
  await settled(page);
  project = State.get().projects[0];
  assert.equal(project.dirty, false);

  ZL.App.run('file.close');
  await settled(page);
  assert.equal(State.get().projects.length, 0);
  assert.equal(State.get().tabs.length, 1);

  ZL.App.run('file.open');
  await settled(page);
  assert.match(document.querySelector('#modalRoot .list').textContent, /Calc/);
  click(page, primaryButton(page));
  await settled(page);
  project = State.get().projects[0];
  const reopened = project.requests.find((r) => r.requestId === add.requestId);
  assert.match(reopened.body, /<tem:intA>40<\/tem:intA>/);
  assert.deepEqual(Array.from(reopened.headers, (h) => h.name), ['X-Api-Key']);
  assert.deepEqual(Array.from(page.errors), []);
});

test('protected WSDL asks for Basic authentication and then loads', async () => {
  const page = loadPage({ lang: 'tr' });
  await createProject(page, 'Secure', 'mock://secure/calc.wsdl');
  assert.equal(page.ZL.State.get().projects.length, 0);
  const dialog = page.document.querySelector('#modalRoot .dialog');
  assert.match(dialog.textContent, /Basic Authentication/);
  assert.match(dialog.textContent, /için yetki gerekli/);
  const inputs = dialog.querySelectorAll('input');
  type(page, inputs[0], 'ALICE');
  type(page, inputs[1], 'secret');
  click(page, primaryButton(page));
  await settled(page);
  await settled(page);
  assert.equal(page.ZL.State.get().projects[0].header.name, 'Secure');
  assert.ok(!JSON.stringify(page.ZL.State.get().projects).includes('secret'), 'no password in the project');
});

test('a SOAP fault turns the status mark red and is logged as error', async () => {
  const page = loadPage();
  await createProject(page, 'Faulty', 'mock://fixtures/calc.wsdl');
  const request = page.ZL.State.get().projects[0].requests[0];
  page.ZL.App.openRequest(request.requestId);
  type(page, page.document.getElementById('endpointInput'), 'http://host/fault');
  page.ZL.App.run('request.send');
  await settled(page);
  assert.equal(page.document.querySelector('.statusline').dataset.result, 'fail');
  assert.match(page.document.querySelector('.response-pane .fault').textContent, /SOAP Fault \[soapenv:Server\]: Mock fault/);
  assert.ok(page.ZL.State.get().logs.error.length >= 1);
});

test('unsaved changes ask before closing (HTML dialog, no window.confirm)', async () => {
  const page = loadPage();
  await createProject(page, 'Dirty', 'mock://fixtures/rpc.wsdl');
  const project = page.ZL.State.get().projects[0];
  page.ZL.App.openRequest(project.requests[0].requestId);
  page.ZL.App.run('request.rename');
  type(page, page.document.querySelector('#modalRoot input'), 'Renamed');
  click(page, primaryButton(page));
  assert.equal(project.dirty, true);
  page.ZL.App.run('file.close');
  assert.match(page.document.querySelector('#modalRoot .dialog').textContent, /unsaved changes/);
  assert.equal(page.ZL.State.get().projects.length, 1);
});

test('the state survives a page reload through "ui" (SAP round trip)', async () => {
  const page = loadPage();
  await createProject(page, 'Reload', 'mock://fixtures/sap.wsdl');
  const snapshot = page.ZL.State.snapshot();
  const restored = JSON.parse(snapshot);
  assert.equal(restored.projects[0].header.name, 'Reload');
  assert.equal(restored.version, 1);
  const lines = page.ZL.Bridge.linesOf({ name: 'x' }, [{ name: 'H1', value: 'v' }]);
  assert.equal(lines[0][1], 'ui');
  assert.deepEqual(Array.from(lines[2]), ['H', 'H1', 'v']);
});

test('preferences are saved; help dialogs open in both languages', async () => {
  const page = loadPage();
  page.ZL.App.run('file.preferences');
  const inputs = page.document.querySelectorAll('#modalRoot input');
  type(page, inputs[0], '120');
  click(page, primaryButton(page));
  await settled(page);
  assert.equal(page.ZL.App.settings().timeoutSec, 120);
  for (const command of ['help.guide', 'help.shortcuts', 'help.about']) {
    page.ZL.App.run(command);
    assert.ok(page.document.querySelector('#modalRoot .dialog'), command);
    click(page, primaryButton(page));
  }
  const tr = loadPage({ lang: 'tr' });
  tr.ZL.App.run('help.about');
  assert.match(tr.document.querySelector('#modalRoot .dialog').textContent, /MIT lisansı/);
});

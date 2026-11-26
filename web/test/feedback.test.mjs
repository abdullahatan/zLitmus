// Sprint 9 (user feedback): default project name, saved projects at the start, panel titles,
// editable request properties, binding window with service endpoints, light/dark theme
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPage, settled } from './helpers.mjs';

const STORE_KEY = 'zlitmus.mock.v1';

function click(page, element) {
  element.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true }));
}

function dblclick(page, element) {
  element.dispatchEvent(new page.window.MouseEvent('dblclick', { bubbles: true }));
}

function type(page, element, value) {
  element.value = value;
  element.dispatchEvent(new page.window.Event('input', { bubbles: true }));
}

function choose(page, element, value) {
  element.value = value;
  element.dispatchEvent(new page.window.Event('change', { bubbles: true }));
}

function primaryButton(page) {
  const buttons = page.document.querySelectorAll('#modalRoot .btn.primary');
  return buttons[buttons.length - 1];
}

async function createProject(page, url, name) {
  page.ZL.App.run('file.new');
  if (name) type(page, page.document.getElementById('newProjectName'), name);
  type(page, page.document.getElementById('newProjectUrl'), url);
  click(page, primaryButton(page));
  await settled(page);
}

function propsTitle(page) {
  return page.document.querySelector('#propsPanel .panel-title').textContent;
}

function node(page, label) {
  return Array.from(page.document.querySelectorAll('#tree .node'))
    .find((n) => n.querySelector('.label').textContent === label);
}

test('the project name is derived from the WSDL address until the user types one', async () => {
  const page = loadPage();
  const { ZL, document } = page;
  assert.equal(ZL.App.defaultProjectName('http://zlitmusdevs.com.tr:8000/sap/bc/srt/wsdl/x?sap-client=100'),
               'zlitmusdevs.com');
  assert.equal(ZL.App.defaultProjectName('https://www.dneonline.com/calculator.asmx?WSDL'), 'www.dneonline');
  assert.equal(ZL.App.defaultProjectName('mock://fixtures/calc.wsdl'), 'calc');
  assert.equal(ZL.App.defaultProjectName('http://10.1.2.3:8000/x?wsdl'), '10.1.2.3');
  assert.equal(ZL.App.defaultProjectName('not a url'), '');

  ZL.App.run('file.new');
  const name = document.getElementById('newProjectName');
  type(page, document.getElementById('newProjectUrl'), 'mock://fixtures/calc.wsdl');
  assert.equal(name.value, 'calc');
  click(page, primaryButton(page));
  await settled(page);
  assert.equal(ZL.State.get().projects[0].header.name, 'calc');

  ZL.App.run('file.new');
  type(page, document.getElementById('newProjectUrl'), 'mock://fixtures/calc.wsdl');
  assert.equal(document.getElementById('newProjectName').value, 'calc (2)', 'unique against saved projects');
  type(page, document.getElementById('newProjectName'), 'Mine');
  type(page, document.getElementById('newProjectUrl'), 'mock://fixtures/rpc.wsdl');
  assert.equal(document.getElementById('newProjectName').value, 'Mine', 'a typed name is kept');
});

test('saved projects are listed in the navigator at the start and open on double-click', async () => {
  const first = loadPage();
  await createProject(first, 'mock://fixtures/calc.wsdl', 'Calc');
  await createProject(first, 'mock://fixtures/rpc.wsdl', 'Rpc');
  const page = loadPage({ seed: { [STORE_KEY]: first.window.localStorage.getItem(STORE_KEY) } });
  const { ZL, document } = page;
  assert.equal(ZL.State.get().projects.length, 0, 'nothing is open yet');
  const calc = node(page, 'Calc');
  assert.ok(calc, 'saved project in the tree without "Open Project"');
  assert.ok(calc.classList.contains('catalog'));
  assert.ok(node(page, 'Rpc'));
  click(page, calc);
  assert.equal(propsTitle(page), 'Saved Project');
  dblclick(page, calc);
  await settled(page);
  assert.equal(ZL.State.get().projects[0].header.name, 'Calc');
  assert.ok(!node(page, 'Calc').classList.contains('catalog'), 'open project replaces the saved entry');
  assert.ok(node(page, 'Rpc').classList.contains('catalog'));
  assert.match(document.querySelector('.recent').textContent, /Calc/);
  assert.deepEqual(Array.from(page.errors), []);
});

test('panel title follows the node; operation properties show the WSDL details', async () => {
  const page = loadPage({ lang: 'tr' });
  await createProject(page, 'mock://fixtures/calc.wsdl', 'Calc');
  const project = page.ZL.State.get().projects[0];
  const projectId = project.header.projectId;
  page.ZL.State.get().selection = { kind: 'operation', projectId, binding: 'CalculatorSoap', operation: 'Add' };
  page.ZL.App.renderAll();
  assert.equal(propsTitle(page), 'Operasyon Özellikleri');
  const text = page.document.getElementById('props').textContent;
  assert.match(text, /Adds two integers\./);
  assert.match(text, /İstek-Yanıt/);
  assert.match(text, /AddSoapIn/);
  assert.match(text, /AddSoapOut/);
  const request = project.requests.find((r) => r.interfaceName === 'CalculatorSoap' && r.operation === 'Add');
  page.ZL.App.openRequest(request.requestId);
  assert.equal(propsTitle(page), 'Request Özellikleri');
});

test('request properties are editable and used when the request is sent and saved', async () => {
  const page = loadPage();
  const { ZL, document } = page;
  await createProject(page, 'mock://fixtures/calc.wsdl', 'Calc');
  const project = ZL.State.get().projects[0];
  const request = project.requests.find((r) => r.interfaceName === 'CalculatorSoap' && r.operation === 'Add');
  ZL.App.openRequest(request.requestId);

  type(page, document.getElementById('propName'), 'Add positive');
  type(page, document.getElementById('propDescription'), 'Adds two positive numbers');
  choose(page, document.getElementById('propEncoding'), 'ISO-8859-9');
  type(page, document.getElementById('propTimeout'), '15');
  choose(page, document.getElementById('propAuthType'), 'BASIC');
  type(page, document.getElementById('propUser'), 'ALICE');
  type(page, document.getElementById('propPassword'), 'secret');
  assert.equal(request.name, 'Add positive');
  assert.equal(request.description, 'Adds two positive numbers');
  assert.equal(request.encoding, 'ISO-8859-9');
  assert.equal(request.timeoutSec, 15);
  assert.equal(project.dirty, true);
  assert.match(document.querySelector('.tab.active .title').textContent, /Add positive/);
  assert.match(document.getElementById('props').textContent, /calculated from the body/);

  ZL.App.run('request.send');
  await settled(page);
  const sent = ZL.State.get().responses[request.requestId].request.headers;
  assert.ok(sent.some((h) => h.n === 'Content-Type' && /charset=ISO-8859-9/.test(h.v)));
  assert.ok(sent.some((h) => h.n === 'Authorization'));

  ZL.App.run('file.save');
  await settled(page);
  const store = page.window.localStorage.getItem(STORE_KEY);
  assert.match(store, /Adds two positive numbers/);
  assert.match(store, /ISO-8859-9/);
  assert.ok(!store.includes('secret'), 'the password is never saved');
});

test('endpoints added in the binding window are saved and offered in the request properties', async () => {
  const page = loadPage();
  const { ZL, document } = page;
  await createProject(page, 'mock://fixtures/calc.wsdl', 'Calc');
  const project = ZL.State.get().projects[0];
  const projectId = project.header.projectId;
  ZL.App.run('file.save');
  await settled(page);

  const binding = node(page, 'CalculatorSoap');
  dblclick(page, binding);
  assert.equal(ZL.State.get().active, 'b:' + projectId + '/CalculatorSoap');
  assert.match(document.querySelector('.binding-body').textContent, /WSDL Definition/);
  assert.match(document.querySelector('.binding-body').textContent, /Definition Parts/);
  click(page, document.querySelector('.binding-window [data-view="endpoints"]'));
  assert.match(document.querySelector('.binding-body').textContent, /http:\/\/localhost:8765\/soap\/calc/);
  type(page, document.getElementById('newEndpoint'), 'http://qa-host:8000/soap/calc');
  click(page, document.querySelector('[data-action="add-endpoint"]'));
  assert.deepEqual(JSON.parse(JSON.stringify(project.header.endpoints)),
                   [{ interfaceName: 'CalculatorSoap', url: 'http://qa-host:8000/soap/calc' }]);
  assert.equal(project.dirty, true);
  assert.equal(document.querySelectorAll('.binding-body tr[data-source="user"]').length, 1);

  const request = project.requests.find((r) => r.interfaceName === 'CalculatorSoap' && r.operation === 'Add');
  ZL.App.openRequest(request.requestId);
  const select = document.getElementById('propEndpoint');
  const options = Array.from(select.options, (o) => o.value);
  assert.ok(options.includes('http://qa-host:8000/soap/calc'));
  assert.ok(options.includes('http://localhost:8765/soap/calc'));
  choose(page, select, 'http://qa-host:8000/soap/calc');
  assert.equal(request.endpoint, 'http://qa-host:8000/soap/calc');
  assert.equal(document.getElementById('endpointInput').value, 'http://qa-host:8000/soap/calc');

  ZL.App.run('file.save');
  await settled(page);
  ZL.App.run('file.close');
  await settled(page);
  dblclick(page, node(page, 'Calc'));
  await settled(page);
  const reopened = ZL.State.get().projects[0];
  assert.equal(reopened.header.endpoints[0].url, 'http://qa-host:8000/soap/calc');
  assert.equal(reopened.requests.find((r) => r.requestId === request.requestId).endpoint, 'http://qa-host:8000/soap/calc');
  assert.deepEqual(Array.from(page.errors), []);
});

test('the theme switches between light and dark and is remembered for the user', async () => {
  const page = loadPage();
  const { ZL, document } = page;
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  click(page, document.getElementById('themeSwitch'));
  await settled(page);
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(JSON.parse(ZL.Mock.settings().uiPrefs).theme, 'dark', 'saved in the user settings at once');

  const again = loadPage({ seed: { [STORE_KEY]: page.window.localStorage.getItem(STORE_KEY) } });
  assert.equal(again.document.documentElement.getAttribute('data-theme'), 'dark');
  again.ZL.App.run('view.theme');
  await settled(again);
  assert.equal(again.document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(JSON.parse(again.ZL.Mock.settings().uiPrefs).theme, 'light');
});

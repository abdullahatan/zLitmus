// New SOAP Project from a WSDL file of the PC ("Browse..."), not only from an address
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, loadPage, settled, tick } from './helpers.mjs';

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

function click(page, element) {
  element.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true }));
}

function type(page, element, value) {
  element.value = value;
  element.dispatchEvent(new page.window.Event('input', { bubbles: true }));
}

function sapPage(ui, reply) {
  return loadPage({ lang: 'tr', boot: {
    runtime: 'sap', version: '1.1.0', lang: 'tr', user: 'TESTER', system: 'DEV/100',
    settings: { timeoutSec: 60, sslId: 'ANONYM', proxyHost: '', proxyPort: '', uiPrefs: '' },
    ui64: b64(JSON.stringify(ui)), workspace64: '', projects: [], message: null, reply } });
}

function capturePosts(page) {
  const posts = [];
  const form = page.document.getElementById('bridgeForm');
  form.submit = () => {
    const lines = Buffer.from(form.elements.payload.value, 'base64').toString('utf8').split('\n').map((row) => {
      const [key, name, value] = row.split('\t');
      return { key, name, value: Buffer.from(value || '', 'base64').toString('utf8') };
    });
    posts.push({ action: form.action, lines, value: (n) => (lines.find((l) => l.name === n) || {}).value });
  };
  return posts;
}

test('Windows paths become file: URLs (like ABAP) and the project name is the file name', () => {
  const { ZL } = loadPage();
  assert.equal(ZL.App.fileUrlOf('C:\\WSDL\\demo_service.wsdl'), 'file:///C:/WSDL/demo_service.wsdl');
  assert.equal(ZL.App.fileUrlOf('\\\\server\\share\\a.wsdl'), 'file://server/share/a.wsdl');
  assert.equal(ZL.App.fileUrlOf('https://h/s?wsdl'), 'https://h/s?wsdl');
  assert.equal(ZL.App.defaultProjectName('C:\\WSDL\\demo_service.wsdl'), 'demo_service');
  assert.equal(ZL.App.defaultProjectName('file:///C:/WSDL/my%20service.WSDL'), 'my service');
});

test('browser: Browse... reads a .wsdl file and the project is created from it', async () => {
  const page = loadPage({ lang: 'tr' });
  const { document, ZL, window } = page;
  ZL.App.run('file.new');
  assert.equal(document.getElementById('newProjectBrowse').textContent, 'Gözat…');
  const picker = document.querySelector('#modalRoot input[type="file"]');
  const file = new window.File([fixture('calc.wsdl')], 'calc_local.wsdl', { type: 'text/xml' });
  Object.defineProperty(picker, 'files', { value: [file] });
  picker.dispatchEvent(new window.Event('change'));
  await tick(50);
  assert.equal(document.getElementById('newProjectUrl').value, 'file:///calc_local.wsdl');
  assert.equal(document.getElementById('newProjectName').value, 'calc_local');
  click(page, document.querySelector('#modalRoot .btn.primary'));
  await settled(page);
  const project = ZL.State.get().projects[0];
  assert.equal(project.header.name, 'calc_local');
  assert.equal(project.header.wsdlUrl, 'file:///calc_local.wsdl');
  assert.equal(project.requests.length, 4, 'samples from the file');
});

test('SAP: Browse... asks ABAP for the file dialog and the dialog comes back with the chosen file', async () => {
  const page = sapPage({ version: 1 }, null);
  const posts = capturePosts(page);
  page.ZL.App.run('file.new');
  type(page, page.document.getElementById('newProjectName'), 'Kendi adım');
  click(page, page.document.getElementById('newProjectBrowse'));
  await tick(5);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].action, 'sapevent:WSDL_BROWSE');
  assert.equal(page.document.querySelector('#modalRoot .dialog'), null, 'the dialog waits for the file dialog');
  const ui = JSON.parse(posts[0].value('ui'));
  assert.equal(ui.newProjectDraft.name, 'Kendi adım');
  page.window.close();

  // ABAP shows the page again with the answer of the file dialog
  const back = sapPage(ui, { kind: 'wsdl_file', ok: true, url: 'file:///C:/WSDL/demo_service.wsdl' });
  const again = capturePosts(back);
  await tick(450);
  assert.equal(back.document.getElementById('newProjectUrl').value, 'file:///C:/WSDL/demo_service.wsdl');
  assert.equal(back.document.getElementById('newProjectName').value, 'Kendi adım', 'a typed name is kept');
  click(back, back.document.querySelector('#modalRoot .btn.primary'));
  await tick(5);
  assert.equal(again.at(-1).action, 'sapevent:PROJECT_CREATE');
  assert.equal(again.at(-1).value('wsdl_url'), 'file:///C:/WSDL/demo_service.wsdl');
  back.window.close();
});

test('SAP: a typed Windows path is sent as a file: URL; refresh sends the address too', async () => {
  const page = sapPage({ version: 1 }, null);
  const posts = capturePosts(page);
  page.ZL.App.run('file.new');
  type(page, page.document.getElementById('newProjectUrl'), 'C:\\WSDL\\typed.wsdl');
  assert.equal(page.document.getElementById('newProjectName').value, 'typed');
  click(page, page.document.querySelector('#modalRoot .btn.primary'));
  await tick(5);
  assert.equal(posts.at(-1).value('wsdl_url'), 'file:///C:/WSDL/typed.wsdl');
  page.window.close();

  const ui = { version: 1, projects: [{ header: { projectId: 'P1', name: 'typed', wsdlUrl: 'file:///C:/WSDL/typed.wsdl' },
                                       requests: [], dirty: false }], selection: { kind: 'project', projectId: 'P1' } };
  const open = sapPage(ui, null);
  const refresh = capturePosts(open);
  await tick(450);
  open.ZL.App.run('project.refresh');
  assert.equal(refresh.at(-1).action, 'sapevent:PROJECT_REFRESH_WSDL');
  assert.equal(refresh.at(-1).value('wsdl_url'), 'file:///C:/WSDL/typed.wsdl');
  open.window.close();
});

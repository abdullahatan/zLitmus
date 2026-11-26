// Third feedback round: resizable property columns, no "Open" toolbar button, exit with
// "Save and exit | Cancel | Exit without saving", quiet state update for SAP GUI Back / Exit / Cancel
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

function mouse(page, target, kind, clientX) {
  target.dispatchEvent(new page.window.MouseEvent(kind, { bubbles: true, cancelable: true, clientX }));
}

async function calcProject(page) {
  page.ZL.App.run('file.new');
  type(page, page.document.getElementById('newProjectUrl'), 'mock://fixtures/calc.wsdl');
  click(page, page.document.querySelector('#modalRoot .btn.primary'));
  await settled(page);
  return page.ZL.State.get().projects[0];
}

function buttons(page) {
  return Array.from(page.document.querySelectorAll('#modalRoot .dialog-foot .btn'), (b) => b.textContent);
}

function button(page, label) {
  return Array.from(page.document.querySelectorAll('#modalRoot .btn')).find((b) => b.textContent === label);
}

test('properties have a "label | value" header and a draggable divider kept in the preferences', async () => {
  const page = loadPage({ lang: 'tr' });
  const { document, ZL } = page;
  const project = await calcProject(page);
  ZL.App.openRequest(project.requests[0].requestId);
  const heads = Array.from(document.querySelectorAll('#props thead th'), (th) => th.textContent);
  assert.deepEqual(heads, ['Başlık', 'Değer']);
  const col = document.querySelector('#props col.label-col');
  assert.equal(col.style.width, '140px');

  const grip = document.querySelector('#props .col-grip');
  mouse(page, grip, 'mousedown', 300);
  mouse(page, document, 'mousemove', 230);
  mouse(page, document, 'mouseup', 230);
  assert.equal(col.style.width, '70px', 'the label column got narrower');
  assert.equal(ZL.State.get().prefs.propsLabelWidth, 70);
  assert.equal(ZL.State.get().prefsDirty, true, 'saved with the next action (ui_prefs)');

  mouse(page, document.querySelector('#props .col-grip'), 'mousedown', 300);
  mouse(page, document, 'mousemove', 100);
  mouse(page, document, 'mouseup', 100);
  assert.equal(ZL.State.get().prefs.propsLabelWidth, 60, 'never narrower than 60 px');
  ZL.App.renderAll();
  assert.equal(document.querySelector('#props col.label-col').style.width, '60px', 'kept after a new render');
});

test('the toolbar has no "Open" button; File > Open Project stays', () => {
  const { document, ZL } = loadPage();
  assert.equal(document.querySelector('#toolbar [data-cmd="file.open"]'), null);
  assert.ok(ZL.Menu.commandIds().includes('file.open'));
});

test('exit with unsaved work asks "Save and exit | Cancel | Exit without saving"', async () => {
  const page = loadPage({ lang: 'tr' });
  const { document, ZL } = page;
  const project = await calcProject(page);
  ZL.App.run('file.exit');
  assert.equal(document.querySelector('#modalRoot .dialog'), null, 'nothing unsaved: no question');
  await settled(page);

  project.requests[0].name = 'Changed';
  project.dirty = true;
  ZL.App.run('file.exit');
  assert.match(document.querySelector('#modalRoot .dialog').textContent, /kaydedilmedi.*kaybolacak/);
  assert.deepEqual(buttons(page), ['Kaydet ve çık', 'İptal', 'Kaydetmeden çık']);
  click(page, button(page, 'İptal'));
  assert.equal(document.querySelector('#modalRoot .dialog'), null);
  assert.equal(project.dirty, true, 'cancel keeps the work');

  ZL.App.run('file.exit');
  click(page, button(page, 'Kaydet ve çık'));
  await tick(5);
  await settled(page);
  await settled(page);
  assert.equal(ZL.State.get().projects[0].dirty, false, 'saved before the exit');
  assert.match(page.window.localStorage.getItem('zlitmus.mock.v1'), /Changed/);
});

// ---------- SAP mode ----------
function sapPage(ui, reply) {
  return loadPage({ lang: 'tr', boot: {
    runtime: 'sap', version: '1.1.0', lang: 'tr', user: 'TESTER', system: 'DEV/100',
    settings: { timeoutSec: 60, sslId: 'ANONYM', proxyHost: '', proxyPort: '', uiPrefs: '' },
    ui64: b64(ui), workspace64: '', projects: [], message: null, reply
  } });
}

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

async function mockUi() {
  const mock = loadPage();
  const project = await calcProject(mock);
  mock.ZL.App.openRequest(project.requests[0].requestId);
  const ui = mock.ZL.State.snapshot();
  mock.window.close();
  return ui;
}

test('SAP mode: edits reach ABAP quietly (UI_SYNC, no reload) so SAP GUI Back can see unsaved work', async () => {
  const page = sapPage(await mockUi(), null);
  const posts = capturePosts(page);
  await tick(1700);
  assert.equal(posts.length, 0, 'nothing changed: nothing sent');

  type(page, page.document.getElementById('propName'), 'Edited in SAP');
  await tick(1700);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].action, 'sapevent:UI_SYNC');
  assert.equal(posts[0].lines.length, 1, 'only the page state');
  assert.match(posts[0].lines[0].value, /"dirty":true/);
  assert.match(posts[0].lines[0].value, /Edited in SAP/);
  assert.equal(page.document.getElementById('busy').hidden, true, 'no busy overlay');
  page.window.close();
});

test('SAP mode: the exit_check reply of ABAP opens the exit question; "Exit without saving" sends EXIT', async () => {
  const dirtyUi = JSON.parse(await mockUi());
  dirtyUi.projects[0].dirty = true;
  const page = sapPage(JSON.stringify(dirtyUi), { kind: 'exit_check', ok: true });
  const posts = capturePosts(page);
  await tick(450);
  assert.deepEqual(buttons(page), ['Kaydet ve çık', 'İptal', 'Kaydetmeden çık']);
  click(page, button(page, 'Kaydetmeden çık'));
  await tick(5);
  assert.equal(posts.at(-1).action, 'sapevent:EXIT');
  page.window.close();
});

test('former SAP GUI keys are in the page menu: File > Install / Update Page, View > Refresh Page (F5)', async () => {
  const b = (text) => Buffer.from(text, 'utf8').toString('base64');
  const page = loadPage({ lang: 'tr', boot: {
    runtime: 'sap', version: '1.1.0', lang: 'tr', user: 'TESTER', system: 'DEV/100',
    settings: { timeoutSec: 60, sslId: 'ANONYM', proxyHost: '', proxyPort: '', uiPrefs: '' },
    ui64: b('{"version":1}'), workspace64: '', projects: [], message: null, reply: null } });
  const ids = Array.from(page.ZL.Menu.definition, (m) => ({ id: m.id, cmds: Array.from(m.items, (i) => i.cmd) }));
  assert.ok(ids.find((m) => m.id === 'file').cmds.includes('page.install'));
  assert.ok(ids.find((m) => m.id === 'view').cmds.includes('page.refresh'));
  const posts = capturePosts(page);
  page.ZL.App.run('page.install');
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }));
  assert.deepEqual(posts.map((p) => p.action), ['sapevent:PAGE_INSTALL', 'sapevent:PAGE_REFRESH']);
  page.window.close();

  const browser = loadPage();
  assert.equal(browser.ZL.Commands['page.install'].enabled(), false, 'browser mode: nothing to install');
});

test('the top bar shows the light logo with the name', () => {
  const { document } = loadPage();
  const svg = document.querySelector('.topbar .brand svg');
  assert.ok(svg);
  assert.match(svg.getAttribute('viewBox'), /377\.7/, 'horizontal lockup (mark + zLitmus)');
  assert.match(svg.outerHTML, /#FFFFFF/i, 'light drawing on the dark bar');
});

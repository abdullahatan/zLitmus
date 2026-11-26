import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPage, settled } from './helpers.mjs';

test('every menu item runs a known command and every command is in a menu', () => {
  const { ZL } = loadPage();
  const menuIds = Array.from(ZL.Menu.commandIds());
  const commandIds = Object.keys(ZL.Commands);
  assert.deepEqual(menuIds.filter((id) => !commandIds.includes(id)), [], 'menu item without command');
  assert.deepEqual(commandIds.filter((id) => !menuIds.includes(id)), [], 'command without menu item');
  for (const id of commandIds) assert.equal(typeof ZL.Commands[id].run, 'function', id);
});

test('shortcuts are unique', () => {
  const { ZL } = loadPage();
  const shortcuts = Array.from(ZL.Menu.definition).flatMap((menu) => Array.from(menu.items))
    .filter((i) => i.shortcut).map((i) => i.shortcut);
  assert.equal(new Set(shortcuts).size, shortcuts.length);
  assert.deepEqual(shortcuts.sort(), ['Ctrl+Enter', 'Ctrl+N', 'Ctrl+O', 'Ctrl+S', 'Ctrl+Shift+F', 'Ctrl+Shift+S', 'F1', 'F5']);
});

test('menu mnemonics are unique in both languages', () => {
  for (const lang of ['tr', 'en']) {
    const { ZL } = loadPage({ lang });
    const letters = Array.from(ZL.Menu.definition).map((m) => ZL.i18n.t(m.label).charAt(0).toLocaleLowerCase(lang));
    assert.equal(new Set(letters).size, letters.length, lang);
  }
});

test('Alt+letter opens a menu, arrows move, Escape closes', () => {
  const { window, document, ZL } = loadPage();
  const key = (k, extra = {}) => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, ...extra }));
  key('f', { altKey: true });
  assert.ok(ZL.Menu.isOpen());
  assert.equal(document.querySelector('.popup .item.active').textContent.startsWith('New SOAP Project'), true);
  key('ArrowRight');
  assert.equal(document.querySelector('.menu-title.open').dataset.menu, 'project');
  key('Escape');
  assert.equal(ZL.Menu.isOpen(), false);
});

test('items that need a selection are disabled without one', () => {
  const { ZL } = loadPage();
  assert.equal(ZL.Commands['file.save'].enabled(), false);
  assert.equal(ZL.Commands['request.send'].enabled(), false);
  assert.equal(ZL.Commands['file.new'].enabled, undefined);
});

test('no script error while the page starts', () => {
  const page = loadPage();
  assert.deepEqual(Array.from(page.errors), []);
  assert.equal(page.document.getElementById('unsupported').hidden, true);
});

test('a mouse click on every menu title opens its menu; outside closes; items run', async () => {
  const { window, document, ZL, errors } = loadPage();
  const mouse = (element, type = 'mousedown') =>
    element.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
  for (const menu of ZL.Menu.definition) {
    mouse(document.querySelector(`.menu-title[data-menu="${menu.id}"]`));
    assert.ok(ZL.Menu.isOpen(), `${menu.id} stays open after the click`);
    assert.equal(document.querySelector('.menu-title.open').dataset.menu, menu.id);
    assert.equal(document.querySelectorAll('.popup .item').length, menu.items.filter((i) => i.cmd).length);
  }
  mouse(document.getElementById('tree'));
  assert.equal(ZL.Menu.isOpen(), false, 'a click outside closes the menu');

  mouse(document.querySelector('.menu-title[data-menu="help"]'));
  const about = Array.from(document.querySelectorAll('.popup .item')).find((i) => /About/.test(i.textContent));
  mouse(about);
  assert.equal(ZL.Menu.isOpen(), false);
  assert.ok(document.querySelector('#modalRoot .dialog'), 'the command of the item ran');
  assert.deepEqual(Array.from(errors), []);
});

test('request items are dimmed without a request and active when one is selected', async () => {
  const page = loadPage();
  const { window, document, ZL } = page;
  const mouse = (element) => element.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  const item = (text) => Array.from(document.querySelectorAll('.popup .item')).find((i) => i.textContent.startsWith(text));
  mouse(document.querySelector('.menu-title[data-menu="request"]'));
  assert.ok(item('Submit').classList.contains('disabled'));
  ZL.Menu.close();

  ZL.App.run('file.new');
  const url = document.getElementById('newProjectUrl');
  url.value = 'mock://fixtures/calc.wsdl';
  url.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector('#modalRoot .btn.primary').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settled(page);
  ZL.App.openRequest(ZL.State.get().projects[0].requests[0].requestId);
  mouse(document.querySelector('.menu-title[data-menu="request"]'));
  assert.ok(!item('Submit').classList.contains('disabled'), 'Submit is active for the selected request');
  assert.ok(!item('Clone').classList.contains('disabled'));
});

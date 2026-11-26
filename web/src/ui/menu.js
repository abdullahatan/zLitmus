/* ======================================================================
 * zLitmus - menu bar, popup and context menus (keyboard: Alt+letter, arrows, Enter, Esc)
 * Items name a command of ZL.Commands (defined in app.js).
 * ==================================================================== */
ZL.Menu = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var SEP = { separator: true };

  var definition = [
    { id: 'file', label: 'menu.file', items: [
      { cmd: 'file.new', label: 'cmd.file.new', shortcut: 'Ctrl+N' },
      { cmd: 'file.open', label: 'cmd.file.open', shortcut: 'Ctrl+O' },
      SEP,
      { cmd: 'file.save', label: 'cmd.file.save', shortcut: 'Ctrl+S' },
      { cmd: 'file.saveAll', label: 'cmd.file.saveAll', shortcut: 'Ctrl+Shift+S' },
      SEP,
      { cmd: 'file.close', label: 'cmd.file.close' },
      SEP,
      { cmd: 'file.preferences', label: 'cmd.file.preferences' },
      { cmd: 'page.install', label: 'cmd.page.install' },
      SEP,
      { cmd: 'file.exit', label: 'cmd.file.exit' }
    ] },
    { id: 'project', label: 'menu.project', items: [
      { cmd: 'project.refresh', label: 'cmd.project.refresh' },
      { cmd: 'project.rename', label: 'cmd.project.rename' },
      { cmd: 'project.delete', label: 'cmd.project.delete' }
    ] },
    { id: 'request', label: 'menu.request', items: [
      { cmd: 'request.new', label: 'cmd.request.new' },
      { cmd: 'request.clone', label: 'cmd.request.clone' },
      { cmd: 'request.rename', label: 'cmd.request.rename' },
      { cmd: 'request.delete', label: 'cmd.request.delete' },
      SEP,
      { cmd: 'request.recreate', label: 'cmd.request.recreate' },
      { cmd: 'request.format', label: 'cmd.request.format', shortcut: 'Ctrl+Shift+F' },
      SEP,
      { cmd: 'request.send', label: 'cmd.request.send', shortcut: 'Ctrl+Enter' },
      SEP,
      { cmd: 'request.exportRequest', label: 'cmd.request.exportRequest' },
      { cmd: 'request.exportResponse', label: 'cmd.request.exportResponse' }
    ] },
    { id: 'view', label: 'menu.view', items: [
      { cmd: 'view.navigator', label: 'cmd.view.navigator' },
      { cmd: 'view.properties', label: 'cmd.view.properties' },
      { cmd: 'view.log', label: 'cmd.view.log' },
      SEP,
      { cmd: 'view.wrap', label: 'cmd.view.wrap' },
      { cmd: 'view.layout', label: 'cmd.view.layout' },
      { cmd: 'page.refresh', label: 'cmd.page.refresh', shortcut: 'F5' },
      SEP,
      { cmd: 'view.theme', label: 'cmd.view.theme' }
    ] },
    { id: 'help', label: 'menu.help', items: [
      { cmd: 'help.guide', label: 'cmd.help.guide', shortcut: 'F1' },
      { cmd: 'help.shortcuts', label: 'cmd.help.shortcuts' },
      SEP,
      { cmd: 'help.about', label: 'cmd.help.about' }
    ] }
  ];

  var openIndex = -1;
  var popup = null;

  function command(id) { return ZL.Commands[id]; }
  function enabled(item) {
    var c = command(item.cmd);
    return !!c && (!c.enabled || c.enabled());
  }
  function checked(item) {
    var c = command(item.cmd);
    return !!c && !!c.checked && c.checked();
  }

  function mnemonic(label) { return label.charAt(0).toLocaleLowerCase(ZL.i18n.lang()); }

  function render() {
    var bar = util.clear(util.$('menubar'));
    definition.forEach(function (menu, index) {
      var label = t(menu.label);
      bar.appendChild(h('button', {
        class: 'menu-title' + (index === openIndex ? ' open' : ''), type: 'button', role: 'menuitem',
        'data-menu': menu.id,
        /* the bar is drawn again when a menu opens: the event must not reach the "click outside" handler */
        onmousedown: function (event) { event.preventDefault(); event.stopPropagation(); toggle(index); },
        onmouseenter: function () { if (openIndex >= 0 && openIndex !== index) openMenu(index, 0); }
      }, [h('span', { class: 'mnemonic', text: label.charAt(0) }), label.substring(1)]));
    });
  }

  function toggle(index) {
    if (openIndex === index) close(); else openMenu(index, -1);
  }

  function openMenu(index, activeItem) {
    close();
    openIndex = index;
    render();
    var anchor = util.$('menubar').children[index].getBoundingClientRect();
    var items = definition[index].items.map(function (item) {
      if (item.separator) return item;
      return { label: t(item.label), shortcut: item.shortcut, enabled: enabled(item), checked: checked(item),
               run: function () { ZL.App.run(item.cmd); } };
    });
    show(items, anchor.left, anchor.bottom, activeItem, true);
  }

  /* items: [{label, shortcut, enabled, checked, run} | {separator: true}] */
  function show(items, x, y, activeItem, fromBar) {
    if (!fromBar) close();
    var root = util.$('popupRoot');
    var rows = [];
    var box = h('div', { class: 'popup', role: 'menu' });
    items.forEach(function (item) {
      if (item.separator) { box.appendChild(h('div', { class: 'sep' })); return; }
      var row = h('div', {
        class: 'item' + (item.enabled === false ? ' disabled' : '') + (item.checked ? ' checked' : ''),
        role: 'menuitem',
        onmouseenter: function () { setActive(rows.indexOf(row)); },
        onmousedown: function (event) { event.preventDefault(); event.stopPropagation(); choose(rows.indexOf(row)); }
      }, [h('span', { text: item.label }), item.shortcut ? h('span', { class: 'shortcut', text: item.shortcut }) : null]);
      row.item = item;
      rows.push(row);
      box.appendChild(row);
    });
    root.appendChild(box);
    var width = box.offsetWidth || 220;
    var height = box.offsetHeight || 200;
    box.style.left = Math.max(0, Math.min(x, window.innerWidth - width - 4)) + 'px';
    box.style.top = Math.max(0, Math.min(y, window.innerHeight - height - 4)) + 'px';
    popup = { box: box, rows: rows, active: -1 };
    setActive(activeItem === 0 ? firstEnabled(0, 1) : -1);

    function setActive(index) {
      rows.forEach(function (r, i) { r.classList.toggle('active', i === index); });
      popup.active = index;
    }
    function choose(index) {
      var row = rows[index];
      if (!row || row.item.enabled === false) return;
      close();
      row.item.run();
    }
    function firstEnabled(from, step) {
      for (var i = 0, j = from; i < rows.length; i++, j = (j + step + rows.length) % rows.length) {
        if (rows[j].item.enabled !== false) return j;
      }
      return -1;
    }
    popup.move = function (step) {
      var start = popup.active < 0 ? (step > 0 ? 0 : rows.length - 1) : (popup.active + step + rows.length) % rows.length;
      setActive(firstEnabled(start, step));
    };
    popup.choose = function () { choose(popup.active); };
  }

  function close() {
    util.clear(util.$('popupRoot'));
    popup = null;
    if (openIndex >= 0) { openIndex = -1; render(); }
  }

  function isOpen() { return !!popup; }

  /* Keyboard: returns true when the event was used */
  function onKey(event) {
    if (event.altKey && !event.ctrlKey && event.key && event.key.length === 1) {
      var key = event.key.toLocaleLowerCase(ZL.i18n.lang());
      for (var i = 0; i < definition.length; i++) {
        if (mnemonic(t(definition[i].label)) === key) { openMenu(i, 0); return true; }
      }
    }
    if (!popup) return false;
    switch (event.key) {
      case 'Escape': close(); return true;
      case 'ArrowDown': popup.move(1); return true;
      case 'ArrowUp': popup.move(-1); return true;
      case 'ArrowRight': if (openIndex >= 0) { openMenu((openIndex + 1) % definition.length, 0); return true; } return false;
      case 'ArrowLeft':
        if (openIndex >= 0) { openMenu((openIndex - 1 + definition.length) % definition.length, 0); return true; }
        return false;
      case 'Enter': popup.choose(); return true;
      default: return false;
    }
  }

  document.addEventListener('mousedown', function (event) {
    var target = event.target;
    if (!popup || !document.body.contains(target)) return;
    if (!popup.box.contains(target) && !util.$('menubar').contains(target)) close();
  });

  /* All command ids used by the menus (the tests compare them with ZL.Commands) */
  function commandIds() {
    var ids = [];
    definition.forEach(function (menu) { menu.items.forEach(function (item) { if (item.cmd) ids.push(item.cmd); }); });
    return ids;
  }

  return { definition: definition, render: render, show: show, close: close, isOpen: isOpen, onKey: onKey,
           commandIds: commandIds, openMenu: openMenu };
})();

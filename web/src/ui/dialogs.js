/* ======================================================================
 * zLitmus - modal dialogs inside the page (no alert / confirm / prompt)
 * ==================================================================== */
ZL.Dialogs = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var stack = [];

  /* options: {title, body: Node|[Node], buttons: [{label, primary, action(close) -> false keeps it open}], onCancel} */
  function open(options) {
    var root = util.$('modalRoot');
    var overlay;
    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      stack = stack.filter(function (entry) { return entry.overlay !== overlay; });
      document.removeEventListener('keydown', onKey, true);
    }
    function cancel() {
      close();
      if (options.onCancel) options.onCancel();
    }
    function onKey(event) {
      if (stack[stack.length - 1] !== entry) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA' && event.target.tagName !== 'BUTTON') {
        var primary = (options.buttons || []).filter(function (b) { return b.primary; })[0];
        if (primary) { event.preventDefault(); event.stopPropagation(); run(primary); }
      }
    }
    function run(button) {
      var keep = button.action ? button.action(close) === false : false;
      if (!keep) close();
    }
    var buttons = (options.buttons || [{ label: t('btn.ok'), primary: true }]).map(function (button) {
      return h('button', { class: 'btn' + (button.primary ? ' primary' : ''), type: 'button', text: button.label,
                           onclick: function () { run(button); } });
    });
    overlay = h('div', { class: 'overlay' }, [
      h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': options.title }, [
        h('div', { class: 'dialog-head' }, [
          h('span', { text: options.title }),
          h('button', { class: 'x', type: 'button', title: t('btn.close'), text: '×', onclick: cancel })
        ]),
        h('div', { class: 'dialog-body' }, options.body),
        h('div', { class: 'dialog-foot' }, buttons)
      ])
    ]);
    var entry = { overlay: overlay, close: close };
    stack.push(entry);
    root.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
    var focus = overlay.querySelector('input, select, textarea') || overlay.querySelector('.btn.primary');
    if (focus) setTimeout(function () { focus.focus(); if (focus.select) focus.select(); }, 0);
    return entry;
  }

  function isOpen() { return stack.length > 0; }

  function field(label, input) {
    return h('div', { class: 'form-row' }, [h('label', { text: label }), input]);
  }

  function message(title, text) {
    open({ title: title, body: [h('p', { text: text })], buttons: [{ label: t('btn.ok'), primary: true }] });
  }

  /* onYes / onNo optional; three buttons when onNo is given (Save / Do not save / Cancel) */
  function confirm(options) {
    var buttons = [{ label: options.yes || t('btn.yes'), primary: true, action: function () { if (options.onYes) options.onYes(); } }];
    if (options.onNo) buttons.push({ label: options.no || t('btn.no'), action: function () { options.onNo(); } });
    buttons.push({ label: t('btn.cancel') });
    open({ title: options.title, body: [h('p', { text: options.text })], buttons: buttons });
  }

  function prompt(options) {
    var input = h('input', { type: 'text', value: options.value || '' });
    open({
      title: options.title,
      body: [field(options.label, input)],
      buttons: [
        { label: t('btn.ok'), primary: true, action: function () {
          var value = input.value.trim();
          if (!value) { input.focus(); return false; }
          options.onOk(value);
          return true;
        } },
        { label: t('btn.cancel') }
      ]
    });
  }

  /* Closes the open dialog without running a button action */
  function closeTop() {
    var top = stack[stack.length - 1];
    if (top) top.close();
  }

  return { open: open, isOpen: isOpen, field: field, message: message, confirm: confirm, prompt: prompt,
           close: closeTop };
})();

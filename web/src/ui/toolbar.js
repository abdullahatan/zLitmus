/* ======================================================================
 * zLitmus - toolbar
 * ==================================================================== */
ZL.Toolbar = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;

  var buttons = [
    { cmd: 'file.new', label: 'tb.newSoap', glyph: '➕' },
    { cmd: 'file.save', label: 'tb.save', glyph: '\u{1F4BE}' },
    { cmd: 'file.saveAll', label: 'tb.saveAll', glyph: '⧉' },
    null,
    { cmd: 'request.send', label: 'tb.send', glyph: '▶', className: 'send' },
    null,
    { cmd: 'file.preferences', label: 'tb.preferences', glyph: '⚙' }
  ];

  function render() {
    var bar = util.clear(util.$('toolbar'));
    buttons.forEach(function (button) {
      if (!button) { bar.appendChild(h('span', { class: 'sep' })); return; }
      var command = ZL.Commands[button.cmd];
      bar.appendChild(h('button', {
        class: 'tb' + (button.className ? ' ' + button.className : ''), type: 'button',
        title: t('cmd.' + button.cmd), disabled: command && command.enabled ? !command.enabled() : false,
        'data-cmd': button.cmd,
        onclick: function () { ZL.App.run(button.cmd); }
      }, [h('span', { class: 'glyph', text: button.glyph }), h('span', { text: t(button.label) })]));
    });
  }

  return { render: render };
})();

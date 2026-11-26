/* ======================================================================
 * zLitmus - log panel: zLitmus log | HTTP log | Error log (session only, max 500 lines each)
 * ==================================================================== */
ZL.Log = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;
  var KINDS = [['app', 'log.app'], ['http', 'log.http'], ['error', 'log.error']];

  function add(kind, type, text) {
    State.log(kind, type, text);
    if (type === 'E' && kind !== 'error') State.log('error', type, text);
    if (State.get().logTab === kind || (type === 'E' && State.get().logTab === 'error')) renderBody();
  }

  function render() {
    var tabs = util.clear(util.$('logTabs'));
    var active = State.get().logTab;
    KINDS.forEach(function (kind) {
      var count = (State.get().logs[kind[0]] || []).length;
      tabs.appendChild(h('div', {
        class: 'tab' + (active === kind[0] ? ' active' : ''), role: 'tab',
        onclick: function () { State.get().logTab = kind[0]; render(); }
      }, [h('span', { class: 'title', text: t(kind[1]) + (count ? ' (' + count + ')' : '') })]));
    });
    renderBody();
  }

  function renderBody() {
    var body = util.clear(util.$('logBody'));
    var lines = State.get().logs[State.get().logTab] || [];
    lines.forEach(function (line) {
      body.appendChild(h('div', { class: 'log-line ' + line.type }, [h('span', { class: 'time', text: line.time }), line.text]));
    });
    body.scrollTop = body.scrollHeight;
  }

  return { add: add, render: render };
})();

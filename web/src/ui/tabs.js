/* ======================================================================
 * zLitmus - tabbed workspace: start page | request windows | binding windows
 * ==================================================================== */
ZL.Tabs = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;

  function title(tab) {
    if (tab.type === 'start') return { text: t('tab.start'), dirty: false };
    if (tab.type === 'binding') return ZL.Binding.title(tab);
    var found = State.findRequest(tab.requestId);
    if (!found) return { text: '?', dirty: false };
    return { text: found.project.header.name + ' › ' + found.request.name, dirty: found.project.dirty };
  }

  function renderHeaders() {
    var bar = util.clear(util.$('tabs'));
    var state = State.get();
    state.tabs.forEach(function (tab) {
      var info = title(tab);
      bar.appendChild(h('div', {
        class: 'tab' + (tab.id === state.active ? ' active' : ''), role: 'tab', 'data-tab': tab.id,
        'aria-selected': String(tab.id === state.active),
        onclick: function () { activate(tab.id); },
        onauxclick: function (event) { if (event.button === 1) ZL.App.closeTab(tab.id); }
      }, [
        h('span', { class: 'title', text: (info.dirty ? '*' : '') + info.text, title: info.text }),
        tab.type === 'start' ? null : h('button', { class: 'close', type: 'button', text: '×', title: t('btn.close'),
          onclick: function (event) { event.stopPropagation(); ZL.App.closeTab(tab.id); } })
      ]));
    });
  }

  function render() {
    renderHeaders();
    var body = util.clear(util.$('tabBody'));
    var state = State.get();
    var tab = state.tabs.filter(function (x) { return x.id === state.active; })[0] || state.tabs[0];
    if (!tab || tab.type === 'start') ZL.Start.render(body);
    else if (tab.type === 'binding') ZL.Binding.render(body, tab);
    else ZL.Request.render(body, tab.requestId);
  }

  function activate(id) {
    State.get().active = id;
    var tab = State.get().tabs.filter(function (x) { return x.id === id; })[0];
    if (tab && tab.requestId) {
      var found = State.findRequest(tab.requestId);
      if (found) {
        ZL.Navigator.reveal({ kind: 'request', projectId: found.project.header.projectId,
                              binding: found.request.interfaceName, operation: found.request.operation,
                              requestId: found.request.requestId });
      }
    } else if (tab && tab.type === 'binding' && State.project(tab.projectId)) {
      ZL.Navigator.reveal({ kind: 'binding', projectId: tab.projectId, binding: tab.binding });
    }
    ZL.App.renderAll();
  }

  /* The request of the active tab, or null */
  function activeRequest() {
    var state = State.get();
    var tab = state.tabs.filter(function (x) { return x.id === state.active; })[0];
    return tab && tab.requestId ? State.findRequest(tab.requestId) : null;
  }

  return { render: render, renderHeaders: renderHeaders, activate: activate, activeRequest: activeRequest };
})();

/* ======================================================================
 * zLitmus - start page: logo with slogan, "New SOAP Project" card, recent projects
 * ==================================================================== */
ZL.Start = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;

  function lockup() {
    var box = h('div', { class: 'lockup' });
    var template = util.$(State.get().prefs.theme === 'dark' ? 'lockupDarkTemplate' : 'lockupTemplate');
    if (template) box.appendChild(document.importNode(template.content, true));
    return box;
  }

  function card(title, text, command) {
    return h('button', { class: 'card', type: 'button', 'data-cmd': command, onclick: function () { ZL.App.run(command); } }, [
      h('div', { class: 'card-title', text: title }),
      h('div', { class: 'card-text', text: text })
    ]);
  }

  function render(container) {
    var recent = State.get().prefs.recent || [];
    if (!recent.length) {
      recent = State.catalog().slice(0, 8).map(function (p) { return { projectId: p.projectId, name: p.name }; });
    }
    container.appendChild(h('div', { class: 'start' }, [
      lockup(),
      h('div', { class: 'cards' }, [
        card(t('start.newTitle'), t('start.newText'), 'file.new'),
        card(t('start.openTitle'), t('start.openText'), 'file.open')
      ]),
      h('div', { class: 'recent' }, [
        h('h3', { text: t('start.recent') }),
        recent.length
          ? h('ul', null, recent.map(function (entry) {
            return h('li', null, [h('a', { text: entry.name, title: entry.projectId,
                                           onclick: function () { ZL.App.openProject(entry.projectId); } })]);
          }))
          : h('div', { class: 'muted', text: t('start.noRecent') })
      ]),
      ZL.Bridge.isSap() ? null : h('p', { class: 'muted', text: t('start.mockNote') })
    ]));
  }

  return { render: render };
})();

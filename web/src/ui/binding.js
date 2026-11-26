/* ======================================================================
 * zLitmus - binding (interface) window, opened by a double-click on a binding
 *   Overview          : WSDL definition, definition parts (documents), operations
 *   Service Endpoints : endpoints of the WSDL and those the user added; the latter are saved with the
 *                       project (ZLITMUS_PROJ-ENDPOINTS_JSON) and offered in the request properties
 *   WSDL Content      : the documents of the definition
 * ==================================================================== */
ZL.Binding = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;

  function view(tab) {
    var views = State.get().requestView;
    var key = 'b:' + tab.projectId + '/' + tab.binding;
    if (!views[key]) views[key] = { tab: 'overview', doc: 0 };
    return views[key];
  }

  function section(title, children) {
    return h('div', { class: 'section' }, [h('h4', { text: title })].concat(children));
  }

  function grid(head, rows, className) {
    return h('table', { class: 'grid' + (className ? ' ' + className : '') }, [
      head ? h('thead', null, [h('tr', null, head.map(function (x) { return h('th', { text: x }); }))]) : null,
      h('tbody', null, rows)
    ]);
  }

  function cell(text, className) { return h('td', { class: className || null, text: text == null ? '' : String(text) }); }

  /* ---------------- overview ---------------- */
  function overview(project, model, entry) {
    var binding = entry ? entry.binding : null;
    var definition = [
      [t('binding.wsdlUrl'), project.header.wsdlUrl],
      [t('binding.namespace'), binding ? binding.tns : ''],
      [t('binding.title'), binding ? binding.name : t('binding.missing')],
      [t('props.soapVersion'), binding ? 'SOAP ' + binding.version : ''],
      [t('props.style'), binding ? binding.style : '']
    ].map(function (row) { return h('tr', null, [h('th', { text: row[0] }), cell(row[1], 'mono')]); });
    var docs = model ? model.docs : [];
    var parts = docs.length
      ? grid([t('binding.wsdlUrl'), t('binding.status'), t('binding.size')], docs.map(function (d) {
        return h('tr', null, [cell(d.url, 'mono'), cell(d.error || (d.status ? 'HTTP ' + d.status : 'OK')),
                              cell(d.size + ' ' + t('unit.bytes'))]);
      }))
      : h('div', { class: 'muted', text: t('binding.noDocs') });
    var operations = binding ? binding.ops.slice().sort(function (x, y) { return x.name.localeCompare(y.name); }) : [];
    var portType = binding && binding.type ? model.portTypes[ZL.Wsdl.qkey(binding.type.ns, binding.type.local)] : null;
    var opRows = operations.map(function (op) {
      var abstract = portType ? portType.ops[op.name] : null;
      var oneWay = abstract ? !abstract.output : false;
      return h('tr', null, [cell(op.name), cell(op.use), cell(oneWay ? t('props.yes') : t('props.no')),
                            cell(op.soapAction, 'mono')]);
    });
    return [
      section(t('binding.definition'), [grid(null, definition, 'def')]),
      section(t('binding.parts'), [parts]),
      section(t('binding.operations'), [grid([t('props.name'), t('binding.use'), t('binding.oneWay'), t('binding.action')],
                                             opRows)])
    ];
  }

  /* ---------------- service endpoints ---------------- */
  function endpoints(project, entry, bindingName) {
    var projectId = project.header.projectId;
    var fromWsdl = entry ? entry.endpoints : [];
    var user = (project.header.endpoints || []).filter(function (e) { return e.interfaceName === bindingName; });
    function assignButton(address) {
      return h('button', { class: 'link-btn', type: 'button', text: t('binding.assign'),
                           onclick: function () { ZL.App.assignEndpoint(projectId, bindingName, address); } });
    }
    var rows = fromWsdl.map(function (address) {
      return h('tr', { 'data-source': 'wsdl' }, [cell(address, 'mono'),
        h('td', null, [h('span', { class: 'tag', text: t('binding.fromWsdl') })]), h('td', null, [assignButton(address)])]);
    }).concat(user.map(function (e) {
      return h('tr', { 'data-source': 'user' }, [
        h('td', null, [h('input', { type: 'text', value: e.url, 'aria-label': t('binding.endpoint'),
          onchange: function (event) { ZL.App.editEndpoint(projectId, bindingName, e.url, event.target.value); } })]),
        h('td', null, [h('span', { class: 'tag', text: t('binding.userAdded') })]),
        h('td', null, [assignButton(e.url), ' ',
          h('button', { class: 'link-btn', type: 'button', text: t('binding.remove'),
                        onclick: function () { ZL.App.removeEndpoint(projectId, bindingName, e.url); } })])
      ]);
    }));
    var input = h('input', { type: 'text', id: 'newEndpoint', placeholder: t('binding.newEndpoint'),
                             onkeydown: function (event) { if (event.key === 'Enter') add(); } });
    function add() { if (ZL.App.addEndpoint(projectId, bindingName, input.value)) input.value = ''; }
    return [section(t('binding.endpoints'), [
      grid([t('binding.endpoint'), t('binding.source'), ''], rows),
      h('div', { class: 'add-row' }, [input,
        h('button', { class: 'btn', type: 'button', text: t('binding.add'), 'data-action': 'add-endpoint', onclick: add })])
    ])];
  }

  /* ---------------- WSDL content ---------------- */
  function documentText(document) {
    if (!document || !document.b64) return '';
    return util.decodeXmlBytes(util.base64ToBytes(document.b64), util.charsetOf(document.contentType));
  }

  function content(project, v) {
    var bundle = State.wsdlBundle(project.header.projectId);
    var documents = (bundle && bundle.documents) || [];
    if (!documents.length) return [h('div', { class: 'muted', text: t('binding.noDocs') })];
    var index = Math.min(v.doc || 0, documents.length - 1);
    var text = documentText(documents[index]);
    var pretty = ZL.Xml.pretty(text);
    return [h('div', { class: 'docs' }, [
      h('div', { class: 'doc-list' }, documents.map(function (d, i) {
        return h('div', { class: 'row' + (i === index ? ' active' : ''), text: d.url, title: d.url,
                          onclick: function () { v.doc = i; ZL.Tabs.render(); } });
      })),
      h('div', { class: 'doc-view' }, [h('pre', { class: 'xmlview', html: ZL.Xml.highlight(pretty || text) })])
    ])];
  }

  /* ---------------- window ---------------- */
  function render(container, tab) {
    util.clear(container);
    var project = State.project(tab.projectId);
    if (!project) { container.appendChild(h('div', { class: 'empty-pane', text: t('request.missing') })); return; }
    var model = State.wsdl(tab.projectId);
    var entry = model ? model.findInterface(tab.binding) : null;
    var v = view(tab);
    var body;
    if (v.tab === 'endpoints') body = endpoints(project, entry, tab.binding);
    else if (v.tab === 'wsdl') body = content(project, v);
    else body = overview(project, model, entry);
    var tabs = [['overview', t('binding.overview')], ['endpoints', t('binding.endpoints')], ['wsdl', t('binding.wsdl')]];
    container.appendChild(h('div', { class: 'binding-window' }, [
      h('div', { class: 'subtabs', role: 'tablist' }, tabs.map(function (item) {
        return h('button', { class: 'subtab' + (item[0] === v.tab ? ' active' : ''), type: 'button', role: 'tab',
                             text: item[1], 'data-view': item[0],
                             onclick: function () { v.tab = item[0]; ZL.Tabs.render(); } });
      })),
      h('div', { class: 'binding-body' }, body)
    ]));
  }

  function title(tab) {
    var project = State.project(tab.projectId);
    return { text: (project ? project.header.name + ' › ' : '') + tab.binding, dirty: !!(project && project.dirty) };
  }

  return { render: render, title: title };
})();

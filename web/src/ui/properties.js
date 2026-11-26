/* ======================================================================
 * zLitmus - properties of the selected node
 * The panel title follows the node ("Operation Properties", "Request Properties", ...).
 * Request properties can be edited here: name, description, encoding, endpoint, timeout, authentication.
 * ==================================================================== */
ZL.Properties = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;
  var ENCODINGS = ['UTF-8', 'ISO-8859-1', 'ISO-8859-9', 'windows-1254', 'US-ASCII'];

  var MIN_COLUMN = 60;

  function labelWidth() { return State.get().prefs.propsLabelWidth || 140; }

  /* Drag of the divider between the label and the value column; the width is kept in ui_prefs */
  function startResize(event, wrap, col, grip) {
    event.preventDefault();
    var startX = event.clientX;
    var startWidth = labelWidth();
    var prefs = State.get().prefs;
    wrap.classList.add('resizing');
    function move(e) {
      var max = wrap.clientWidth ? Math.max(MIN_COLUMN, wrap.clientWidth - MIN_COLUMN) : Infinity;
      prefs.propsLabelWidth = Math.max(MIN_COLUMN, Math.min(max, startWidth + e.clientX - startX));
      col.style.width = prefs.propsLabelWidth + 'px';
      grip.style.left = (prefs.propsLabelWidth - 3) + 'px';
    }
    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      wrap.classList.remove('resizing');
      State.get().prefsDirty = true;
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  /* rows: [label, value] (text) or [label, element] (editable); {hint: text} is a note over both columns.
     Two columns "label | value" with a draggable divider. */
  function table(rows) {
    var width = labelWidth();
    var col = h('col', { class: 'label-col', style: 'width:' + width + 'px' });
    var grip = h('div', { class: 'col-grip', title: t('props.resize'), style: 'left:' + (width - 3) + 'px' });
    var wrap = h('div', { class: 'props-wrap' });
    grip.addEventListener('mousedown', function (event) { startResize(event, wrap, col, grip); });
    wrap.appendChild(h('table', { class: 'props' }, [
      h('colgroup', null, [col, h('col')]),
      h('thead', null, [h('tr', null, [h('th', { class: 'label-head', text: t('props.colLabel') }),
                                       h('th', { class: 'value-head', text: t('props.colValue') })])]),
      tbody(rows)
    ]));
    wrap.appendChild(grip);
    return wrap;
  }

  function tbody(rows) {
    return h('tbody', null, rows.map(function (row) {
      if (row.hint) return h('tr', { class: 'hint-row' }, [h('td', { colspan: '2', text: row.hint })]);
      var value = row[1];
      if (value && value.nodeType) return h('tr', null, [h('th', { text: row[0], title: row[0] }), h('td', { class: 'edit' }, [value])]);
      var text = value == null ? '' : String(value);
      return h('tr', null, [h('th', { text: row[0], title: row[0] }), h('td', { text: text, title: text })]);
    }));
  }

  function projectRows(project) {
    var bundle = State.wsdlBundle(project.header.projectId);
    return [
      [t('props.name'), project.header.name],
      [t('props.definitionUrl'), project.header.wsdlUrl],
      [t('props.documents'), bundle && bundle.documents ? bundle.documents.length : 0],
      [t('props.cached'), util.formatTimestamp(project.header.wsdlLoadedAt || (bundle && bundle.loadedAt))],
      [t('props.requests'), project.requests.length],
      [t('props.changedAt'), util.formatTimestamp(project.header.changedAt)]
    ];
  }

  function catalogRows(entry) {
    return [
      [t('props.name'), entry.name],
      [t('props.definitionUrl'), entry.wsdlUrl],
      [t('props.requests'), entry.requestCount || 0],
      [t('props.changedAt'), util.formatTimestamp(entry.changedAt)],
      { hint: t('props.openHint') }
    ];
  }

  function bindingRows(project, bindingName) {
    var model = State.wsdl(project.header.projectId);
    var entry = model ? model.findInterface(bindingName) : null;
    var binding = entry ? entry.binding : null;
    var bundle = State.wsdlBundle(project.header.projectId);
    return [
      [t('props.name'), bindingName],
      [t('props.definitionUrl'), project.header.wsdlUrl],
      [t('props.binding'), binding ? '{' + binding.tns + '}' + binding.name : t('props.unknown')],
      [t('props.soapVersion'), binding ? 'SOAP ' + binding.version : ''],
      [t('props.style'), binding ? binding.style : ''],
      [t('binding.endpoints'), ZL.Request.endpointsFor(project, bindingName).length],
      [t('props.cached'), bundle ? t('props.yes') + ' (' + util.formatTimestamp(bundle.loadedAt) + ')' : t('props.no')],
      { hint: t('props.openHint') }
    ];
  }

  /* portType operation of a binding operation: documentation, input and output messages */
  function abstractOperation(model, binding, operation) {
    if (!model || !binding || !binding.type) return null;
    var portType = model.portTypes[ZL.Wsdl.qkey(binding.type.ns, binding.type.local)];
    return portType ? portType.ops[operation] || null : null;
  }

  function operationRows(project, bindingName, operation) {
    var model = State.wsdl(project.header.projectId);
    var entry = model ? model.findInterface(bindingName) : null;
    var op = entry ? entry.binding.ops.filter(function (o) { return o.name === operation; })[0] : null;
    var abstract = abstractOperation(model, entry && entry.binding, operation);
    var type = '';
    if (abstract) type = abstract.output ? t('props.requestResponse') : t('props.oneWay');
    return [
      [t('props.name'), operation],
      [t('props.description'), abstract ? abstract.doc.trim() : ''],
      [t('props.soapAction'), op ? op.soapAction : ''],
      [t('props.operation'), operation],
      [t('props.style'), op ? op.style : ''],
      [t('props.type'), type],
      [t('props.input'), abstract && abstract.input ? abstract.input.local : ''],
      [t('props.output'), abstract && abstract.output ? abstract.output.local : ''],
      [t('props.use'), op ? op.use : ''],
      [t('props.requests'), project.requests.filter(function (r) {
        return r.interfaceName === bindingName && r.operation === operation;
      }).length]
    ];
  }

  /* ---------------- editable request properties ---------------- */
  function textInput(value, onInput, attrs) {
    return h('input', Object.assign({ type: 'text', value: value || '', autocomplete: 'off',
                                      oninput: function (event) { onInput(event.target.value); } }, attrs || {}));
  }

  function select(options, value, onChange, attrs) {
    var node = h('select', Object.assign({ onchange: function () { onChange(node.value); } }, attrs || {}),
      options.map(function (option) {
        return h('option', { value: option.value, text: option.text, selected: option.value === value });
      }));
    return node;
  }

  function endpointSelect(found) {
    var request = found.request;
    var NEW = '*new*';
    var endpoints = ZL.Request.endpointsFor(found.project, request.interfaceName);
    if (request.endpoint && endpoints.indexOf(request.endpoint) < 0) endpoints = [request.endpoint].concat(endpoints);
    var options = endpoints.map(function (e) { return { value: e, text: e }; });
    if (!request.endpoint) options.unshift({ value: '', text: '' });
    options.push({ value: NEW, text: '+ ' + t('binding.newEndpoint') + '…' });
    var node = select(options, request.endpoint, function (value) {
      if (value !== NEW) { request.endpoint = value; ZL.App.requestEdited(found); return; }
      node.value = request.endpoint;
      ZL.Dialogs.prompt({ title: t('binding.newEndpoint'), label: t('props.endpoint'), value: '',
        onOk: function (address) {
          var projectId = found.project.header.projectId;
          var value = String(address || '').trim();
          if (!value) return;
          if (ZL.Request.endpointsFor(found.project, request.interfaceName).indexOf(value) < 0) {
            ZL.App.addEndpoint(projectId, request.interfaceName, value);
          }
          request.endpoint = value;
          found.project.dirty = true;
          ZL.App.renderAll();
        } });
    }, { id: 'propEndpoint', title: request.endpoint });
    return node;
  }

  function requestRows(found) {
    var request = found.request;
    var settings = ZL.App.settings() || {};
    var passwords = State.get().passwords;
    var basic = request.authType === 'BASIC';
    function edited() { ZL.App.requestEdited(found); }
    var encoding = request.encoding || 'UTF-8';
    var encodings = ENCODINGS.indexOf(encoding) < 0 ? ENCODINGS.concat([encoding]) : ENCODINGS;
    return [
      [t('props.name'), textInput(request.name, function (value) {
        if (value.trim()) { request.name = value.trim(); edited(); }
      }, { id: 'propName' })],
      [t('props.description'), textInput(request.description, function (value) {
        request.description = value; edited();
      }, { id: 'propDescription', maxlength: '255' })],
      [t('props.messageSize'), util.byteLength(request.body) + ' ' + t('unit.bytes') + ' (' + t('props.calculated') + ')'],
      [t('props.encoding'), select(encodings.map(function (e) { return { value: e, text: e }; }), encoding, function (value) {
        request.encoding = value === 'UTF-8' ? '' : value; edited();
      }, { id: 'propEncoding' })],
      [t('props.endpoint'), endpointSelect(found)],
      [t('props.timeout'), h('input', { type: 'number', min: '0', max: '3600', id: 'propTimeout',
        value: request.timeoutSec ? String(request.timeoutSec) : '',
        placeholder: (settings.timeoutSec || 60) + ' s (' + t('props.default') + ')',
        oninput: function (event) { request.timeoutSec = Math.max(0, parseInt(event.target.value, 10) || 0); edited(); } })],
      [t('props.authType'), select([{ value: 'NONE', text: t('auth.none') }, { value: 'BASIC', text: 'Basic' }],
        basic ? 'BASIC' : 'NONE', function (value) { request.authType = value; edited(); render(); }, { id: 'propAuthType' })],
      [t('props.username'), textInput(request.authUser, function (value) { request.authUser = value; edited(); },
        { id: 'propUser', disabled: !basic })],
      [t('props.password'), h('input', { type: 'password', id: 'propPassword', autocomplete: 'new-password',
        value: passwords[request.requestId] || '', disabled: !basic,
        oninput: function (event) {
          passwords[request.requestId] = event.target.value;
          ZL.Request.refresh(request.requestId);
        } })],
      { hint: t('props.passwordHint') }
    ];
  }

  /* ---------------- panel ---------------- */
  function titleOf(kind) {
    var known = ['project', 'binding', 'operation', 'request', 'catalog'];
    return known.indexOf(kind) >= 0 ? t('props.title.' + kind) : t('props.title');
  }

  function setTitle(kind) {
    var title = util.$('propsPanel').querySelector('.panel-title');
    if (title) title.textContent = titleOf(kind);
  }

  function render() {
    var box = util.clear(util.$('props'));
    var selection = State.get().selection;
    if (selection && selection.kind === 'catalog') {
      var saved = State.catalog().filter(function (p) { return p.projectId === selection.projectId; })[0];
      setTitle(saved ? 'catalog' : '');
      box.appendChild(saved ? table(catalogRows(saved)) : h('div', { class: 'empty', text: t('props.empty') }));
      return;
    }
    var project = selection ? State.project(selection.projectId) : null;
    if (!project) {
      setTitle('');
      box.appendChild(h('div', { class: 'empty', text: t('props.empty') }));
      return;
    }
    var rows;
    var kind = selection.kind;
    switch (kind) {
      case 'binding': rows = bindingRows(project, selection.binding); break;
      case 'operation': rows = operationRows(project, selection.binding, selection.operation); break;
      case 'request': {
        var found = State.findRequest(selection.requestId);
        if (!found) kind = 'project';
        rows = found ? requestRows(found) : projectRows(project);
        break;
      }
      default: kind = 'project'; rows = projectRows(project);
    }
    setTitle(kind);
    box.appendChild(table(rows));
  }

  return { render: render, titleOf: titleOf };
})();

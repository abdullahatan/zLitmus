/* ======================================================================
 * zLitmus - request window: toolbar, request editor (XML | Raw, Auth | Headers),
 * response view (XML | Raw, Headers | Sent request), status line with the result mark
 * ==================================================================== */
ZL.Request = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;
  var Generator = ZL.Generator;
  var COLORS = { waiting: '#B8C2CE', pass: '#1FA463', fail: '#E0484E' };

  function view(requestId) {
    var views = State.get().requestView;
    if (!views[requestId]) views[requestId] = { req: 'xml', reqFoot: 'headers', res: 'xml', resFoot: 'headers' };
    return views[requestId];
  }

  /* Endpoints of a binding: those the user added (Service Endpoints) first, then the WSDL addresses */
  function endpointsFor(project, interfaceName) {
    var model = State.wsdl(project.header.projectId);
    var entry = model ? model.findInterface(interfaceName) : null;
    var user = (project.header.endpoints || []).filter(function (e) { return e.interfaceName === interfaceName; })
      .map(function (e) { return e.url; });
    return user.concat(entry ? entry.endpoints : []).concat(model ? model.endpoints() : [])
      .filter(function (e, i, all) { return e && all.indexOf(e) === i; });
  }

  /* WSDL facts of the request: binding version, SOAPAction, endpoints */
  function context(project, request) {
    var model = State.wsdl(project.header.projectId);
    var entry = model ? model.findInterface(request.interfaceName) : null;
    var op = entry ? entry.binding.ops.filter(function (o) { return o.name === request.operation; })[0] : null;
    return {
      model: model,
      entry: entry,
      op: op,
      version: entry ? entry.binding.version : '1.1',
      soapAction: op ? op.soapAction : '',
      encoding: request.encoding || 'UTF-8',
      endpoints: endpointsFor(project, request.interfaceName)
    };
  }

  function autoHeaders(ctx) { return Generator.autoHeaders(ctx.version, ctx.soapAction, ctx.encoding); }

  function effectiveHeaders(project, request) {
    return Generator.effectiveHeaders(autoHeaders(context(project, request)), request.headers);
  }

  /* Status of the last response: waiting | pass | fail */
  function resultOf(response) {
    if (!response || response.waiting) return 'waiting';
    if (!response.ok || response.status >= 400 || response.status < 200) return 'fail';
    return ZL.Xml.faultOf(responseText(response)) ? 'fail' : 'pass';
  }

  function responseText(response) {
    if (!response || !response.body64) return '';
    var type = (response.headers || []).filter(function (x) { return x.n.toLowerCase() === 'content-type'; })[0];
    return util.decodeXmlBytes(util.base64ToBytes(response.body64), util.charsetOf(type ? type.v : ''));
  }

  function mark(result) {
    var box = h('span', { class: 'mark', title: t('result.' + result) });
    var template = util.$('markTemplate');
    if (!template) return box;
    box.appendChild(document.importNode(template.content, true));
    var paths = box.querySelectorAll('path');
    if (paths.length) paths[paths.length - 1].setAttribute('fill', COLORS[result]);
    return box;
  }

  function changed(project) {
    State.markDirty(project.header.projectId);
    ZL.App.dirtyChanged();
  }

  function subtabs(items, active, onSelect) {
    return h('div', { class: 'subtabs', role: 'tablist' }, items.map(function (item) {
      return h('button', { class: 'subtab' + (item[0] === active ? ' active' : ''), type: 'button', role: 'tab', text: item[1],
                           onclick: function () { onSelect(item[0]); } });
    }));
  }

  /* ---------------- request pane ---------------- */
  function rawRequest(project, request) {
    var lines = ['POST ' + (request.endpoint || '') + ' HTTP/1.1'];
    effectiveHeaders(project, request).forEach(function (x) { lines.push(x.name + ': ' + x.value); });
    if (request.authType === 'BASIC' && request.authUser) lines.push('Authorization: Basic ********');
    return lines.join('\n') + '\n\n' + (request.body || '');
  }

  function authPanel(project, request) {
    var password = State.get().passwords;
    var type = h('select', { onchange: function () { request.authType = type.value; changed(project); rerender(); } }, [
      h('option', { value: 'NONE', text: t('auth.none'), selected: request.authType !== 'BASIC' }),
      h('option', { value: 'BASIC', text: 'Basic', selected: request.authType === 'BASIC' })
    ]);
    var rows = [ZL.Dialogs.field(t('auth.type'), type)];
    if (request.authType === 'BASIC') {
      rows.push(ZL.Dialogs.field(t('auth.user'), h('input', { type: 'text', value: request.authUser, autocomplete: 'off',
        oninput: function (event) { request.authUser = event.target.value; changed(project); } })));
      rows.push(ZL.Dialogs.field(t('auth.password'), h('input', { type: 'password', value: password[request.requestId] || '',
        autocomplete: 'new-password',
        oninput: function (event) { password[request.requestId] = event.target.value; } })));
      rows.push(h('div', { class: 'muted', text: t('auth.passwordNote') }));
    }
    rows.push(ZL.Dialogs.field(t('request.timeout'), h('input', {
      type: 'number', min: '0', max: '3600', value: request.timeoutSec ? String(request.timeoutSec) : '',
      placeholder: String((ZL.App.settings() || {}).timeoutSec || 60),
      oninput: function (event) { request.timeoutSec = parseInt(event.target.value, 10) || 0; changed(project); }
    })));
    return rows;
  }

  function headersPanel(project, request) {
    var auto = autoHeaders(context(project, request));
    var userNames = request.headers.map(function (x) { return (x.name || '').toLowerCase(); });
    var body = h('tbody');
    auto.forEach(function (x) {
      var replaced = userNames.indexOf(x.name.toLowerCase()) >= 0;
      body.appendChild(h('tr', { class: 'auto' + (replaced ? ' replaced' : ''), title: t('headers.auto') },
        [h('td', { text: x.name }), h('td', { text: x.value }), h('td')]));
    });
    request.headers.forEach(function (x, index) {
      body.appendChild(h('tr', null, [
        h('td', null, [h('input', { type: 'text', value: x.name, placeholder: t('headers.name'),
          oninput: function (event) { x.name = event.target.value; changed(project); },
          onchange: rerender })]),
        h('td', null, [h('input', { type: 'text', value: x.value, placeholder: t('headers.value'),
          oninput: function (event) { x.value = event.target.value; changed(project); } })]),
        h('td', null, [h('button', { class: 'link-btn', type: 'button', text: '✕', title: t('headers.remove'),
          onclick: function () { request.headers.splice(index, 1); changed(project); rerender(); } })])
      ]));
    });
    return [
      h('table', { class: 'kv' }, [h('thead', null, [h('tr', null, [h('th', { text: t('headers.name') }),
        h('th', { text: t('headers.value') }), h('th', { style: 'width:24px' })])]), body]),
      h('button', { class: 'link-btn', type: 'button', text: '+ ' + t('headers.add'), 'data-action': 'add-header',
                    onclick: function () { request.headers.push({ name: '', value: '' }); changed(project); rerender(); } })
    ];
  }

  /* XML editor with syntax colours: a transparent textarea over a highlighted layer (same font, padding and
     scroll position), so the text stays a normal editable textarea */
  function codeEditor(project, request) {
    var layer = h('pre', { class: 'xmlview code-layer', 'aria-hidden': 'true' });
    var area = h('textarea', { class: 'editor code-input', id: 'requestEditor', spellcheck: 'false', value: request.body,
      'aria-label': t('request.title'), wrap: 'off',
      oninput: function () { request.body = area.value; paint(); changed(project); },
      onscroll: follow,
      onkeydown: function (event) {
        if (event.key === 'Tab' && !event.ctrlKey) {
          event.preventDefault();
          var start = area.selectionStart;
          area.value = area.value.substring(0, start) + '   ' + area.value.substring(area.selectionEnd);
          area.selectionStart = area.selectionEnd = start + 3;
          request.body = area.value;
          paint();
          changed(project);
        }
      } });
    function follow() {
      layer.scrollTop = area.scrollTop;
      layer.scrollLeft = area.scrollLeft;
    }
    function paint() {
      /* the extra line keeps the layer as high as the textarea when the text ends with a line break */
      layer.innerHTML = ZL.Xml.highlight(area.value) + '\n ';
      if (area.clientWidth) {
        layer.style.width = area.clientWidth + 'px';
        layer.style.height = area.clientHeight + 'px';
      }
      follow();
    }
    paint();
    setTimeout(paint, 0);
    return h('div', { class: 'code-editor' }, [layer, area]);
  }

  function exportButton(title, enabled, run) {
    return h('button', { class: 'pane-action', type: 'button', title: title, 'aria-label': title, disabled: !enabled,
                         'data-action': 'export', onclick: run }, [h('span', { class: 'glyph', text: '⤓' }),
                                                                   h('span', { text: t('tb.export') })]);
  }

  function requestPane(project, request) {
    var v = view(request.requestId);
    var body;
    if (v.req === 'raw') {
      body = h('pre', { class: 'xmlview', text: rawRequest(project, request) });
    } else {
      body = codeEditor(project, request);
    }
    var userHeaders = request.headers.filter(function (x) { return x.name; }).length;
    var footBody = v.reqFoot === 'auth' ? authPanel(project, request) : headersPanel(project, request);
    return h('div', { class: 'pane request-pane' }, [
      h('div', { class: 'pane-head' }, [
        h('span', { class: 'pane-name', text: t('request.title') }),
        subtabs([['xml', 'XML'], ['raw', t('tab.raw')]], v.req, function (k) { v.req = k; rerender(); }),
        exportButton(t('cmd.request.exportRequest'), true, function () { ZL.App.run('request.exportRequest'); })
      ]),
      h('div', { class: 'pane-body' }, [body]),
      h('div', { class: 'pane-foot' }, [
        subtabs([['auth', t('tab.auth') + (request.authType === 'BASIC' ? ' (Basic)' : '')],
                 ['headers', t('tab.headers') + ' (' + userHeaders + ')']], v.reqFoot,
                function (k) { v.reqFoot = k; rerender(); }),
        h('div', { class: 'foot-body' }, footBody)
      ])
    ]);
  }

  /* ---------------- response pane ---------------- */
  function responsePane(request, response) {
    var v = view(request.requestId);
    var parts = [];
    if (!response) {
      parts.push(h('div', { class: 'empty-pane', text: t('response.none') }));
    } else if (response.waiting) {
      parts.push(h('div', { class: 'empty-pane', text: t('response.waiting') }));
    } else {
      var text = responseText(response);
      var fault = ZL.Xml.faultOf(text);
      if (!response.ok && response.message) parts.push(h('div', { class: 'fault', text: response.message }));
      if (fault) parts.push(h('div', { class: 'fault', text: fault }));
      if (response.hint) parts.push(h('div', { class: 'hint', text: response.hint }));
      if (v.res === 'raw') {
        var raw = (response.status ? 'HTTP/1.1 ' + response.status + ' ' + (response.reason || '') + '\n' : '') +
          (response.headers || []).map(function (x) { return x.n + ': ' + x.v; }).join('\n') + '\n\n' + text;
        parts.push(h('pre', { class: 'xmlview', text: raw }));
      } else {
        var pretty = ZL.Xml.pretty(text);
        parts.push(h('pre', { class: 'xmlview', html: ZL.Xml.highlight(pretty || text) }));
      }
    }
    var headers = (response && response.headers) || [];
    var sent = (response && response.request) || null;
    var footBody = v.resFoot === 'request'
      ? (sent ? [h('div', { text: sent.method + ' ' + sent.url }), kvTable(sent.headers || [])]
              : [h('div', { class: 'muted', text: t('response.none') })])
      : [kvTable(headers)];
    return h('div', { class: 'pane response-pane' }, [
      h('div', { class: 'pane-head' }, [
        h('span', { class: 'pane-name', text: t('response.title') }),
        subtabs([['xml', 'XML'], ['raw', t('tab.raw')]], v.res, function (k) { v.res = k; rerender(); }),
        exportButton(t('cmd.request.exportResponse'), !!(response && !response.waiting && response.body64),
                     function () { ZL.App.run('request.exportResponse'); })
      ]),
      h('div', { class: 'pane-body' }, parts),
      h('div', { class: 'pane-foot' }, [
        subtabs([['headers', t('tab.headers') + ' (' + headers.length + ')'], ['request', t('tab.sentRequest')]], v.resFoot,
                function (k) { v.resFoot = k; rerender(); }),
        h('div', { class: 'foot-body' }, footBody)
      ])
    ]);
  }

  function kvTable(pairs) {
    return h('table', { class: 'kv' }, [h('tbody', null, pairs.map(function (x) {
      return h('tr', null, [h('th', { text: x.n }), h('td', { text: x.v })]);
    }))]);
  }

  function statusLine(response) {
    var result = resultOf(response);
    var items = [mark(result)];
    if (response && !response.waiting) {
      if (response.status) {
        items.push(h('span', { class: 'code ' + result, text: 'HTTP ' + response.status + ' ' + (response.reason || '') }));
      }
      items.push(h('span', { text: t('response.time', { ms: response.timeMs || 0, bytes: response.size || 0 }) }));
    } else {
      items.push(h('span', { class: 'muted', text: t('result.' + result) }));
    }
    return h('div', { class: 'statusline', 'data-result': result }, items);
  }

  /* ---------------- request | response with a draggable divider (ratio kept in ui_prefs) ---------------- */
  var MIN_RATIO = 0.15;
  var MAX_RATIO = 0.85;

  function panes(left, right, prefs) {
    var vertical = prefs.layout === 'vertical';
    var box = h('div', { class: 'panes' + (vertical ? ' vertical' : '') });
    var split = h('div', { class: 'pane-split', role: 'separator', title: t('request.resize'),
                           'aria-orientation': vertical ? 'horizontal' : 'vertical' });
    function apply(ratio) { left.style.flex = '0 0 ' + (ratio * 100).toFixed(2) + '%'; }
    apply(prefs.paneRatio || 0.5);
    split.addEventListener('dblclick', function () { prefs.paneRatio = 0.5; State.get().prefsDirty = true; apply(0.5); });
    split.addEventListener('mousedown', function (event) {
      event.preventDefault();
      var rect = box.getBoundingClientRect();
      var size = (vertical ? rect.height : rect.width) || 1000;
      var origin = vertical ? rect.top : rect.left;
      var startRatio = prefs.paneRatio || 0.5;
      var start = vertical ? event.clientY : event.clientX;
      box.classList.add('resizing');
      function move(e) {
        var position = vertical ? e.clientY : e.clientX;
        var ratio = rect.width || rect.height ? (position - origin) / size : startRatio + (position - start) / size;
        prefs.paneRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio));
        apply(prefs.paneRatio);
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        box.classList.remove('resizing');
        State.get().prefsDirty = true;
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    box.appendChild(left);
    box.appendChild(split);
    box.appendChild(right);
    return box;
  }

  /* ---------------- window ---------------- */
  var current = null;

  function rerender() {
    if (current) render(current.container, current.requestId);
  }

  function render(container, requestId) {
    current = { container: container, requestId: requestId };
    util.clear(container);
    var found = State.findRequest(requestId);
    if (!found) { container.appendChild(h('div', { class: 'empty-pane', text: t('request.missing') })); return; }
    var project = found.project;
    var request = found.request;
    var ctx = context(project, request);
    var prefs = State.get().prefs;
    var listId = 'endpoints-' + requestId;
    var stale = ZL.Navigator.isStale(project, request);
    container.appendChild(h('div', { class: 'request' + (prefs.wrap ? ' wrap' : '') }, [
      h('div', { class: 'req-toolbar' }, [
        h('button', { class: 'tb send', type: 'button', title: t('cmd.request.send') + ' (Ctrl+Enter)', 'data-cmd': 'request.send',
                      onclick: function () { ZL.App.run('request.send'); } },
          [h('span', { class: 'glyph', text: '▶' }), h('span', { text: t('tb.send') })]),
        h('input', { class: 'endpoint', type: 'text', list: listId, value: request.endpoint, id: 'endpointInput',
                     placeholder: t('request.endpoint'), 'aria-label': t('request.endpoint'),
                     oninput: function (event) { request.endpoint = event.target.value; changed(project); } }),
        h('datalist', { id: listId }, ctx.endpoints.map(function (e) { return h('option', { value: e }); })),
        h('button', { class: 'tb', type: 'button', title: t('cmd.request.format') + ' (Ctrl+Shift+F)',
                      onclick: function () { ZL.App.run('request.format'); } }, [h('span', { text: t('tb.format') })]),
        h('button', { class: 'tb', type: 'button', title: t('cmd.request.recreate'),
                      onclick: function () { ZL.App.run('request.recreate'); } }, [h('span', { text: t('tb.recreate') })]),
        h('button', { class: 'tb', type: 'button', title: t('cmd.view.layout'),
                      onclick: function () { ZL.App.run('view.layout'); } },
          [h('span', { class: 'glyph', text: prefs.layout === 'vertical' ? '⬍' : '⬌' })]),
        h('span', { class: 'opinfo', text: 'SOAP ' + ctx.version + (ctx.soapAction ? ' · ' + ctx.soapAction : ''),
                    title: ctx.soapAction })
      ]),
      stale ? h('div', { class: 'stale-note', text: t('request.stale') }) : null,
      panes(requestPane(project, request), responsePane(request, State.get().responses[requestId]), prefs),
      statusLine(State.get().responses[requestId])
    ]));
  }

  /* Re-renders the window when it shows this request (after an edit in the properties panel) */
  function refresh(requestId) {
    if (current && current.requestId === requestId && document.body.contains(current.container)) rerender();
  }

  return { render: render, rerender: rerender, refresh: refresh, effectiveHeaders: effectiveHeaders, context: context,
           endpointsFor: endpointsFor, resultOf: resultOf, responseText: responseText };
})();

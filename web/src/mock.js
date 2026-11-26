/* ======================================================================
 * zLitmus - browser mock of the ABAP side (runtime !== 'sap')
 * Opening web/dist/zlitmus.html in a browser works without SAP: the actions are handled in
 * memory, WSDL addresses are answered from the embedded test fixtures (web/test/fixtures) and
 * projects are kept in localStorage (memory when it is not available). No password is stored.
 * Fixture addresses: any URL that ends with a fixture path, e.g. "mock://fixtures/calc.wsdl".
 * Addresses containing "secure" answer 401 without credentials; requests to URLs containing
 * "fault" answer with a SOAP fault.
 * ==================================================================== */
ZL.Mock = (function () {
  var util = ZL.util;
  var STORE_KEY = 'zlitmus.mock.v1';
  var fixtures = readFixtures();
  var memory = load();
  var open = {};
  var localFiles = {};

  function readFixtures() {
    var node = document.getElementById('zlitmus-fixtures');
    try { return node ? JSON.parse(node.textContent) : {}; } catch (e) { return {}; }
  }

  function load() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage not available: memory only */ }
    return { projects: {}, settings: { timeoutSec: 60, sslId: 'ANONYM', proxyHost: '', proxyPort: '', uiPrefs: '' } };
  }

  function persist() {
    try { if (window.localStorage) window.localStorage.setItem(STORE_KEY, JSON.stringify(memory)); } catch (e) { /* ignore */ }
  }

  function value(lines, name) {
    for (var i = 0; i < lines.length; i++) if (lines[i][0] === 'V' && lines[i][1] === name) return lines[i][2];
    return '';
  }

  function headersOf(lines) {
    return lines.filter(function (l) { return l[0] === 'H'; }).map(function (l) { return { name: l[1], value: l[2] }; });
  }

  function now() { return new Date().toISOString(); }

  function fixtureFor(url) {
    var keys = Object.keys(fixtures);
    for (var i = 0; i < keys.length; i++) {
      var plain = url.split('?')[0].split('#')[0];
      if (plain === keys[i] || plain.slice(-(keys[i].length + 1)) === '/' + keys[i]) return fixtures[keys[i]];
    }
    return null;
  }

  /* A WSDL file chosen in the browser: kept in memory under file:///<name> (like a file of the PC in SAP GUI) */
  function addLocalFile(name, text) {
    var url = 'file:///' + name;
    localFiles[url] = text;
    return url;
  }

  function download(url) {
    if (localFiles[url] != null) {
      return Promise.resolve({ url: url, status: 200, contentType: 'text/xml', text: localFiles[url] });
    }
    if (/^file:/i.test(url)) return Promise.resolve({ url: url, status: 0, contentType: '', text: '', error: url });
    var text = fixtureFor(url);
    if (text != null) return Promise.resolve({ url: url, status: 200, contentType: 'text/xml; charset=utf-8', text: text });
    return fetch(url).then(function (response) {
      return response.text().then(function (body) {
        return { url: url, status: response.status, contentType: response.headers.get('content-type') || '', text: body };
      });
    }, function (error) {
      return { url: url, status: 0, contentType: '', text: '', error: String(error) };
    });
  }

  function loadWsdl(url, user) {
    if (/secure/i.test(url) && !user) {
      return Promise.resolve({ url: url, documents: [], authRequired: true, realm: 'zLitmus mock' });
    }
    var documents = [];
    function next(address) {
      if (documents.length >= 40 || documents.some(function (d) { return d.url === address; })) return Promise.resolve();
      return download(address).then(function (doc) {
        var ok = doc.status >= 200 && doc.status < 300;
        documents.push({ url: address, status: doc.status, contentType: doc.contentType,
                         error: ok ? '' : (doc.error || 'HTTP ' + doc.status), b64: util.toBase64(doc.text) });
        if (!ok) return null;
        return ZL.Wsdl.Refs.extract(doc.text).reduce(function (chain, reference) {
          return chain.then(function () { return next(ZL.Wsdl.Refs.resolve(address, reference)); });
        }, Promise.resolve());
      });
    }
    return next(url).then(function () { return { url: url, loadedAt: now(), documents: documents }; });
  }

  /* Like ABAP check_wsdl_loaded: an answer whose root is not wsdl:definitions / description is no WSDL */
  function notWsdl(wsdl) {
    var first = wsdl.documents[0];
    var text = first && first.b64 ? util.fromBase64(first.b64) : '';
    var root = (/<(?![?!])(?:[\w.-]+:)?([\w.-]+)/.exec(text) || [])[1] || '';
    if (root === 'definitions' || root === 'description') return '';
    var error = (/<errorText>([^<]*)/.exec(text) || [])[1] || '';
    return ZL.i18n.t('mock.notWsdl', { root: root, error: error });
  }

  function workspace() {
    return { projects: Object.keys(open).map(function (id) { return { projectId: id, wsdl: open[id] }; }) };
  }

  /* Saved projects of the user (boot list "projects" of ABAP) */
  function catalog() {
    return Object.keys(memory.projects).map(function (id) {
      var p = memory.projects[id];
      return { projectId: id, name: p.header.name, wsdlUrl: p.header.wsdlUrl, changedAt: p.header.changedAt,
               requestCount: p.requests.length };
    }).sort(function (x, y) { return x.name.localeCompare(y.name); });
  }

  function result(reply, message) {
    return { reply: reply, workspace: workspace(), settings: memory.settings, projects: catalog(),
             message: message || (reply.message ? { type: reply.ok ? 'S' : 'E', text: reply.message } : null) };
  }

  function failure(action, text) {
    return result({ kind: action.toLowerCase(), ok: false, message: text }, { type: 'E', text: text });
  }

  function stored(projectId) { return memory.projects[projectId] || null; }

  function projectJson(entry) {
    return { header: entry.header, requests: entry.requests };
  }

  function nameExists(name, exceptId) {
    return Object.keys(memory.projects).some(function (id) {
      return id !== exceptId && memory.projects[id].header.name.toUpperCase() === name.toUpperCase();
    });
  }

  function createProject(lines) {
    var t = ZL.i18n.t;
    var url = value(lines, 'wsdl_url').trim();
    return loadWsdl(url, value(lines, 'wsdl_user')).then(function (wsdl) {
      if (wsdl.authRequired) {
        var host = url.replace(/^[a-z]+:\/\//i, '').split(/[\/?#]/)[0];
        return result({ kind: 'auth_required', ok: false, action: 'PROJECT_CREATE', url: url, host: host,
                        realm: wsdl.realm, message: t('auth.required', { host: host }) },
                      { type: 'W', text: t('auth.required', { host: host }) });
      }
      var first = wsdl.documents[0];
      if (!first || first.error) return failure('PROJECT_CREATE', t('mock.wsdlFailed', { error: first ? first.error : '' }));
      if (notWsdl(wsdl)) return failure('PROJECT_CREATE', notWsdl(wsdl));
      var name = value(lines, 'name').trim() || new ZL.Wsdl(wsdl).firstServiceName() || 'SOAP Project';
      if (nameExists(name)) return failure('PROJECT_CREATE', t('mock.nameExists', { name: name }));
      var header = { projectId: util.uuid(), owner: 'MOCK', projectType: 'SOAP', name: name, wsdlUrl: url,
                     wsdlLoadedAt: wsdl.loadedAt, createdAt: now(), changedAt: now(), endpoints: [] };
      memory.projects[header.projectId] = { header: header, requests: [], wsdl: wsdl };
      open[header.projectId] = wsdl;
      persist();
      return result({ kind: 'project', ok: true, project: { header: header, requests: [] },
                      createSamples: value(lines, 'create_samples') === 'true',
                      message: t('mock.wsdlLoaded', { count: wsdl.documents.length }) });
    });
  }

  function refreshWsdl(lines) {
    var t = ZL.i18n.t;
    var entry = stored(value(lines, 'project_id'));
    if (!entry) return Promise.resolve(failure('PROJECT_REFRESH_WSDL', t('mock.notFound')));
    var url = entry.header.wsdlUrl;
    return loadWsdl(url, value(lines, 'wsdl_user')).then(function (wsdl) {
      if (wsdl.authRequired) {
        var host = url.replace(/^[a-z]+:\/\//i, '').split(/[\/?#]/)[0];
        return result({ kind: 'auth_required', ok: false, action: 'PROJECT_REFRESH_WSDL', url: url, host: host,
                        realm: wsdl.realm, message: t('auth.required', { host: host }) });
      }
      entry.wsdl = wsdl;
      entry.header.wsdlLoadedAt = wsdl.loadedAt;
      open[entry.header.projectId] = wsdl;
      persist();
      return result({ kind: 'project', ok: true, project: projectJson(entry),
                      message: t('mock.wsdlLoaded', { count: wsdl.documents.length }) });
    });
  }

  function sendRequest(lines) {
    var url = value(lines, 'url');
    var body = value(lines, 'body');
    var started = Date.now();
    var sent = headersOf(lines).map(function (h) { return { n: h.name, v: h.value }; });
    var basic = value(lines, 'auth_type') === 'BASIC' && value(lines, 'user');
    if (basic) sent.push({ n: 'Authorization', v: 'Basic ********' });
    var status = 200;
    var reason = 'OK';
    var answer;
    if (/secure/i.test(url) && !basic) {
      status = 401; reason = 'Unauthorized'; answer = '<html><body>401 Unauthorized</body></html>';
    } else if (/fault/i.test(url) || /<fault/i.test(body)) {
      status = 500; reason = 'Internal Server Error';
      answer = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>' +
               '<soapenv:Fault><faultcode>soapenv:Server</faultcode><faultstring>Mock fault</faultstring>' +
               '</soapenv:Fault></soapenv:Body></soapenv:Envelope>';
    } else {
      var operation = (/<(?:[\w.\-]+:)?Body[^>]*>\s*<(?:[\w.\-]+:)?([\w.\-]+)/.exec(body) || [])[1] || 'Operation';
      answer = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>' +
               '<' + operation + 'Response xmlns="urn:zlitmus:mock"><result>42</result></' + operation + 'Response>' +
               '</soapenv:Body></soapenv:Envelope>';
    }
    var bytes = util.utf8(answer);
    return Promise.resolve(result({
      kind: 'response', ok: true, projectId: value(lines, 'project_id'), requestId: value(lines, 'request_id'),
      status: status, reason: reason, timeMs: Date.now() - started + 7, size: bytes.length,
      headers: [{ n: 'Content-Type', v: 'text/xml; charset=utf-8' }, { n: 'Content-Length', v: String(bytes.length) }],
      body64: util.bytesToBase64(bytes), message: 'HTTP ' + status + ' ' + reason, hint: '',
      request: { method: value(lines, 'method') || 'POST', url: url, headers: sent }
    }, { type: status >= 400 ? 'W' : 'S', text: 'HTTP ' + status + ' ' + reason }));
  }

  function handle(action, lines) {
    var t = ZL.i18n.t;
    var projectId = value(lines, 'project_id');
    var entry;
    var prefs = value(lines, 'prefs');
    if (prefs) { memory.settings.uiPrefs = prefs; persist(); }
    switch (action) {
      case 'PROJECT_LIST':
        return Promise.resolve(result({ kind: 'projects', ok: true, projects: catalog() }));
      case 'PROJECT_CREATE':
        return createProject(lines);
      case 'PROJECT_OPEN':
        entry = stored(projectId);
        if (!entry) return Promise.resolve(failure(action, t('mock.notFound')));
        open[projectId] = entry.wsdl;
        return Promise.resolve(result({ kind: 'project', ok: true, project: projectJson(entry) }));
      case 'PROJECT_SAVE': {
        var data = JSON.parse(value(lines, 'project') || '{}');
        entry = stored(data.header && data.header.projectId);
        if (!entry) return Promise.resolve(failure(action, t('mock.notFound')));
        entry.requests = (data.requests || []).map(function (r, i) {
          var copy = ZL.State.normalizeRequest(r);
          copy.position = i + 1;
          return copy;
        });
        entry.header.endpoints = ((data.header && data.header.endpoints) || []).map(function (e) {
          return { interfaceName: e.interfaceName || '', url: e.url || '' };
        });
        entry.header.changedAt = now();
        persist();
        return Promise.resolve(result({ kind: 'saved', ok: true, project: projectJson(entry), message: t('msg.saved') }));
      }
      case 'PROJECT_RENAME':
        entry = stored(projectId);
        if (!entry) return Promise.resolve(failure(action, t('mock.notFound')));
        if (nameExists(value(lines, 'name'), projectId)) {
          return Promise.resolve(failure(action, t('mock.nameExists', { name: value(lines, 'name') })));
        }
        entry.header.name = value(lines, 'name');
        persist();
        return Promise.resolve(result({ kind: 'saved', ok: true, project: projectJson(entry), message: t('msg.saved') }));
      case 'PROJECT_REFRESH_WSDL':
        return refreshWsdl(lines);
      case 'PROJECT_DELETE':
        delete memory.projects[projectId];
        delete open[projectId];
        persist();
        return Promise.resolve(result({ kind: 'deleted', ok: true, projectId: projectId, message: t('msg.deleted') }));
      case 'PROJECT_CLOSE':
        delete open[projectId];
        return Promise.resolve(result({ kind: 'closed', ok: true, projectId: projectId }));
      case 'REQUEST_SEND':
        return sendRequest(lines);
      case 'PREFS_SAVE':
        return Promise.resolve(result({ kind: 'prefs', ok: true }));
      case 'SETTINGS_SAVE':
        memory.settings = Object.assign(memory.settings, JSON.parse(value(lines, 'settings') || '{}'));
        persist();
        return Promise.resolve(result({ kind: 'settings', ok: true, settings: memory.settings, message: t('msg.saved') }));
      case 'EXIT':
        return Promise.resolve(result({ kind: 'exit', ok: true }, { type: 'S', text: t('mock.exit') }));
      default:
        return Promise.resolve(failure(action, t('mock.unknownAction', { action: action })));
    }
  }

  return {
    handle: handle,
    settings: function () { return memory.settings; },
    catalog: catalog,
    addLocalFile: addLocalFile,
    fixtureNames: function () { return Object.keys(fixtures); },
    reset: function () { memory = { projects: {}, settings: load().settings }; open = {}; persist(); }
  };
})();

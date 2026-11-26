/* ======================================================================
 * zLitmus - application: commands, answers of ABAP, dialogs, keyboard, layout
 * ==================================================================== */
ZL.Commands = {};

ZL.App = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;
  var Dialogs = ZL.Dialogs;
  var settings = null;
  var status = { type: 'S', text: '' };
  var toastTimer = null;
  var syncTimer = null;
  var remembered = { key: '', dirty: false };

  /* ================= start and answers ================= */
  function start() {
    var boot = ZL.Bridge.boot();
    var lang = boot.lang || ((navigator.language || '').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en');
    ZL.i18n.setLang(lang);
    ZL.i18n.apply(document);
    settings = boot.settings || (ZL.Bridge.isSap() ? null : ZL.Mock.settings());
    var ui = ZL.Bridge.decodeJson(boot.ui64);
    State.restore(ui);
    if (!ui) State.applyPrefs(parsePrefs(settings));
    remembered = { key: projectsKey(), dirty: State.dirtyProjects().length > 0 };
    State.setWorkspace(ZL.Bridge.decodeJson(boot.workspace64));
    State.setCatalog(boot.projects || (ZL.Bridge.isSap() ? [] : ZL.Mock.catalog()));
    applyTheme();
    util.$('themeSwitch').addEventListener('click', function () { run('view.theme'); });
    util.$('sessionInfo').textContent = ZL.Bridge.isSap()
      ? (boot.user || '') + ' · ' + (boot.system || '') + ' · ' + lang.toUpperCase()
      : t('session.mock') + ' · ' + lang.toUpperCase();
    bindKeyboard();
    bindSplitters();
    applyLayout();
    if (boot.bootError) ZL.Log.add('app', 'E', boot.bootError);
    handle({ message: boot.message, reply: boot.reply }, true);
  }

  /* SAP GUI shows the page again after every action. An action sent while the control is still loading the page
     can be lost (no answer: the page waits for nothing). Automatic follow-up actions of the start (e.g. saving the
     sample requests of a new project) therefore wait until the page is loaded. */
  var START_DELAY_MS = 300;

  function afterPageLoad(run) {
    if (document.readyState === 'complete') setTimeout(run, START_DELAY_MS);
    else window.addEventListener('load', function () { setTimeout(run, START_DELAY_MS); });
  }

  /* Answer of the mock (the SAP answer arrives through start) */
  function receive(result) {
    if (result.settings) settings = result.settings;
    if (result.workspace) State.setWorkspace(result.workspace);
    if (result.projects) State.setCatalog(result.projects);
    handle(result);
  }

  function handle(result, atStart) {
    if (result.message && result.message.text) setStatus(result.message.type, result.message.text);
    if (result.reply) onReply(result.reply);
    State.get().lastAction = null;
    renderAll();
    if (result.message && result.message.text && result.message.type !== 'E') ZL.Log.add('app', result.message.type, result.message.text);
    if (atStart && ZL.Bridge.isSap()) afterPageLoad(processQueue);
    else processQueue();
  }

  function parsePrefs(source) {
    try { return source && source.uiPrefs ? JSON.parse(source.uiPrefs) : null; } catch (e) { return null; }
  }

  function onReply(reply) {
    var state = State.get();
    if (!reply.ok && reply.kind !== 'auth_required') {
      state.pending = null;
      state.queue = [];
      ZL.Log.add('app', 'E', reply.message || t('msg.failed'));
      toast(reply.message || t('msg.failed'), 'E');
      if (reply.kind === 'response') State.setResponse(reply.requestId || '', reply);
      if (reply.kind === 'response' && reply.requestId) logResponse(reply);
      return;
    }
    switch (reply.kind) {
      case 'projects': showProjectList(reply.projects || []); break;
      case 'project': projectArrived(reply); break;
      case 'auth_required': askCredentials(reply); break;
      case 'saved': projectSaved(reply); break;
      case 'deleted':
        State.removeProject(reply.projectId);
        State.forget(reply.projectId);
        break;
      case 'response':
        State.setResponse(reply.requestId, reply);
        logResponse(reply);
        break;
      case 'closed':
        State.removeProject(reply.projectId);
        break;
      case 'settings':
        settings = reply.settings;
        break;
      case 'prefs': break;
      case 'wsdl_file': {
        var draft = state.newProjectDraft || {};
        state.newProjectDraft = null;
        if (reply.url) draft.url = reply.url;
        setTimeout(function () { newProjectDialog(draft); }, 0);
        break;
      }
      case 'exit_check':
        /* SAP GUI Back / Exit / Cancel: ABAP saw unsaved work and asks the page */
        afterPageLoad(exit);
        break;
      case 'exit':
        toast(t('mock.exit'));
        break;
      default: break;
    }
  }

  function keepsLocalRequests(action) {
    return action === 'PROJECT_REFRESH_WSDL' || action === 'PROJECT_RENAME';
  }

  function projectArrived(reply) {
    var state = State.get();
    var data = reply.project || {};
    var existing = State.project(data.header.projectId);
    var entry;
    if (existing && keepsLocalRequests(state.lastAction)) {
      existing.header = data.header;
      entry = existing;
    } else {
      entry = State.upsertProject(data);
    }
    state.pending = null;
    State.remember(entry.header);
    ZL.Navigator.reveal({ kind: 'project', projectId: entry.header.projectId });
    if (reply.createSamples) {
      entry.requests = samplesFor(entry);
      if (entry.requests.length) {
        entry.dirty = true;
        ZL.Log.add('app', 'S', t('msg.samples', { count: entry.requests.length }));
        state.queue.push(saveItem(entry));
      }
    }
    var stale = entry.requests.filter(function (r) { return ZL.Navigator.isStale(entry, r); }).length;
    if (stale) ZL.Log.add('app', 'W', t('msg.stale', { count: stale }));
    var model = State.wsdl(entry.header.projectId);
    if (model) model.errors.forEach(function (error) { ZL.Log.add('app', 'W', error); });
  }

  function projectSaved(reply) {
    var state = State.get();
    var data = reply.project || {};
    var existing = State.project(data.header && data.header.projectId);
    if (existing && keepsLocalRequests(state.lastAction)) {
      existing.header = data.header;
      State.remember(existing.header);
    } else if (data.header) {
      State.upsertProject(data);
      State.remember(data.header);
    }
  }

  function logResponse(reply) {
    var request = reply.request || {};
    var text = (request.method || 'POST') + ' ' + (request.url || '') + ' → ' +
      (reply.status ? reply.status + ' ' + (reply.reason || '') : (reply.message || '')) +
      ' · ' + (reply.timeMs || 0) + ' ms · ' + (reply.size || 0) + ' ' + t('unit.bytes');
    var result = ZL.Request.resultOf(reply);
    ZL.Log.add('http', result === 'fail' ? 'W' : 'I', text);
    var fault = ZL.Xml.faultOf(ZL.Request.responseText(reply));
    if (fault) ZL.Log.add('error', 'E', fault);
    if (!reply.ok && reply.message) ZL.Log.add('error', 'E', reply.message + (reply.hint ? ' ' + reply.hint : ''));
  }

  /* ================= sending ================= */
  function send(action, values, headers, busyText) {
    var state = State.get();
    values = values || {};
    if (state.prefsDirty) {
      values.prefs = JSON.stringify(state.prefs);
      state.prefsDirty = false;
    }
    state.lastAction = action;
    return ZL.Bridge.send(action, values, headers, busyText);
  }

  function processQueue() {
    var state = State.get();
    if (!state.queue.length || Dialogs.isOpen()) return;
    var next = state.queue.shift();
    if (next.action === 'PROJECT_SAVE') {
      var project = State.project(next.projectId);
      if (!project) { processQueue(); return; }
      send('PROJECT_SAVE', { project: JSON.stringify(projectPayload(project)) }, null, t('busy.saving'));
      return;
    }
    send(next.action, next.values || {});
  }

  function projectPayload(project) {
    return {
      header: { projectId: project.header.projectId,
                endpoints: (project.header.endpoints || []).filter(function (e) { return e.url; }) },
      requests: project.requests.map(function (r) {
        return { requestId: r.requestId, interfaceName: r.interfaceName, operation: r.operation, name: r.name,
                 endpoint: r.endpoint, body: r.body, headers: r.headers.filter(function (x) { return x.name; }),
                 authType: r.authType, authUser: r.authUser, timeoutSec: r.timeoutSec || 0,
                 description: r.description || '', encoding: r.encoding || '' };
      })
    };
  }

  function saveItem(project) { return { action: 'PROJECT_SAVE', projectId: project.header.projectId }; }

  /* ================= projects ================= */
  function samplesFor(project) {
    var model = State.wsdl(project.header.projectId);
    if (!model) return [];
    var requests = [];
    model.interfaces().forEach(function (entry) {
      entry.ops.forEach(function (op) {
        var sample = ZL.Generator.sample(model, entry.binding, op);
        requests.push(State.normalizeRequest({ interfaceName: entry.name, operation: op, name: 'Request 1',
                                               endpoint: entry.endpoints[0] || '', body: sample ? sample.xml : '' }));
      });
    });
    return requests;
  }

  /* Default project name of a WSDL address: the host without its last label
     (zlitmusdevs.com.tr -> zlitmusdevs.com); a host without dots gives the file name of the path */
  /* C:\dir\a.wsdl -> file:///C:/dir/a.wsdl, \\server\share\a.wsdl -> file://server/share/a.wsdl (as ABAP
     ZCL_LITMUS_URL->FILE_URL); addresses with a scheme stay as they are */
  function fileUrlOf(text) {
    var value = String(text || '').trim();
    if (/^[a-z]:[\\/]/i.test(value)) return 'file:///' + value.replace(/\\/g, '/');
    if (/^\\\\[^\\]/.test(value)) return 'file:' + value.replace(/\\/g, '/');
    return value;
  }

  function defaultProjectName(address) {
    var text = fileUrlOf(address);
    if (/^file:/i.test(text)) {
      var base = decodeURIComponent(text.split(/[?#]/)[0].split('/').pop() || '');
      return base.replace(/\.[^.]*$/, '');
    }
    var match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)([^?#]*)/i.exec(text);
    if (!match) return '';
    var host = match[1].replace(/^[^@]*@/, '').replace(/:\d+$/, '');
    var labels = host.split('.').filter(Boolean);
    if (labels.length > 1 && !/^\d+$/.test(labels[labels.length - 1])) return labels.slice(0, -1).join('.');
    if (labels.length > 1) return host;
    var file = match[2].split('/').filter(Boolean).pop() || '';
    return file.replace(/\.[^.]*$/, '') || host;
  }

  /* A name that no saved or open project uses yet: "name", "name (2)", "name (3)", ... */
  function uniqueProjectName(base) {
    if (!base) return '';
    var used = State.catalog().map(function (p) { return (p.name || '').toLowerCase(); })
      .concat(State.get().projects.map(function (p) { return (p.header.name || '').toLowerCase(); }));
    var candidate = base;
    for (var n = 2; used.indexOf(candidate.toLowerCase()) >= 0; n++) candidate = base + ' (' + n + ')';
    return candidate;
  }

  /* draft: values of the dialog before "Browse..." (SAP shows the page again after the file dialog) */
  function newProjectDialog(draft) {
    draft = draft || {};
    var typed = !!draft.typed;
    var name = h('input', { type: 'text', id: 'newProjectName', placeholder: t('newProject.namePlaceholder'),
                            value: draft.name || '', oninput: function () { typed = name.value.trim() !== ''; } });
    function suggest() { if (!typed) name.value = uniqueProjectName(defaultProjectName(url.value)); }
    var url = h('input', { type: 'text', id: 'newProjectUrl', placeholder: t('newProject.wsdlPlaceholder'),
                           value: draft.url || '', list: ZL.Bridge.isSap() ? null : 'mockFixtures',
                           oninput: suggest, onchange: suggest });
    var samples = h('input', { type: 'checkbox', id: 'newProjectSamples', checked: draft.samples !== false });
    var picker = h('input', { type: 'file', accept: '.wsdl,.xml', hidden: true, onchange: function () {
      var file = picker.files && picker.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        url.value = ZL.Mock.addLocalFile(file.name, String(reader.result));
        suggest();
      };
      reader.readAsText(file);
    } });
    var browse = h('button', { class: 'btn', type: 'button', id: 'newProjectBrowse', text: t('newProject.browse'),
      onclick: function () {
        if (!ZL.Bridge.isSap()) { picker.click(); return; }
        State.get().newProjectDraft = { name: name.value, url: url.value, samples: samples.checked, typed: typed };
        Dialogs.close();
        setTimeout(function () { send('WSDL_BROWSE', {}, null, t('busy.choosingFile')); }, 0);
      } });
    suggest();
    var body = [
      Dialogs.field(t('newProject.name'), name),
      Dialogs.field(t('newProject.wsdl'), h('div', { class: 'input-with-button' }, [url, browse, picker])),
      h('label', { class: 'check' }, [samples, t('newProject.samples')]),
      h('p', { class: 'muted', text: t('newProject.nameHint') })
    ];
    if (!ZL.Bridge.isSap()) {
      body.push(h('datalist', { id: 'mockFixtures' }, ZL.Mock.fixtureNames().filter(function (n) {
        return /\.wsdl$/.test(n);
      }).map(function (n) { return h('option', { value: 'mock://fixtures/' + n }); })));
    }
    Dialogs.open({
      title: t('newProject.title'), body: body,
      buttons: [
        { label: t('btn.ok'), primary: true, action: function () {
          if (!url.value.trim()) { url.focus(); return false; }
          var values = { name: name.value.trim(), wsdl_url: fileUrlOf(url.value),
                         create_samples: samples.checked ? 'true' : 'false' };
          State.get().pending = { action: 'PROJECT_CREATE', values: values };
          setTimeout(function () { send('PROJECT_CREATE', values, null, t('busy.loadingWsdl')); }, 0);
          return true;
        } },
        { label: t('btn.cancel') }
      ]
    });
  }

  function askCredentials(reply) {
    var state = State.get();
    var pending = state.pending || { action: reply.action, values: { wsdl_url: reply.url } };
    var known = state.wsdlAuth[reply.url] || {};
    var user = h('input', { type: 'text', value: known.user || '', autocomplete: 'off' });
    var pass = h('input', { type: 'password', autocomplete: 'new-password' });
    Dialogs.open({
      title: t('auth.title'),
      body: [
        h('p', { text: t('auth.required', { host: reply.host || reply.url }) }),
        reply.realm ? h('p', { class: 'muted', text: t('auth.realm', { realm: reply.realm }) }) : null,
        Dialogs.field(t('auth.user'), user),
        Dialogs.field(t('auth.password'), pass)
      ],
      buttons: [
        { label: t('btn.ok'), primary: true, action: function () {
          if (!user.value) { user.focus(); return false; }
          state.wsdlAuth[reply.url] = { user: user.value, pass: pass.value };
          var values = Object.assign({}, pending.values, { wsdl_user: user.value, wsdl_pass: pass.value });
          setTimeout(function () { send(pending.action, values, null, t('busy.loadingWsdl')); }, 0);
          return true;
        } },
        { label: t('btn.cancel') }
      ],
      onCancel: function () { state.pending = null; }
    });
  }

  function showProjectList(projects) {
    if (!projects.length) { Dialogs.message(t('openProject.title'), t('openProject.empty')); return; }
    var chosen = projects[0].projectId;
    var rows = projects.map(function (p) {
      var row = h('div', { class: 'row', 'data-project': p.projectId,
        onclick: function () {
          chosen = p.projectId;
          rows.forEach(function (r) { r.classList.toggle('active', r === row); });
        },
        ondblclick: function () { dialog.close(); openProject(p.projectId); }
      }, [h('span', { class: 'name', text: p.name }), h('span', { class: 'muted', text: p.wsdlUrl }),
          h('span', { class: 'meta', text: t('openProject.meta', { count: p.requestCount,
                                                                   date: util.formatTimestamp(p.changedAt) }) })]);
      return row;
    });
    rows[0].classList.add('active');
    var dialog = Dialogs.open({
      title: t('openProject.title'),
      body: [h('div', { class: 'list' }, rows)],
      buttons: [
        { label: t('openProject.open'), primary: true, action: function () { setTimeout(function () { openProject(chosen); }, 0); } },
        { label: t('btn.cancel') }
      ]
    });
  }

  function openProject(projectId) {
    if (State.project(projectId)) {
      ZL.Navigator.reveal({ kind: 'project', projectId: projectId });
      renderAll();
      return;
    }
    send('PROJECT_OPEN', { project_id: projectId }, null, t('busy.opening'));
  }

  function currentProjectId() {
    var state = State.get();
    if (state.selection && State.project(state.selection.projectId)) return state.selection.projectId;
    var active = ZL.Tabs.activeRequest();
    return active ? active.project.header.projectId : null;
  }

  function saveProject(projectId) {
    var project = State.project(projectId);
    if (!project) return;
    send('PROJECT_SAVE', { project: JSON.stringify(projectPayload(project)) }, null, t('busy.saving'));
  }

  function saveAll() {
    var dirty = State.dirtyProjects();
    if (!dirty.length) return;
    State.get().queue = dirty.map(saveItem);
    processQueue();
  }

  function closeProject(projectId, afterwards) {
    var project = State.project(projectId);
    if (!project) return;
    function close() {
      State.removeProject(projectId);
      renderAll();
      send('PROJECT_CLOSE', { project_id: projectId });
      if (afterwards) afterwards();
    }
    if (!project.dirty) { close(); return; }
    Dialogs.confirm({
      title: t('close.title'), text: t('close.unsaved', { name: project.header.name }),
      yes: t('close.save'), no: t('close.discard'),
      onYes: function () {
        State.get().queue = [saveItem(project), { action: 'PROJECT_CLOSE', values: { project_id: projectId } }];
        processQueue();
      },
      onNo: close
    });
  }

  function refreshWsdl(projectId) {
    var project = State.project(projectId);
    if (!project) return;
    var values = { project_id: projectId, wsdl_url: project.header.wsdlUrl || '' };
    var known = State.get().wsdlAuth[project.header.wsdlUrl];
    if (known) { values.wsdl_user = known.user; values.wsdl_pass = known.pass; }
    State.get().pending = { action: 'PROJECT_REFRESH_WSDL', values: { project_id: projectId } };
    send('PROJECT_REFRESH_WSDL', values, null, t('busy.loadingWsdl'));
  }

  function renameProject(projectId) {
    var project = State.project(projectId);
    if (!project) return;
    Dialogs.prompt({ title: t('cmd.project.rename'), label: t('newProject.name'), value: project.header.name,
                     onOk: function (name) {
                       setTimeout(function () { send('PROJECT_RENAME', { project_id: projectId, name: name }); }, 0);
                     } });
  }

  function deleteProject(projectId) {
    var project = State.project(projectId);
    if (!project) return;
    Dialogs.confirm({ title: t('cmd.project.delete'), text: t('delete.project', { name: project.header.name }),
                      onYes: function () { setTimeout(function () { send('PROJECT_DELETE', { project_id: projectId }); }, 0); } });
  }

  /* ================= requests ================= */
  function currentRequest() {
    var active = ZL.Tabs.activeRequest();
    if (active) return active;
    var selection = State.get().selection;
    return selection && selection.kind === 'request' ? State.findRequest(selection.requestId) : null;
  }

  function currentOperation() {
    var selection = State.get().selection;
    if (selection && (selection.kind === 'operation' || selection.kind === 'request') && State.project(selection.projectId)) {
      return selection;
    }
    var active = ZL.Tabs.activeRequest();
    if (active) {
      return { projectId: active.project.header.projectId, binding: active.request.interfaceName,
               operation: active.request.operation };
    }
    return null;
  }

  function openRequest(requestId) {
    var found = State.findRequest(requestId);
    if (!found) return;
    State.openTab({ id: 'r:' + requestId, type: 'request', requestId: requestId,
                    projectId: found.project.header.projectId });
    ZL.Navigator.reveal({ kind: 'request', projectId: found.project.header.projectId, binding: found.request.interfaceName,
                          operation: found.request.operation, requestId: requestId });
    renderAll();
  }

  function sampleBody(project, interfaceName, operation) {
    var model = State.wsdl(project.header.projectId);
    var entry = model ? model.findInterface(interfaceName) : null;
    var sample = entry ? ZL.Generator.sample(model, entry.binding, operation) : null;
    return { body: sample ? sample.xml : '', endpoint: entry ? entry.endpoints[0] || '' : '' };
  }

  function nextName(project, interfaceName, operation) {
    var used = project.requests.filter(function (r) { return r.interfaceName === interfaceName && r.operation === operation; })
      .map(function (r) { return r.name; });
    var n = 1;
    while (used.indexOf('Request ' + n) >= 0) n++;
    return 'Request ' + n;
  }

  function newRequest() {
    var target = currentOperation();
    if (!target) return;
    var project = State.project(target.projectId);
    var sample = sampleBody(project, target.binding, target.operation);
    var request = State.normalizeRequest({ interfaceName: target.binding, operation: target.operation,
                                           name: nextName(project, target.binding, target.operation),
                                           endpoint: sample.endpoint, body: sample.body });
    project.requests.push(request);
    project.dirty = true;
    openRequest(request.requestId);
  }

  function cloneRequest() {
    var found = currentRequest();
    if (!found) return;
    var copy = State.normalizeRequest(util.clone(found.request));
    copy.requestId = util.uuid();
    copy.name = t('request.copyOf', { name: found.request.name });
    found.project.requests.push(copy);
    found.project.dirty = true;
    openRequest(copy.requestId);
  }

  function renameRequest() {
    var found = currentRequest();
    if (!found) return;
    Dialogs.prompt({ title: t('cmd.request.rename'), label: t('newProject.name'), value: found.request.name,
                     onOk: function (name) { found.request.name = name; found.project.dirty = true; renderAll(); } });
  }

  function deleteRequest() {
    var found = currentRequest();
    if (!found) return;
    Dialogs.confirm({ title: t('cmd.request.delete'), text: t('delete.request', { name: found.request.name }),
      onYes: function () {
        var id = found.request.requestId;
        found.project.requests = found.project.requests.filter(function (r) { return r.requestId !== id; });
        found.project.dirty = true;
        State.closeTab('r:' + id);
        delete State.get().responses[id];
        State.get().selection = { kind: 'operation', projectId: found.project.header.projectId,
                                  binding: found.request.interfaceName, operation: found.request.operation };
        renderAll();
      } });
  }

  function recreateRequest() {
    var found = currentRequest();
    if (!found) return;
    var sample = sampleBody(found.project, found.request.interfaceName, found.request.operation);
    if (!sample.body) { toast(t('request.noSample'), 'E'); return; }
    Dialogs.confirm({ title: t('cmd.request.recreate'), text: t('request.recreateConfirm'),
      onYes: function () {
        found.request.body = sample.body;
        if (!found.request.endpoint) found.request.endpoint = sample.endpoint;
        found.project.dirty = true;
        renderAll();
      } });
  }

  /* Export of the request body / the response as an XML file. SAP: ABAP opens the save dialog
     (FILE_EXPORT, PAI); browser: download link. */
  function fileName(request, part) {
    return (request.name || 'request').replace(/[\\/:*?"<>|]+/g, '_') + '-' + part + '.xml';
  }

  function exportFile(name, content) {
    if (ZL.Bridge.isSap()) {
      send('FILE_EXPORT', { file_name: name, content: content }, null, t('busy.working'));
      return;
    }
    try {
      var link = h('a', { href: URL.createObjectURL(new Blob([content], { type: 'application/xml' })), download: name });
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) { toast(String(e), 'E'); }
  }

  function exportRequest() {
    var found = currentRequest();
    if (found) exportFile(fileName(found.request, 'request'), found.request.body || '');
  }

  function responseOf(found) {
    var response = found ? State.get().responses[found.request.requestId] : null;
    return response && !response.waiting && response.body64 ? response : null;
  }

  function exportResponse() {
    var found = currentRequest();
    var response = responseOf(found);
    if (!response) return;
    var text = ZL.Request.responseText(response);
    exportFile(fileName(found.request, 'response'), ZL.Xml.pretty(text) || text);
  }

  function formatRequest() {
    var found = currentRequest();
    if (!found) return;
    var pretty = ZL.Xml.pretty(found.request.body);
    if (pretty == null) { toast(t('request.notXml'), 'E'); return; }
    if (pretty !== found.request.body) {
      found.request.body = pretty;
      found.project.dirty = true;
    }
    renderAll();
  }

  function sendRequest() {
    var found = currentRequest();
    if (!found) return;
    var request = found.request;
    if (!request.endpoint) { toast(t('request.noEndpoint'), 'E'); return; }
    var state = State.get();
    if (!ZL.Tabs.activeRequest()) openRequest(request.requestId);
    State.setResponse(request.requestId, { waiting: true });
    ZL.Log.add('app', 'I', t('msg.sending', { name: request.name, url: request.endpoint }));
    send('REQUEST_SEND', {
      project_id: found.project.header.projectId,
      request_id: request.requestId,
      method: 'POST',
      url: request.endpoint,
      body: request.body,
      auth_type: request.authType,
      user: request.authType === 'BASIC' ? request.authUser : '',
      pass: request.authType === 'BASIC' ? (state.passwords[request.requestId] || '') : '',
      timeout: request.timeoutSec ? String(request.timeoutSec) : '',
      encoding: request.encoding || ''
    }, ZL.Request.effectiveHeaders(found.project, request), t('busy.sending'));
  }

  /* Edit of a request in the properties panel: the panel itself is not re-rendered while typing */
  function requestEdited(found) {
    found.project.dirty = true;
    scheduleSync();
    ZL.Navigator.render();
    ZL.Tabs.renderHeaders();
    ZL.Toolbar.render();
    ZL.Request.refresh(found.request.requestId);
    renderStatus();
  }

  /* ================= bindings and their endpoints ================= */
  function openBinding(projectId, binding) {
    if (!State.project(projectId)) return;
    State.openTab({ id: 'b:' + projectId + '/' + binding, type: 'binding', projectId: projectId, binding: binding });
    ZL.Navigator.reveal({ kind: 'binding', projectId: projectId, binding: binding });
    renderAll();
  }

  function endpointChanged(project) {
    project.dirty = true;
    renderAll();
  }

  /* Adds an endpoint of the user to a binding; false when it is empty or already known */
  function addEndpoint(projectId, binding, address) {
    var project = State.project(projectId);
    var value = String(address || '').trim();
    if (!project || !value) return false;
    if (ZL.Request.endpointsFor(project, binding).indexOf(value) >= 0) { toast(t('binding.exists'), 'E'); return false; }
    project.header.endpoints = (project.header.endpoints || []).concat([{ interfaceName: binding, url: value }]);
    endpointChanged(project);
    return true;
  }

  function removeEndpoint(projectId, binding, address) {
    var project = State.project(projectId);
    if (!project) return;
    project.header.endpoints = (project.header.endpoints || []).filter(function (e) {
      return !(e.interfaceName === binding && e.url === address);
    });
    endpointChanged(project);
  }

  function editEndpoint(projectId, binding, address, value) {
    var project = State.project(projectId);
    var next = String(value || '').trim();
    if (!project || !next || next === address) return;
    if (ZL.Request.endpointsFor(project, binding).indexOf(next) >= 0) { toast(t('binding.exists'), 'E'); renderAll(); return; }
    project.header.endpoints.forEach(function (e) { if (e.interfaceName === binding && e.url === address) e.url = next; });
    project.requests.forEach(function (r) { if (r.interfaceName === binding && r.endpoint === address) r.endpoint = next; });
    endpointChanged(project);
  }

  /* Sets the endpoint of every request of the binding */
  function assignEndpoint(projectId, binding, address) {
    var project = State.project(projectId);
    if (!project) return;
    var count = 0;
    project.requests.forEach(function (r) {
      if (r.interfaceName === binding && r.endpoint !== address) { r.endpoint = address; count++; }
    });
    if (count) project.dirty = true;
    toast(t('binding.assigned', { count: count }));
    renderAll();
  }

  /* ================= theme ================= */
  function applyTheme() {
    var dark = State.get().prefs.theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var button = util.$('themeSwitch');
    if (!button) return;
    button.classList.toggle('dark', dark);
    button.setAttribute('aria-checked', String(dark));
    button.title = t(dark ? 'theme.toLight' : 'theme.toDark');
    button.querySelector('.ts-label').textContent = t('theme.label');
    button.querySelector('.ts-state').textContent = t(dark ? 'theme.dark' : 'theme.light');
  }

  /* Switches the theme and saves it at once in the user settings (ZLITMUS_USET-UI_PREFS) */
  function toggleTheme() {
    var state = State.get();
    state.prefs.theme = state.prefs.theme === 'dark' ? 'light' : 'dark';
    state.prefsDirty = true;
    applyTheme();
    renderAll();
    send('PREFS_SAVE', {});
  }

  /* ================= settings and help ================= */
  function preferencesDialog() {
    var current = settings || {};
    var timeout = h('input', { type: 'number', min: '1', max: '3600', value: String(current.timeoutSec || 60) });
    var known = ['ANONYM', 'DFAULT'];
    var custom = known.indexOf(current.sslId || 'ANONYM') < 0;
    var sslInput = h('input', { type: 'text', maxlength: '6', value: custom ? current.sslId : '', hidden: !custom });
    var ssl = h('select', { onchange: function () { sslInput.hidden = ssl.value !== '*'; } }, [
      h('option', { value: 'ANONYM', text: 'ANONYM', selected: !custom && current.sslId !== 'DFAULT' }),
      h('option', { value: 'DFAULT', text: 'DFAULT', selected: current.sslId === 'DFAULT' }),
      h('option', { value: '*', text: t('settings.sslOther'), selected: custom })
    ]);
    var proxyHost = h('input', { type: 'text', value: current.proxyHost || '' });
    var proxyPort = h('input', { type: 'text', value: current.proxyPort || '' });
    Dialogs.open({
      title: t('settings.title'),
      body: [
        Dialogs.field(t('settings.timeout'), timeout),
        Dialogs.field(t('settings.ssl'), ssl),
        Dialogs.field('', sslInput),
        Dialogs.field(t('settings.proxyHost'), proxyHost),
        Dialogs.field(t('settings.proxyPort'), proxyPort),
        h('p', { class: 'muted', text: t('settings.note') })
      ],
      buttons: [
        { label: t('btn.save'), primary: true, action: function () {
          var state = State.get();
          var value = {
            timeoutSec: parseInt(timeout.value, 10) || 60,
            sslId: (ssl.value === '*' ? sslInput.value : ssl.value).toUpperCase().trim() || 'ANONYM',
            proxyHost: proxyHost.value.trim(),
            proxyPort: proxyPort.value.trim(),
            uiPrefs: JSON.stringify(state.prefs)
          };
          state.prefsDirty = false;
          setTimeout(function () { send('SETTINGS_SAVE', { settings: JSON.stringify(value) }); }, 0);
          return true;
        } },
        { label: t('btn.cancel') }
      ]
    });
  }

  function guideDialog() {
    var sections = ['start', 'request', 'save', 'auth', 'errors'];
    Dialogs.open({
      title: t('cmd.help.guide'),
      body: [h('div', { class: 'guide' }, sections.map(function (key) {
        return h('div', null, [h('h4', { text: t('guide.' + key + '.title') }), h('p', { text: t('guide.' + key + '.text') })]);
      }))],
      buttons: [{ label: t('btn.close'), primary: true }]
    });
  }

  function shortcutsDialog() {
    var rows = [['Ctrl+N', 'cmd.file.new'], ['Ctrl+O', 'cmd.file.open'], ['Ctrl+S', 'cmd.file.save'],
                ['Ctrl+Shift+S', 'cmd.file.saveAll'], ['Ctrl+Enter', 'cmd.request.send'],
                ['Ctrl+Shift+F', 'cmd.request.format'], ['F1', 'cmd.help.guide'], ['F5', 'cmd.page.refresh'], ['Alt+…', 'shortcuts.menu'],
                ['↑ ↓ ← →', 'shortcuts.tree'], ['Esc', 'shortcuts.escape']];
    Dialogs.open({
      title: t('cmd.help.shortcuts'),
      body: [h('table', { class: 'kv' }, [h('tbody', null, rows.map(function (row) {
        return h('tr', null, [h('th', { text: row[0] }), h('td', { text: t(row[1]) })]);
      }))])],
      buttons: [{ label: t('btn.close'), primary: true }]
    });
  }

  function aboutDialog() {
    var logo = h('div');
    var template = util.$(State.get().prefs.theme === 'dark' ? 'lockupDarkTemplate' : 'lockupTemplate');
    if (template) logo.appendChild(document.importNode(template.content, true));
    Dialogs.open({
      title: t('cmd.help.about'),
      body: [h('div', { class: 'about' }, [
        logo,
        h('p', { text: t('about.version', { version: '1.1.0' }) }),
        h('p', { text: t('about.license') }),
        h('p', { class: 'muted', text: t('about.credits') })
      ])],
      buttons: [{ label: t('btn.close'), primary: true }]
    });
  }

  /* Exit: unsaved work asks "Save and exit | Cancel | Exit without saving" */
  function exit() {
    var dirty = State.dirtyProjects();
    if (!dirty.length) { send('EXIT', {}); return; }
    Dialogs.open({
      title: t('exit.title'),
      body: [h('p', { text: t('exit.lost') }),
             h('p', { class: 'muted', text: t('exit.unsaved', { count: dirty.length }) + ' ' +
                                            dirty.map(function (p) { return p.header.name; }).join(', ') })],
      buttons: [
        { label: t('exit.save'), primary: true, action: function () {
          State.get().queue = dirty.map(saveItem).concat([{ action: 'EXIT', values: {} }]);
          setTimeout(processQueue, 0);
        } },
        { label: t('exit.cancel') },
        { label: t('exit.discard'), action: function () { setTimeout(function () { send('EXIT', {}); }, 0); } }
      ]
    });
  }

  /* ================= unsaved work known to ABAP =================
     SAP GUI Back / Exit / Cancel do not reach the page. The page therefore sends its state quietly ("UI_SYNC",
     no page reload) a moment after the projects change; on such an exit ABAP sees the unsaved work and shows the
     page again with the reply "exit_check". */
  function projectsKey() { return JSON.stringify(State.get().projects); }

  function scheduleSync() {
    if (!ZL.Bridge.isSap()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      var key = projectsKey();
      var dirty = State.dirtyProjects().length > 0;
      if (key === remembered.key || (!dirty && !remembered.dirty)) return;
      remembered = { key: key, dirty: dirty };
      ZL.Bridge.sync();
    }, 1500);
  }

  /* ================= commands ================= */
  function hasProject() { return !!currentProjectId(); }
  function hasRequest() { return !!currentRequest(); }
  function togglePref(name) {
    return function () {
      var prefs = State.get().prefs;
      prefs[name] = !prefs[name];
      State.get().prefsDirty = true;
      applyLayout();
      renderAll();
    };
  }

  var C = ZL.Commands;
  C['file.new'] = { run: newProjectDialog };
  C['file.open'] = { run: function () { send('PROJECT_LIST', {}, null, t('busy.loading')); } };
  C['file.save'] = { run: function () { saveProject(currentProjectId()); }, enabled: hasProject };
  C['file.saveAll'] = { run: saveAll, enabled: function () { return State.dirtyProjects().length > 0; } };
  C['file.close'] = { run: function () { closeProject(currentProjectId()); }, enabled: hasProject };
  C['file.preferences'] = { run: preferencesDialog };
  C['file.exit'] = { run: exit };
  C['project.refresh'] = { run: function () { refreshWsdl(currentProjectId()); }, enabled: hasProject };
  C['project.rename'] = { run: function () { renameProject(currentProjectId()); }, enabled: hasProject };
  C['project.delete'] = { run: function () { deleteProject(currentProjectId()); }, enabled: hasProject };
  C['request.new'] = { run: newRequest, enabled: function () { return !!currentOperation(); } };
  C['request.clone'] = { run: cloneRequest, enabled: hasRequest };
  C['request.rename'] = { run: renameRequest, enabled: hasRequest };
  C['request.delete'] = { run: deleteRequest, enabled: hasRequest };
  C['request.recreate'] = { run: recreateRequest, enabled: hasRequest };
  C['request.format'] = { run: formatRequest, enabled: hasRequest };
  C['request.send'] = { run: sendRequest, enabled: hasRequest };
  C['request.exportRequest'] = { run: exportRequest, enabled: hasRequest };
  C['request.exportResponse'] = { run: exportResponse, enabled: function () { return !!responseOf(currentRequest()); } };
  C['view.navigator'] = { run: togglePref('showNav'), checked: function () { return State.get().prefs.showNav; } };
  C['view.properties'] = { run: togglePref('showProps'), checked: function () { return State.get().prefs.showProps; } };
  C['view.log'] = { run: togglePref('showLog'), checked: function () { return State.get().prefs.showLog; } };
  C['view.wrap'] = { run: togglePref('wrap'), checked: function () { return State.get().prefs.wrap; } };
  C['view.layout'] = { run: function () {
    var prefs = State.get().prefs;
    prefs.layout = prefs.layout === 'vertical' ? 'horizontal' : 'vertical';
    State.get().prefsDirty = true;
    renderAll();
  }, checked: function () { return State.get().prefs.layout === 'vertical'; } };
  C['view.theme'] = { run: toggleTheme, checked: function () { return State.get().prefs.theme === 'dark'; } };
  /* Former SAP GUI function keys: the page is shown again by ABAP / the page file is chosen on the PC */
  C['page.refresh'] = { run: function () { send('PAGE_REFRESH', {}, null, t('busy.loading')); },
                        enabled: function () { return ZL.Bridge.isSap(); } };
  C['page.install'] = { run: function () { send('PAGE_INSTALL', {}, null, t('busy.working')); },
                        enabled: function () { return ZL.Bridge.isSap(); } };
  C['help.guide'] = { run: guideDialog };
  C['help.shortcuts'] = { run: shortcutsDialog };
  C['help.about'] = { run: aboutDialog };

  function run(id) {
    var command = C[id];
    if (!command || (command.enabled && !command.enabled())) return;
    ZL.Menu.close();
    command.run();
  }

  /* Context menu of a navigator node */
  function contextMenu(selection, x, y) {
    var items;
    switch (selection.kind) {
      case 'project': items = ['file.save', 'file.close', null, 'project.refresh', 'project.rename', 'project.delete']; break;
      case 'binding': items = ['open', null, 'project.refresh']; break;
      case 'operation': items = ['request.new']; break;
      case 'catalog': items = ['open']; break;
      default: items = ['open', 'request.send', null, 'request.clone', 'request.rename', 'request.delete', null,
                        'request.recreate'];
    }
    ZL.Menu.show(items.map(function (id) {
      if (!id) return { separator: true };
      if (id === 'open') return { label: t('nav.open'), run: function () { openSelection(selection); } };
      var command = C[id];
      return { label: t('cmd.' + id), enabled: !command.enabled || command.enabled(), run: function () { run(id); } };
    }), x, y);
  }

  function openSelection(selection) {
    if (selection.kind === 'binding') openBinding(selection.projectId, selection.binding);
    else if (selection.kind === 'catalog') openProject(selection.projectId);
    else openRequest(selection.requestId);
  }

  /* ================= rendering ================= */
  function renderAll() {
    scheduleSync();
    ZL.Menu.render();
    ZL.Toolbar.render();
    ZL.Navigator.render();
    ZL.Properties.render();
    ZL.Tabs.render();
    ZL.Log.render();
    renderStatus();
  }

  function selectionChanged() {
    ZL.Properties.render();
    ZL.Toolbar.render();
  }

  function dirtyChanged() {
    scheduleSync();
    ZL.Navigator.render();
    ZL.Tabs.renderHeaders();
    ZL.Toolbar.render();
    ZL.Properties.render();
  }

  function setStatus(type, text) { status = { type: type || 'S', text: text || '' }; }

  function renderStatus() {
    var bar = util.clear(util.$('statusbar'));
    bar.appendChild(h('span', { class: 'msg ' + status.type, text: status.text }));
    var dirty = State.dirtyProjects().length;
    bar.appendChild(h('span', { class: 'right', text: dirty ? t('status.unsaved', { count: dirty }) : '' }));
  }

  function toast(text, type) {
    var node = util.$('toast');
    node.textContent = text;
    node.className = 'toast' + (type === 'E' ? ' E' : '');
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, type === 'E' ? 7000 : 3500);
  }

  function closeTab(id) {
    State.closeTab(id);
    renderAll();
  }

  /* ================= layout, splitters, keyboard ================= */
  function applyLayout() {
    var prefs = State.get().prefs;
    util.$('side').style.width = prefs.navWidth + 'px';
    util.$('propsPanel').style.height = prefs.propsHeight + 'px';
    util.$('logPanel').style.height = prefs.logHeight + 'px';
    util.$('navPanel').hidden = !prefs.showNav;
    util.$('propsPanel').hidden = !prefs.showProps;
    util.$('sideSplit').hidden = !(prefs.showNav && prefs.showProps);
    util.$('side').hidden = !(prefs.showNav || prefs.showProps);
    util.$('mainSplit').hidden = util.$('side').hidden;
    if (prefs.showProps && !prefs.showNav) util.$('propsPanel').style.height = '100%';
    util.$('logPanel').hidden = !prefs.showLog;
    util.$('logSplit').hidden = !prefs.showLog;
  }

  function bindSplitters() {
    function drag(id, onMove) {
      util.$(id).addEventListener('mousedown', function (event) {
        event.preventDefault();
        var startX = event.clientX;
        var startY = event.clientY;
        var prefs = State.get().prefs;
        var initial = { navWidth: prefs.navWidth, propsHeight: prefs.propsHeight, logHeight: prefs.logHeight };
        function move(e) { onMove(prefs, initial, e.clientX - startX, e.clientY - startY); applyLayout(); }
        function up() {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          State.get().prefsDirty = true;
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    drag('mainSplit', function (p, i, dx) { p.navWidth = clamp(i.navWidth + dx, 160, window.innerWidth - 300); });
    drag('sideSplit', function (p, i, dx, dy) { p.propsHeight = clamp(i.propsHeight - dy, 60, window.innerHeight - 200); });
    drag('logSplit', function (p, i, dx, dy) { p.logHeight = clamp(i.logHeight - dy, 60, window.innerHeight - 200); });
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (event) {
      if (Dialogs.isOpen()) return;
      if (ZL.Menu.onKey(event)) { event.preventDefault(); return; }
      var key = event.key;
      var ctrl = event.ctrlKey || event.metaKey;
      var command = null;
      if (ctrl && event.shiftKey && (key === 'S' || key === 's')) command = 'file.saveAll';
      else if (ctrl && event.shiftKey && (key === 'F' || key === 'f')) command = 'request.format';
      else if (ctrl && !event.shiftKey && (key === 'n' || key === 'N')) command = 'file.new';
      else if (ctrl && !event.shiftKey && (key === 'o' || key === 'O')) command = 'file.open';
      else if (ctrl && !event.shiftKey && (key === 's' || key === 'S')) command = 'file.save';
      else if (ctrl && key === 'Enter') command = 'request.send';
      else if (key === 'F1') command = 'help.guide';
      else if (key === 'F5' && ZL.Bridge.isSap()) command = 'page.refresh';
      if (command) { event.preventDefault(); run(command); }
    });
  }

  return {
    start: start, receive: receive, run: run, contextMenu: contextMenu, openRequest: openRequest,
    openProject: openProject, closeTab: closeTab, renderAll: renderAll, selectionChanged: selectionChanged,
    dirtyChanged: dirtyChanged, toast: toast, samplesFor: samplesFor, projectPayload: projectPayload,
    openBinding: openBinding, addEndpoint: addEndpoint, removeEndpoint: removeEndpoint, editEndpoint: editEndpoint,
    assignEndpoint: assignEndpoint, requestEdited: requestEdited, defaultProjectName: defaultProjectName,
    uniqueProjectName: uniqueProjectName, fileUrlOf: fileUrlOf, settings: function () { return settings; }
  };
})();

/* ======================================================================
 * zLitmus - workspace state
 * The whole state travels to ABAP with every action (value "ui") and comes back with the boot
 * data, because SAP GUI shows the page again after each action. WSDL documents are not part
 * of it: ABAP keeps them in the session and sends them as "workspace64".
 * Passwords live only here (session memory); they are never saved with a project.
 * ==================================================================== */
ZL.State = (function () {
  var MAX_LOG_LINES = 500;
  var MAX_RESPONSES = 20;
  var MAX_RECENT = 8;
  var state = fresh();
  var wsdlBundles = {};
  var wsdlModels = {};
  var catalog = [];

  function fresh() {
    return {
      version: 1,
      projects: [],
      tabs: [{ id: 'start', type: 'start' }],
      active: 'start',
      selection: null,
      expanded: {},
      responses: {},
      responseOrder: [],
      passwords: {},
      wsdlAuth: {},
      pending: null,
      lastAction: null,
      queue: [],
      logs: { app: [], http: [], error: [] },
      logTab: 'app',
      requestView: {},
      prefs: defaultPrefs(),
      prefsDirty: false,
      newProjectDraft: null
    };
  }

  function defaultPrefs() {
    return { navWidth: 280, propsHeight: 200, logHeight: 150, wrap: false, layout: 'horizontal',
             showNav: true, showProps: true, showLog: true, recent: [], theme: 'light',
             propsLabelWidth: 140, paneRatio: 0.5 };
  }

  function get() { return state; }

  function restore(ui) {
    state = fresh();
    if (ui && typeof ui === 'object' && ui.version === 1) {
      Object.keys(state).forEach(function (key) { if (ui[key] !== undefined) state[key] = ui[key]; });
      state.prefs = Object.assign(defaultPrefs(), state.prefs || {});
    }
    if (!state.tabs.some(function (tab) { return tab.id === 'start'; })) state.tabs.unshift({ id: 'start', type: 'start' });
    return state;
  }

  function applyPrefs(prefs) {
    state.prefs = Object.assign(defaultPrefs(), prefs || {});
  }

  /* What is sent to ABAP as "ui" */
  function snapshot() { return JSON.stringify(state); }

  /* ---- projects and requests ---- */
  function project(projectId) {
    for (var i = 0; i < state.projects.length; i++) if (state.projects[i].header.projectId === projectId) return state.projects[i];
    return null;
  }

  function findRequest(requestId) {
    for (var i = 0; i < state.projects.length; i++) {
      var requests = state.projects[i].requests;
      for (var j = 0; j < requests.length; j++) {
        if (requests[j].requestId === requestId) return { project: state.projects[i], request: requests[j] };
      }
    }
    return null;
  }

  function normalizeRequest(request) {
    return {
      requestId: request.requestId || ZL.util.uuid(),
      interfaceName: request.interfaceName || '',
      operation: request.operation || '',
      name: request.name || 'Request 1',
      endpoint: request.endpoint || '',
      body: request.body || '',
      headers: (request.headers || []).map(function (h) { return { name: h.name || '', value: h.value || '' }; }),
      authType: request.authType || 'NONE',
      authUser: request.authUser || '',
      timeoutSec: request.timeoutSec || 0,
      description: request.description || '',
      encoding: request.encoding || ''
    };
  }

  /* Project from ABAP replaces the open one (dirty flag is cleared) */
  function upsertProject(data) {
    var header = data.header || {};
    header.endpoints = (header.endpoints || []).map(function (e) {
      return { interfaceName: e.interfaceName || '', url: e.url || '' };
    });
    var entry = {
      header: header,
      requests: (data.requests || []).map(normalizeRequest),
      dirty: false
    };
    var existing = project(entry.header.projectId);
    if (existing) {
      existing.header = entry.header;
      existing.requests = entry.requests;
      existing.dirty = false;
      return existing;
    }
    state.projects.push(entry);
    state.expanded['p:' + entry.header.projectId] = true;
    return entry;
  }

  function removeProject(projectId) {
    var entry = project(projectId);
    state.projects = state.projects.filter(function (p) { return p.header.projectId !== projectId; });
    state.tabs = state.tabs.filter(function (tab) { return tab.projectId !== projectId; });
    if (!state.tabs.some(function (tab) { return tab.id === state.active; })) state.active = 'start';
    if (state.selection && state.selection.projectId === projectId) state.selection = null;
    if (entry) {
      entry.requests.forEach(function (r) { delete state.responses[r.requestId]; delete state.passwords[r.requestId]; });
    }
    delete wsdlBundles[projectId];
    delete wsdlModels[projectId];
  }

  function markDirty(projectId) {
    var entry = project(projectId);
    if (entry) entry.dirty = true;
  }

  function dirtyProjects() { return state.projects.filter(function (p) { return p.dirty; }); }

  /* ---- WSDL of the open projects (from workspace64, not part of the UI state) ---- */
  function setWorkspace(workspace) {
    wsdlBundles = {};
    wsdlModels = {};
    ((workspace && workspace.projects) || []).forEach(function (p) { wsdlBundles[p.projectId] = p.wsdl || {}; });
  }

  function setWsdl(projectId, bundle) {
    wsdlBundles[projectId] = bundle;
    delete wsdlModels[projectId];
  }

  function wsdl(projectId) {
    if (!wsdlModels[projectId] && wsdlBundles[projectId]) wsdlModels[projectId] = new ZL.Wsdl(wsdlBundles[projectId]);
    return wsdlModels[projectId] || null;
  }

  function wsdlBundle(projectId) { return wsdlBundles[projectId] || null; }

  /* ---- responses ---- */
  function setResponse(requestId, response) {
    state.responses[requestId] = response;
    state.responseOrder = state.responseOrder.filter(function (id) { return id !== requestId; }).concat([requestId]);
    while (state.responseOrder.length > MAX_RESPONSES) delete state.responses[state.responseOrder.shift()];
  }

  /* ---- logs ---- */
  function log(kind, type, text) {
    var lines = state.logs[kind] || (state.logs[kind] = []);
    lines.push({ time: ZL.util.time(), type: type || 'I', text: String(text) });
    while (lines.length > MAX_LOG_LINES) lines.shift();
  }

  /* ---- recent projects (ui_prefs) ---- */
  function remember(header) {
    var recent = state.prefs.recent.filter(function (r) { return r.projectId !== header.projectId; });
    recent.unshift({ projectId: header.projectId, name: header.name });
    state.prefs.recent = recent.slice(0, MAX_RECENT);
    state.prefsDirty = true;
  }

  function forget(projectId) {
    state.prefs.recent = state.prefs.recent.filter(function (r) { return r.projectId !== projectId; });
    state.prefsDirty = true;
  }

  /* ---- tabs ---- */
  function openTab(tab) {
    if (!state.tabs.some(function (t) { return t.id === tab.id; })) state.tabs.push(tab);
    state.active = tab.id;
  }

  function closeTab(id) {
    if (id === 'start') return;
    var index = -1;
    state.tabs.forEach(function (tab, i) { if (tab.id === id) index = i; });
    if (index < 0) return;
    state.tabs.splice(index, 1);
    if (state.active === id) state.active = state.tabs[Math.max(0, index - 1)].id;
  }

  /* ---- saved projects of the user (boot list, not part of the UI state) ---- */
  function setCatalog(list) { catalog = Array.isArray(list) ? list : []; }
  function catalogEntries() { return catalog; }

  return {
    setCatalog: setCatalog, catalog: catalogEntries,
    get: get, restore: restore, snapshot: snapshot, applyPrefs: applyPrefs, defaultPrefs: defaultPrefs,
    project: project, findRequest: findRequest, upsertProject: upsertProject, removeProject: removeProject,
    normalizeRequest: normalizeRequest, markDirty: markDirty, dirtyProjects: dirtyProjects,
    setWorkspace: setWorkspace, setWsdl: setWsdl, wsdl: wsdl, wsdlBundle: wsdlBundle,
    setResponse: setResponse, log: log, remember: remember, forget: forget,
    openTab: openTab, closeTab: closeTab
  };
})();

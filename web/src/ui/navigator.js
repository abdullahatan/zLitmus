/* ======================================================================
 * zLitmus - navigator tree: project > binding (interface) > operation > request
 * Saved projects that are not open follow the open ones (collapsed; expanding opens them).
 * Requests whose operation no longer exists in the WSDL are shown crossed out ("stale").
 * ==================================================================== */
ZL.Navigator = (function () {
  var util = ZL.util;
  var h = util.h;
  var t = ZL.i18n.t;
  var State = ZL.State;
  var visible = [];

  function key(selection) {
    if (!selection) return '';
    return [selection.kind, selection.projectId, selection.binding || '', selection.operation || '', selection.requestId || '']
      .join('|');
  }

  function expandedKey(kind, projectId, binding, operation) {
    return kind.charAt(0) + ':' + projectId + (binding ? '/' + binding : '') + (operation ? '/' + operation : '');
  }

  /* Bindings and operations of a project: from the WSDL, plus those only known from saved requests */
  function structure(project) {
    var model = State.wsdl(project.header.projectId);
    var interfaces = model ? model.interfaces().map(function (i) {
      return { name: i.name, version: i.binding.version, ops: i.ops.map(function (op) { return { name: op, stale: false }; }) };
    }) : [];
    project.requests.forEach(function (request) {
      var entry = interfaces.filter(function (i) { return i.name === request.interfaceName; })[0];
      if (!entry) {
        entry = { name: request.interfaceName || '?', version: '', ops: [], stale: !!model };
        interfaces.push(entry);
      }
      if (!entry.ops.some(function (op) { return op.name === request.operation; })) {
        entry.ops.push({ name: request.operation || '?', stale: !!model });
      }
    });
    return interfaces;
  }

  function isStale(project, request) {
    var model = State.wsdl(project.header.projectId);
    if (!model) return false;
    var entry = model.findInterface(request.interfaceName);
    return !entry || entry.ops.indexOf(request.operation) < 0;
  }

  function render() {
    var tree = util.clear(util.$('tree'));
    var state = State.get();
    var selected = key(state.selection);
    visible = [];
    var saved = closedCatalog();
    if (!state.projects.length && !saved.length) {
      tree.appendChild(h('div', { class: 'empty', text: t('nav.empty') }));
      return;
    }
    state.projects.forEach(function (project) {
      var projectId = project.header.projectId;
      var projectKey = expandedKey('project', projectId);
      var model = State.wsdl(projectId);
      addNode(tree, {
        depth: 0, icon: 'project', iconText: 'P', label: project.header.name, dirty: project.dirty,
        badge: model ? '' : t('nav.noWsdl'),
        selection: { kind: 'project', projectId: projectId },
        expandKey: projectKey, expanded: !!state.expanded[projectKey], selected: selected
      });
      if (!state.expanded[projectKey]) return;
      structure(project).forEach(function (entry) {
        var bindingKey = expandedKey('binding', projectId, entry.name);
        addNode(tree, {
          depth: 1, icon: 'binding', iconText: 'B', label: entry.name, stale: entry.stale,
          badge: entry.version ? 'SOAP ' + entry.version : '',
          selection: { kind: 'binding', projectId: projectId, binding: entry.name },
          expandKey: bindingKey, expanded: !!state.expanded[bindingKey], selected: selected
        });
        if (!state.expanded[bindingKey]) return;
        entry.ops.forEach(function (op) {
          var opKey = expandedKey('operation', projectId, entry.name, op.name);
          var requests = project.requests.filter(function (r) { return r.interfaceName === entry.name && r.operation === op.name; });
          addNode(tree, {
            depth: 2, icon: 'operation', iconText: 'O', label: op.name, stale: op.stale,
            selection: { kind: 'operation', projectId: projectId, binding: entry.name, operation: op.name },
            expandKey: requests.length ? opKey : null, expanded: !!state.expanded[opKey], selected: selected
          });
          if (!state.expanded[opKey]) return;
          requests.forEach(function (request) {
            addNode(tree, {
              depth: 3, icon: 'request', iconText: '✉', label: request.name,
              stale: isStale(project, request),
              selection: { kind: 'request', projectId: projectId, binding: entry.name, operation: op.name,
                           requestId: request.requestId },
              selected: selected
            });
          });
        });
      });
    });
    saved.forEach(function (entry) {
      addNode(tree, {
        depth: 0, icon: 'catalog', iconText: 'P', label: entry.name, catalog: true,
        badge: t('nav.requests', { count: entry.requestCount || 0 }),
        selection: { kind: 'catalog', projectId: entry.projectId },
        expandKey: 'c:' + entry.projectId, expanded: false, selected: selected
      });
    });
  }

  /* Saved projects of the user that are not open: shown collapsed, opened on demand */
  function closedCatalog() {
    return State.catalog().filter(function (entry) { return !State.project(entry.projectId); });
  }

  function addNode(tree, node) {
    var row = h('div', {
      class: 'node' + (key(node.selection) === node.selected ? ' selected' : '') + (node.stale ? ' stale' : '') +
             (node.dirty ? ' dirty' : '') + (node.catalog ? ' catalog' : ''),
      title: node.catalog ? t('props.openHint') : null,
      role: 'treeitem', style: 'padding-left:' + (4 + node.depth * 16) + 'px',
      'aria-expanded': node.expandKey ? String(!!node.expanded) : null,
      onclick: function () { select(node.selection); },
      ondblclick: function () { activate(node); },
      oncontextmenu: function (event) {
        event.preventDefault();
        select(node.selection);
        ZL.App.contextMenu(node.selection, event.clientX, event.clientY);
      }
    }, [
      h('span', { class: 'twisty', text: node.expandKey ? (node.expanded ? '▾' : '▸') : '',
                  onclick: function (event) { event.stopPropagation(); expand(node); } }),
      h('span', { class: 'icon ' + node.icon, text: node.iconText }),
      h('span', { class: 'label', text: node.label }),
      node.badge ? h('span', { class: 'badge', text: node.badge }) : null
    ]);
    visible.push(node);
    tree.appendChild(row);
  }

  function expand(node, force) {
    if (node.catalog) { if (force !== false) ZL.App.openProject(node.selection.projectId); return; }
    if (node.expandKey) toggle(node.expandKey, force);
  }

  function toggle(expandKey, force) {
    var expanded = State.get().expanded;
    expanded[expandKey] = force === undefined ? !expanded[expandKey] : force;
    render();
  }

  function select(selection) {
    State.get().selection = selection;
    render();
    ZL.App.selectionChanged();
  }

  function activate(node) {
    var selection = node.selection;
    if (selection.kind === 'request') ZL.App.openRequest(selection.requestId);
    else if (selection.kind === 'binding') ZL.App.openBinding(selection.projectId, selection.binding);
    else expand(node);
  }

  /* Up / Down / Left / Right / Enter on the focused tree */
  function onKey(event) {
    if (!visible.length) return false;
    var current = key(State.get().selection);
    var index = -1;
    visible.forEach(function (node, i) { if (key(node.selection) === current) index = i; });
    var node = visible[index];
    switch (event.key) {
      case 'ArrowDown': select(visible[Math.min(visible.length - 1, index + 1)].selection); return true;
      case 'ArrowUp': select(visible[Math.max(0, index - 1)].selection); return true;
      case 'ArrowRight': if (node) expand(node, true); return true;
      case 'ArrowLeft': if (node) expand(node, false); return true;
      case 'Enter': if (node) activate(node); return true;
      case 'ContextMenu':
        if (node) ZL.App.contextMenu(node.selection, 40, 120);
        return true;
      default: return false;
    }
  }

  function reveal(selection) {
    var expanded = State.get().expanded;
    expanded[expandedKey('project', selection.projectId)] = true;
    if (selection.binding) expanded[expandedKey('binding', selection.projectId, selection.binding)] = true;
    if (selection.operation) {
      expanded[expandedKey('operation', selection.projectId, selection.binding, selection.operation)] = true;
    }
    State.get().selection = selection;
  }

  util.$('tree').addEventListener('keydown', function (event) {
    if (onKey(event)) event.preventDefault();
  });

  return { render: render, reveal: reveal, isStale: isStale, structure: structure };
})();

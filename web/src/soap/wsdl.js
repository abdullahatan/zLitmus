/* ======================================================================
 * zLitmus - WSDL 1.1 model (messages, port types, SOAP bindings, services, schemas)
 * Input: the documents ABAP downloaded ({url, status, contentType, error, b64}).
 * ==================================================================== */
ZL.NS = {
  wsdl: 'http://schemas.xmlsoap.org/wsdl/',
  soap11: 'http://schemas.xmlsoap.org/wsdl/soap/',
  soap12: 'http://schemas.xmlsoap.org/wsdl/soap12/',
  xsd: 'http://www.w3.org/2001/XMLSchema',
  env11: 'http://schemas.xmlsoap.org/soap/envelope/',
  env12: 'http://www.w3.org/2003/05/soap-envelope',
  wsdl20: 'http://www.w3.org/ns/wsdl'
};

ZL.Wsdl = (function () {
  var NS = ZL.NS;
  var t = ZL.i18n.t;

  function qkey(ns, local) { return '{' + (ns || '') + '}' + local; }

  /* "tns:Name" -> {ns, local}, resolved against the namespaces in scope of element */
  function qname(element, value) {
    if (!value) return null;
    value = value.trim();
    var colon = value.indexOf(':');
    var prefix = colon > 0 ? value.substring(0, colon) : null;
    var local = colon > 0 ? value.substring(colon + 1) : value;
    var ns = element.lookupNamespaceURI(prefix);
    if (ns == null && prefix === 'xml') ns = 'http://www.w3.org/XML/1998/namespace';
    return { ns: ns || '', local: local };
  }

  function kids(element, ns, local) {
    var out = [];
    for (var child = element.firstElementChild; child; child = child.nextElementSibling) {
      if ((ns == null || child.namespaceURI === ns) && (local == null || child.localName === local)) out.push(child);
    }
    return out;
  }

  function kid(element, ns, local) { return kids(element, ns, local)[0] || null; }

  /* Import references of a WSDL/XSD document (ABAP does the same when it downloads) */
  var Refs = {
    extract: function (text) {
      var out = [];
      var pattern = /<(?:[A-Za-z_][\w.\-]*:)?(import|include|redefine)\b[^>]*?\b(location|schemaLocation)\s*=\s*("([^"]*)"|'([^']*)')/g;
      var match;
      while ((match = pattern.exec(text))) {
        var location = (match[4] != null ? match[4] : match[5]).replace(/&amp;/g, '&');
        if (location && out.indexOf(location) < 0) out.push(location);
      }
      return out;
    },
    resolve: function (base, reference) {
      try { return new URL(reference, base).href; } catch (e) { return reference; }
    }
  };

  function Wsdl(bundle) {
    this.url = bundle.url || '';
    this.docs = [];
    this.errors = [];
    this.messages = {};
    this.portTypes = {};
    this.bindings = {};
    this.services = [];
    this.schemaIndex = { element: {}, complexType: {}, simpleType: {}, group: {}, attributeGroup: {}, attribute: {} };
    this.nsPrefixHints = {};
    this.load(bundle.documents || []);
  }

  Wsdl.prototype.load = function (documents) {
    var self = this;
    var parser = new DOMParser();
    documents.forEach(function (d) {
      var info = { url: d.url, status: d.status, error: d.error || '', size: 0 };
      self.docs.push(info);
      if (!d.b64) { if (!info.error) info.error = t('wsdl.noContent'); return; }
      var bytes = ZL.util.base64ToBytes(d.b64);
      info.size = bytes.length;
      if (d.status && (d.status < 200 || d.status >= 300)) { info.error = info.error || 'HTTP ' + d.status; return; }
      var text = ZL.util.decodeXmlBytes(bytes, ZL.util.charsetOf(d.contentType));
      var doc = parser.parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror')[0]) {
        info.error = t('wsdl.xmlError');
        self.errors.push(d.url + ': ' + t('wsdl.xmlError'));
        return;
      }
      self.collectPrefixes(doc.documentElement);
      self.loadRoot(doc.documentElement);
    });
  };

  Wsdl.prototype.collectPrefixes = function (element) {
    var self = this;
    function scan(e) {
      for (var i = 0; i < e.attributes.length; i++) {
        var a = e.attributes[i];
        if (a.prefix === 'xmlns' && a.value && !self.nsPrefixHints[a.value]) self.nsPrefixHints[a.value] = a.localName;
      }
    }
    scan(element);
    var schemas = element.getElementsByTagNameNS(NS.xsd, 'schema');
    for (var i = 0; i < schemas.length; i++) scan(schemas[i]);
  };

  Wsdl.prototype.loadRoot = function (root) {
    var self = this;
    if (root.namespaceURI === NS.xsd && root.localName === 'schema') { self.addSchema(root); return; }
    if (root.namespaceURI === NS.wsdl20) { self.errors.push(t('wsdl.wsdl20')); return; }
    if (root.namespaceURI !== NS.wsdl || root.localName !== 'definitions') return;
    var tns = root.getAttribute('targetNamespace') || '';

    kids(root, NS.wsdl, 'types').forEach(function (types) {
      kids(types, NS.xsd, 'schema').forEach(function (schema) { self.addSchema(schema); });
    });
    kids(root, NS.wsdl, 'message').forEach(function (m) {
      self.messages[qkey(tns, m.getAttribute('name'))] = {
        name: m.getAttribute('name'),
        parts: kids(m, NS.wsdl, 'part').map(function (p) {
          return { name: p.getAttribute('name'), element: qname(p, p.getAttribute('element')),
                   type: qname(p, p.getAttribute('type')) };
        })
      };
    });
    kids(root, NS.wsdl, 'portType').forEach(function (portType) {
      var ops = {};
      kids(portType, NS.wsdl, 'operation').forEach(function (op) {
        var input = kid(op, NS.wsdl, 'input');
        var output = kid(op, NS.wsdl, 'output');
        ops[op.getAttribute('name')] = {
          input: input ? qname(input, input.getAttribute('message')) : null,
          output: output ? qname(output, output.getAttribute('message')) : null,
          doc: (kid(op, NS.wsdl, 'documentation') || {}).textContent || ''
        };
      });
      self.portTypes[qkey(tns, portType.getAttribute('name'))] = { name: portType.getAttribute('name'), ops: ops };
    });
    kids(root, NS.wsdl, 'binding').forEach(function (b) {
      var soapBinding = kid(b, NS.soap11, 'binding');
      var version = '1.1';
      var soapNs = NS.soap11;
      if (!soapBinding) { soapBinding = kid(b, NS.soap12, 'binding'); version = '1.2'; soapNs = NS.soap12; }
      if (!soapBinding) return; /* HTTP or another non-SOAP binding */
      var style = soapBinding.getAttribute('style') || 'document';
      var ops = kids(b, NS.wsdl, 'operation').map(function (op) {
        var soapOp = kid(op, soapNs, 'operation');
        var input = kid(op, NS.wsdl, 'input');
        var body = input ? kid(input, soapNs, 'body') : null;
        var headers = input ? kids(input, soapNs, 'header').map(function (header) {
          return { message: qname(header, header.getAttribute('message')), part: header.getAttribute('part') };
        }) : [];
        return {
          name: op.getAttribute('name'),
          soapAction: soapOp ? (soapOp.getAttribute('soapAction') || '') : '',
          style: (soapOp && soapOp.getAttribute('style')) || style,
          use: body ? (body.getAttribute('use') || 'literal') : 'literal',
          namespace: body ? (body.getAttribute('namespace') || '') : '',
          parts: body && body.getAttribute('parts') != null
            ? body.getAttribute('parts').split(/\s+/).filter(Boolean) : null,
          headers: headers
        };
      });
      self.bindings[qkey(tns, b.getAttribute('name'))] = {
        name: b.getAttribute('name'), tns: tns, version: version, style: style,
        type: qname(b, b.getAttribute('type')), ops: ops
      };
    });
    kids(root, NS.wsdl, 'service').forEach(function (service) {
      var ports = kids(service, NS.wsdl, 'port').map(function (port) {
        var address = kid(port, NS.soap11, 'address') || kid(port, NS.soap12, 'address');
        return { name: port.getAttribute('name'), binding: qname(port, port.getAttribute('binding')),
                 address: address ? address.getAttribute('location') : '' };
      });
      self.services.push({ name: service.getAttribute('name'), ports: ports });
    });
  };

  Wsdl.prototype.addSchema = function (schema) {
    var self = this;
    var tns = schema.getAttribute('targetNamespace') || '';
    var context = {
      tns: tns,
      qualified: schema.getAttribute('elementFormDefault') === 'qualified',
      attrQualified: schema.getAttribute('attributeFormDefault') === 'qualified'
    };
    for (var child = schema.firstElementChild; child; child = child.nextElementSibling) {
      if (child.namespaceURI !== NS.xsd) continue;
      var index = self.schemaIndex[child.localName];
      if (!index || !child.getAttribute('name')) continue;
      var key = qkey(tns, child.getAttribute('name'));
      if (!index[key]) index[key] = { node: child, ctx: context };
    }
  };

  /* Global schema component; falls back to the local name (chameleon includes, sloppy WSDLs) */
  Wsdl.prototype.lookup = function (kind, q) {
    if (!q) return null;
    var index = this.schemaIndex[kind];
    var hit = index[qkey(q.ns, q.local)];
    if (hit) return hit;
    var suffix = '}' + q.local;
    var found = null;
    for (var key in index) {
      if (key.slice(-suffix.length) === suffix) { if (found) return found; found = index[key]; }
    }
    return found;
  };

  /* SOAP bindings with their operations and endpoints (navigator level "interface") */
  Wsdl.prototype.interfaces = function () {
    var self = this;
    var out = [];
    var byName = {};
    Object.keys(self.bindings).forEach(function (key) {
      var b = self.bindings[key];
      var entry = { name: b.name, key: key, binding: b, endpoints: [], ports: [],
                    ops: b.ops.map(function (o) { return o.name; }).sort(function (x, y) { return x.localeCompare(y); }) };
      byName[key] = entry;
      out.push(entry);
    });
    self.services.forEach(function (service) {
      service.ports.forEach(function (port) {
        var entry = port.binding ? byName[qkey(port.binding.ns, port.binding.local)] : null;
        if (!entry) return;
        entry.ports.push({ service: service.name, name: port.name, address: port.address });
        if (port.address && entry.endpoints.indexOf(port.address) < 0) entry.endpoints.push(port.address);
      });
    });
    return out.sort(function (x, y) { return x.name.localeCompare(y.name); });
  };

  Wsdl.prototype.findInterface = function (name) {
    var all = this.interfaces();
    for (var i = 0; i < all.length; i++) if (all[i].name === name) return all[i];
    return null;
  };

  Wsdl.prototype.endpoints = function () {
    var out = [];
    this.services.forEach(function (service) {
      service.ports.forEach(function (port) { if (port.address && out.indexOf(port.address) < 0) out.push(port.address); });
    });
    return out;
  };

  Wsdl.prototype.firstServiceName = function () {
    return this.services.length ? this.services[0].name : '';
  };

  Wsdl.qkey = qkey;
  Wsdl.qname = qname;
  Wsdl.kids = kids;
  Wsdl.kid = kid;
  Wsdl.Refs = Refs;
  return Wsdl;
})();

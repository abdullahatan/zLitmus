/* ======================================================================
 * zLitmus - sample request generator
 * "?" placeholders and "Optional:", "Zero or more repetitions:", CHOICE comments stay in English
 * on purpose: they are the usual markers of SOAP sample requests.
 * ==================================================================== */
ZL.Generator = (function () {
  var NS = ZL.NS;
  var Wsdl = ZL.Wsdl;
  var qkey = Wsdl.qkey;
  var qname = Wsdl.qname;
  var kids = Wsdl.kids;
  var kid = Wsdl.kid;
  var indent = ZL.Xml.indent;
  var MAX_DEPTH = 30;
  var RESERVED_PREFIX = /^(soap|soap12|soapenv|soapenc|wsdl|xsd|xs|xsi|http|mime|xml|xmlns|wsp|wsu|wsam|wsaw|wsx|ns\d*|tns|s|q\d+)$/i;

  function Generator(wsdl) {
    this.w = wsdl;
    this.prefixOf = {};
    this.used = { soapenv: true, xml: true, xmlns: true, xsi: true };
    this.order = [];
  }

  Generator.prototype.prefix = function (ns) {
    if (!ns) return '';
    if (this.prefixOf[ns]) return this.prefixOf[ns];
    var hint = this.w.nsPrefixHints[ns];
    var prefix = hint && !RESERVED_PREFIX.test(hint) && /^[A-Za-z_][\w\-]{0,15}$/.test(hint) ? hint : '';
    if (!prefix) {
      if (/^urn:/i.test(ns)) prefix = 'urn';
      else {
        var match = /^[a-z]+:\/\/(?:www\.)?([^\/:.]+)/i.exec(ns);
        prefix = match ? match[1].replace(/[^A-Za-z]/g, '').substring(0, 3).toLowerCase() : 'ns';
        if (!prefix) prefix = 'ns';
      }
    }
    var base = prefix;
    var n = 1;
    while (this.used[prefix]) prefix = base + (n++);
    this.used[prefix] = true;
    this.prefixOf[ns] = prefix;
    this.order.push(ns);
    return prefix;
  };

  Generator.prototype.tag = function (name, ns) {
    var prefix = this.prefix(ns);
    return prefix ? prefix + ':' + name : name;
  };

  function occurs(element) {
    var min = element.getAttribute('minOccurs');
    var max = element.getAttribute('maxOccurs');
    return { min: min == null ? 1 : parseInt(min, 10),
             max: max == null ? 1 : (max === 'unbounded' ? Infinity : parseInt(max, 10)) };
  }

  function occursComment(o) {
    if (o.max > 1) {
      if (o.min === 0) return 'Zero or more repetitions:';
      return o.min === 1 ? '1 or more repetitions:' : o.min + ' or more repetitions:';
    }
    return o.min === 0 ? 'Optional:' : null;
  }

  /* out: array of [depth, text] */
  Generator.prototype.element = function (element, ctx, depth, out, stack) {
    var occ = occurs(element);
    var ref = element.getAttribute('ref');
    if (ref) {
      var global = this.w.lookup('element', qname(element, ref));
      if (!global) { out.push([depth, '<!--Unknown element: ' + ref + '-->']); return; }
      this.declared(global.node, global.ctx, global.ctx.tns, depth, out, stack, occ);
      return;
    }
    var form = element.getAttribute('form');
    var qualified = form ? form === 'qualified' : ctx.qualified;
    this.declared(element, ctx, qualified ? ctx.tns : '', depth, out, stack, occ);
  };

  /* One element declaration with namespace ns */
  Generator.prototype.declared = function (decl, ctx, ns, depth, out, stack, occ) {
    var name = decl.getAttribute('name');
    var comment = occ ? occursComment(occ) : null;
    if (comment) out.push([depth, '<!--' + comment + '-->']);
    var tag = this.tag(name, ns);
    if (depth > MAX_DEPTH) { out.push([depth, '<' + tag + '>?</' + tag + '>']); return; }
    var typeAttr = decl.getAttribute('type');
    var inlineComplex = kid(decl, NS.xsd, 'complexType');
    var inlineSimple = kid(decl, NS.xsd, 'simpleType');
    if (inlineComplex) { this.complexElement(tag, inlineComplex, ctx, depth, out, stack); return; }
    if (inlineSimple || !typeAttr) { out.push([depth, '<' + tag + '>?</' + tag + '>']); return; }
    this.typed(tag, qname(decl, typeAttr), depth, out, stack);
  };

  /* Element named tag with the content of the named type q */
  Generator.prototype.typed = function (tag, q, depth, out, stack) {
    if (!q || q.ns === NS.xsd) { out.push([depth, '<' + tag + '>?</' + tag + '>']); return; }
    var complex = this.w.lookup('complexType', q);
    if (complex) {
      var key = qkey(q.ns, q.local);
      if (stack.indexOf(key) >= 0) {
        out.push([depth, '<!--Recursive type (' + q.local + '), not expanded-->']);
        out.push([depth, '<' + tag + '/>']);
        return;
      }
      this.complexElement(tag, complex.node, complex.ctx, depth, out, stack.concat([key]));
      return;
    }
    out.push([depth, '<' + tag + '>?</' + tag + '>']);
  };

  Generator.prototype.complexElement = function (tag, complex, ctx, depth, out, stack) {
    var content = { attrs: [], lines: [], simple: false };
    this.complexContent(complex, ctx, depth + 1, content, stack);
    var attrs = content.attrs.map(function (a) { return ' ' + a + '="?"'; }).join('');
    if (content.simple) { out.push([depth, '<' + tag + attrs + '>?</' + tag + '>']); return; }
    if (!content.lines.length) { out.push([depth, '<' + tag + attrs + '/>']); return; }
    out.push([depth, '<' + tag + attrs + '>']);
    Array.prototype.push.apply(out, content.lines);
    out.push([depth, '</' + tag + '>']);
  };

  Generator.prototype.complexContent = function (complex, ctx, depth, content, stack) {
    var self = this;
    for (var c = complex.firstElementChild; c; c = c.nextElementSibling) {
      if (c.namespaceURI !== NS.xsd) continue;
      switch (c.localName) {
        case 'sequence': case 'all': case 'choice': case 'group':
          self.particle(c, ctx, depth, content.lines, stack); break;
        case 'attribute': self.attribute(c, ctx, content); break;
        case 'attributeGroup': self.attributeGroup(c, content); break;
        case 'complexContent': self.derived(c, ctx, depth, content, stack); break;
        case 'simpleContent': self.simpleContent(c, ctx, depth, content, stack); break;
        default: break;
      }
    }
  };

  Generator.prototype.derived = function (node, ctx, depth, content, stack) {
    var extension = kid(node, NS.xsd, 'extension');
    var restriction = kid(node, NS.xsd, 'restriction');
    if (extension) {
      var base = qname(extension, extension.getAttribute('base'));
      var baseType = base && base.ns !== NS.xsd ? this.w.lookup('complexType', base) : null;
      if (baseType) {
        var key = qkey(base.ns, base.local);
        if (stack.indexOf(key) < 0) this.complexContent(baseType.node, baseType.ctx, depth, content, stack.concat([key]));
      }
      this.complexContent(extension, ctx, depth, content, stack);
    } else if (restriction) {
      this.complexContent(restriction, ctx, depth, content, stack);
    }
  };

  Generator.prototype.simpleContent = function (node, ctx, depth, content, stack) {
    var self = this;
    content.simple = true;
    var derivation = kid(node, NS.xsd, 'extension') || kid(node, NS.xsd, 'restriction');
    if (!derivation) return;
    var base = qname(derivation, derivation.getAttribute('base'));
    var baseType = base && base.ns !== NS.xsd ? self.w.lookup('complexType', base) : null;
    if (baseType) {
      var inherited = { attrs: [], lines: [], simple: true };
      self.complexContent(baseType.node, baseType.ctx, depth, inherited, stack);
      Array.prototype.push.apply(content.attrs, inherited.attrs);
    }
    kids(derivation, NS.xsd, 'attribute').forEach(function (a) { self.attribute(a, ctx, content); });
    kids(derivation, NS.xsd, 'attributeGroup').forEach(function (a) { self.attributeGroup(a, content); });
  };

  Generator.prototype.particle = function (node, ctx, depth, out, stack) {
    var self = this;
    if (node.localName === 'group') {
      var ref = node.getAttribute('ref');
      var group = ref ? self.w.lookup('group', qname(node, ref)) : null;
      if (!group) return;
      var groupKey = 'group:' + ref;
      if (stack.indexOf(groupKey) >= 0) return;
      kids(group.node, NS.xsd).forEach(function (c) {
        if (c.localName === 'sequence' || c.localName === 'choice' || c.localName === 'all') {
          self.particle(c, group.ctx, depth, out, stack.concat([groupKey]));
        }
      });
      return;
    }
    var list = kids(node, NS.xsd);
    if (node.localName === 'choice') {
      var count = list.filter(function (c) { return c.localName !== 'annotation'; }).length;
      out.push([depth, '<!--You have a CHOICE of the next ' + count + ' items at this level-->']);
    }
    list.forEach(function (c) {
      switch (c.localName) {
        case 'element': self.element(c, ctx, depth, out, stack); break;
        case 'sequence': case 'choice': case 'all': case 'group': self.particle(c, ctx, depth, out, stack); break;
        case 'any': out.push([depth, '<!--You may enter ANY elements at this point-->']); break;
        default: break;
      }
    });
  };

  Generator.prototype.attribute = function (a, ctx, content) {
    var ref = a.getAttribute('ref');
    if (ref) {
      var q = qname(a, ref);
      content.attrs.push(this.tag(q.local, q.ns));
      return;
    }
    if (a.getAttribute('use') === 'prohibited') return;
    var name = a.getAttribute('name');
    if (!name) return;
    var form = a.getAttribute('form');
    var qualified = form ? form === 'qualified' : ctx.attrQualified;
    content.attrs.push(qualified && ctx.tns ? this.tag(name, ctx.tns) : name);
  };

  Generator.prototype.attributeGroup = function (a, content) {
    var self = this;
    var group = self.w.lookup('attributeGroup', qname(a, a.getAttribute('ref')));
    if (!group) return;
    kids(group.node, NS.xsd, 'attribute').forEach(function (x) { self.attribute(x, group.ctx, content); });
    kids(group.node, NS.xsd, 'attributeGroup').forEach(function (x) { self.attributeGroup(x, content); });
  };

  /* One message part inside Body or Header */
  Generator.prototype.part = function (part, rpc, depth, out) {
    if (part.element) {
      var global = this.w.lookup('element', part.element);
      if (!global) { out.push([depth, '<!--Element not found: ' + part.element.local + '-->']); return; }
      if (rpc) { this.declaredAs(part.name, global, depth, out); return; }
      this.declared(global.node, global.ctx, global.ctx.tns, depth, out, [], null);
      return;
    }
    this.typed(part.name, part.type, depth, out, []);
  };

  /* rpc with an element part: accessor named after the part, content of the element */
  Generator.prototype.declaredAs = function (name, global, depth, out) {
    var typeAttr = global.node.getAttribute('type');
    var complex = kid(global.node, NS.xsd, 'complexType');
    if (complex) this.complexElement(name, complex, global.ctx, depth, out, []);
    else this.typed(name, typeAttr ? qname(global.node, typeAttr) : null, depth, out, []);
  };

  Generator.prototype.bindingOperation = function (binding, operationName) {
    for (var i = 0; i < binding.ops.length; i++) if (binding.ops[i].name === operationName) return binding.ops[i];
    return null;
  };

  /* Full envelope of an operation of a binding: {xml, soapAction, version, style, doc} or null */
  Generator.prototype.envelope = function (binding, operationName) {
    var w = this.w;
    var self = this;
    var op = this.bindingOperation(binding, operationName);
    if (!op) return null;
    var portType = binding.type ? w.portTypes[qkey(binding.type.ns, binding.type.local)] : null;
    var portOp = portType ? portType.ops[operationName] : null;
    var message = portOp && portOp.input ? w.messages[qkey(portOp.input.ns, portOp.input.local)] : null;
    var rpc = op.style === 'rpc';

    var header = [];
    op.headers.forEach(function (h) {
      var headerMessage = h.message ? w.messages[qkey(h.message.ns, h.message.local)] : null;
      if (!headerMessage) return;
      headerMessage.parts.forEach(function (p) { if (p.name === h.part) self.part(p, false, 2, header); });
    });

    var body = [];
    var parts = message ? message.parts : [];
    if (op.parts) parts = parts.filter(function (p) { return op.parts.indexOf(p.name) >= 0; });
    if (rpc) {
      var wrapper = this.tag(operationName, op.namespace || binding.tns);
      if (!parts.length) body.push([2, '<' + wrapper + '/>']);
      else {
        body.push([2, '<' + wrapper + '>']);
        parts.forEach(function (p) { self.part(p, true, 3, body); });
        body.push([2, '</' + wrapper + '>']);
      }
    } else {
      parts.forEach(function (p) { self.part(p, false, 2, body); });
    }

    var envelopeNs = binding.version === '1.2' ? NS.env12 : NS.env11;
    var declarations = ' xmlns:soapenv="' + envelopeNs + '"';
    this.order.forEach(function (ns) { declarations += ' xmlns:' + self.prefixOf[ns] + '="' + ZL.util.esc(ns) + '"'; });
    var lines = ['<soapenv:Envelope' + declarations + '>'];
    if (header.length) {
      lines.push('   <soapenv:Header>');
      header.forEach(function (l) { lines.push(indent(l[0]) + l[1]); });
      lines.push('   </soapenv:Header>');
    } else {
      lines.push('   <soapenv:Header/>');
    }
    lines.push('   <soapenv:Body>');
    body.forEach(function (l) { lines.push(indent(l[0]) + l[1]); });
    lines.push('   </soapenv:Body>');
    lines.push('</soapenv:Envelope>');
    return { xml: lines.join('\n'), soapAction: op.soapAction, version: binding.version, style: op.style,
             doc: portOp ? portOp.doc : '' };
  };

  /* Envelope with a fresh generator (prefixes are per request) */
  function sample(wsdl, binding, operationName) {
    return new Generator(wsdl).envelope(binding, operationName);
  }

  /* Content-Type and SOAPAction of SOAP 1.1 / 1.2 (charset = encoding of the request body) */
  function autoHeaders(version, soapAction, charset) {
    var cs = charset || 'UTF-8';
    if (version === '1.2') {
      return [{ name: 'Content-Type',
                value: 'application/soap+xml;charset=' + cs + (soapAction ? ';action="' + soapAction + '"' : '') }];
    }
    return [{ name: 'Content-Type', value: 'text/xml;charset=' + cs },
            { name: 'SOAPAction', value: '"' + (soapAction || '') + '"' }];
  }

  /* Automatic headers first; a user header with the same name replaces the automatic one */
  function effectiveHeaders(auto, user) {
    var names = (user || []).filter(function (h) { return h.name; }).map(function (h) { return h.name.toLowerCase(); });
    return auto.filter(function (h) { return names.indexOf(h.name.toLowerCase()) < 0; })
      .concat((user || []).filter(function (h) { return h.name; }));
  }

  Generator.sample = sample;
  Generator.autoHeaders = autoHeaders;
  Generator.effectiveHeaders = effectiveHeaders;
  return Generator;
})();

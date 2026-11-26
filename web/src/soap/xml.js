/* ======================================================================
 * zLitmus - XML pretty print, highlight and SOAP fault detection
 * ==================================================================== */
ZL.Xml = (function () {
  var esc = ZL.util.esc;
  var ENVELOPE_11 = 'http://schemas.xmlsoap.org/soap/envelope/';
  var ENVELOPE_12 = 'http://www.w3.org/2003/05/soap-envelope';

  function indent(depth) { return new Array(depth + 1).join('   '); }

  function parse(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    return doc.getElementsByTagName('parsererror').length ? null : doc;
  }

  /* Indented XML, or null when the text is no well-formed XML */
  function pretty(text) {
    var source = String(text || '').trim();
    if (!source || source.charAt(0) !== '<') return null;
    var doc = parse(source);
    if (!doc) return null;
    var out = [];
    var declaration = /^<\?xml[^>]*\?>/.exec(source);
    if (declaration) out.push(declaration[0]);

    function attributes(element) {
      var text = '';
      for (var i = 0; i < element.attributes.length; i++) {
        text += ' ' + element.attributes[i].name + '="' + esc(element.attributes[i].value) + '"';
      }
      return text;
    }

    function walk(node, depth) {
      var pad = indent(depth);
      if (node.nodeType === 8) { out.push(pad + '<!--' + node.nodeValue + '-->'); return; }
      if (node.nodeType === 4) { out.push(pad + '<![CDATA[' + node.nodeValue + ']]>'); return; }
      if (node.nodeType === 7) { out.push(pad + '<?' + node.target + ' ' + node.data + '?>'); return; }
      if (node.nodeType !== 1) return;
      var name = node.nodeName;
      var children = Array.prototype.filter.call(node.childNodes, function (child) {
        return !(child.nodeType === 3 && !child.nodeValue.trim());
      });
      if (!children.length) { out.push(pad + '<' + name + attributes(node) + '/>'); return; }
      var onlyText = children.every(function (child) { return child.nodeType === 3; });
      if (onlyText) {
        var value = children.map(function (child) { return child.nodeValue; }).join('');
        out.push(pad + '<' + name + attributes(node) + '>' + esc(value).replace(/&quot;/g, '"') + '</' + name + '>');
        return;
      }
      out.push(pad + '<' + name + attributes(node) + '>');
      children.forEach(function (child) {
        if (child.nodeType === 3) out.push(indent(depth + 1) + esc(child.nodeValue.trim()).replace(/&quot;/g, '"'));
        else walk(child, depth + 1);
      });
      out.push(pad + '</' + name + '>');
    }

    Array.prototype.forEach.call(doc.childNodes, function (node) { walk(node, 0); });
    return out.join('\n');
  }

  /* HTML with spans: t = tag, a = attribute name, v = attribute value, c = comment / CDATA / PI */
  function highlight(text) {
    var tokens = /(<!--[\s\S]*?-->)|(<!\[CDATA\[[\s\S]*?\]\]>)|(<\?[\s\S]*?\?>)|(<\/?[^\s>\/]+)((?:\s+[^\s=>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)(\s*)(\/?>)|([^<]+)|(<)/g;
    var out = '';
    var match;
    while ((match = tokens.exec(text))) {
      if (match[1] || match[2] || match[3]) out += '<span class="c">' + esc(match[0]) + '</span>';
      else if (match[4]) {
        out += '<span class="t">' + esc(match[4]) + '</span>';
        if (match[5]) {
          out += match[5].replace(/([^\s=]+)(\s*=\s*)("[^"]*"|'[^']*')/g, function (all, name, equals, value) {
            return '<span class="a">' + esc(name) + '</span>' + equals + '<span class="v">' + esc(value) + '</span>';
          });
        }
        out += esc(match[6]) + '<span class="t">' + esc(match[7]) + '</span>';
      } else out += esc(match[0]);
      if (tokens.lastIndex === match.index) tokens.lastIndex++;
    }
    return out;
  }

  /* "SOAP Fault [code]: text" of a response, '' when there is none */
  function faultOf(text) {
    try {
      var doc = parse(String(text || '').trim());
      if (!doc) return '';
      var fault = doc.getElementsByTagNameNS(ENVELOPE_11, 'Fault')[0] || doc.getElementsByTagNameNS(ENVELOPE_12, 'Fault')[0];
      if (!fault) return '';
      var code = '';
      var reason = '';
      for (var child = fault.firstElementChild; child; child = child.nextElementSibling) {
        if (child.localName === 'faultcode' || child.localName === 'Code') code = child.textContent.trim().replace(/\s+/g, ' ');
        if (child.localName === 'faultstring' || child.localName === 'Reason') reason = child.textContent.trim();
      }
      return 'SOAP Fault' + (code ? ' [' + code + ']' : '') + (reason ? ': ' + reason : '');
    } catch (e) { return ''; }
  }

  return { pretty: pretty, highlight: highlight, faultOf: faultOf, indent: indent, parse: parse,
           ENVELOPE_11: ENVELOPE_11, ENVELOPE_12: ENVELOPE_12 };
})();

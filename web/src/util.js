/* ======================================================================
 * zLitmus - utilities
 * ==================================================================== */
var ZL = window.ZL || {};
window.ZL = ZL;

ZL.util = (function () {
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* h('div', {class: 'x', onclick: fn, text: 'a'}, [child, 'text']) */
  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      var value = attrs[name];
      if (value == null || value === false) return;
      if (name === 'text') node.textContent = value;
      else if (name === 'html') node.innerHTML = value;
      else if (name === 'class') node.className = value;
      else if (name.indexOf('on') === 0 && typeof value === 'function') node.addEventListener(name.substring(2), value);
      else if (name === 'value') node.value = value;
      else if (name === 'checked' || name === 'disabled' || name === 'selected') node[name] = !!value;
      else node.setAttribute(name, value === true ? '' : value);
    });
    [].concat(children == null ? [] : children).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function bytesToBase64(bytes) {
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    if (!base64) return new Uint8Array(0);
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function utf8(text) { return new TextEncoder().encode(String(text == null ? '' : text)); }
  function toBase64(text) { return bytesToBase64(utf8(text)); }

  function decodeBytes(bytes, charset) {
    var name = (charset || 'utf-8').toLowerCase();
    try { return new TextDecoder(name).decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); }
  }

  function fromBase64(base64) { return decodeBytes(base64ToBytes(base64), 'utf-8'); }

  function charsetOf(contentType) {
    var match = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType || '');
    return match ? match[1] : '';
  }

  /* XML documents may declare their own encoding (<?xml ... encoding="ISO-8859-9"?>) */
  function decodeXmlBytes(bytes, headerCharset) {
    if (headerCharset) return decodeBytes(bytes, headerCharset);
    var head = '';
    for (var i = 0; i < Math.min(bytes.length, 200); i++) head += String.fromCharCode(bytes[i]);
    var match = /encoding\s*=\s*["']([A-Za-z0-9_\-]+)["']/.exec(head);
    return decodeBytes(bytes, match ? match[1] : 'utf-8');
  }

  function byteLength(text) { return utf8(text).length; }

  /* 32 hex characters, like SYSUUID_C32 */
  function uuid() {
    var bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(bytes, function (b) { return (b < 16 ? '0' : '') + b.toString(16); })
      .join('').toUpperCase();
  }

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

  function time() {
    var d = new Date();
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
  }

  function formatTimestamp(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  return {
    $: $, esc: esc, h: h, clear: clear, utf8: utf8, toBase64: toBase64, fromBase64: fromBase64,
    bytesToBase64: bytesToBase64, base64ToBytes: base64ToBytes, decodeBytes: decodeBytes,
    decodeXmlBytes: decodeXmlBytes, charsetOf: charsetOf, byteLength: byteLength, uuid: uuid,
    clone: clone, time: time, formatTimestamp: formatTimestamp
  };
})();

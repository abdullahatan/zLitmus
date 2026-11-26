/* ======================================================================
 * zLitmus - bridge to ABAP (SAPEVENT) and to the browser mock
 * Page -> ABAP: form POST to "sapevent:<ACTION>", field "payload" = base64 of lines
 *               "KEY TAB NAME TAB base64(value)" (V = value, H = HTTP header).
 *               Every action carries "V ui" (the state of the page, JSON).
 * ABAP -> page: the whole page is shown again; the boot JSON holds the answer ("reply"),
 *               the state ("ui64") and the WSDL documents of the open projects ("workspace64").
 * ==================================================================== */
ZL.Bridge = (function () {
  var util = ZL.util;
  var boot = readBoot();
  var waitTimer = null;
  var NETWORK_ACTIONS = ['PROJECT_CREATE', 'PROJECT_REFRESH_WSDL', 'REQUEST_SEND', 'PAGE_INSTALL', 'FILE_EXPORT',
                         'WSDL_BROWSE'];
  var LOCAL_WAIT_MS = 20000;

  function readBoot() {
    var node = util.$('zlitmus-boot');
    var raw = node ? node.textContent.trim() : '';
    if (!raw || raw.indexOf('__') === 0) return { runtime: 'browser' };
    try { return JSON.parse(raw); } catch (e) { return { runtime: 'browser', bootError: String(e) }; }
  }

  function isSap() { return boot.runtime === 'sap'; }

  /* lines: [[key, name, value]] -> base64 of "KEY\tNAME\tbase64(value)" rows */
  function encode(lines) {
    return util.toBase64(lines.map(function (line) {
      return line[0] + '\t' + line[1] + '\t' + util.toBase64(line[2] == null ? '' : String(line[2]));
    }).join('\n'));
  }

  /* values: {name: value}, headers: [{name, value}] */
  function linesOf(values, headers) {
    var lines = [['V', 'ui', ZL.State.snapshot()]];
    Object.keys(values || {}).forEach(function (name) { lines.push(['V', name, values[name]]); });
    (headers || []).forEach(function (h) { lines.push(['H', h.name, h.value]); });
    return lines;
  }

  function busy(on, text) {
    util.$('busyText').textContent = text || ZL.i18n.t('busy.working');
    util.$('busy').hidden = !on;
  }

  function send(action, values, headers, busyText) {
    var lines = linesOf(values, headers);
    busy(true, busyText);
    if (!isSap()) {
      return ZL.Mock.handle(action, lines).then(function (result) {
        busy(false);
        ZL.App.receive(result);
      }, function (error) {
        busy(false);
        ZL.App.receive({ reply: { kind: action.toLowerCase(), ok: false, message: String(error) },
                         message: { type: 'E', text: String(error) } });
      });
    }
    var form = util.$('bridgeForm');
    form.action = 'sapevent:' + action;
    form.elements.payload.value = encode(lines);
    form.submit();
    /* ABAP answers by showing the page again; if nothing comes back, do not stay blocked. Only actions that go
       to the network (WSDL, request) may take as long as the HTTP timeout. */
    var settings = ZL.App.settings() || {};
    clearTimeout(waitTimer);
    waitTimer = setTimeout(function () {
      busy(false);
      ZL.App.toast(ZL.i18n.t('bridge.noAnswer'), 'E');
    }, NETWORK_ACTIONS.indexOf(action) >= 0 ? ((settings.timeoutSec || 60) + 30) * 1000 : LOCAL_WAIT_MS);
    return Promise.resolve();
  }

  /* Quiet state update for ABAP (no busy overlay, no page reload): only "ui" */
  function sync() {
    if (!isSap() || !util.$('busy').hidden) return;
    var form = util.$('bridgeForm');
    form.action = 'sapevent:UI_SYNC';
    form.elements.payload.value = encode([['V', 'ui', ZL.State.snapshot()]]);
    form.submit();
  }

  function decodeJson(base64) {
    if (!base64) return null;
    try { return JSON.parse(util.fromBase64(base64)); } catch (e) { return null; }
  }

  return {
    boot: function () { return boot; },
    isSap: isSap,
    encode: encode,
    linesOf: linesOf,
    send: send,
    sync: sync,
    busy: busy,
    decodeJson: decodeJson
  };
})();

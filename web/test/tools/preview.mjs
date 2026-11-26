// Writes preview pages (SAP boot) for visual checks with a headless browser: node test/tools/preview.mjs <dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { distFile, loadPage, settled } from '../helpers.mjs';

const out = process.argv[2];
const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

const mock = loadPage({ lang: 'tr' });
mock.ZL.App.run('file.new');
const url = mock.document.getElementById('newProjectUrl');
url.value = 'mock://fixtures/calc.wsdl';
url.dispatchEvent(new mock.window.Event('input', { bubbles: true }));
mock.document.querySelector('#modalRoot .btn.primary').dispatchEvent(new mock.window.MouseEvent('click', { bubbles: true }));
await settled(mock);
const project = mock.ZL.State.get().projects[0];
mock.ZL.App.openRequest(project.requests[0].requestId);
const ui = mock.ZL.State.snapshot();
const workspace = JSON.stringify({ projects: [{ projectId: project.header.projectId,
                                                wsdl: mock.ZL.State.wsdlBundle(project.header.projectId) }] });
mock.window.close();

const html = readFileSync(distFile, 'utf8');
for (const theme of ['light', 'dark']) {
  for (const [name, reply] of [['props', null],
                               ['dialog', { kind: 'auth_required', ok: false, action: 'PROJECT_CREATE',
                                            url: 'http://host:8000/x?wsdl', host: 'host:8000',
                                            realm: 'SAP NetWeaver Application Server [DEV/100]' }],
                               ['newproject', { kind: 'wsdl_file', ok: true, url: 'file:///C:/WSDL/demo_service.wsdl' }]]) {
    const boot = { runtime: 'sap', version: '1.1.0', lang: 'tr', user: 'TESTER', system: 'DEV/100',
                   settings: { timeoutSec: 60, sslId: 'ANONYM', proxyHost: '', proxyPort: '',
                               uiPrefs: JSON.stringify({ theme }) },
                   ui64: b64(ui.replace('"theme":"light"', '"theme":"' + theme + '"')), workspace64: b64(workspace),
                   projects: [], message: null, reply };
    writeFileSync(join(out, `${name}-${theme}.html`), html.replace('__ZLITMUS_BOOT__', () => JSON.stringify(boot)));
  }
}
console.log('ok');
process.exit(0);

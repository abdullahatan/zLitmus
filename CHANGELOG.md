# Changelog

## 1.1.0 — 2026-11-26

User feedback after the first SAP GUI test.

### ABAP (`$ZLITMUS`)
- `ZLITMUS_REQ`: `DESCRIPTION`, `ENCODING`; `ZLITMUS_PROJ`: `ENDPOINTS_JSON` (endpoints added by the user per binding).
- Request bodies are sent in the code page of the request (`CL_ABAP_CONV_CODEPAGE`), UTF-8 by default.
- New action `PREFS_SAVE` (saves the page preferences at once, e.g. the theme); boot JSON carries the user's projects.
- An answer that is not a WSDL (e.g. SAP `<error>` document with HTTP 200) is refused with its error text.
- SAP GUI Back / Exit / Cancel with unsaved work asks the page first (`UI_SYNC`, `exit_check`).
- No SAP GUI function keys or menus: GUI status `ZLITMUS_MAIN` (optional); page menu actions `PAGE_REFRESH`,
  `PAGE_INSTALL`, fallback page while the page is not installed; `FILE_EXPORT` saves XML on the PC.
- `ZCL_LITMUS_FILE_CLIENT`: file: URLs from the PC (only for a local WSDL), others from the network.
- 65 ABAP Unit tests.

### Page
- Project name derived from the WSDL address, unique among the saved projects.
- Saved projects are listed in the navigator at the start and open with a double-click.
- Properties panel titles per node (Project / Interface / Operation / Request Properties); operation details from
  the WSDL (description, type, input, output).
- Editable request properties: name, description, encoding, endpoint (list), timeout, authentication, user, password
  (session only).
- Binding window: Overview, Service Endpoints (add / edit / remove / assign to all requests), WSDL Content.
- Light and dark theme switch, remembered per user.
- Menus open with the mouse again (they closed at once); unavailable items are dimmed.
- Properties as two resizable columns (label | value); toolbar without "Open".
- Exit asks "Save and exit | Cancel | Exit without saving".
- Dark theme dialogs and menus: lighter elevated surface, border and scrim.
- Light logo with the name in the top bar; Refresh / Install page in the page menu.
- Resizable request | response divider; coloured request XML editor; export of request and response as XML.
- Sample requests of a new project are saved after the page has loaded (the early save could get lost in
  SAP GUI); shorter wait for local actions; WSDL download time in the message.
- New SOAP Project from a WSDL file of the PC (Browse…, or a typed Windows path); XSD files next to it are read too.
- 59 Node tests (incl. replies recorded from the real service).

## 1.0.0 — 2026-11-26

First release (phase 1: SOAP).

### ABAP (`$ZLITMUS`)
- Program `ZLITMUS`: selection screen 1001 with the HTML control, F1 refresh page, F2 install / update page.
- Projects, requests, user settings and audit log in tables `ZLITMUS_PROJ`, `ZLITMUS_REQ`, `ZLITMUS_USET`, `ZLITMUS_LOG`;
  projects belong to their owner, WSDL documents are cached compressed.
- HTTP client on `CL_HTTP_CLIENT`: SSL client identity, proxy, timeout, preemptive Basic authentication, duration,
  SSL / ICM / DNS / connection hints, `Authorization` masked.
- WSDL loader: `wsdl:import`, `xsd:import`, `xsd:include`, `xsd:redefine`, at most 40 documents, 401 → authentication.
- Page bridge (SAPEVENT payload, boot JSON) and action handler (`PROJECT_*`, `REQUEST_SEND`, `SETTINGS_SAVE`, `EXIT`).
- TR / EN texts (`ZCL_LITMUS_TEXTS`), error class `ZCX_LITMUS_ERROR` (ZCX_RETURN3).
- 53 ABAP Unit tests.

### Page (`web/dist/zlitmus.html`)
- Project workspace layout: menu bar, toolbar, navigator, properties, tabbed request windows, log panel.
- New SOAP Project with Basic Authentication dialog, sample requests, automatic save; open, save, save all, close,
  rename, delete, update definition (stale requests marked).
- Request editor (XML / Raw, Auth, Headers with automatic SOAP 1.1 / 1.2 headers) and response view (formatted XML, raw,
  headers, sent request, SOAP fault, hints, result mark, response time and size).
- Preferences (timeout, SSL ID, proxy), user guide, keyboard shortcuts, about.
- Browser mock mode with embedded sample WSDLs.
- 29 Node tests (jsdom): texts, menus, WSDL template snapshots, bridge payloads, end-to-end mock flow.

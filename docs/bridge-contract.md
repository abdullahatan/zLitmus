# zLitmus — Köprü sözleşmesi (Page ⇄ ABAP)

Bu belge sayfa (`web/src/bridge.js`, `web/src/app.js`) ile ABAP (`ZCL_LITMUS_BRIDGE`, `ZIF_LITMUS_ACTION_HANDLER`,
`ZCL_LITMUS_ACTION_HANDLER`) arasındaki tek doğruluk kaynağıdır. İki taraf da testlerle buna bağlıdır:

| Kontrol | Nerede |
|---|---|
| `Bridge.encode` çıktısı ABAP testindeki referans yükle birebir aynı | `web/test/bridge.test.mjs` ↔ `ZCL_LITMUS_BRIDGE` › `payload_lines_from_page` |
| Sayfanın ürettiği REQUEST_SEND yükü ABAP'ta doğru çözülüyor (form kodlaması, Türkçe karakter, `+/=`) | `web/test/bridge.test.mjs` ↔ `ZCL_LITMUS_BRIDGE` › `request_send_from_page` |
| Sayfanın gönderdiği her eylem `ZIF_LITMUS_ACTION_HANDLER=>action` içinde var | `web/test/bridge.test.mjs` |
| Eylem işleyicinin yanıt şekilleri | `ZCL_LITMUS_ACTION_HANDLER` test sınıfı |

## 1. Sayfa → ABAP

- Form `POST`, `action="sapevent:<EYLEM>"`, tek alan `payload`.
- `payload` = base64( satırlar `\n` ile ), satır = `ANAHTAR \t AD \t base64(değer)`; base64 hep UTF-8 üzerinden.
- `ANAHTAR`: `V` değer, `H` HTTP header (sırası korunur).
- Her eylem ilk satır olarak `V ui` taşır: sayfanın bütün durumu (JSON, `ZL.State`). ABAP bunu oturum belleğinde tutar ve
  bir sonraki gösterimde `ui64` olarak geri verir; veritabanına yazılmaz.
- Herhangi bir eylem `V prefs` taşıyabilir (JSON: panel boyutları, satır kaydırma, yerleşim, son projeler, tema `light`/`dark`). ABAP bunu
  `ZLITMUS_USET-UI_PREFS`'e yazar.

### Eylemler ve değerleri

| Eylem | `V` değerleri | `H` | Yanıt `kind` |
|---|---|---|---|
| `PROJECT_LIST` | – | – | `projects` |
| `PROJECT_CREATE` | `name` (boş olabilir), `wsdl_url`, `wsdl_user`, `wsdl_pass`, `create_samples` (`true`/`false`) | – | `project` / `auth_required` |
| `PROJECT_OPEN` | `project_id` | – | `project` |
| `PROJECT_SAVE` | `project` (JSON, §3) | – | `saved` |
| `PROJECT_RENAME` | `project_id`, `name` | – | `saved` |
| `PROJECT_REFRESH_WSDL` | `project_id`, `wsdl_url`, `wsdl_user`, `wsdl_pass` | – | `project` / `auth_required` |
| `PROJECT_DELETE` | `project_id` | – | `deleted` |
| `PROJECT_CLOSE` | `project_id` | – | `closed` |
| `REQUEST_SEND` | `project_id`, `request_id`, `method` (`POST`), `url`, `body`, `auth_type` (`NONE`/`BASIC`), `user`, `pass`, `timeout` (sn, boş = ayar), `encoding` (gövde kod sayfası, boş = UTF-8) | etkin header'lar (otomatik + kullanıcı) | `response` |
| `PREFS_SAVE` | `prefs` (yalnız tercihleri yazar; ör. tema değişince hemen) | – | `prefs` |
| `UI_SYNC` | yalnız `ui` (sessiz durum eşitleme; ABAP saklar, yanıt vermez, sayfa yenilenmez) | – | – |
| `PAGE_REFRESH` | – (ABAP sayfayı yeniden gösterir) | – | – |
| `PAGE_INSTALL` | – (ABAP PAI'de dosya seçtirir, sayfayı kurar ve gösterir; kurulu değilken yedek sayfadan da gelir) | – | – |
| `FILE_EXPORT` | `file_name`, `content` (ABAP PAI'de kaydetme diyaloğu, UTF-8) | – | – |
| `WSDL_BROWSE` | – (ABAP PAI'de dosya açma penceresi) | – | `wsdl_file` (`ok`, `url`) |
| `SETTINGS_SAVE` | `settings` (JSON: `timeoutSec`, `sslId`, `proxyHost`, `proxyPort`, `uiPrefs`) | – | `settings` |
| `EXIT` | – | – | (`exit`, ABAP `ZLX_EXIT` ile ekrandan çıkar) |

Şifreler (`wsdl_pass`, `pass`) yalnız bu eylemde kullanılır; hiçbir tabloya, loga veya yanıta yazılmaz.

## 2. ABAP → Sayfa

Bütün sayfa yeniden gösterilir; `__ZLITMUS_BOOT__` işaretinin yerine boot JSON konur (`<` her yerde JSON kaçışıyla):

```json
{ "runtime": "sap", "version": "1.0.0", "lang": "tr|en", "user": "…", "system": "SID/client",
  "settings": { "timeoutSec": 60, "sslId": "ANONYM", "proxyHost": "", "proxyPort": "", "uiPrefs": "{…}" },
  "ui64": "<base64 ui JSON>", "workspace64": "<base64 çalışma alanı JSON>",
  "projects": [ { "projectId", "name", "wsdlUrl", "changedAt", "requestCount" } ],
  "message": { "type": "S|W|E", "text": "…" } | null,
  "reply": { "kind": "…", "ok": true, "message": "…", … } | null }
```

`workspace64` = `{"projects":[{"projectId","wsdl":{"url","loadedAt","documents":[{"url","status","contentType","error","b64"}]}}]}`
— yalnız oturumda açık projelerin WSDL belgeleri. Sayfa bunları geri göndermez.

`projects` = kullanıcının kayıtlı projeleri (`PROJECT_LIST` ile aynı satırlar). Sayfa bunları açılışta gezginde
kapalı düğümler olarak gösterir; çift tıklama / açma `PROJECT_OPEN` gönderir.

### Yanıt alanları (`reply`, camelCase)

| `kind` | Alanlar |
|---|---|
| hepsi | `kind`, `ok`, `message` |
| `projects` | `projects[]{projectId, name, wsdlUrl, changedAt, requestCount}` |
| `project`, `saved` | `project{header, requests[]}` (§3), `project` için ayrıca `createSamples` |
| `auth_required` | `action`, `url`, `host`, `realm` (`ok` = false) |
| `deleted`, `closed` | `projectId` |
| `response` | `projectId`, `requestId`, `status`, `reason`, `timeMs`, `size`, `headers[]{n,v}`, `body64`, `hint`, `request{method, url, headers[]{n,v}}` (`Authorization` = `Basic ********`) |
| `settings` | `settings{…}` |
| `prefs` | – |
| `exit_check` | – (SAP GUI çıkışında kaydedilmemiş iş: sayfa çıkış sorusunu sorar) |
| hata | `kind` = eylem adı küçük harf, `ok` = false, `message` |

## 3. Proje JSON'u

ABAP tipi `ZIF_LITMUS_TYPES=>project` ile aynı şekil:

```json
{ "header": { "projectId": "32 hex", "owner": "…", "projectType": "SOAP", "name": "…", "wsdlUrl": "…",
              "wsdlLoadedAt": "ISO", "createdBy": "…", "createdAt": "ISO", "changedBy": "…", "changedAt": "ISO",
              "endpoints": [ { "interfaceName": "binding adı", "url": "…" } ] },
  "requests": [ { "requestId": "32 hex", "projectId": "…", "interfaceName": "binding adı", "operation": "…",
                  "name": "Request 1", "position": 1, "endpoint": "…", "body": "…",
                  "headers": [ { "name": "…", "value": "…" } ], "authType": "NONE|BASIC", "authUser": "…",
                  "timeoutSec": 0, "description": "…", "encoding": "UTF-8|ISO-8859-9|…" } ] }
```

`PROJECT_SAVE` ile sayfa yalnız `header.projectId`, `header.endpoints` ve `requests[]` alanlarını gönderir (zaman damgaları gönderilmez,
gönderilirse yok sayılır). Yeni isteklerin `requestId`'si sayfada üretilir (32 hex); listede olmayan kayıtlı istekler silinir.

`header.endpoints`: kullanıcının binding penceresinde (Service Endpoints) eklediği adresler; `ZLITMUS_PROJ-ENDPOINTS_JSON`
alanında saklanır. WSDL'deki adresler burada tutulmaz (WSDL'den okunur). `encoding` boşsa UTF-8 kullanılır.

`wsdl_url` bir `file:` adresiyse (`file:///C:/…`) `PROJECT_CREATE` / `PROJECT_REFRESH_WSDL` ABAP'ta PAI'de çalışır ve belgeler
kullanıcının PC'sinden okunur (D-023).

/* ======================================================================
 * zLitmus - texts (Turkish when the SAP logon language is TR, English otherwise)
 * Both dictionaries must have the same keys (checked by web/test/i18n.test.mjs).
 * ==================================================================== */
ZL.i18n = (function () {
  var dict = {
    tr: {
      'btn.ok': 'Tamam', 'btn.cancel': 'İptal', 'btn.close': 'Kapat', 'btn.yes': 'Evet', 'btn.no': 'Hayır',
      'btn.save': 'Kaydet',

      'props.title.project': 'Proje Özellikleri', 'props.title.binding': 'Interface Özellikleri',
      'props.title.operation': 'Operasyon Özellikleri', 'props.title.request': 'Request Özellikleri',
      'props.title.catalog': 'Kayıtlı Proje', 'props.description': 'Açıklama', 'props.operation': 'Operasyon',
      'props.type': 'Tür', 'props.input': 'Girdi', 'props.output': 'Çıktı', 'props.requestResponse': 'İstek-Yanıt',
      'props.oneWay': 'Tek yönlü', 'props.password': 'Şifre', 'props.default': 'varsayılan',
      'props.passwordHint': 'Şifre yalnızca bu oturumda tutulur, projeyle kaydedilmez.',
      'props.openHint': 'Açmak için çift tıklayın.', 'props.calculated': 'gövdeden hesaplanır',
      'nav.requests': '{count} istek',
      'cmd.view.theme': 'Koyu Tema', 'theme.label': 'Tema', 'theme.toLight': 'Açık temaya geç',
      'theme.toDark': 'Koyu temaya geç', 'theme.light': 'Açık', 'theme.dark': 'Koyu',
      'binding.overview': 'Genel Bakış', 'binding.endpoints': 'Servis Endpoint\'leri', 'binding.wsdl': 'WSDL İçeriği',
      'binding.definition': 'WSDL Tanımı', 'binding.wsdlUrl': 'WSDL adresi', 'binding.namespace': 'Namespace',
      'binding.parts': 'Tanım Parçaları', 'binding.operations': 'Operasyonlar', 'binding.use': 'Kullanım',
      'binding.oneWay': 'Tek yönlü', 'binding.action': 'Action', 'binding.endpoint': 'Endpoint',
      'binding.source': 'Kaynak', 'binding.fromWsdl': 'WSDL', 'binding.userAdded': 'Kullanıcı', 'binding.add': 'Ekle',
      'binding.remove': 'Sil', 'binding.assign': 'Tüm isteklere ata',
      'binding.assigned': '{count} isteğin endpoint\'i değiştirildi.', 'binding.newEndpoint': 'Yeni endpoint adresi',
      'binding.exists': 'Bu endpoint zaten listede.', 'binding.noDocs': 'WSDL belgesi yok (WSDL\'i güncelleyin).',
      'binding.status': 'Durum', 'binding.size': 'Boyut', 'binding.missing': 'Binding WSDL\'de bulunamadı.',
      'binding.title': 'Binding',
      'busy.working': 'Çalışıyor…', 'busy.saving': 'Kaydediliyor…', 'busy.sending': 'İstek gönderiliyor…',
      'busy.loadingWsdl': 'WSDL indiriliyor…', 'busy.opening': 'Proje açılıyor…', 'busy.loading': 'Yükleniyor…',
      'bridge.noAnswer': 'SAP tarafından yanıt gelmedi.',
      'session.mock': 'Tarayıcı modu (SAP yok)',

      'menu.file': 'Dosya', 'menu.project': 'Proje', 'menu.request': 'İstek', 'menu.view': 'Görünüm', 'menu.help': 'Yardım',
      'cmd.file.new': 'Yeni SOAP Projesi', 'cmd.file.open': 'Proje Aç…', 'cmd.file.save': 'Kaydet',
      'cmd.file.saveAll': 'Tümünü Kaydet', 'cmd.file.close': 'Projeyi Kapat', 'cmd.file.preferences': 'Ayarlar…',
      'cmd.file.exit': 'Çıkış', 'cmd.page.refresh': 'Sayfayı Yenile', 'cmd.page.install': 'Sayfayı Kur / Güncelle…',
      'cmd.project.refresh': 'WSDL\'i Güncelle', 'cmd.project.rename': 'Yeniden Adlandır', 'cmd.project.delete': 'Projeyi Sil',
      'cmd.request.new': 'Yeni İstek', 'cmd.request.clone': 'İsteği Kopyala', 'cmd.request.rename': 'Yeniden Adlandır',
      'cmd.request.delete': 'İsteği Sil', 'cmd.request.recreate': 'Şablonu Yeniden Üret',
      'cmd.request.format': 'XML\'i Biçimlendir', 'cmd.request.exportRequest': 'İsteği XML Olarak Dışa Aktar…', 'cmd.request.exportResponse': 'Yanıtı XML Olarak Dışa Aktar…', 'tb.export': 'Dışa aktar', 'request.resize': 'Sürükleyerek boyutlandırın (çift tıklama: eşit)', 'cmd.request.send': 'Gönder',
      'cmd.view.navigator': 'Gezgin', 'cmd.view.properties': 'Özellikler Paneli', 'cmd.view.log': 'Log Paneli',
      'cmd.view.wrap': 'Satır Kaydır', 'cmd.view.layout': 'İstek-Yanıt Yerleşimi (yan yana / alt alta)',
      'cmd.help.guide': 'Kullanım Kılavuzu', 'cmd.help.shortcuts': 'Klavye Kısayolları', 'cmd.help.about': 'Hakkında',

      'tb.newSoap': 'Yeni SOAP', 'tb.save': 'Kaydet', 'tb.saveAll': 'Tümünü Kaydet', 'tb.send': 'Gönder',
      'tb.preferences': 'Ayarlar', 'tb.format': 'Biçimlendir', 'tb.recreate': 'Şablon',

      'nav.title': 'Gezgin', 'nav.empty': 'Açık proje yok. Dosya > Yeni SOAP Projesi ile başlayın.',
      'nav.noWsdl': '(WSDL yok)', 'nav.open': 'Aç',
      'props.title': 'Özellikler', 'props.colLabel': 'Başlık', 'props.colValue': 'Değer', 'props.resize': 'Sütun genişliğini değiştirmek için sürükleyin', 'props.empty': 'Gezginde bir düğüm seçin.', 'props.name': 'Ad',
      'props.definitionUrl': 'Tanım adresi', 'props.documents': 'Belge sayısı', 'props.cached': 'Önbellekte',
      'props.requests': 'İstek sayısı', 'props.changedAt': 'Değişiklik', 'props.binding': 'Binding',
      'props.unknown': '(WSDL\'de yok)', 'props.soapVersion': 'SOAP sürümü', 'props.style': 'Stil', 'props.yes': 'Evet',
      'props.no': 'Hayır', 'props.soapAction': 'SOAPAction', 'props.use': 'Kullanım', 'props.messageSize': 'Mesaj boyutu',
      'props.encoding': 'Kodlama', 'props.endpoint': 'Endpoint', 'props.timeout': 'Zaman aşımı',
      'props.username': 'Kullanıcı adı', 'props.authType': 'Yetki türü',
      'unit.bytes': 'bayt',

      'log.app': 'zLitmus log', 'log.http': 'HTTP log', 'log.error': 'Hata log',
      'tab.start': 'Başlangıç', 'tab.raw': 'Ham', 'tab.auth': 'Yetki', 'tab.headers': 'Headers',
      'tab.sentRequest': 'Gönderilen istek',

      'start.newTitle': 'Yeni SOAP Projesi', 'start.newText': 'WSDL adresinden proje oluşturun; örnek istekler hazırlanır.',
      'start.openTitle': 'Proje Aç', 'start.openText': 'Kaydettiğiniz projelerden birini açın.',
      'start.recent': 'Son açılan projeler', 'start.noRecent': 'Henüz proje açılmadı.',
      'start.mockNote': 'Tarayıcı modu: SAP bağlantısı yok. Örnek WSDL\'ler için mock://fixtures/calc.wsdl gibi adresler kullanılabilir.',

      'request.title': 'İstek', 'request.endpoint': 'Endpoint adresi', 'request.timeout': 'Zaman aşımı (sn)',
      'request.missing': 'İstek bulunamadı (proje kapatılmış olabilir).',
      'request.stale': 'Bu isteğin operasyonu güncel WSDL\'de yok (eski).',
      'request.copyOf': '{name} kopyası', 'request.noSample': 'WSDL\'de bu operasyon için şablon üretilemedi.',
      'request.recreateConfirm': 'İstek gövdesi WSDL\'den yeniden üretilecek. Mevcut gövde silinir. Devam edilsin mi?',
      'request.notXml': 'İstek gövdesi geçerli bir XML değil.', 'request.noEndpoint': 'Endpoint adresi boş.',
      'response.title': 'Yanıt', 'response.none': 'Henüz yanıt yok. Gönder (Ctrl+Enter).',
      'response.waiting': 'Yanıt bekleniyor…', 'response.time': 'yanıt süresi: {ms} ms ({bytes} bayt)',
      'result.waiting': 'Bekliyor', 'result.pass': 'Başarılı', 'result.fail': 'Başarısız',
      'auth.none': 'Yok', 'auth.type': 'Yetki türü', 'auth.user': 'Kullanıcı', 'auth.password': 'Şifre',
      'auth.passwordNote': 'Şifre hiçbir yere kaydedilmez; ekran kapanınca silinir.',
      'auth.title': 'Basic Authentication', 'auth.required': '{host} için yetki gerekli', 'auth.realm': 'Alan (realm): {realm}',
      'headers.auto': 'Otomatik header (aynı adla eklediğiniz header bunun yerine geçer)', 'headers.name': 'Ad',
      'headers.value': 'Değer', 'headers.remove': 'Sil', 'headers.add': 'Header ekle',

      'newProject.title': 'Yeni SOAP Projesi', 'newProject.name': 'Proje adı', 'newProject.wsdl': 'Başlangıç WSDL\'i',
      'newProject.samples': 'Bütün operasyonlar için örnek istek oluştur',
      'newProject.namePlaceholder': 'WSDL adresinden üretilir',
      'newProject.nameHint': 'Adres SAP sunucusu üzerinden indirilir; dosya bu PC\'den okunur (yanındaki XSD dosyalarıyla birlikte).', 'newProject.browse': 'Gözat…', 'newProject.wsdlPlaceholder': 'https://host/service?wsdl veya bir .wsdl dosyası', 'busy.choosingFile': 'Dosya seçiliyor…',
      'openProject.title': 'Proje Aç', 'openProject.empty': 'Kayıtlı proje yok.', 'openProject.open': 'Aç',
      'openProject.meta': '{count} istek · {date}',
      'close.title': 'Projeyi Kapat', 'close.unsaved': '"{name}" projesinde kaydedilmemiş değişiklikler var.',
      'close.save': 'Kaydet', 'close.discard': 'Kaydetme',
      'delete.project': '"{name}" projesi ve bütün istekleri silinsin mi?', 'delete.request': '"{name}" isteği silinsin mi?',
      'exit.unsaved': '{count} projede kaydedilmemiş değişiklik var.', 'exit.title': 'Kaydedilmemiş çalışma', 'exit.lost': 'Ekrandaki çalışmalarınız kaydedilmedi. Kaydetmeden çıkarsanız bu değişiklikler kaybolacak.', 'exit.save': 'Kaydet ve çık', 'exit.discard': 'Kaydetmeden çık', 'exit.cancel': 'İptal',
      'status.unsaved': '{count} proje kaydedilmedi',

      'settings.title': 'Ayarlar', 'settings.timeout': 'Zaman aşımı (sn)', 'settings.ssl': 'SSL istemci kimliği',
      'settings.sslOther': 'Diğer…', 'settings.proxyHost': 'Proxy sunucu', 'settings.proxyPort': 'Proxy port',
      'settings.note': 'SSL kimliği STRUST\'taki istemci PSE\'sidir (ANONYM / DFAULT).',

      'msg.saved': 'Kaydedildi.', 'msg.deleted': 'Silindi.', 'msg.failed': 'İşlem başarısız.',
      'msg.samples': '{count} örnek istek oluşturuldu.', 'msg.stale': '{count} isteğin operasyonu WSDL\'de artık yok (eski).',
      'msg.sending': '{name} gönderiliyor: {url}',

      'wsdl.noContent': 'İçerik yok', 'wsdl.xmlError': 'XML okunamadı', 'wsdl.wsdl20': 'WSDL 2.0 desteklenmiyor (sadece WSDL 1.1).',
      'mock.wsdlFailed': 'WSDL alınamadı (tarayıcı modu): {error}', 'mock.notWsdl': 'Adres bir WSDL döndürmedi (kök öğe: {root}). {error}', 'mock.nameExists': 'Bu adla bir proje zaten var: {name}',
      'mock.wsdlLoaded': 'WSDL yüklendi ({count} belge).', 'mock.notFound': 'Proje bulunamadı.',
      'mock.exit': 'Tarayıcı modunda çıkış yok; sekmeyi kapatabilirsiniz.', 'mock.unknownAction': 'Bilinmeyen işlem: {action}',

      'guide.start.title': '1. Proje oluşturun',
      'guide.start.text': 'Dosya > Yeni SOAP Projesi: proje adını ve WSDL adresini girin. WSDL ve import ettiği belgeler SAP sunucusundan indirilir, her operasyon için "Request 1" hazırlanır ve proje kaydedilir. WSDL yetki isterse Basic Authentication penceresi açılır.',
      'guide.request.title': '2. İsteği düzenleyin ve gönderin',
      'guide.request.text': 'Gezginde isteğe çift tıklayın. "?" yer tutucularını doldurun, endpoint\'i seçin veya yazın, gerekirse Headers ve Yetki sekmelerini kullanın. Gönder (Ctrl+Enter): yanıt sağda; durum işareti yeşil (başarılı), kırmızı (hata, Fault, zaman aşımı) veya gri (bekliyor) olur.',
      'guide.save.title': '3. Kaydedin',
      'guide.save.text': 'Değişen projeler * ile işaretlenir. Ctrl+S veya Dosya > Kaydet. Şifreler kaydedilmez, kullanıcı adları kaydedilir.',
      'guide.auth.title': 'Yetki ve ayarlar',
      'guide.auth.text': 'Basic yetki ilk istekle gönderilir. Ayarlar: zaman aşımı, SSL istemci kimliği (STRUST), proxy.',
      'guide.errors.title': 'Sık hatalar',
      'guide.errors.text': 'SSL: sertifika zinciri STRUST\'a eklenmeli. ICM: SMICM\'de HTTP/HTTPS servisi aktif olmalı. Bağlantı: firewall veya proxy. Boş sayfa: tarayıcı denetimi Edge olmalı.',
      'shortcuts.menu': 'Menüyü aç (altı çizili harf)', 'shortcuts.tree': 'Gezginde gezin, aç/kapat',
      'shortcuts.escape': 'Menüyü / pencereyi kapat',
      'about.version': 'Sürüm {version} · The litmus test for your SAP web services.',
      'about.license': 'MIT lisansı.',
      'about.credits': 'ZCX_RETURN3 (c) Alwin van de Put, MIT. Logo yazısı: Space Grotesk (SIL OFL 1.1).'
    },
    en: {
      'btn.ok': 'OK', 'btn.cancel': 'Cancel', 'btn.close': 'Close', 'btn.yes': 'Yes', 'btn.no': 'No',
      'btn.save': 'Save',

      'props.title.project': 'Project Properties', 'props.title.binding': 'Interface Properties',
      'props.title.operation': 'Operation Properties', 'props.title.request': 'Request Properties',
      'props.title.catalog': 'Saved Project', 'props.description': 'Description', 'props.operation': 'Operation',
      'props.type': 'Type', 'props.input': 'Input', 'props.output': 'Output', 'props.requestResponse': 'Request-Response',
      'props.oneWay': 'One-Way', 'props.password': 'Password', 'props.default': 'default',
      'props.passwordHint': 'The password is kept for this session only; it is not saved with the project.',
      'props.openHint': 'Double-click to open.', 'props.calculated': 'calculated from the body',
      'nav.requests': '{count} requests',
      'cmd.view.theme': 'Dark Theme', 'theme.label': 'Theme', 'theme.toLight': 'Switch to the light theme',
      'theme.toDark': 'Switch to the dark theme', 'theme.light': 'Light', 'theme.dark': 'Dark',
      'binding.overview': 'Overview', 'binding.endpoints': 'Service Endpoints', 'binding.wsdl': 'WSDL Content',
      'binding.definition': 'WSDL Definition', 'binding.wsdlUrl': 'WSDL URL', 'binding.namespace': 'Namespace',
      'binding.parts': 'Definition Parts', 'binding.operations': 'Operations', 'binding.use': 'Use',
      'binding.oneWay': 'One-Way', 'binding.action': 'Action', 'binding.endpoint': 'Endpoint',
      'binding.source': 'Source', 'binding.fromWsdl': 'WSDL', 'binding.userAdded': 'User', 'binding.add': 'Add',
      'binding.remove': 'Remove', 'binding.assign': 'Assign to all requests',
      'binding.assigned': 'The endpoint of {count} request(s) was changed.', 'binding.newEndpoint': 'New endpoint address',
      'binding.exists': 'This endpoint is already in the list.', 'binding.noDocs': 'No WSDL document (update the definition).',
      'binding.status': 'Status', 'binding.size': 'Size', 'binding.missing': 'The binding was not found in the WSDL.',
      'binding.title': 'Binding',
      'busy.working': 'Working…', 'busy.saving': 'Saving…', 'busy.sending': 'Sending request…',
      'busy.loadingWsdl': 'Loading WSDL…', 'busy.opening': 'Opening project…', 'busy.loading': 'Loading…',
      'bridge.noAnswer': 'No answer came from SAP.',
      'session.mock': 'Browser mode (no SAP)',

      'menu.file': 'File', 'menu.project': 'Project', 'menu.request': 'Request', 'menu.view': 'View', 'menu.help': 'Help',
      'cmd.file.new': 'New SOAP Project', 'cmd.file.open': 'Open Project…', 'cmd.file.save': 'Save',
      'cmd.file.saveAll': 'Save All', 'cmd.file.close': 'Close Project', 'cmd.file.preferences': 'Preferences…',
      'cmd.file.exit': 'Exit', 'cmd.page.refresh': 'Refresh Page', 'cmd.page.install': 'Install / Update Page…',
      'cmd.project.refresh': 'Update Definition', 'cmd.project.rename': 'Rename', 'cmd.project.delete': 'Delete Project',
      'cmd.request.new': 'New Request', 'cmd.request.clone': 'Clone Request', 'cmd.request.rename': 'Rename',
      'cmd.request.delete': 'Delete Request', 'cmd.request.recreate': 'Recreate Request',
      'cmd.request.format': 'Format XML', 'cmd.request.exportRequest': 'Export Request as XML…', 'cmd.request.exportResponse': 'Export Response as XML…', 'tb.export': 'Export', 'request.resize': 'Drag to resize (double-click: equal)', 'cmd.request.send': 'Submit',
      'cmd.view.navigator': 'Navigator', 'cmd.view.properties': 'Properties', 'cmd.view.log': 'Log',
      'cmd.view.wrap': 'Word Wrap', 'cmd.view.layout': 'Request-Response Layout (side by side / stacked)',
      'cmd.help.guide': 'User Guide', 'cmd.help.shortcuts': 'Keyboard Shortcuts', 'cmd.help.about': 'About',

      'tb.newSoap': 'New SOAP', 'tb.save': 'Save', 'tb.saveAll': 'Save All', 'tb.send': 'Submit',
      'tb.preferences': 'Preferences', 'tb.format': 'Format', 'tb.recreate': 'Template',

      'nav.title': 'Navigator', 'nav.empty': 'No open project. Start with File > New SOAP Project.',
      'nav.noWsdl': '(no WSDL)', 'nav.open': 'Open',
      'props.title': 'Properties', 'props.colLabel': 'Property', 'props.colValue': 'Value', 'props.resize': 'Drag to change the column width', 'props.empty': 'Select a node in the navigator.', 'props.name': 'Name',
      'props.definitionUrl': 'Definition URL', 'props.documents': 'Documents', 'props.cached': 'Cached',
      'props.requests': 'Requests', 'props.changedAt': 'Changed', 'props.binding': 'Binding',
      'props.unknown': '(not in the WSDL)', 'props.soapVersion': 'SOAP Version', 'props.style': 'Style', 'props.yes': 'Yes',
      'props.no': 'No', 'props.soapAction': 'SOAPAction', 'props.use': 'Use', 'props.messageSize': 'Message Size',
      'props.encoding': 'Encoding', 'props.endpoint': 'Endpoint', 'props.timeout': 'Timeout',
      'props.username': 'Username', 'props.authType': 'Authentication Type',
      'unit.bytes': 'bytes',

      'log.app': 'zLitmus log', 'log.http': 'HTTP log', 'log.error': 'Error log',
      'tab.start': 'Start', 'tab.raw': 'Raw', 'tab.auth': 'Auth', 'tab.headers': 'Headers',
      'tab.sentRequest': 'Sent request',

      'start.newTitle': 'New SOAP Project', 'start.newText': 'Create a project from a WSDL address; sample requests are prepared.',
      'start.openTitle': 'Open Project', 'start.openText': 'Open one of your saved projects.',
      'start.recent': 'Recent projects', 'start.noRecent': 'No project opened yet.',
      'start.mockNote': 'Browser mode: no SAP connection. Sample WSDLs are available at addresses like mock://fixtures/calc.wsdl.',

      'request.title': 'Request', 'request.endpoint': 'Endpoint address', 'request.timeout': 'Timeout (s)',
      'request.missing': 'Request not found (the project may be closed).',
      'request.stale': 'The operation of this request is not in the current WSDL (stale).',
      'request.copyOf': 'Copy of {name}', 'request.noSample': 'No template could be generated from the WSDL for this operation.',
      'request.recreateConfirm': 'The request body will be generated again from the WSDL. The current body is lost. Continue?',
      'request.notXml': 'The request body is no valid XML.', 'request.noEndpoint': 'The endpoint address is empty.',
      'response.title': 'Response', 'response.none': 'No response yet. Submit (Ctrl+Enter).',
      'response.waiting': 'Waiting for the response…', 'response.time': 'response time: {ms}ms ({bytes} bytes)',
      'result.waiting': 'Waiting', 'result.pass': 'Passed', 'result.fail': 'Failed',
      'auth.none': 'No Authorization', 'auth.type': 'Authorization', 'auth.user': 'Username', 'auth.password': 'Password',
      'auth.passwordNote': 'The password is never saved; it is removed when the screen is closed.',
      'auth.title': 'Basic Authentication', 'auth.required': 'Authentication required for {host}', 'auth.realm': 'Realm: {realm}',
      'headers.auto': 'Automatic header (a header you add with the same name replaces it)', 'headers.name': 'Name',
      'headers.value': 'Value', 'headers.remove': 'Remove', 'headers.add': 'Add header',

      'newProject.title': 'New SOAP Project', 'newProject.name': 'Project Name', 'newProject.wsdl': 'Initial WSDL',
      'newProject.samples': 'Create sample requests for all operations',
      'newProject.namePlaceholder': 'Taken from the WSDL address',
      'newProject.nameHint': 'An address is downloaded by the SAP server; a file is read from this PC (with the XSD files next to it).', 'newProject.browse': 'Browse…', 'newProject.wsdlPlaceholder': 'https://host/service?wsdl or a .wsdl file', 'busy.choosingFile': 'Choosing a file…',
      'openProject.title': 'Open Project', 'openProject.empty': 'There is no saved project.', 'openProject.open': 'Open',
      'openProject.meta': '{count} requests · {date}',
      'close.title': 'Close Project', 'close.unsaved': 'Project "{name}" has unsaved changes.',
      'close.save': 'Save', 'close.discard': 'Don\'t save',
      'delete.project': 'Delete project "{name}" with all its requests?', 'delete.request': 'Delete request "{name}"?',
      'exit.unsaved': '{count} project(s) have unsaved changes.', 'exit.title': 'Unsaved work', 'exit.lost': 'Your work on the screen is not saved. If you exit without saving, these changes are lost.', 'exit.save': 'Save and exit', 'exit.discard': 'Exit without saving', 'exit.cancel': 'Cancel',
      'status.unsaved': '{count} project(s) not saved',

      'settings.title': 'Preferences', 'settings.timeout': 'Timeout (s)', 'settings.ssl': 'SSL client identity',
      'settings.sslOther': 'Other…', 'settings.proxyHost': 'Proxy host', 'settings.proxyPort': 'Proxy port',
      'settings.note': 'The SSL identity is the client PSE in STRUST (ANONYM / DFAULT).',

      'msg.saved': 'Saved.', 'msg.deleted': 'Deleted.', 'msg.failed': 'The action failed.',
      'msg.samples': '{count} sample requests created.', 'msg.stale': 'The operation of {count} request(s) is no longer in the WSDL (stale).',
      'msg.sending': 'Sending {name}: {url}',

      'wsdl.noContent': 'No content', 'wsdl.xmlError': 'XML could not be read', 'wsdl.wsdl20': 'WSDL 2.0 is not supported (WSDL 1.1 only).',
      'mock.wsdlFailed': 'The WSDL could not be loaded (browser mode): {error}', 'mock.notWsdl': 'The address did not return a WSDL (root element: {root}). {error}', 'mock.nameExists': 'A project with this name already exists: {name}',
      'mock.wsdlLoaded': 'WSDL loaded ({count} documents).', 'mock.notFound': 'Project not found.',
      'mock.exit': 'There is no exit in browser mode; you can close the tab.', 'mock.unknownAction': 'Unknown action: {action}',

      'guide.start.title': '1. Create a project',
      'guide.start.text': 'File > New SOAP Project: enter a project name and the WSDL address. The WSDL and the documents it imports are downloaded by the SAP server, "Request 1" is prepared for every operation and the project is saved. When the WSDL needs authentication, the Basic Authentication dialog opens.',
      'guide.request.title': '2. Edit and submit a request',
      'guide.request.text': 'Double-click a request in the navigator. Fill in the "?" placeholders, choose or type the endpoint and use the Headers and Auth tabs when needed. Submit (Ctrl+Enter): the response appears on the right; the status mark turns green (passed), red (error, fault, timeout) or grey (waiting).',
      'guide.save.title': '3. Save',
      'guide.save.text': 'Changed projects are marked with *. Ctrl+S or File > Save. Passwords are never saved, user names are.',
      'guide.auth.title': 'Authentication and preferences',
      'guide.auth.text': 'Basic authentication is sent with the first request. Preferences: timeout, SSL client identity (STRUST), proxy.',
      'guide.errors.title': 'Common errors',
      'guide.errors.text': 'SSL: add the certificate chain in STRUST. ICM: an HTTP/HTTPS service must be active in SMICM. Connection: firewall or proxy. Empty page: the browser control must be Edge.',
      'shortcuts.menu': 'Open a menu (underlined letter)', 'shortcuts.tree': 'Move in the navigator, expand / collapse',
      'shortcuts.escape': 'Close the menu / dialog',
      'about.version': 'Version {version} · The litmus test for your SAP web services.',
      'about.license': 'MIT License.',
      'about.credits': 'ZCX_RETURN3 (c) Alwin van de Put, MIT. Logo lettering: Space Grotesk (SIL OFL 1.1).'
    }
  };
  var lang = 'en';

  function t(key, vars) {
    var text = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    return !vars ? text : text.replace(/\{(\w+)\}/g, function (all, name) {
      return vars[name] == null ? all : String(vars[name]);
    });
  }

  function setLang(value) {
    lang = dict[value] ? value : 'en';
    document.documentElement.lang = lang;
  }

  function apply(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n]'), function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
  }

  return { t: t, setLang: setLang, lang: function () { return lang; }, apply: apply, dict: dict };
})();

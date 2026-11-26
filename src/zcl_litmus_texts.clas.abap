"! <p class="shorttext synchronized">zLitmus - user texts (TR/EN)</p>
"! Every text a user can see comes from here: Turkish when the logon language is TR,
"! English in every other language. No message class is used (no SE63 translation).
CLASS zcl_litmus_texts DEFINITION
  PUBLIC
  FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    INTERFACES zif_litmus_texts.

    " Text keys. The value of every key equals its component name.
    CONSTANTS:
      BEGIN OF key,
        screen_title        TYPE string VALUE `SCREEN_TITLE`,
        fkey_refresh        TYPE string VALUE `FKEY_REFRESH`,
        fkey_install        TYPE string VALUE `FKEY_INSTALL`,
        page_not_installed  TYPE string VALUE `PAGE_NOT_INSTALLED`,
        page_installed      TYPE string VALUE `PAGE_INSTALLED`,
        no_file_selected    TYPE string VALUE `NO_FILE_SELECTED`,
        file_read_error     TYPE string VALUE `FILE_READ_ERROR`,
        file_saved          TYPE string VALUE `FILE_SAVED`,
        file_write_error    TYPE string VALUE `FILE_WRITE_ERROR`,
        page_invalid        TYPE string VALUE `PAGE_INVALID`,
        mime_write_error    TYPE string VALUE `MIME_WRITE_ERROR`,
        html_control_error  TYPE string VALUE `HTML_CONTROL_ERROR`,
        http_client_error   TYPE string VALUE `HTTP_CLIENT_ERROR`,
        icm_inactive        TYPE string VALUE `ICM_INACTIVE`,
        url_invalid         TYPE string VALUE `URL_INVALID`,
        connection_error    TYPE string VALUE `CONNECTION_ERROR`,
        hint_icm            TYPE string VALUE `HINT_ICM`,
        hint_ssl            TYPE string VALUE `HINT_SSL`,
        hint_timeout        TYPE string VALUE `HINT_TIMEOUT`,
        hint_dns            TYPE string VALUE `HINT_DNS`,
        hint_connection     TYPE string VALUE `HINT_CONNECTION`,
        wsdl_http_error     TYPE string VALUE `WSDL_HTTP_ERROR`,
        wsdl_auth_required  TYPE string VALUE `WSDL_AUTH_REQUIRED`,
        wsdl_empty          TYPE string VALUE `WSDL_EMPTY`,
        wsdl_not_wsdl       TYPE string VALUE `WSDL_NOT_WSDL`,
        wsdl_loaded         TYPE string VALUE `WSDL_LOADED`,
        wsdl_loaded_in      TYPE string VALUE `WSDL_LOADED_IN`,
        project_not_found   TYPE string VALUE `PROJECT_NOT_FOUND`,
        project_name_exists TYPE string VALUE `PROJECT_NAME_EXISTS`,
        project_name_empty  TYPE string VALUE `PROJECT_NAME_EMPTY`,
        not_authorized      TYPE string VALUE `NOT_AUTHORIZED`,
        saved               TYPE string VALUE `SAVED`,
        deleted             TYPE string VALUE `DELETED`,
        unknown_action      TYPE string VALUE `UNKNOWN_ACTION`,
        edge_required       TYPE string VALUE `EDGE_REQUIRED`,
        no_page_data        TYPE string VALUE `NO_PAGE_DATA`,
        invalid_data        TYPE string VALUE `INVALID_DATA`,
        database_error      TYPE string VALUE `DATABASE_ERROR`,
        request_done        TYPE string VALUE `REQUEST_DONE`,
      END OF key.

    CONSTANTS turkish TYPE sylangu VALUE 'T'.

    "! Texts in Turkish for language T, in English for every other language
    CLASS-METHODS create
      IMPORTING
        language      TYPE sylangu
      RETURNING
        VALUE(result) TYPE REF TO zif_litmus_texts.

  PRIVATE SECTION.
    TYPES:
      BEGIN OF entry,
        text_key TYPE string,
        turkish  TYPE string,
        english  TYPE string,
      END OF entry.
    TYPES catalog_entries TYPE HASHED TABLE OF entry WITH UNIQUE KEY text_key.

    DATA in_turkish TYPE abap_bool.
    DATA catalog TYPE catalog_entries.

    METHODS constructor
      IMPORTING
        language TYPE sylangu.

    METHODS screen_texts
      RETURNING
        VALUE(result) TYPE catalog_entries.

    METHODS network_texts
      RETURNING
        VALUE(result) TYPE catalog_entries.

    METHODS project_texts
      RETURNING
        VALUE(result) TYPE catalog_entries.

ENDCLASS.



CLASS zcl_litmus_texts IMPLEMENTATION.

  METHOD create.
    result = NEW zcl_litmus_texts( language ).
  ENDMETHOD.


  METHOD constructor.
    in_turkish = xsdbool( language = turkish ).
    INSERT LINES OF screen_texts( ) INTO TABLE catalog.
    INSERT LINES OF network_texts( ) INTO TABLE catalog.
    INSERT LINES OF project_texts( ) INTO TABLE catalog.
  ENDMETHOD.


  METHOD zif_litmus_texts~get.
    DATA(entry) = VALUE #( catalog[ text_key = text_key ] OPTIONAL ).
    IF entry IS INITIAL.
      result = text_key.
      RETURN.
    ENDIF.
    result = COND #( WHEN in_turkish = abap_true THEN entry-turkish ELSE entry-english ).
  ENDMETHOD.


  METHOD zif_litmus_texts~format.
    result = zif_litmus_texts~get( text_key ).
    result = replace( val = result sub = `&1` with = variable_1 occ = 0 ).
    result = replace( val = result sub = `&2` with = variable_2 occ = 0 ).
  ENDMETHOD.


  METHOD zif_litmus_texts~raise_error.
    " Values are put into the text here, so long URLs are not cut to 50 characters (SYMSGV)
    DATA(error) = NEW zcx_litmus_error( ).
    error->add_text( iv_message    = CONV #( zif_litmus_texts~format( text_key   = text_key
                                                                      variable_1 = variable_1
                                                                      variable_2 = variable_2 ) )
                     iv_variable_1 = CONV #( variable_1 )
                     iv_variable_2 = CONV #( variable_2 )
                     iv_variable_3 = space
                     iv_variable_4 = space ).
    RAISE EXCEPTION error.
  ENDMETHOD.


  METHOD zif_litmus_texts~language_code.
    result = COND #( WHEN in_turkish = abap_true THEN `tr` ELSE `en` ).
  ENDMETHOD.


  METHOD screen_texts.
    result = VALUE #(
      ( text_key = key-screen_title
        turkish  = `zLitmus - SOAP servis test aracı`
        english  = `zLitmus - SOAP service test tool` )
      ( text_key = key-fkey_refresh
        turkish  = `Sayfayı yenile`
        english  = `Refresh page` )
      ( text_key = key-fkey_install
        turkish  = `Sayfayı kur / güncelle`
        english  = `Install / update page` )
      ( text_key = key-page_not_installed
        turkish  = `zLitmus sayfası kurulu değil: "Sayfayı kur / güncelle" ile web\dist\zlitmus.html dosyasını `
                && `yükleyin.`
        english  = `The zLitmus page is not installed: use "Install / update page" to upload `
                && `web\dist\zlitmus.html.` )
      ( text_key = key-page_installed
        turkish  = `zLitmus sayfası kuruldu / güncellendi.`
        english  = `The zLitmus page was installed / updated.` )
      ( text_key = key-no_file_selected
        turkish  = `Dosya seçilmedi.`
        english  = `No file was selected.` )
      ( text_key = key-file_read_error
        turkish  = `Dosya okunamadı: &1`
        english  = `The file could not be read: &1` )
      ( text_key = key-file_saved
        turkish  = `Dosya kaydedildi: &1`
        english  = `The file was saved: &1` )
      ( text_key = key-file_write_error
        turkish  = `Dosya yazılamadı: &1`
        english  = `The file could not be written: &1` )
      ( text_key = key-page_invalid
        turkish  = `Bu dosya zLitmus sayfası değil (web\dist\zlitmus.html seçilmeli).`
        english  = `This file is not the zLitmus page (select web\dist\zlitmus.html).` )
      ( text_key = key-mime_write_error
        turkish  = `Sayfa MIME deposuna yazılamadı (&1, hata &2).`
        english  = `The page could not be written to the MIME repository (&1, error &2).` )
      ( text_key = key-html_control_error
        turkish  = `HTML kontrolü oluşturulamadı veya sayfayı gösteremedi.`
        english  = `The HTML control could not be created or could not show the page.` )
      ( text_key = key-edge_required
        turkish  = `zLitmus için SAP GUI tarayıcı denetimi Edge (WebView2) olmalı: SAP GUI Seçenekleri > `
                && `Etkileşim Tasarımı > Denetim Ayarları > Tarayıcı Denetimi.`
        english  = `zLitmus needs the Edge (WebView2) browser control: SAP GUI Options > Interaction Design > `
                && `Control Settings > Browser Control.` )
      ( text_key = key-no_page_data
        turkish  = `SAP GUI sayfa verisini iletmedi (SAP GUI for Windows ve Edge tarayıcı denetimi gerekir).`
        english  = `SAP GUI did not pass the page data (SAP GUI for Windows with the Edge browser control is `
                && `required).` )
      ( text_key = key-invalid_data
        turkish  = `Sayfadan gelen veri okunamadı: &1`
        english  = `The data sent by the page could not be read: &1` )
      ( text_key = key-unknown_action
        turkish  = `Bilinmeyen işlem: &1`
        english  = `Unknown action: &1` ) ).
  ENDMETHOD.


  METHOD network_texts.
    result = VALUE #(
      ( text_key = key-http_client_error
        turkish  = `HTTP istemcisi oluşturulamadı (hata &1).`
        english  = `The HTTP client could not be created (error &1).` )
      ( text_key = key-icm_inactive
        turkish  = `Adresin protokolü (HTTP/HTTPS) için ICM'de aktif servis yok.`
        english  = `There is no active ICM service for the protocol of the address (HTTP/HTTPS).` )
      ( text_key = key-url_invalid
        turkish  = `Adres geçersiz: &1`
        english  = `Invalid address: &1` )
      ( text_key = key-connection_error
        turkish  = `İstek gönderilemedi (kod &1): &2`
        english  = `The request could not be sent (code &1): &2` )
      ( text_key = key-hint_icm
        turkish  = `SMICM > Git > Servisler: adresin protokolü (HTTP veya HTTPS) için bir servis aktif olmalı.`
        english  = `SMICM > Goto > Services: a service must be active for the protocol of the address `
                && `(HTTP or HTTPS).` )
      ( text_key = key-hint_ssl
        turkish  = `SSL hatası: hedef sunucunun sertifika zinciri (kök ve ara sertifikalar) STRUST'ta seçilen `
                && `SSL istemci PSE'sine (ANONYM veya DFAULT) eklenmeli; ardından ICM yeniden başlatılmalı `
                && `(SMICM > Yönetim > ICM > Yeniden başlat). Ayrıntı: SMICM > Git > İzleme dosyası.`
        english  = `SSL error: add the certificate chain of the target server (root and intermediate `
                && `certificates) to the SSL client PSE chosen in STRUST (ANONYM or DFAULT), then restart the `
                && `ICM (SMICM > Administration > ICM > Restart). Details: SMICM > Goto > Trace File.` )
      ( text_key = key-hint_timeout
        turkish  = `Zaman aşımı: Ayarlar'dan süreyi artırın. Sunucu hiç cevap vermiyorsa ağ ve firewall `
                && `erişimini kontrol edin.`
        english  = `Timeout: increase the timeout in the preferences. If the server never answers, check the `
                && `network and firewall access.` )
      ( text_key = key-hint_dns
        turkish  = `Sunucu adı çözülemedi: SAP sunucusu bu adı (DNS) tanımıyor. Adresi veya proxy ayarını kontrol `
                && `edin.`
        english  = `The host name could not be resolved: the SAP server does not know this name (DNS). Check `
                && `the address or the proxy settings.` )
      ( text_key = key-hint_connection
        turkish  = `Bağlantı kurulamadı: SAP sunucusundan &1 adresine firewall izni, port ve gerekiyorsa proxy `
                && `ayarı kontrol edilmeli.`
        english  = `No connection: check the firewall rule from the SAP server to &1, the port and, if needed, `
                && `the proxy settings.` )
      ( text_key = key-request_done
        turkish  = `HTTP &1 - &2 ms`
        english  = `HTTP &1 - &2 ms` ) ).
  ENDMETHOD.


  METHOD project_texts.
    result = VALUE #(
      ( text_key = key-wsdl_http_error
        turkish  = `WSDL alınamadı (HTTP &1): &2`
        english  = `The WSDL could not be loaded (HTTP &1): &2` )
      ( text_key = key-wsdl_auth_required
        turkish  = `WSDL için yetki gerekli: &1`
        english  = `Authentication required for &1` )
      ( text_key = key-wsdl_empty
        turkish  = `WSDL boş geldi: &1`
        english  = `The WSDL is empty: &1` )
      ( text_key = key-wsdl_not_wsdl
        turkish  = `Adres bir WSDL döndürmedi (kök öğe: &1). &2`
        english  = `The address did not return a WSDL (root element: &1). &2` )
      ( text_key = key-wsdl_loaded
        turkish  = `WSDL yüklendi (&1 belge).`
        english  = `WSDL loaded (&1 documents).` )
      ( text_key = key-wsdl_loaded_in
        turkish  = `WSDL yüklendi (&1 belge, &2 ms).`
        english  = `WSDL loaded (&1 documents, &2 ms).` )
      ( text_key = key-project_not_found
        turkish  = `Proje bulunamadı.`
        english  = `Project not found.` )
      ( text_key = key-project_name_exists
        turkish  = `Bu adla bir proje zaten var: &1`
        english  = `A project with this name already exists: &1` )
      ( text_key = key-project_name_empty
        turkish  = `Proje adı boş olamaz.`
        english  = `The project name must not be empty.` )
      ( text_key = key-not_authorized
        turkish  = `Bu proje başka bir kullanıcıya ait.`
        english  = `This project belongs to another user.` )
      ( text_key = key-saved
        turkish  = `Kaydedildi.`
        english  = `Saved.` )
      ( text_key = key-deleted
        turkish  = `Silindi.`
        english  = `Deleted.` )
      ( text_key = key-database_error
        turkish  = `Veritabanı hatası: &1`
        english  = `Database error: &1` ) ).
  ENDMETHOD.

ENDCLASS.


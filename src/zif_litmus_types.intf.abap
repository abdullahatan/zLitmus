"! <p class="shorttext synchronized">zLitmus - common types</p>
INTERFACE zif_litmus_types
  PUBLIC.

  "! Hex representation of a 16 byte UUID (database keys are SYSUUID_X16)
  TYPES id TYPE sysuuid_c32.
  TYPES ids TYPE STANDARD TABLE OF id WITH EMPTY KEY.

  CONSTANTS:
    BEGIN OF project_type,
      soap TYPE c LENGTH 10 VALUE 'SOAP',
    END OF project_type.

  CONSTANTS:
    BEGIN OF auth_type,
      none  TYPE c LENGTH 10 VALUE 'NONE',
      basic TYPE c LENGTH 10 VALUE 'BASIC',
    END OF auth_type.

  TYPES:
    BEGIN OF header,
      name  TYPE string,
      value TYPE string,
    END OF header.
  TYPES headers TYPE STANDARD TABLE OF header WITH EMPTY KEY.

  TYPES:
    BEGIN OF credentials,
      user     TYPE string,
      password TYPE string,
    END OF credentials.

  TYPES:
    BEGIN OF settings,
      timeout_sec TYPE i,
      ssl_id      TYPE ssfapplssl,
      proxy_host  TYPE string,
      proxy_port  TYPE string,
      ui_prefs    TYPE string,
    END OF settings.

  TYPES:
    BEGIN OF connection,
      timeout_sec TYPE i,
      ssl_id      TYPE ssfapplssl,
      proxy_host  TYPE string,
      proxy_port  TYPE string,
    END OF connection.

  TYPES:
    BEGIN OF http_request,
      method      TYPE string,
      url         TYPE string,
      headers     TYPE headers,
      body        TYPE xstring,
      credentials TYPE credentials,
      connection  TYPE connection,
    END OF http_request.

  TYPES:
    BEGIN OF http_response,
      "! abap_true when an HTTP answer arrived (any status)
      received     TYPE abap_bool,
      status       TYPE i,
      reason       TYPE string,
      headers      TYPE headers,
      body         TYPE xstring,
      time_ms      TYPE i,
      message      TYPE string,
      hint         TYPE string,
      sent_headers TYPE headers,
    END OF http_response.

  TYPES:
    BEGIN OF wsdl_document,
      url          TYPE string,
      status       TYPE i,
      content_type TYPE string,
      content      TYPE xstring,
      error        TYPE string,
    END OF wsdl_document.
  TYPES wsdl_documents TYPE STANDARD TABLE OF wsdl_document WITH EMPTY KEY.

  TYPES:
    BEGIN OF wsdl_package,
      url           TYPE string,
      documents     TYPE wsdl_documents,
      auth_required TYPE abap_bool,
      realm         TYPE string,
      loaded_at     TYPE timestampl,
    END OF wsdl_package.

  TYPES:
    BEGIN OF request,
      request_id     TYPE id,
      project_id     TYPE id,
      interface_name TYPE string,
      operation      TYPE string,
      name           TYPE string,
      position       TYPE i,
      endpoint       TYPE string,
      body           TYPE string,
      headers        TYPE headers,
      auth_type      TYPE string,
      auth_user      TYPE string,
      timeout_sec    TYPE i,
      changed_by     TYPE syuname,
      changed_at     TYPE timestampl,
      description    TYPE string,
      "! Code page of the request body (empty = UTF-8)
      encoding       TYPE string,
    END OF request.
  TYPES requests TYPE STANDARD TABLE OF request WITH EMPTY KEY.

  " Endpoint a user added to a binding (in addition to the WSDL addresses)
  TYPES:
    BEGIN OF endpoint,
      interface_name TYPE string,
      url            TYPE string,
    END OF endpoint.
  TYPES endpoints TYPE STANDARD TABLE OF endpoint WITH EMPTY KEY.

  TYPES:
    BEGIN OF project_header,
      project_id     TYPE id,
      owner          TYPE syuname,
      project_type   TYPE string,
      name           TYPE string,
      wsdl_url       TYPE string,
      wsdl_loaded_at TYPE timestampl,
      created_by     TYPE syuname,
      created_at     TYPE timestampl,
      changed_by     TYPE syuname,
      changed_at     TYPE timestampl,
      endpoints      TYPE endpoints,
    END OF project_header.

  TYPES:
    BEGIN OF project,
      header   TYPE project_header,
      requests TYPE requests,
    END OF project.

  TYPES:
    BEGIN OF project_summary,
      project_id    TYPE id,
      name          TYPE string,
      wsdl_url      TYPE string,
      changed_at    TYPE timestampl,
      request_count TYPE i,
    END OF project_summary.
  TYPES project_summaries TYPE STANDARD TABLE OF project_summary WITH EMPTY KEY.

  TYPES:
    BEGIN OF audit_entry,
      project_id    TYPE id,
      method        TYPE string,
      url           TYPE string,
      http_status   TYPE i,
      duration_ms   TYPE i,
      response_size TYPE i,
      error_text    TYPE string,
    END OF audit_entry.

  " One line of a page payload: key V = value, H = HTTP header
  TYPES:
    BEGIN OF page_line,
      key   TYPE string,
      name  TYPE string,
      value TYPE string,
    END OF page_line.
  TYPES page_lines TYPE STANDARD TABLE OF page_line WITH EMPTY KEY.

  CONSTANTS:
    BEGIN OF line_key,
      value  TYPE string VALUE `V`,
      header TYPE string VALUE `H`,
    END OF line_key.

ENDINTERFACE.

"! <p class="shorttext synchronized">zLitmus - page actions</p>
"! Each page action is one private method. The WSDL packages of the open projects are kept in
"! the instance (session memory) and given to the page again with every boot.
CLASS zcl_litmus_action_handler DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_litmus_action_handler.

    TYPES:
      BEGIN OF dependencies,
        project_repo  TYPE REF TO zif_litmus_project_repo,
        settings_repo TYPE REF TO zif_litmus_settings_repo,
        http_client   TYPE REF TO zif_litmus_http_client,
        audit_log     TYPE REF TO zif_litmus_audit_log,
        texts         TYPE REF TO zif_litmus_texts,
      END OF dependencies.

    METHODS constructor
      IMPORTING
        dependencies TYPE dependencies
        user         TYPE syuname.

  PRIVATE SECTION.
    CONSTANTS:
      BEGIN OF reply_kind,
        projects      TYPE string VALUE `projects`,
        project       TYPE string VALUE `project`,
        auth_required TYPE string VALUE `auth_required`,
        saved         TYPE string VALUE `saved`,
        deleted       TYPE string VALUE `deleted`,
        closed        TYPE string VALUE `closed`,
        response      TYPE string VALUE `response`,
        settings      TYPE string VALUE `settings`,
        exit          TYPE string VALUE `exit`,
        prefs         TYPE string VALUE `prefs`,
      END OF reply_kind.

    CONSTANTS:
      BEGIN OF field,
        name           TYPE string VALUE `name`,
        wsdl_url       TYPE string VALUE `wsdl_url`,
        wsdl_user      TYPE string VALUE `wsdl_user`,
        wsdl_pass      TYPE string VALUE `wsdl_pass`,
        create_samples TYPE string VALUE `create_samples`,
        project_id     TYPE string VALUE `project_id`,
        request_id     TYPE string VALUE `request_id`,
        project        TYPE string VALUE `project`,
        method         TYPE string VALUE `method`,
        url            TYPE string VALUE `url`,
        body           TYPE string VALUE `body`,
        auth_type      TYPE string VALUE `auth_type`,
        user           TYPE string VALUE `user`,
        pass           TYPE string VALUE `pass`,
        timeout        TYPE string VALUE `timeout`,
        settings       TYPE string VALUE `settings`,
        encoding       TYPE string VALUE `encoding`,
      END OF field.

    CONSTANTS default_method TYPE string VALUE `POST`.
    CONSTANTS json_true TYPE string VALUE `true`.
    CONSTANTS max_timeout_digits TYPE i VALUE 4.
    CONSTANTS utf8 TYPE string VALUE `UTF-8`.

    TYPES:
      BEGIN OF session_project,
        project_id TYPE zif_litmus_types=>id,
        wsdl       TYPE zif_litmus_types=>wsdl_package,
      END OF session_project.
    TYPES session_projects TYPE HASHED TABLE OF session_project WITH UNIQUE KEY project_id.

    " JSON shapes exchanged with the page (names become camelCase)
    TYPES:
      BEGIN OF name_value,
        n TYPE string,
        v TYPE string,
      END OF name_value.
    TYPES name_values TYPE STANDARD TABLE OF name_value WITH EMPTY KEY.

    TYPES:
      BEGIN OF document_json,
        url          TYPE string,
        status       TYPE i,
        content_type TYPE string,
        error        TYPE string,
        b64          TYPE string,
      END OF document_json.
    TYPES documents_json TYPE STANDARD TABLE OF document_json WITH EMPTY KEY.

    TYPES:
      BEGIN OF wsdl_json,
        url       TYPE string,
        loaded_at TYPE timestampl,
        documents TYPE documents_json,
      END OF wsdl_json.

    TYPES:
      BEGIN OF open_project_json,
        project_id TYPE zif_litmus_types=>id,
        wsdl       TYPE wsdl_json,
      END OF open_project_json.

    TYPES:
      BEGIN OF workspace_json,
        projects TYPE STANDARD TABLE OF open_project_json WITH EMPTY KEY,
      END OF workspace_json.

    TYPES:
      BEGIN OF saved_request_json,
        request_id     TYPE zif_litmus_types=>id,
        interface_name TYPE string,
        operation      TYPE string,
        name           TYPE string,
        endpoint       TYPE string,
        body           TYPE string,
        headers        TYPE zif_litmus_types=>headers,
        auth_type      TYPE string,
        auth_user      TYPE string,
        timeout_sec    TYPE i,
        description    TYPE string,
        encoding       TYPE string,
      END OF saved_request_json.

    TYPES:
      BEGIN OF saved_project_json,
        BEGIN OF header,
          project_id TYPE zif_litmus_types=>id,
          endpoints  TYPE zif_litmus_types=>endpoints,
        END OF header,
        requests TYPE STANDARD TABLE OF saved_request_json WITH EMPTY KEY,
      END OF saved_project_json.

    TYPES:
      BEGIN OF basic_reply,
        kind    TYPE string,
        ok      TYPE abap_bool,
        message TYPE string,
      END OF basic_reply.

    TYPES:
      BEGIN OF projects_reply,
        kind     TYPE string,
        ok       TYPE abap_bool,
        message  TYPE string,
        projects TYPE zif_litmus_types=>project_summaries,
      END OF projects_reply.

    TYPES:
      BEGIN OF project_reply,
        kind           TYPE string,
        ok             TYPE abap_bool,
        message        TYPE string,
        project        TYPE zif_litmus_types=>project,
        create_samples TYPE abap_bool,
      END OF project_reply.

    TYPES:
      BEGIN OF auth_reply,
        kind    TYPE string,
        ok      TYPE abap_bool,
        message TYPE string,
        action  TYPE string,
        url     TYPE string,
        host    TYPE string,
        realm   TYPE string,
      END OF auth_reply.

    TYPES:
      BEGIN OF project_id_reply,
        kind       TYPE string,
        ok         TYPE abap_bool,
        message    TYPE string,
        project_id TYPE zif_litmus_types=>id,
      END OF project_id_reply.

    TYPES:
      BEGIN OF sent_request_json,
        method  TYPE string,
        url     TYPE string,
        headers TYPE name_values,
      END OF sent_request_json.

    TYPES:
      BEGIN OF response_reply,
        kind       TYPE string,
        ok         TYPE abap_bool,
        message    TYPE string,
        project_id TYPE zif_litmus_types=>id,
        request_id TYPE zif_litmus_types=>id,
        status     TYPE i,
        reason     TYPE string,
        time_ms    TYPE i,
        size       TYPE i,
        headers    TYPE name_values,
        body64     TYPE string,
        hint       TYPE string,
        request    TYPE sent_request_json,
      END OF response_reply.

    TYPES:
      BEGIN OF settings_reply,
        kind     TYPE string,
        ok       TYPE abap_bool,
        message  TYPE string,
        settings TYPE zif_litmus_types=>settings,
      END OF settings_reply.

    DATA project_repo TYPE REF TO zif_litmus_project_repo.
    DATA settings_repo TYPE REF TO zif_litmus_settings_repo.
    DATA http_client TYPE REF TO zif_litmus_http_client.
    DATA audit_log TYPE REF TO zif_litmus_audit_log.
    DATA texts TYPE REF TO zif_litmus_texts.
    DATA bridge TYPE REF TO zcl_litmus_bridge.
    DATA user TYPE syuname.
    DATA open_projects TYPE session_projects.

    METHODS dispatch
      IMPORTING
        action        TYPE string
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS list_projects
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS create_project
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS open_project
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS save_project
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS rename_project
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS refresh_wsdl
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS delete_project
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS close_project
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    METHODS send_request
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS save_settings
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply
      RAISING
        zcx_litmus_error.

    METHODS request_exit
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    METHODS save_prefs
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    "! Request body in the code page of the request (UTF-8 when it is empty)
    METHODS encoded_body
      IMPORTING
        text          TYPE string
        encoding      TYPE string
      RETURNING
        VALUE(result) TYPE xstring
      RAISING
        zcx_litmus_error.

    METHODS value_of
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
        name          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS connection
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>connection
      RAISING
        zcx_litmus_error.

    METHODS load_wsdl
      IMPORTING
        url           TYPE string
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>wsdl_package
      RAISING
        zcx_litmus_error.

    METHODS check_wsdl_loaded
      IMPORTING
        wsdl TYPE zif_litmus_types=>wsdl_package
      RAISING
        zcx_litmus_error.

    METHODS service_name_of
      IMPORTING
        wsdl          TYPE zif_litmus_types=>wsdl_package
      RETURNING
        VALUE(result) TYPE string.

    METHODS host_of
      IMPORTING
        url           TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS remember
      IMPORTING
        project_id TYPE zif_litmus_types=>id
        wsdl       TYPE zif_litmus_types=>wsdl_package.

    METHODS auth_required_reply
      IMPORTING
        action        TYPE string
        url           TYPE string
        wsdl          TYPE zif_litmus_types=>wsdl_package
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    "! LOAD_MS: duration of the WSDL download (0 = taken from the cache, no time in the message)
    METHODS project_loaded_reply
      IMPORTING
        project        TYPE zif_litmus_types=>project
        wsdl           TYPE zif_litmus_types=>wsdl_package
        create_samples TYPE abap_bool
        load_ms        TYPE i DEFAULT 0
      RETURNING
        VALUE(result)  TYPE zif_litmus_action_handler=>reply.

    METHODS saved_reply
      IMPORTING
        project       TYPE zif_litmus_types=>project
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    METHODS sent_reply
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
        request       TYPE zif_litmus_types=>http_request
        response      TYPE zif_litmus_types=>http_response
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    METHODS http_request_of
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>http_request
      RAISING
        zcx_litmus_error.

    METHODS name_values_of
      IMPORTING
        headers       TYPE zif_litmus_types=>headers
      RETURNING
        VALUE(result) TYPE name_values.

    METHODS failure
      IMPORTING
        action        TYPE string
        error         TYPE REF TO zcx_litmus_error
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    METHODS to_json
      IMPORTING
        data          TYPE any
      RETURNING
        VALUE(result) TYPE string.

    METHODS from_json
      IMPORTING
        json TYPE string
      CHANGING
        data TYPE any.
    "! Page preferences (panel sizes, recent projects) sent with any action as value "prefs"
    METHODS persist_prefs
      IMPORTING
        lines TYPE zif_litmus_types=>page_lines
      RAISING
        zcx_litmus_error.

ENDCLASS.



CLASS zcl_litmus_action_handler IMPLEMENTATION.

  METHOD constructor.
    project_repo = dependencies-project_repo.
    settings_repo = dependencies-settings_repo.
    http_client = dependencies-http_client.
    audit_log = dependencies-audit_log.
    texts = dependencies-texts.
    me->user = user.
    bridge = NEW #( ).
  ENDMETHOD.


  METHOD zif_litmus_action_handler~handle.
    DATA(action_name) = to_upper( condense( action ) ).
    TRY.
        persist_prefs( lines ).
        result = dispatch( action = action_name
                           lines  = lines ).
      CATCH zcx_litmus_error INTO DATA(error).
        result = failure( action = action_name
                          error  = error ).
    ENDTRY.
  ENDMETHOD.


  METHOD zif_litmus_action_handler~workspace_json.
    DATA workspace TYPE workspace_json.
    LOOP AT open_projects INTO DATA(project).
      INSERT VALUE #( project_id = project-project_id
                      wsdl       = VALUE #( url       = project-wsdl-url
                                            loaded_at = project-wsdl-loaded_at
                                            documents = VALUE #( FOR document IN project-wsdl-documents
                                                                 ( url          = document-url
                                                                   status       = document-status
                                                                   content_type = document-content_type
                                                                   error        = document-error
                                                                   b64          = cl_http_utility=>encode_x_base64(
                                                                                    document-content ) ) ) ) )
             INTO TABLE workspace-projects.
    ENDLOOP.
    result = to_json( workspace ).
  ENDMETHOD.


  METHOD zif_litmus_action_handler~settings_json.
    TRY.
        result = to_json( settings_repo->read( user ) ).
      CATCH zcx_litmus_error.
        result = to_json( VALUE zif_litmus_types=>settings(
                            timeout_sec = zif_litmus_settings_repo=>defaults-timeout_sec
                            ssl_id      = zif_litmus_settings_repo=>defaults-ssl_id ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD dispatch.
    CASE action.
      WHEN zif_litmus_action_handler=>action-project_list.
        result = list_projects( ).
      WHEN zif_litmus_action_handler=>action-project_create.
        result = create_project( lines ).
      WHEN zif_litmus_action_handler=>action-project_open.
        result = open_project( lines ).
      WHEN zif_litmus_action_handler=>action-project_save.
        result = save_project( lines ).
      WHEN zif_litmus_action_handler=>action-project_rename.
        result = rename_project( lines ).
      WHEN zif_litmus_action_handler=>action-project_refresh_wsdl.
        result = refresh_wsdl( lines ).
      WHEN zif_litmus_action_handler=>action-project_delete.
        result = delete_project( lines ).
      WHEN zif_litmus_action_handler=>action-project_close.
        result = close_project( lines ).
      WHEN zif_litmus_action_handler=>action-request_send.
        result = send_request( lines ).
      WHEN zif_litmus_action_handler=>action-settings_save.
        result = save_settings( lines ).
      WHEN zif_litmus_action_handler=>action-exit.
        result = request_exit( ).
      WHEN zif_litmus_action_handler=>action-prefs_save.
        result = save_prefs( ).
      WHEN OTHERS.
        texts->raise_error( text_key   = zcl_litmus_texts=>key-unknown_action
                            variable_1 = action ).
    ENDCASE.
  ENDMETHOD.


  METHOD list_projects.
    result-json = to_json( VALUE projects_reply( kind     = reply_kind-projects
                                                 ok       = abap_true
                                                 projects = project_repo->list_for_owner( ) ) ).
  ENDMETHOD.


  METHOD create_project.
    DATA(url) = condense( value_of( lines = lines name = field-wsdl_url ) ).
    IF url IS INITIAL.
      texts->raise_error( text_key   = zcl_litmus_texts=>key-url_invalid
                          variable_1 = url ).
    ENDIF.

    DATA(timer) = cl_abap_runtime=>create_hr_timer( ).
    DATA(wsdl) = load_wsdl( url   = url
                            lines = lines ).
    DATA(load_ms) = timer->get_runtime( ) DIV 1000.
    IF wsdl-auth_required = abap_true.
      result = auth_required_reply( action = zif_litmus_action_handler=>action-project_create
                                    url    = url
                                    wsdl   = wsdl ).
      RETURN.
    ENDIF.
    check_wsdl_loaded( wsdl ).

    DATA(name) = condense( value_of( lines = lines name = field-name ) ).
    IF name IS INITIAL.
      name = service_name_of( wsdl ).
    ENDIF.
    DATA(header) = project_repo->create( name     = name
                                         wsdl_url = url ).
    project_repo->store_wsdl_cache( project_id = header-project_id
                                    wsdl       = wsdl ).
    remember( project_id = header-project_id
              wsdl       = wsdl ).
    result = project_loaded_reply(
               project        = VALUE #( header = header )
               wsdl           = wsdl
               create_samples = xsdbool( value_of( lines = lines name = field-create_samples ) = json_true )
               load_ms        = load_ms ).
  ENDMETHOD.


  METHOD open_project.
    DATA(project_id) = CONV zif_litmus_types=>id( value_of( lines = lines name = field-project_id ) ).
    DATA(project) = project_repo->read( project_id ).
    DATA(wsdl) = project_repo->read_wsdl_cache( project_id ).
    remember( project_id = project_id
              wsdl       = wsdl ).
    result = project_loaded_reply( project        = project
                                   wsdl           = wsdl
                                   create_samples = abap_false ).
  ENDMETHOD.


  METHOD save_project.
    DATA saved_project TYPE saved_project_json.
    from_json( EXPORTING json = value_of( lines = lines name = field-project )
               CHANGING  data = saved_project ).
    IF saved_project-header-project_id IS INITIAL.
      texts->raise_error( zcl_litmus_texts=>key-project_not_found ).
    ENDIF.

    DATA(project) = VALUE zif_litmus_types=>project(
                      header   = VALUE #( project_id = saved_project-header-project_id
                                          endpoints  = saved_project-header-endpoints )
                      requests = CORRESPONDING #( saved_project-requests ) ).
    result = saved_reply( project_repo->save( project ) ).
  ENDMETHOD.


  METHOD rename_project.
    DATA(project_id) = CONV zif_litmus_types=>id( value_of( lines = lines name = field-project_id ) ).
    project_repo->rename( project_id = project_id
                          name       = value_of( lines = lines name = field-name ) ).
    result = saved_reply( project_repo->read( project_id ) ).
  ENDMETHOD.


  METHOD refresh_wsdl.
    DATA(project_id) = CONV zif_litmus_types=>id( value_of( lines = lines name = field-project_id ) ).
    DATA(project) = project_repo->read( project_id ).
    DATA(timer) = cl_abap_runtime=>create_hr_timer( ).
    DATA(wsdl) = load_wsdl( url   = project-header-wsdl_url
                            lines = lines ).
    DATA(load_ms) = timer->get_runtime( ) DIV 1000.
    IF wsdl-auth_required = abap_true.
      result = auth_required_reply( action = zif_litmus_action_handler=>action-project_refresh_wsdl
                                    url    = project-header-wsdl_url
                                    wsdl   = wsdl ).
      RETURN.
    ENDIF.
    check_wsdl_loaded( wsdl ).

    project_repo->store_wsdl_cache( project_id = project_id
                                    wsdl       = wsdl ).
    remember( project_id = project_id
              wsdl       = wsdl ).
    result = project_loaded_reply( project        = project_repo->read( project_id )
                                   wsdl           = wsdl
                                   create_samples = abap_false
                                   load_ms        = load_ms ).
  ENDMETHOD.


  METHOD delete_project.
    DATA(project_id) = CONV zif_litmus_types=>id( value_of( lines = lines name = field-project_id ) ).
    project_repo->delete( project_id ).
    DELETE open_projects WHERE project_id = project_id.

    DATA(text) = texts->get( zcl_litmus_texts=>key-deleted ).
    result = VALUE #( json         = to_json( VALUE project_id_reply( kind       = reply_kind-deleted
                                                                      ok         = abap_true
                                                                      message    = text
                                                                      project_id = project_id ) )
                      message_type = zif_litmus_action_handler=>message_type-success
                      message_text = text ).
  ENDMETHOD.


  METHOD close_project.
    DATA(project_id) = CONV zif_litmus_types=>id( value_of( lines = lines name = field-project_id ) ).
    DELETE open_projects WHERE project_id = project_id.
    result-json = to_json( VALUE project_id_reply( kind       = reply_kind-closed
                                                   ok         = abap_true
                                                   project_id = project_id ) ).
  ENDMETHOD.


  METHOD send_request.
    DATA(request) = http_request_of( lines ).
    DATA(response) = http_client->send( request ).
    audit_log->write( VALUE #( project_id    = CONV #( value_of( lines = lines name = field-project_id ) )
                               method        = request-method
                               url           = request-url
                               http_status   = response-status
                               duration_ms   = response-time_ms
                               response_size = xstrlen( response-body )
                               error_text    = response-message ) ).
    result = sent_reply( lines    = lines
                         request  = request
                         response = response ).
  ENDMETHOD.


  METHOD save_settings.
    DATA settings TYPE zif_litmus_types=>settings.
    from_json( EXPORTING json = value_of( lines = lines name = field-settings )
               CHANGING  data = settings ).
    settings_repo->save( uname    = user
                         settings = settings ).

    DATA(text) = texts->get( zcl_litmus_texts=>key-saved ).
    result = VALUE #( json         = to_json( VALUE settings_reply( kind     = reply_kind-settings
                                                                    ok       = abap_true
                                                                    message  = text
                                                                    settings = settings_repo->read( user ) ) )
                      message_type = zif_litmus_action_handler=>message_type-success
                      message_text = text ).
  ENDMETHOD.


  METHOD request_exit.
    result = VALUE #( json           = to_json( VALUE basic_reply( kind = reply_kind-exit
                                                                   ok   = abap_true ) )
                      exit_requested = abap_true ).
  ENDMETHOD.


  METHOD value_of.
    result = bridge->value_of( lines = lines
                               name  = name ).
  ENDMETHOD.


  METHOD connection.
    DATA(settings) = settings_repo->read( user ).
    result = VALUE #( timeout_sec = settings-timeout_sec
                      ssl_id      = settings-ssl_id
                      proxy_host  = settings-proxy_host
                      proxy_port  = settings-proxy_port ).
  ENDMETHOD.


  METHOD load_wsdl.
    DATA(loader) = NEW zcl_litmus_wsdl_loader( http_client ).
    result = loader->load( url         = url
                           credentials = VALUE #( user     = value_of( lines = lines name = field-wsdl_user )
                                                  password = value_of( lines = lines name = field-wsdl_pass ) )
                           connection  = connection( ) ).
  ENDMETHOD.


  METHOD check_wsdl_loaded.
    DATA(first_document) = VALUE #( wsdl-documents[ 1 ] OPTIONAL ).
    IF first_document-error IS NOT INITIAL.
      texts->raise_error( text_key   = zcl_litmus_texts=>key-wsdl_http_error
                          variable_1 = |{ first_document-status }|
                          variable_2 = first_document-error ).
    ENDIF.
    IF first_document-content IS INITIAL.
      texts->raise_error( text_key   = zcl_litmus_texts=>key-wsdl_empty
                          variable_1 = wsdl-url ).
    ENDIF.

    " An HTTP 200 answer can still be an error document (e.g. SAP SOA runtime "<error>")
    DATA(wsdl_text) = bridge->from_utf8( first_document-content ).
    FIND FIRST OCCURRENCE OF PCRE `<(?![?!])(?:[\w.-]+:)?([\w.-]+)` IN wsdl_text SUBMATCHES DATA(root).
    IF root <> `definitions` AND root <> `description`.
      FIND FIRST OCCURRENCE OF PCRE `<errorText>([^<]*)` IN wsdl_text SUBMATCHES DATA(error_text).
      texts->raise_error( text_key   = zcl_litmus_texts=>key-wsdl_not_wsdl
                          variable_1 = root
                          variable_2 = error_text ).
    ENDIF.
  ENDMETHOD.


  METHOD service_name_of.
    DATA(wsdl_text) = bridge->from_utf8( VALUE #( wsdl-documents[ 1 ]-content OPTIONAL ) ).
    FIND FIRST OCCURRENCE OF PCRE `<(?:[\w.-]+:)?service\s[^>]*name\s*=\s*["']([^"']+)["']`
      IN wsdl_text SUBMATCHES result.
    IF result IS INITIAL.
      result = host_of( wsdl-url ).
    ENDIF.
  ENDMETHOD.


  METHOD host_of.
    DATA(scheme_end) = find( val = url sub = `://` ).
    result = COND #( WHEN scheme_end < 0 THEN url ELSE substring( val = url off = scheme_end + 3 ) ).
    DATA(host_end) = find( val = result pcre = `[/?#]` ).
    IF host_end >= 0.
      result = substring( val = result len = host_end ).
    ENDIF.
  ENDMETHOD.


  METHOD remember.
    DELETE open_projects WHERE project_id = project_id.
    INSERT VALUE #( project_id = project_id
                    wsdl       = wsdl ) INTO TABLE open_projects.
  ENDMETHOD.


  METHOD auth_required_reply.
    DATA(host) = host_of( url ).
    DATA(text) = texts->format( text_key   = zcl_litmus_texts=>key-wsdl_auth_required
                                variable_1 = host ).
    result = VALUE #( json         = to_json( VALUE auth_reply( kind    = reply_kind-auth_required
                                                                ok      = abap_false
                                                                message = text
                                                                action  = action
                                                                url     = url
                                                                host    = host
                                                                realm   = wsdl-realm ) )
                      message_type = zif_litmus_action_handler=>message_type-warning
                      message_text = text ).
  ENDMETHOD.


  METHOD project_loaded_reply.
    DATA(failed_documents) = REDUCE i( INIT count = 0
                                       FOR document IN wsdl-documents WHERE ( error IS NOT INITIAL )
                                       NEXT count = count + 1 ).
    DATA(text) = texts->format( text_key   = COND #( WHEN load_ms > 0
                                                     THEN zcl_litmus_texts=>key-wsdl_loaded_in
                                                     ELSE zcl_litmus_texts=>key-wsdl_loaded )
                                variable_1 = |{ lines( wsdl-documents ) }|
                                variable_2 = |{ load_ms }| ).
    result = VALUE #( json         = to_json( VALUE project_reply( kind           = reply_kind-project
                                                                   ok             = abap_true
                                                                   message        = text
                                                                   project        = project
                                                                   create_samples = create_samples ) )
                      message_type = COND #( WHEN failed_documents > 0
                                             THEN zif_litmus_action_handler=>message_type-warning
                                             ELSE zif_litmus_action_handler=>message_type-success )
                      message_text = text ).
  ENDMETHOD.


  METHOD saved_reply.
    DATA(text) = texts->get( zcl_litmus_texts=>key-saved ).
    result = VALUE #( json         = to_json( VALUE project_reply( kind    = reply_kind-saved
                                                                   ok      = abap_true
                                                                   message = text
                                                                   project = project ) )
                      message_type = zif_litmus_action_handler=>message_type-success
                      message_text = text ).
  ENDMETHOD.


  METHOD sent_reply.
    DATA(text) = COND #( WHEN response-received = abap_true
                         THEN texts->format( text_key   = zcl_litmus_texts=>key-request_done
                                             variable_1 = |{ response-status } { response-reason }|
                                             variable_2 = |{ response-time_ms }| )
                         ELSE response-message ).
    DATA(reply) = VALUE response_reply( kind       = reply_kind-response
                                        ok         = response-received
                                        message    = text
                                        project_id = value_of( lines = lines name = field-project_id )
                                        request_id = value_of( lines = lines name = field-request_id )
                                        status     = response-status
                                        reason     = response-reason
                                        time_ms    = response-time_ms
                                        size       = xstrlen( response-body )
                                        headers    = name_values_of( response-headers )
                                        body64     = cl_http_utility=>encode_x_base64( response-body )
                                        hint       = response-hint
                                        request    = VALUE #( method  = request-method
                                                              url     = request-url
                                                              headers = name_values_of( response-sent_headers ) ) ).
    result = VALUE #( json         = to_json( reply )
                      message_type = COND #( WHEN response-received = abap_false
                                             THEN zif_litmus_action_handler=>message_type-error
                                             WHEN response-status >= 400
                                             THEN zif_litmus_action_handler=>message_type-warning
                                             ELSE zif_litmus_action_handler=>message_type-success )
                      message_text = text ).
  ENDMETHOD.


  METHOD http_request_of.
    DATA(http_method) = to_upper( condense( value_of( lines = lines name = field-method ) ) ).
    DATA(timeout) = condense( value_of( lines = lines name = field-timeout ) ).

    result = VALUE #( method     = COND #( WHEN http_method IS INITIAL THEN default_method ELSE http_method )
                      url        = condense( value_of( lines = lines name = field-url ) )
                      headers    = bridge->headers_of( lines )
                      body       = encoded_body( text     = value_of( lines = lines name = field-body )
                                                 encoding = value_of( lines = lines name = field-encoding ) )
                      connection = connection( ) ).
    IF to_upper( value_of( lines = lines name = field-auth_type ) ) = zif_litmus_types=>auth_type-basic.
      result-credentials = VALUE #( user     = value_of( lines = lines name = field-user )
                                    password = value_of( lines = lines name = field-pass ) ).
    ENDIF.
    IF timeout CO `0123456789` AND timeout IS NOT INITIAL AND strlen( timeout ) <= max_timeout_digits.
      result-connection-timeout_sec = CONV i( timeout ).
    ENDIF.
  ENDMETHOD.


  METHOD name_values_of.
    result = VALUE #( FOR header IN headers ( n = header-name v = header-value ) ).
  ENDMETHOD.


  METHOD failure.
    DATA(text) = error->get_bapiret2_struc( )-message.
    result = VALUE #( json         = to_json( VALUE basic_reply( kind    = to_lower( action )
                                                                 ok      = abap_false
                                                                 message = text ) )
                      message_type = zif_litmus_action_handler=>message_type-error
                      message_text = text ).
  ENDMETHOD.


  METHOD to_json.
    result = /ui2/cl_json=>serialize( data          = data
                                      pretty_name   = /ui2/cl_json=>pretty_mode-camel_case
                                      ts_as_iso8601 = abap_true ).
  ENDMETHOD.


  METHOD from_json.
    /ui2/cl_json=>deserialize( EXPORTING json        = json
                                         pretty_name = /ui2/cl_json=>pretty_mode-camel_case
                               CHANGING  data        = data ).
  ENDMETHOD.

  METHOD zif_litmus_action_handler~project_list_json.
    TRY.
        result = to_json( project_repo->list_for_owner( ) ).
      CATCH zcx_litmus_error.
        result = `[]`.
    ENDTRY.
  ENDMETHOD.


  METHOD save_prefs.
    " The preferences themselves are written by PERSIST_PREFS before every action
    result-json = to_json( VALUE basic_reply( kind = reply_kind-prefs
                                              ok   = abap_true ) ).
  ENDMETHOD.


  METHOD encoded_body.
    DATA(codepage) = to_upper( condense( encoding ) ).
    IF codepage IS INITIAL OR codepage = utf8.
      result = bridge->to_utf8( text ).
      RETURN.
    ENDIF.
    TRY.
        result = cl_abap_conv_codepage=>create_out( codepage = codepage )->convert( text ).
      CATCH cx_parameter_invalid_range cx_sy_conversion_codepage INTO DATA(error).
        texts->raise_error( text_key   = zcl_litmus_texts=>key-invalid_data
                            variable_1 = |{ codepage }: { error->get_text( ) }| ).
    ENDTRY.
  ENDMETHOD.


  METHOD persist_prefs.
    CONSTANTS prefs_field TYPE string VALUE `prefs`.
    DATA(prefs) = value_of( lines = lines name = prefs_field ).
    IF prefs IS INITIAL.
      RETURN.
    ENDIF.
    DATA(settings) = settings_repo->read( user ).
    settings-ui_prefs = prefs.
    settings_repo->save( uname    = user
                         settings = settings ).
  ENDMETHOD.
ENDCLASS.


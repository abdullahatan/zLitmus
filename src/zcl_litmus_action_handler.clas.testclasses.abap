"! In-memory projects of one owner
CLASS ltd_project_repo DEFINITION FINAL FOR TESTING.

  PUBLIC SECTION.
    INTERFACES zif_litmus_project_repo.

    TYPES:
      BEGIN OF stored_project,
        project TYPE zif_litmus_types=>project,
        wsdl    TYPE zif_litmus_types=>wsdl_package,
      END OF stored_project.
    TYPES stored_projects TYPE STANDARD TABLE OF stored_project WITH EMPTY KEY.

    DATA projects TYPE stored_projects READ-ONLY.

  PRIVATE SECTION.
    DATA last_number TYPE i.

    METHODS next_id
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>id.

    METHODS raise_not_found
      RAISING
        zcx_litmus_error.

ENDCLASS.


CLASS ltd_project_repo IMPLEMENTATION.

  METHOD zif_litmus_project_repo~list_for_owner.
    result = VALUE #( FOR stored IN projects ( project_id    = stored-project-header-project_id
                                               name          = stored-project-header-name
                                               request_count = lines( stored-project-requests ) ) ).
  ENDMETHOD.


  METHOD zif_litmus_project_repo~read.
    IF NOT line_exists( projects[ project-header-project_id = project_id ] ).
      raise_not_found( ).
    ENDIF.
    result = projects[ project-header-project_id = project_id ]-project.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~create.
    result = VALUE #( project_id = next_id( )
                      owner      = 'ALICE'
                      name       = name
                      wsdl_url   = wsdl_url ).
    INSERT VALUE #( project-header = result ) INTO TABLE projects.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~save.
    IF NOT line_exists( projects[ project-header-project_id = project-header-project_id ] ).
      raise_not_found( ).
    ENDIF.
    DATA(stored) = REF #( projects[ project-header-project_id = project-header-project_id ] ).
    stored->project-requests = project-requests.
    stored->project-header-endpoints = project-header-endpoints.
    LOOP AT stored->project-requests REFERENCE INTO DATA(request) WHERE request_id IS INITIAL.
      request->request_id = next_id( ).
    ENDLOOP.
    result = stored->project.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~rename.
    IF NOT line_exists( projects[ project-header-project_id = project_id ] ).
      raise_not_found( ).
    ENDIF.
    projects[ project-header-project_id = project_id ]-project-header-name = name.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~delete.
    DELETE projects WHERE project-header-project_id = project_id.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~store_wsdl_cache.
    IF NOT line_exists( projects[ project-header-project_id = project_id ] ).
      raise_not_found( ).
    ENDIF.
    projects[ project-header-project_id = project_id ]-wsdl = wsdl.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~read_wsdl_cache.
    IF NOT line_exists( projects[ project-header-project_id = project_id ] ).
      raise_not_found( ).
    ENDIF.
    result = projects[ project-header-project_id = project_id ]-wsdl.
  ENDMETHOD.


  METHOD next_id.
    last_number = last_number + 1.
    result = |{ last_number WIDTH = 32 ALIGN = RIGHT PAD = '0' }|.
  ENDMETHOD.


  METHOD raise_not_found.
    zcl_litmus_texts=>create( 'E' )->raise_error( zcl_litmus_texts=>key-project_not_found ).
  ENDMETHOD.

ENDCLASS.


CLASS ltd_settings_repo DEFINITION FINAL FOR TESTING.

  PUBLIC SECTION.
    INTERFACES zif_litmus_settings_repo.

    DATA saved TYPE zif_litmus_types=>settings READ-ONLY.

ENDCLASS.


CLASS ltd_settings_repo IMPLEMENTATION.

  METHOD zif_litmus_settings_repo~read.
    result = COND #( WHEN saved IS INITIAL
                     THEN VALUE #( timeout_sec = 60 ssl_id = 'ANONYM' )
                     ELSE saved ).
  ENDMETHOD.


  METHOD zif_litmus_settings_repo~save.
    saved = settings.
  ENDMETHOD.

ENDCLASS.


CLASS ltd_audit_log DEFINITION FINAL FOR TESTING.

  PUBLIC SECTION.
    INTERFACES zif_litmus_audit_log.

    DATA entries TYPE STANDARD TABLE OF zif_litmus_types=>audit_entry WITH EMPTY KEY READ-ONLY.

ENDCLASS.


CLASS ltd_audit_log IMPLEMENTATION.

  METHOD zif_litmus_audit_log~write.
    INSERT entry INTO TABLE entries.
  ENDMETHOD.

ENDCLASS.


"! Answers from a fixed table of URL -> response; unknown URLs get 404
CLASS ltd_http_client DEFINITION FINAL FOR TESTING.

  PUBLIC SECTION.
    INTERFACES zif_litmus_http_client.

    TYPES:
      BEGIN OF prepared_answer,
        url      TYPE string,
        response TYPE zif_litmus_types=>http_response,
      END OF prepared_answer.
    TYPES answer_list TYPE STANDARD TABLE OF prepared_answer WITH EMPTY KEY.

    DATA last_request TYPE zif_litmus_types=>http_request READ-ONLY.

    METHODS answer
      IMPORTING
        url      TYPE string
        response TYPE zif_litmus_types=>http_response.

  PRIVATE SECTION.
    DATA answers TYPE answer_list.

ENDCLASS.


CLASS ltd_http_client IMPLEMENTATION.

  METHOD zif_litmus_http_client~send.
    last_request = request.
    result = VALUE #( answers[ url = request-url ]-response
                      DEFAULT VALUE #( received = abap_true
                                       status   = 404
                                       reason   = `Not Found` ) ).
    result-sent_headers = request-headers.
  ENDMETHOD.


  METHOD answer.
    INSERT VALUE #( url      = url
                    response = response ) INTO TABLE answers.
  ENDMETHOD.

ENDCLASS.


CLASS ltc_action_handler DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    CONSTANTS wsdl_url TYPE string VALUE `http://h:8000/calc?wsdl`.

    DATA projects TYPE REF TO ltd_project_repo.
    DATA settings TYPE REF TO ltd_settings_repo.
    DATA audit TYPE REF TO ltd_audit_log.
    DATA http TYPE REF TO ltd_http_client.
    DATA cut TYPE REF TO zif_litmus_action_handler.

    METHODS setup.
    METHODS create_project_loads_wsdl FOR TESTING.
    METHODS create_project_needs_auth FOR TESTING.
    METHODS error_document_is_not_a_wsdl FOR TESTING.
    METHODS open_project_gives_requests FOR TESTING RAISING zcx_litmus_error.
    METHODS save_project_writes_requests FOR TESTING.
    METHODS send_request_is_logged FOR TESTING.
    METHODS unknown_action_is_an_error FOR TESTING.
    METHODS exit_is_requested FOR TESTING.
    METHODS settings_are_saved FOR TESTING.
    METHODS page_prefs_are_persisted FOR TESTING.
    METHODS prefs_save_only_saves_prefs FOR TESTING.
    METHODS body_is_sent_in_its_encoding FOR TESTING.
    METHODS project_list_for_the_start FOR TESTING.
    METHODS endpoints_are_saved FOR TESTING.

    METHODS answer_wsdl.
    METHODS created_project_id
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>id.
ENDCLASS.


CLASS ltc_action_handler IMPLEMENTATION.

  METHOD setup.
    projects = NEW #( ).
    settings = NEW #( ).
    audit = NEW #( ).
    http = NEW #( ).
    cut = NEW zcl_litmus_action_handler( dependencies = VALUE #( project_repo  = projects
                                                                 settings_repo = settings
                                                                 http_client   = http
                                                                 audit_log     = audit
                                                                 texts         = zcl_litmus_texts=>create( 'E' ) )
                                         user         = 'ALICE' ).
  ENDMETHOD.


  METHOD create_project_loads_wsdl.
    answer_wsdl( ).

    DATA(result) = cut->handle( action = `PROJECT_CREATE`
                                lines  = VALUE #( ( key = `V` name = `ui` value = `{}` )
                                                  ( key = `V` name = `wsdl_url` value = wsdl_url )
                                                  ( key = `V` name = `create_samples` value = `true` ) ) ).

    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"kind":"project","ok":true*"name":"CalcService"*' ).
    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"createSamples":true*' ).
    cl_abap_unit_assert=>assert_equals( act = lines( projects->projects )
                                        exp = 1 ).
    cl_abap_unit_assert=>assert_char_cp( act = cut->workspace_json( )
                                         exp = '*"documents":[{"url":"http://h:8000/calc?wsdl","status":200*' ).
    cl_abap_unit_assert=>assert_equals( act = result-message_type
                                        exp = `S` ).
    " The download time is shown (it tells whether a slow start is the WSDL server)
    cl_abap_unit_assert=>assert_char_cp( act = result-message_text
                                         exp = 'WSDL loaded (1 documents*).' ).
  ENDMETHOD.


  METHOD create_project_needs_auth.
    http->answer( url      = wsdl_url
                  response = VALUE #( received = abap_true
                                      status   = 401
                                      reason   = `Unauthorized`
                                      headers  = VALUE #( ( name  = `www-authenticate`
                                                            value = `Basic realm="SAP"` ) ) ) ).

    DATA(result) = cut->handle( action = `PROJECT_CREATE`
                                lines  = VALUE #( ( key = `V` name = `name` value = `Calc` )
                                                  ( key = `V` name = `wsdl_url` value = wsdl_url ) ) ).

    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"kind":"auth_required","ok":false*"host":"h:8000","realm":"SAP"*' ).
    cl_abap_unit_assert=>assert_initial( projects->projects ).
    cl_abap_unit_assert=>assert_equals( act = result-message_text
                                        exp = `Authentication required for h:8000` ).
  ENDMETHOD.


  METHOD open_project_gives_requests.
    DATA(project_id) = created_project_id( ).
    CAST zif_litmus_project_repo( projects )->save(
      VALUE #( header   = VALUE #( project_id = project_id )
               requests = VALUE #( ( name = `Request 1` operation = `Add` ) ) ) ).
    cut = NEW zcl_litmus_action_handler( dependencies = VALUE #( project_repo  = projects
                                                                 settings_repo = settings
                                                                 http_client   = http
                                                                 audit_log     = audit
                                                                 texts         = zcl_litmus_texts=>create( 'E' ) )
                                         user         = 'ALICE' ).

    DATA(result) = cut->handle( action = `PROJECT_OPEN`
                                lines  = VALUE #( ( key = `V` name = `project_id` value = project_id ) ) ).

    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"requests":[{*"name":"Request 1","position":0*' ).
    cl_abap_unit_assert=>assert_char_cp( act = cut->workspace_json( )
                                         exp = |*"projectId":"{ project_id }"*| ).
  ENDMETHOD.


  METHOD save_project_writes_requests.
    DATA(project_id) = created_project_id( ).
    DATA(project_json) = |\{"header":\{"projectId":"{ project_id }","name":"Calc","changedAt":"2026-11-25T10:00:00Z"\},|
                      && |"requests":[\{"name":"Request 1","operation":"Add","interfaceName":"CalcSoap",|
                      && |"headers":[\{"name":"X-A","value":"1"\}],"authType":"BASIC","authUser":"ALICE"\}]\}|.

    DATA(result) = cut->handle( action = `PROJECT_SAVE`
                                lines  = VALUE #( ( key = `V` name = `project` value = project_json ) ) ).

    DATA(saved_request) = projects->projects[ 1 ]-project-requests[ 1 ].
    cl_abap_unit_assert=>assert_equals( act = saved_request-name
                                        exp = `Request 1` ).
    cl_abap_unit_assert=>assert_equals( act = saved_request-headers
                                        exp = VALUE zif_litmus_types=>headers( ( name = `X-A` value = `1` ) ) ).
    cl_abap_unit_assert=>assert_equals( act = saved_request-auth_user
                                        exp = `ALICE` ).
    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"kind":"saved","ok":true*' ).
  ENDMETHOD.


  METHOD send_request_is_logged.
    http->answer( url      = `http://h:8000/calc`
                  response = VALUE #( received = abap_true
                                      status   = 200
                                      reason   = `OK`
                                      time_ms  = 147
                                      body     = cl_abap_codepage=>convert_to( `<ok/>` ) ) ).

    DATA(result) = cut->handle( action = `REQUEST_SEND`
                                lines  = VALUE #( ( key = `V` name = `project_id` value = `0123` )
                                                  ( key = `V` name = `url` value = `http://h:8000/calc` )
                                                  ( key = `V` name = `body` value = `<a/>` )
                                                  ( key = `V` name = `auth_type` value = `BASIC` )
                                                  ( key = `V` name = `user` value = `ALICE` )
                                                  ( key = `V` name = `pass` value = `s3cret` )
                                                  ( key = `V` name = `timeout` value = `15` )
                                                  ( key = `H` name = `SOAPAction` value = `"urn:add"` ) ) ).

    cl_abap_unit_assert=>assert_equals( act = http->last_request-credentials-password
                                        exp = `s3cret` ).
    cl_abap_unit_assert=>assert_equals( act = http->last_request-connection-timeout_sec
                                        exp = 15 ).
    cl_abap_unit_assert=>assert_equals( act = http->last_request-method
                                        exp = `POST` ).
    cl_abap_unit_assert=>assert_equals( act = lines( audit->entries )
                                        exp = 1 ).
    cl_abap_unit_assert=>assert_equals( act = audit->entries[ 1 ]-http_status
                                        exp = 200 ).
    cl_abap_unit_assert=>assert_equals( act = audit->entries[ 1 ]-response_size
                                        exp = 5 ).
    cl_abap_unit_assert=>assert_char_np( act = result-json
                                         exp = '*s3cret*' ).
    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"kind":"response","ok":true*"status":200*"timeMs":147,"size":5*' ).
    cl_abap_unit_assert=>assert_equals( act = result-message_text
                                        exp = `HTTP 200 OK - 147 ms` ).
  ENDMETHOD.


  METHOD unknown_action_is_an_error.
    DATA(result) = cut->handle( action = `FOO`
                                lines  = VALUE #( ) ).

    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"kind":"foo","ok":false,"message":"Unknown action: FOO"*' ).
    cl_abap_unit_assert=>assert_equals( act = result-message_type
                                        exp = `E` ).
  ENDMETHOD.


  METHOD exit_is_requested.
    DATA(result) = cut->handle( action = `EXIT`
                                lines  = VALUE #( ) ).

    cl_abap_unit_assert=>assert_true( result-exit_requested ).
  ENDMETHOD.


  METHOD settings_are_saved.
    DATA(result) = cut->handle(
      action = `SETTINGS_SAVE`
      lines  = VALUE #( ( key   = `V`
                          name  = `settings`
                          value = `{"timeoutSec":90,"sslId":"DFAULT","proxyHost":"p","proxyPort":"3128"}` ) ) ).

    cl_abap_unit_assert=>assert_equals( act = settings->saved-timeout_sec
                                        exp = 90 ).
    cl_abap_unit_assert=>assert_equals( act = settings->saved-ssl_id
                                        exp = 'DFAULT' ).
    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"kind":"settings","ok":true*"timeoutSec":90*' ).
    cl_abap_unit_assert=>assert_char_cp( act = cut->settings_json( )
                                         exp = '*"proxyPort":"3128"*' ).
  ENDMETHOD.


  METHOD page_prefs_are_persisted.
    cut->handle( action = `PROJECT_LIST`
                 lines  = VALUE #( ( key = `V` name = `prefs` value = `{"wrap":true}` ) ) ).

    cl_abap_unit_assert=>assert_equals( act = settings->saved-ui_prefs
                                        exp = `{"wrap":true}` ).
    cl_abap_unit_assert=>assert_equals( act = settings->saved-timeout_sec
                                        exp = 60 ).
  ENDMETHOD.


  METHOD prefs_save_only_saves_prefs.
    DATA(result) = cut->handle( action = `PREFS_SAVE`
                                lines  = VALUE #( ( key = `V` name = `prefs` value = `{"theme":"dark"}` ) ) ).

    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = '*"kind":"prefs","ok":true*' ).
    cl_abap_unit_assert=>assert_equals( act = settings->saved-ui_prefs
                                        exp = `{"theme":"dark"}` ).
  ENDMETHOD.


  METHOD body_is_sent_in_its_encoding.
    cut->handle( action = `REQUEST_SEND`
                 lines  = VALUE #( ( key = `V` name = `url` value = `http://h:8000/calc` )
                                   ( key = `V` name = `body` value = `<a>ğ</a>` )
                                   ( key = `V` name = `encoding` value = `iso-8859-9` ) ) ).

    cl_abap_unit_assert=>assert_equals( act = http->last_request-body
                                        exp = CONV xstring( '3C613EF03C2F613E' ) ).
  ENDMETHOD.


  METHOD project_list_for_the_start.
    created_project_id( ).

    DATA(result) = cut->project_list_json( ).

    cl_abap_unit_assert=>assert_char_cp( act = result
                                         exp = '[{"projectId":"*","name":"Calc",*}]' ).
  ENDMETHOD.


  METHOD endpoints_are_saved.
    DATA(project_id) = created_project_id( ).
    DATA(project_json) = |\{"header":\{"projectId":"{ project_id }",|
                      && |"endpoints":[\{"interfaceName":"CalcSoap","url":"http://other/calc"\}]\},"requests":[]\}|.

    cut->handle( action = `PROJECT_SAVE`
                 lines  = VALUE #( ( key = `V` name = `project` value = project_json ) ) ).

    cl_abap_unit_assert=>assert_equals(
      act = projects->projects[ 1 ]-project-header-endpoints
      exp = VALUE zif_litmus_types=>endpoints( ( interface_name = `CalcSoap` url = `http://other/calc` ) ) ).
  ENDMETHOD.


  METHOD error_document_is_not_a_wsdl.
    http->answer( url      = wsdl_url
                  response = VALUE #( received = abap_true
                                      status   = 200
                                      reason   = `OK`
                                      body     = cl_abap_codepage=>convert_to(
                                                   `<?xml version="1.0"?><error><errorText>`
                                                && `WSP Exception caught</errorText></error>` ) ) ).

    DATA(result) = cut->handle( action = `PROJECT_CREATE`
                                lines  = VALUE #( ( key = `V` name = `wsdl_url` value = wsdl_url ) ) ).

    cl_abap_unit_assert=>assert_char_cp( act = result-json
                                         exp = `*"ok":false*root element: error). WSP Exception caught*` ).
    cl_abap_unit_assert=>assert_initial( projects->projects ).
  ENDMETHOD.


  METHOD answer_wsdl.
    http->answer( url      = wsdl_url
                  response = VALUE #( received = abap_true
                                      status   = 200
                                      reason   = `OK`
                                      body     = cl_abap_codepage=>convert_to(
                                                   `<wsdl:definitions><wsdl:service name="CalcService">`
                                                && `</wsdl:service></wsdl:definitions>` ) ) ).
  ENDMETHOD.


  METHOD created_project_id.
    answer_wsdl( ).
    cut->handle( action = `PROJECT_CREATE`
                 lines  = VALUE #( ( key = `V` name = `name` value = `Calc` )
                                   ( key = `V` name = `wsdl_url` value = wsdl_url ) ) ).
    result = projects->projects[ 1 ]-project-header-project_id.
  ENDMETHOD.

ENDCLASS.

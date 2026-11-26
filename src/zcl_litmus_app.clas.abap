"! <p class="shorttext synchronized">zLitmus - screen application (HTML control)</p>
"! Owns the HTML control on CL_GUI_CONTAINER=&gt;SCREEN0 and the session: page actions arrive as
"! SAPEVENT system events, are handled by ZCL_LITMUS_ACTION_HANDLER, committed, and the whole page
"! is shown again with the answer in its boot data (the Edge control ignores the frame of SHOW_URL).
CLASS zcl_litmus_app DEFINITION
  PUBLIC
  FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    CONSTANTS:
      BEGIN OF function_code,
        refresh TYPE syucomm VALUE 'FC01',
        install TYPE syucomm VALUE 'FC02',
        exit    TYPE syucomm VALUE 'ZLX_EXIT',
        export  TYPE syucomm VALUE 'ZLX_EXPO',
        browse  TYPE syucomm VALUE 'ZLX_WSDL',
        pai     TYPE syucomm VALUE 'ZLX_DEFR',
      END OF function_code.

    "! Application with the real database, network and MIME dependencies
    CLASS-METHODS create
      RETURNING
        VALUE(result) TYPE REF TO zcl_litmus_app.

    "! Texts in the logon language (screen title, function keys)
    METHODS texts
      RETURNING
        VALUE(result) TYPE REF TO zif_litmus_texts.

    "! PBO of the screen: creates the HTML control once and shows the page
    METHODS pbo.

    "! PAI of the screen: refresh page, install page, exit
    METHODS user_command
      IMPORTING
        ucomm TYPE syucomm.

    METHODS exit_requested
      RETURNING
        VALUE(result) TYPE abap_bool.

    METHODS page_installed
      RETURNING
        VALUE(result) TYPE abap_bool.

    "! Frees the HTML control; the session (open projects, page state) stays
    METHODS release_control.

    "! The last page state has projects with unsaved changes
    METHODS has_unsaved_changes
      RETURNING
        VALUE(result) TYPE abap_bool.

    "! SAP GUI Back / Exit / Cancel with unsaved work: the page is shown again and asks the user
    METHODS request_exit_check.

    METHODS free.

  PRIVATE SECTION.
    CONSTANTS ui_field TYPE string VALUE `ui`.
    CONSTANTS dirty_marker TYPE string VALUE `"dirty":true`.
    CONSTANTS exit_check_reply TYPE string VALUE `{"kind":"exit_check","ok":true}`.
    CONSTANTS xml_filter TYPE string VALUE `XML (*.xml)|*.xml|*.*|*.*`.
    CONSTANTS wsdl_filter TYPE string VALUE `WSDL (*.wsdl;*.xml)|*.wsdl;*.xml|*.*|*.*`.
    CONSTANTS wsdl_url_field TYPE string VALUE `wsdl_url`.

    TYPES:
      BEGIN OF export_file,
        name    TYPE string,
        content TYPE string,
      END OF export_file.

    DATA text_catalog TYPE REF TO zif_litmus_texts.
    DATA handler TYPE REF TO zif_litmus_action_handler.
    DATA page_store TYPE REF TO zif_litmus_page_store.
    DATA bridge TYPE REF TO zcl_litmus_bridge.
    DATA html_viewer TYPE REF TO cl_gui_html_viewer.
    "! UI state of the page as it sent it with the last action (JSON)
    DATA ui_state TYPE string.
    "! Answer to the last action; shown once with the next display
    DATA last_reply TYPE zif_litmus_action_handler=>reply.
    DATA exit_flag TYPE abap_bool.
    "! File the page asked to save (FILE_EXPORT); written in PAI
    DATA pending_export TYPE export_file.
    "! Page action that reads files of the PC: it runs in PAI (frontend services), not in the control event
    DATA deferred_action TYPE string.
    DATA deferred_lines TYPE zif_litmus_types=>page_lines.
    DATA urls TYPE REF TO zcl_litmus_url.

    METHODS constructor
      IMPORTING
        catalog    TYPE REF TO zif_litmus_texts
        handler    TYPE REF TO zif_litmus_action_handler
        page_store TYPE REF TO zif_litmus_page_store.

    METHODS on_sapevent
      FOR EVENT sapevent OF cl_gui_html_viewer
      IMPORTING
        action
        postdata.

    METHODS create_control
      RAISING
        zcx_litmus_error.

    METHODS show_page
      RAISING
        zcx_litmus_error.

    METHODS display
      IMPORTING
        html TYPE string
      RAISING
        zcx_litmus_error.

    METHODS boot_json
      RETURNING
        VALUE(result) TYPE string.

    METHODS handle_event
      IMPORTING
        action    TYPE string
        post_data TYPE cnht_post_data_tab.

    METHODS unexpected_error_reply
      IMPORTING
        action        TYPE string
        error         TYPE REF TO cx_root
      RETURNING
        VALUE(result) TYPE zif_litmus_action_handler=>reply.

    METHODS show_status_message
      IMPORTING
        error TYPE REF TO zcx_litmus_error.

    "! Minimal page while zLitmus is not installed: text and an "Install / update page" button
    METHODS install_page_html
      RETURNING
        VALUE(result) TYPE string.

    "! Keeps the page state of an event that carries one
    METHODS keep_ui_state
      IMPORTING
        lines TYPE zif_litmus_types=>page_lines.

    "! Save dialog on the PC and download of the pending export (UTF-8, as sent by the page)
    METHODS save_export
      RAISING
        zcx_litmus_error.

    "! Open dialog for a WSDL file; answer "wsdl_file" with its file: URL (ok = false when cancelled)
    METHODS browse_wsdl
      RETURNING
        VALUE(result) TYPE string.

    "! Creating / updating a project from a WSDL file of the PC
    METHODS reads_local_files
      IMPORTING
        action        TYPE string
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE abap_bool.

    METHODS run_deferred_action.

ENDCLASS.



CLASS zcl_litmus_app IMPLEMENTATION.

  METHOD create.
    DATA(catalog) = zcl_litmus_texts=>create( sy-langu ).
    DATA(handler) = NEW zcl_litmus_action_handler(
      dependencies = VALUE #( project_repo  = NEW zcl_litmus_project_repo( owner = sy-uname
                                                                           texts = catalog )
                              settings_repo = NEW zcl_litmus_settings_repo( catalog )
                              http_client   = NEW zcl_litmus_file_client(
                                                http_client = NEW zcl_litmus_http_client( catalog )
                                                texts       = catalog )
                              audit_log     = NEW zcl_litmus_audit_log( uname = sy-uname
                                                                        texts = catalog )
                              texts         = catalog )
      user         = sy-uname ).
    result = NEW #( catalog    = catalog
                    handler    = handler
                    page_store = NEW zcl_litmus_page_store( texts  = catalog
                                                            bridge = NEW #( ) ) ).
  ENDMETHOD.


  METHOD constructor.
    text_catalog = catalog.
    me->handler = handler.
    me->page_store = page_store.
    bridge = NEW #( ).
    urls = NEW #( ).
  ENDMETHOD.


  METHOD texts.
    result = text_catalog.
  ENDMETHOD.


  METHOD pbo.
    IF html_viewer IS BOUND.
      RETURN.
    ENDIF.
    TRY.
        create_control( ).
        show_page( ).
      CATCH zcx_litmus_error INTO DATA(error).
        show_status_message( error ).
    ENDTRY.
  ENDMETHOD.


  METHOD user_command.
    TRY.
        CASE ucomm.
          WHEN function_code-refresh.
            show_page( ).
          WHEN function_code-install.
            " The page is shown again also when the file dialog was cancelled (the page waits for an answer)
            TRY.
                page_store->install_from_frontend( ).
                DATA(installed_text) = text_catalog->get( zcl_litmus_texts=>key-page_installed ).
                MESSAGE installed_text TYPE 'S'.
              CATCH zcx_litmus_error INTO DATA(install_error).
                show_status_message( install_error ).
            ENDTRY.
            show_page( ).
          WHEN function_code-export.
            TRY.
                save_export( ).
              CATCH zcx_litmus_error INTO DATA(export_error).
                show_status_message( export_error ).
            ENDTRY.
            show_page( ).
          WHEN function_code-browse.
            last_reply = VALUE #( json = browse_wsdl( ) ).
            show_page( ).
          WHEN function_code-pai.
            run_deferred_action( ).
            show_page( ).
          WHEN function_code-exit.
            exit_flag = abap_true.
        ENDCASE.
      CATCH zcx_litmus_error INTO DATA(error).
        show_status_message( error ).
    ENDTRY.
  ENDMETHOD.


  METHOD exit_requested.
    result = exit_flag.
  ENDMETHOD.


  METHOD page_installed.
    TRY.
        page_store->read( ).
        result = abap_true.
      CATCH zcx_litmus_error.
        result = abap_false.
    ENDTRY.
  ENDMETHOD.


  METHOD release_control.
    IF html_viewer IS BOUND.
      SET HANDLER on_sapevent FOR html_viewer ACTIVATION abap_false.
      html_viewer->free( EXCEPTIONS OTHERS = 1 ).
      CLEAR html_viewer.
    ENDIF.
  ENDMETHOD.


  METHOD free.
    release_control( ).
    CLEAR: ui_state, last_reply.
  ENDMETHOD.


  METHOD on_sapevent.
    handle_event( action    = CONV #( action )
                  post_data = postdata ).
  ENDMETHOD.


  METHOD handle_event.
    " Top level of a page action: whatever happens, the page is shown again with an answer
    TRY.
        DATA(lines) = bridge->parse_payload( post_data ).
        IF reads_local_files( action = action
                              lines  = lines ) = abap_true.
          keep_ui_state( lines ).
          deferred_action = action.
          deferred_lines = lines.
          cl_gui_cfw=>set_new_ok_code( function_code-pai ).
          RETURN.
        ENDIF.
        CASE action.
          WHEN zif_litmus_action_handler=>action-wsdl_browse.
            keep_ui_state( lines ).
            cl_gui_cfw=>set_new_ok_code( function_code-browse ).
            RETURN.
          WHEN zif_litmus_action_handler=>action-ui_sync.
            " Only the state is kept; the page stays as it is (it posted into a hidden frame)
            keep_ui_state( lines ).
            RETURN.
          WHEN zif_litmus_action_handler=>action-page_install.
            " The file dialog runs in PAI (function code of the former F2 key), not inside the control event
            keep_ui_state( lines ).
            cl_gui_cfw=>set_new_ok_code( function_code-install ).
            RETURN.
          WHEN zif_litmus_action_handler=>action-file_export.
            " Like the installation: the save dialog runs in PAI
            keep_ui_state( lines ).
            pending_export = VALUE #( name    = bridge->value_of( lines = lines
                                                                  name  = `file_name` )
                                      content = bridge->value_of( lines = lines
                                                                  name  = `content` ) ).
            cl_gui_cfw=>set_new_ok_code( function_code-export ).
            RETURN.
          WHEN zif_litmus_action_handler=>action-page_refresh.
            keep_ui_state( lines ).
          WHEN OTHERS.
            IF lines IS INITIAL.
              last_reply = VALUE #( message_type = zif_litmus_action_handler=>message_type-error
                                    message_text = text_catalog->get( zcl_litmus_texts=>key-no_page_data ) ).
            ELSE.
              keep_ui_state( lines ).
              last_reply = handler->handle( action = action
                                            lines  = lines ).
              COMMIT WORK.
            ENDIF.
        ENDCASE.
      CATCH cx_root INTO DATA(unexpected).
        ROLLBACK WORK.
        last_reply = unexpected_error_reply( action = action
                                             error  = unexpected ).
    ENDTRY.

    IF last_reply-exit_requested = abap_true.
      exit_flag = abap_true.
      cl_gui_cfw=>set_new_ok_code( function_code-exit ).
      RETURN.
    ENDIF.
    TRY.
        show_page( ).
      CATCH zcx_litmus_error INTO DATA(error).
        show_status_message( error ).
    ENDTRY.
  ENDMETHOD.


  METHOD create_control.
    DATA events TYPE cntl_simple_events.

    CREATE OBJECT html_viewer
      EXPORTING
        parent               = cl_gui_container=>screen0
        query_table_disabled = abap_true
      EXCEPTIONS
        OTHERS               = 1.
    IF sy-subrc <> 0.
      CLEAR html_viewer.
      text_catalog->raise_error( zcl_litmus_texts=>key-html_control_error ).
    ENDIF.

    " System event: the handler runs at once, without PAI and PBO
    INSERT VALUE cntl_simple_event( eventid    = cl_gui_html_viewer=>m_id_sapevent
                                    appl_event = abap_false ) INTO TABLE events.
    html_viewer->set_registered_events( EXPORTING  events = events
                                        EXCEPTIONS OTHERS = 1 ).
    IF sy-subrc <> 0.
      text_catalog->raise_error( zcl_litmus_texts=>key-html_control_error ).
    ENDIF.
    SET HANDLER on_sapevent FOR html_viewer.
  ENDMETHOD.


  METHOD show_page.
    TRY.
        DATA(page) = page_store->read( ).
      CATCH zcx_litmus_error.
        display( install_page_html( ) ).
        CLEAR last_reply.
        RETURN.
    ENDTRY.
    display( replace( val  = page
                      sub  = zcl_litmus_bridge=>boot_marker
                      with = boot_json( ) ) ).
    CLEAR last_reply.
  ENDMETHOD.


  METHOD display.
    DATA url TYPE c LENGTH 255.

    IF html_viewer IS NOT BOUND.
      RETURN.
    ENDIF.
    DATA(content) = bridge->to_utf8( html ).
    DATA(size) = xstrlen( content ).
    DATA(binary_lines) = cl_bcs_convert=>xstring_to_solix( content ).
    html_viewer->load_data( EXPORTING  type         = 'text'
                                       subtype      = 'html'
                                       size         = size
                            IMPORTING  assigned_url = url
                            CHANGING   data_table   = binary_lines
                            EXCEPTIONS OTHERS       = 1 ).
    IF sy-subrc <> 0.
      text_catalog->raise_error( zcl_litmus_texts=>key-html_control_error ).
    ENDIF.
    html_viewer->show_url( EXPORTING  url    = url
                           EXCEPTIONS OTHERS = 1 ).
    IF sy-subrc <> 0.
      text_catalog->raise_error( zcl_litmus_texts=>key-html_control_error ).
    ENDIF.
  ENDMETHOD.


  METHOD boot_json.
    result = bridge->build_boot( VALUE #( language     = text_catalog->language_code( )
                                          user         = sy-uname
                                          system       = |{ sy-sysid }/{ sy-mandt }|
                                          settings     = handler->settings_json( )
                                          ui           = ui_state
                                          workspace    = handler->workspace_json( )
                                          message_type = last_reply-message_type
                                          message_text = last_reply-message_text
                                          reply        = last_reply-json
                                          projects     = handler->project_list_json( ) ) ).
  ENDMETHOD.


  METHOD unexpected_error_reply.
    DATA(text) = error->get_text( ).
    result = VALUE #( json         = |\{"kind":{ bridge->json_string( to_lower( action ) ) },"ok":false,|
                                  && |"message":{ bridge->json_string( text ) }\}|
                      message_type = zif_litmus_action_handler=>message_type-error
                      message_text = text ).
  ENDMETHOD.


  METHOD show_status_message.
    DATA(text) = error->get_bapiret2_struc( )-message.
    MESSAGE text TYPE 'S' DISPLAY LIKE 'E'.
  ENDMETHOD.

  METHOD has_unsaved_changes.
    result = xsdbool( ui_state CS dirty_marker ).
  ENDMETHOD.

  METHOD request_exit_check.
    last_reply = VALUE #( json = exit_check_reply ).
  ENDMETHOD.

  METHOD install_page_html.
    DATA(text) = escape( val    = text_catalog->get( zcl_litmus_texts=>key-page_not_installed )
                         format = cl_abap_format=>e_html_text ).
    DATA(button) = escape( val    = text_catalog->get( zcl_litmus_texts=>key-fkey_install )
                           format = cl_abap_format=>e_html_text ).
    result = |<!DOCTYPE html><html><head><meta charset="utf-8"></head>|
          && |<body style="font:14px Segoe UI,Arial,sans-serif;padding:40px;color:#0F1B2A;background:#F4F6F9">|
          && |<h2>zLitmus</h2><p>{ text }</p>|
          && |<form method="post" action="sapevent:{ zif_litmus_action_handler=>action-page_install }">|
          && |<button type="submit" style="padding:6px 18px;font:inherit">{ button }</button>|
          && |</form></body></html>|.
  ENDMETHOD.

  METHOD keep_ui_state.
    IF lines IS NOT INITIAL.
      ui_state = bridge->value_of( lines = lines
                                   name  = ui_field ).
    ENDIF.
  ENDMETHOD.

  METHOD save_export.
    DATA file_name TYPE string.
    DATA folder TYPE string.
    DATA full_path TYPE string.
    DATA user_action TYPE i.

    cl_gui_frontend_services=>file_save_dialog( EXPORTING  window_title      = |zLitmus|
                                                           default_extension = `xml`
                                                           default_file_name = pending_export-name
                                                           file_filter       = xml_filter
                                                CHANGING   filename          = file_name
                                                           path              = folder
                                                           fullpath          = full_path
                                                           user_action       = user_action
                                                EXCEPTIONS OTHERS            = 1 ).
    IF sy-subrc <> 0 OR user_action = cl_gui_frontend_services=>action_cancel OR full_path IS INITIAL.
      text_catalog->raise_error( zcl_litmus_texts=>key-no_file_selected ).
    ENDIF.

    DATA(content) = bridge->to_utf8( pending_export-content ).
    DATA(binary_lines) = cl_bcs_convert=>xstring_to_solix( content ).
    cl_gui_frontend_services=>gui_download( EXPORTING  bin_filesize = xstrlen( content )
                                                       filename     = full_path
                                                       filetype     = 'BIN'
                                            CHANGING   data_tab     = binary_lines
                                            EXCEPTIONS OTHERS       = 1 ).
    IF sy-subrc <> 0.
      text_catalog->raise_error( text_key   = zcl_litmus_texts=>key-file_write_error
                                 variable_1 = full_path ).
    ENDIF.
    CLEAR pending_export.
    DATA(saved_text) = text_catalog->format( text_key   = zcl_litmus_texts=>key-file_saved
                                             variable_1 = full_path ).
    MESSAGE saved_text TYPE 'S'.
  ENDMETHOD.

  METHOD browse_wsdl.
    DATA files TYPE filetable.
    DATA return_code TYPE i.
    DATA user_action TYPE i.

    cl_gui_frontend_services=>file_open_dialog( EXPORTING  window_title = |zLitmus - WSDL|
                                                           file_filter  = wsdl_filter
                                                CHANGING   file_table   = files
                                                           rc           = return_code
                                                           user_action  = user_action
                                                EXCEPTIONS OTHERS       = 1 ).
    IF sy-subrc <> 0 OR return_code < 1 OR user_action = cl_gui_frontend_services=>action_cancel.
      result = `{"kind":"wsdl_file","ok":false}`.
      RETURN.
    ENDIF.
    DATA(url) = urls->file_url( CONV #( files[ 1 ]-filename ) ).
    result = |\{"kind":"wsdl_file","ok":true,"url":{ bridge->json_string( url ) }\}|.
  ENDMETHOD.

  METHOD reads_local_files.
    result = xsdbool( ( action = zif_litmus_action_handler=>action-project_create
                        OR action = zif_litmus_action_handler=>action-project_refresh_wsdl )
                      AND urls->is_file( bridge->value_of( lines = lines
                                                           name  = wsdl_url_field ) ) = abap_true ).
  ENDMETHOD.

  METHOD run_deferred_action.
    DATA(action) = deferred_action.
    DATA(lines) = deferred_lines.
    CLEAR: deferred_action, deferred_lines.
    TRY.
        last_reply = handler->handle( action = action
                                      lines  = lines ).
        COMMIT WORK.
      CATCH cx_root INTO DATA(unexpected).
        ROLLBACK WORK.
        last_reply = unexpected_error_reply( action = action
                                             error  = unexpected ).
    ENDTRY.
  ENDMETHOD.
ENDCLASS.


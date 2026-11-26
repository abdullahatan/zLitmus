"! <p class="shorttext synchronized">zLitmus - page in the MIME repository</p>
"! The page lives at PAGE_URL in the local package $ZLITMUS, so no transport is asked for.
CLASS zcl_litmus_page_store DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_litmus_page_store.

    CONSTANTS page_url TYPE string VALUE `/SAP/PUBLIC/ZLITMUS/zlitmus.html`.
    CONSTANTS folder_url TYPE string VALUE `/SAP/PUBLIC/ZLITMUS`.
    CONSTANTS package TYPE devclass VALUE '$ZLITMUS'.

    METHODS constructor
      IMPORTING
        texts  TYPE REF TO zif_litmus_texts
        bridge TYPE REF TO zcl_litmus_bridge.

  PRIVATE SECTION.
    CONSTANTS file_filter TYPE string VALUE `HTML (*.html)|*.html`.
    CONSTANTS binary_file TYPE char10 VALUE 'BIN'.
    CONSTANTS put_data_inconsistency TYPE sysubrc VALUE 5.

    DATA texts TYPE REF TO zif_litmus_texts.
    DATA bridge TYPE REF TO zcl_litmus_bridge.
    DATA mime TYPE REF TO if_mr_api.
    DATA cached_page TYPE string.

    METHODS check_page
      IMPORTING
        html TYPE string
      RAISING
        zcx_litmus_error.

    METHODS chosen_file
      RETURNING
        VALUE(result) TYPE string
      RAISING
        zcx_litmus_error.

    METHODS file_content
      IMPORTING
        file          TYPE string
      RETURNING
        VALUE(result) TYPE xstring
      RAISING
        zcx_litmus_error.

    METHODS write_to_mime
      IMPORTING
        content TYPE xstring
      RAISING
        zcx_litmus_error.

    "! Return code of PUT (0 = written)
    METHODS put_page
      IMPORTING
        content       TYPE xstring
      RETURNING
        VALUE(result) TYPE sysubrc.

ENDCLASS.



CLASS zcl_litmus_page_store IMPLEMENTATION.

  METHOD constructor.
    me->texts = texts.
    me->bridge = bridge.
    mime = cl_mime_repository_api=>get_api( ).
  ENDMETHOD.


  METHOD zif_litmus_page_store~read.
    DATA content TYPE xstring.

    IF cached_page IS NOT INITIAL.
      result = cached_page.
      RETURN.
    ENDIF.
    mime->get( EXPORTING  i_url              = page_url
                          i_check_authority  = abap_false
               IMPORTING  e_content          = content
               EXCEPTIONS parameter_missing  = 1
                          error_occured      = 2
                          not_found          = 3
                          permission_failure = 4
                          OTHERS             = 5 ).
    IF sy-subrc <> 0 OR content IS INITIAL.
      texts->raise_error( zcl_litmus_texts=>key-page_not_installed ).
    ENDIF.
    result = bridge->from_utf8( content ).
    check_page( result ).
    cached_page = result.
  ENDMETHOD.


  METHOD zif_litmus_page_store~install_from_frontend.
    DATA(content) = file_content( chosen_file( ) ).
    DATA(html) = bridge->from_utf8( content ).
    check_page( html ).
    write_to_mime( content ).
    cached_page = html.
  ENDMETHOD.


  METHOD check_page.
    IF find( val = html sub = zcl_litmus_bridge=>page_marker ) < 0
        OR find( val = html sub = zcl_litmus_bridge=>boot_marker ) < 0.
      texts->raise_error( zcl_litmus_texts=>key-page_invalid ).
    ENDIF.
  ENDMETHOD.


  METHOD chosen_file.
    DATA files TYPE filetable.
    DATA return_code TYPE i.
    DATA user_action TYPE i.

    cl_gui_frontend_services=>file_open_dialog( EXPORTING  window_title = |zLitmus - zlitmus.html|
                                                           file_filter  = file_filter
                                                CHANGING   file_table   = files
                                                           rc           = return_code
                                                           user_action  = user_action
                                                EXCEPTIONS OTHERS       = 1 ).
    IF sy-subrc <> 0 OR return_code < 1 OR user_action = cl_gui_frontend_services=>action_cancel.
      texts->raise_error( zcl_litmus_texts=>key-no_file_selected ).
    ENDIF.
    result = files[ 1 ]-filename.
  ENDMETHOD.


  METHOD file_content.
    DATA binary_lines TYPE solix_tab.
    DATA length TYPE i.

    cl_gui_frontend_services=>gui_upload( EXPORTING  filename   = file
                                                     filetype   = binary_file
                                          IMPORTING  filelength = length
                                          CHANGING   data_tab   = binary_lines
                                          EXCEPTIONS OTHERS     = 1 ).
    IF sy-subrc <> 0 OR length = 0.
      texts->raise_error( text_key   = zcl_litmus_texts=>key-file_read_error
                          variable_1 = file ).
    ENDIF.
    result = cl_bcs_convert=>solix_to_xstring( it_solix = binary_lines
                                               iv_size  = length ).
  ENDMETHOD.


  METHOD write_to_mime.
    " The folder usually exists already; PUT reports what really matters
    mime->create_folder( EXPORTING  i_url                     = folder_url
                                    i_description             = `zLitmus`
                                    i_suppress_package_dialog = abap_true
                                    i_dev_package             = package
                                    i_suppress_dialogs        = abap_true
                         EXCEPTIONS OTHERS                    = 1 ).

    DATA(return_code) = put_page( content ).
    IF return_code = put_data_inconsistency.
      " The stored object has no content in its original language: replace the object
      mime->delete( EXPORTING  i_url              = page_url
                               i_suppress_dialogs = abap_true
                    EXCEPTIONS OTHERS             = 1 ).
      return_code = put_page( content ).
    ENDIF.

    IF return_code <> 0.
      ROLLBACK WORK.
      texts->raise_error( text_key   = zcl_litmus_texts=>key-mime_write_error
                          variable_1 = page_url
                          variable_2 = |{ return_code }| ).
    ENDIF.
    COMMIT WORK.
  ENDMETHOD.


  METHOD put_page.
    mime->put( EXPORTING  i_url                     = page_url
                          i_content                 = content
                          i_language                = space
                          i_description             = `zLitmus page`
                          i_suppress_package_dialog = abap_true
                          i_dev_package             = package
                          i_suppress_dialogs        = abap_true
               EXCEPTIONS parameter_missing         = 1
                          error_occured             = 2
                          cancelled                 = 3
                          permission_failure        = 4
                          data_inconsistency        = 5
                          new_loio_already_exists   = 6
                          is_folder                 = 7
                          OTHERS                    = 8 ).
    result = sy-subrc.
  ENDMETHOD.

ENDCLASS.


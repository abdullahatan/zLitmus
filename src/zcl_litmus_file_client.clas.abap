"! <p class="shorttext synchronized">zLitmus - WSDL documents from the PC (file:) or the network</p>
"! file: URLs are read on the PC of the user with SAP GUI (only in PAI, see ZCL_LITMUS_APP); every
"! other URL goes to the HTTP client of the application server.
CLASS zcl_litmus_file_client DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_litmus_http_client.

    METHODS constructor
      IMPORTING
        http_client TYPE REF TO zif_litmus_http_client
        texts       TYPE REF TO zif_litmus_texts.

  PRIVATE SECTION.
    CONSTANTS binary_file TYPE char10 VALUE 'BIN'.
    CONSTANTS xml_type TYPE string VALUE `text/xml`.

    DATA http_client TYPE REF TO zif_litmus_http_client.
    DATA texts TYPE REF TO zif_litmus_texts.
    DATA urls TYPE REF TO zcl_litmus_url.

    METHODS read_file
      IMPORTING
        url           TYPE string
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>http_response.

ENDCLASS.



CLASS zcl_litmus_file_client IMPLEMENTATION.

  METHOD constructor.
    me->http_client = http_client.
    me->texts = texts.
    urls = NEW #( ).
  ENDMETHOD.


  METHOD zif_litmus_http_client~send.
    result = COND #( WHEN urls->is_file( request-url ) = abap_true
                     THEN read_file( request-url )
                     ELSE http_client->send( request ) ).
  ENDMETHOD.


  METHOD read_file.
    DATA binary_lines TYPE solix_tab.
    DATA length TYPE i.

    DATA(path) = urls->local_path( url ).
    DATA(timer) = cl_abap_runtime=>create_hr_timer( ).
    cl_gui_frontend_services=>gui_upload( EXPORTING  filename   = path
                                                     filetype   = binary_file
                                          IMPORTING  filelength = length
                                          CHANGING   data_tab   = binary_lines
                                          EXCEPTIONS OTHERS     = 1 ).
    IF sy-subrc <> 0 OR length = 0.
      result = VALUE #( received = abap_false
                        message  = texts->format( text_key   = zcl_litmus_texts=>key-file_read_error
                                                  variable_1 = path ) ).
      RETURN.
    ENDIF.
    result = VALUE #( received = abap_true
                      status   = 200
                      reason   = `OK`
                      time_ms  = timer->get_runtime( ) DIV 1000
                      headers  = VALUE #( ( name = `content-type` value = xml_type ) )
                      body     = cl_bcs_convert=>solix_to_xstring( it_solix = binary_lines
                                                                   iv_size  = length ) ).
  ENDMETHOD.

ENDCLASS.

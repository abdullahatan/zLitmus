"! Remembers the last request and answers 200
CLASS ltd_http_client DEFINITION FINAL FOR TESTING.

  PUBLIC SECTION.
    INTERFACES zif_litmus_http_client.

    DATA last_url TYPE string READ-ONLY.

ENDCLASS.


CLASS ltd_http_client IMPLEMENTATION.

  METHOD zif_litmus_http_client~send.
    last_url = request-url.
    result = VALUE #( received = abap_true
                      status   = 200
                      reason   = `OK` ).
  ENDMETHOD.

ENDCLASS.


"! The file branch needs SAP GUI (GUI_UPLOAD) and is checked in the acceptance test
CLASS ltc_file_client DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    DATA http TYPE REF TO ltd_http_client.
    DATA cut TYPE REF TO zif_litmus_http_client.

    METHODS setup.
    METHODS network_urls_go_to_the_server FOR TESTING.
ENDCLASS.


CLASS ltc_file_client IMPLEMENTATION.

  METHOD setup.
    http = NEW #( ).
    cut = NEW zcl_litmus_file_client( http_client = http
                                      texts       = zcl_litmus_texts=>create( 'E' ) ).
  ENDMETHOD.


  METHOD network_urls_go_to_the_server.
    DATA(result) = cut->send( VALUE #( method = `GET`
                                       url    = `https://h/service?wsdl` ) ).

    cl_abap_unit_assert=>assert_equals( act = http->last_url
                                        exp = `https://h/service?wsdl` ).
    cl_abap_unit_assert=>assert_equals( act = result-status
                                        exp = 200 ).
  ENDMETHOD.

ENDCLASS.

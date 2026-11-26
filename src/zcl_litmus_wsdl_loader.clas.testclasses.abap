"! Answers from a fixed table of URL -> response; unknown URLs get 404
CLASS ltd_http_client DEFINITION FINAL FOR TESTING.

  PUBLIC SECTION.
    INTERFACES zif_litmus_http_client.

    TYPES:
      BEGIN OF answer,
        url      TYPE string,
        response TYPE zif_litmus_types=>http_response,
      END OF answer.
    TYPES answer_list TYPE STANDARD TABLE OF answer WITH EMPTY KEY.

    DATA requested_urls TYPE string_table READ-ONLY.
    DATA last_request TYPE zif_litmus_types=>http_request READ-ONLY.

    METHODS answer_xml
      IMPORTING
        url TYPE string
        xml TYPE string.

    METHODS answer_status
      IMPORTING
        url      TYPE string
        response TYPE zif_litmus_types=>http_response.

  PRIVATE SECTION.
    DATA answers TYPE answer_list.

ENDCLASS.


CLASS ltd_http_client IMPLEMENTATION.

  METHOD zif_litmus_http_client~send.
    INSERT request-url INTO TABLE requested_urls.
    last_request = request.
    result = VALUE #( answers[ url = request-url ]-response
                      DEFAULT VALUE #( received = abap_true
                                       status   = 404
                                       reason   = `Not Found` ) ).
  ENDMETHOD.


  METHOD answer_xml.
    INSERT VALUE #( url      = url
                    response = VALUE #( received = abap_true
                                        status   = 200
                                        reason   = `OK`
                                        headers  = VALUE #( ( name = `Content-Type` value = `text/xml` ) )
                                        body     = cl_abap_codepage=>convert_to( xml ) ) ) INTO TABLE answers.
  ENDMETHOD.


  METHOD answer_status.
    INSERT VALUE #( url      = url
                    response = response ) INTO TABLE answers.
  ENDMETHOD.

ENDCLASS.


CLASS ltc_wsdl_loader DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    DATA http TYPE REF TO ltd_http_client.
    DATA cut TYPE REF TO zcl_litmus_wsdl_loader.

    METHODS setup.
    METHODS three_level_import_chain FOR TESTING.
    METHODS cyclic_import_loads_once FOR TESTING.
    METHODS missing_child_is_reported FOR TESTING.
    METHODS unauthorized_wsdl_asks_auth FOR TESTING.
    METHODS escaped_ampersand_in_location FOR TESTING.
    METHODS credentials_are_passed_on FOR TESTING.
    METHODS local_file_reads_neighbours FOR TESTING.
    METHODS remote_wsdl_never_reads_the_pc FOR TESTING.

    METHODS load
      IMPORTING
        url           TYPE string
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>wsdl_package.
ENDCLASS.


CLASS ltc_wsdl_loader IMPLEMENTATION.

  METHOD setup.
    http = NEW #( ).
    cut = NEW #( http ).
  ENDMETHOD.


  METHOD three_level_import_chain.
    http->answer_xml( url = `http://h/svc/main.wsdl`
                      xml = `<wsdl:definitions><wsdl:import namespace="urn:a" location="level1.wsdl"/>`
                         && `</wsdl:definitions>` ).
    http->answer_xml( url = `http://h/svc/level1.wsdl`
                      xml = |<definitions><types><xs:schema>\n  <xs:import namespace="urn:b"\n|
                         && |    schemaLocation='xsd/level2.xsd' /></xs:schema></types></definitions>| ).
    http->answer_xml( url = `http://h/svc/xsd/level2.xsd`
                      xml = `<xsd:schema><xsd:include schemaLocation="../common/level3.xsd"/></xsd:schema>` ).
    http->answer_xml( url = `http://h/svc/common/level3.xsd`
                      xml = `<xsd:schema><xsd:element name="import"/></xsd:schema>` ).

    DATA(result) = load( `http://h/svc/main.wsdl` ).

    cl_abap_unit_assert=>assert_equals( act = http->requested_urls
                                        exp = VALUE string_table( ( `http://h/svc/main.wsdl` )
                                                                  ( `http://h/svc/level1.wsdl` )
                                                                  ( `http://h/svc/xsd/level2.xsd` )
                                                                  ( `http://h/svc/common/level3.xsd` ) ) ).
    cl_abap_unit_assert=>assert_false( result-auth_required ).
    cl_abap_unit_assert=>assert_equals( act = result-documents[ 4 ]-content_type
                                        exp = `text/xml` ).
  ENDMETHOD.


  METHOD cyclic_import_loads_once.
    http->answer_xml( url = `http://h/a.xsd`
                      xml = `<schema><include schemaLocation="b.xsd"/></schema>` ).
    http->answer_xml( url = `http://h/b.xsd`
                      xml = `<schema><include schemaLocation="a.xsd"/><redefine schemaLocation="b.xsd"/></schema>` ).

    DATA(result) = load( `http://h/a.xsd` ).

    cl_abap_unit_assert=>assert_equals( act = lines( result-documents )
                                        exp = 2 ).
    cl_abap_unit_assert=>assert_equals( act = lines( http->requested_urls )
                                        exp = 2 ).
  ENDMETHOD.


  METHOD missing_child_is_reported.
    http->answer_xml( url = `http://h/main.wsdl`
                      xml = `<definitions><!-- <xs:import schemaLocation="hidden.xsd"/> -->`
                         && `<xs:import schemaLocation="missing.xsd"/></definitions>` ).

    DATA(result) = load( `http://h/main.wsdl` ).

    cl_abap_unit_assert=>assert_equals( act = lines( result-documents )
                                        exp = 2 ).
    cl_abap_unit_assert=>assert_initial( result-documents[ 1 ]-error ).
    cl_abap_unit_assert=>assert_equals( act = result-documents[ 2 ]-error
                                        exp = `HTTP 404 Not Found` ).
    cl_abap_unit_assert=>assert_false( result-auth_required ).
  ENDMETHOD.


  METHOD unauthorized_wsdl_asks_auth.
    http->answer_status( url      = `http://h/secure?wsdl`
                         response = VALUE #( received = abap_true
                                             status   = 401
                                             reason   = `Unauthorized`
                                             headers  = VALUE #( ( name  = `WWW-Authenticate`
                                                                   value = `Basic realm="SAP [DEV/100]"` ) ) ) ).

    DATA(result) = load( `http://h/secure?wsdl` ).

    cl_abap_unit_assert=>assert_true( result-auth_required ).
    cl_abap_unit_assert=>assert_equals( act = result-realm
                                        exp = `SAP [DEV/100]` ).
    cl_abap_unit_assert=>assert_equals( act = lines( result-documents )
                                        exp = 1 ).
  ENDMETHOD.


  METHOD escaped_ampersand_in_location.
    http->answer_xml( url = `http://h/svc/main.wsdl`
                      xml = `<definitions><import location="types.xsd?a=1&amp;b=2"/></definitions>` ).

    load( `http://h/svc/main.wsdl` ).

    cl_abap_unit_assert=>assert_equals( act = http->requested_urls[ 2 ]
                                        exp = `http://h/svc/types.xsd?a=1&b=2` ).
  ENDMETHOD.


  METHOD credentials_are_passed_on.
    http->answer_xml( url = `http://h/main.wsdl`
                      xml = `<definitions/>` ).

    cut->load( url         = `http://h/main.wsdl`
               credentials = VALUE #( user = `ALICE` password = `secret` )
               connection  = VALUE #( timeout_sec = 30 ) ).

    cl_abap_unit_assert=>assert_equals( act = http->last_request-credentials-user
                                        exp = `ALICE` ).
    cl_abap_unit_assert=>assert_equals( act = http->last_request-connection-timeout_sec
                                        exp = 30 ).
    cl_abap_unit_assert=>assert_equals( act = http->last_request-method
                                        exp = `GET` ).
  ENDMETHOD.


  METHOD local_file_reads_neighbours.
    http->answer_xml( url = `file:///C:/WSDL/main.wsdl`
                      xml = `<definitions><types><xs:schema><xs:import schemaLocation="types.xsd"/>`
                         && `<xs:import schemaLocation="https://h/common.xsd"/></xs:schema></types></definitions>` ).
    http->answer_xml( url = `file:///C:/WSDL/types.xsd`
                      xml = `<xsd:schema/>` ).
    http->answer_xml( url = `https://h/common.xsd`
                      xml = `<xsd:schema/>` ).

    load( `file:///C:/WSDL/main.wsdl` ).

    cl_abap_unit_assert=>assert_equals( act = http->requested_urls
                                        exp = VALUE string_table( ( `file:///C:/WSDL/main.wsdl` )
                                                                  ( `file:///C:/WSDL/types.xsd` )
                                                                  ( `https://h/common.xsd` ) ) ).
  ENDMETHOD.


  METHOD remote_wsdl_never_reads_the_pc.
    http->answer_xml( url = `http://h/main.wsdl`
                      xml = `<definitions><wsdl:import location="file:///C:/Windows/win.ini"/></definitions>` ).

    load( `http://h/main.wsdl` ).

    cl_abap_unit_assert=>assert_equals( act = http->requested_urls
                                        exp = VALUE string_table( ( `http://h/main.wsdl` ) ) ).
  ENDMETHOD.


  METHOD load.
    result = cut->load( url         = url
                        credentials = VALUE #( )
                        connection  = VALUE #( ) ).
  ENDMETHOD.

ENDCLASS.

CLASS ltc_bridge DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    " Built by Bridge.encode of the page for: V ui {"a":"Şğİ\t"} (JSON text) / V body <x><LF><TAB>çö</x> /
    " H SOAPAction "urn:a" / V empty ''
    CONSTANTS page_payload TYPE string
      VALUE `Vgl1aQlleUpoSWpvaXhaN0VuOFN3WEhRaWZRPT0KVglib2R5CVBIZytDZ25EcDhPMlBDOTRQZz09CkgJU09BUE`
         & `FjdGlvbglJblZ5YmpwaElnPT0KVgllbXB0eQk=`.

    CONSTANTS escaped_less_than TYPE string VALUE `\` & `u003c`.

    DATA cut TYPE REF TO zcl_litmus_bridge.

    METHODS setup.
    METHODS payload_lines_from_page FOR TESTING.
    METHODS form_post_in_char_lines FOR TESTING.
    METHODS form_post_in_hex_lines FOR TESTING.
    METHODS headers_keep_page_order FOR TESTING.
    METHODS json_string_escapes FOR TESTING.
    METHODS boot_hides_script_end FOR TESTING.
    METHODS empty_post_gives_no_lines FOR TESTING.
    METHODS request_send_from_page FOR TESTING.

    METHODS form_body
      RETURNING
        VALUE(result) TYPE string.

    " Built by Bridge.encode of the page for a REQUEST_SEND (web/test/bridge.test.mjs, SEND_PAYLOAD)
    METHODS send_payload
      RETURNING
        VALUE(result) TYPE string.
ENDCLASS.


CLASS ltc_bridge IMPLEMENTATION.

  METHOD setup.
    cut = NEW #( ).
  ENDMETHOD.


  METHOD payload_lines_from_page.
    DATA(result) = cut->lines_of( page_payload ).

    cl_abap_unit_assert=>assert_equals( act = lines( result )
                                        exp = 4 ).
    cl_abap_unit_assert=>assert_equals( act = cut->value_of( lines = result name = `ui` )
                                        exp = `{"a":"Şğİ\t"}` ).
    cl_abap_unit_assert=>assert_equals(
      act = cut->value_of( lines = result name = `body` )
      exp = |<x>{ cl_abap_char_utilities=>newline }{ cl_abap_char_utilities=>horizontal_tab }çö</x>| ).
    cl_abap_unit_assert=>assert_equals( act = result[ key = `H` name = `SOAPAction` ]-value
                                        exp = `"urn:a"` ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( result[ key = `V` name = `empty` ] ) ) ).
    cl_abap_unit_assert=>assert_initial( cut->value_of( lines = result name = `empty` ) ).
  ENDMETHOD.


  METHOD form_post_in_char_lines.
    DATA post_data TYPE cnht_post_data_tab.
    DATA(body) = form_body( ).
    WHILE body IS NOT INITIAL.
      DATA(chunk_length) = nmin( val1 = 40 val2 = strlen( body ) ).
      INSERT CONV #( substring( val = body len = chunk_length ) ) INTO TABLE post_data.
      body = substring( val = body off = chunk_length ).
    ENDWHILE.

    DATA(result) = cut->parse_payload( post_data ).

    cl_abap_unit_assert=>assert_equals( act = result
                                        exp = cut->lines_of( page_payload ) ).
  ENDMETHOD.


  METHOD form_post_in_hex_lines.
    TYPES hex_line TYPE x LENGTH 16.
    DATA post_data TYPE STANDARD TABLE OF hex_line WITH EMPTY KEY.
    DATA(bytes) = cut->to_utf8( form_body( ) ).
    WHILE bytes IS NOT INITIAL.
      DATA(chunk_length) = nmin( val1 = 16 val2 = xstrlen( bytes ) ).
      INSERT CONV #( bytes(chunk_length) ) INTO TABLE post_data.
      bytes = bytes+chunk_length.
    ENDWHILE.

    DATA(result) = cut->parse_payload( post_data ).

    cl_abap_unit_assert=>assert_equals( act = result
                                        exp = cut->lines_of( page_payload ) ).
  ENDMETHOD.


  METHOD headers_keep_page_order.
    DATA(lines) = VALUE zif_litmus_types=>page_lines( ( key = `H` name = `B` value = `2` )
                                                      ( key = `V` name = `url` value = `x` )
                                                      ( key = `H` name = `A` value = `1` ) ).

    DATA(result) = cut->headers_of( lines ).

    cl_abap_unit_assert=>assert_equals( act = result
                                        exp = VALUE zif_litmus_types=>headers( ( name = `B` value = `2` )
                                                                               ( name = `A` value = `1` ) ) ).
  ENDMETHOD.


  METHOD json_string_escapes.
    DATA(result) = cut->json_string( |a"b\\c{ cl_abap_char_utilities=>newline }</script>| ).

    cl_abap_unit_assert=>assert_equals( act = result
                                        exp = `"a\"b\\c\n` && escaped_less_than && `/script>"` ).
  ENDMETHOD.


  METHOD boot_hides_script_end.
    DATA(result) = cut->build_boot( VALUE #( language = `tr`
                                             user     = `ALICE`
                                             system   = `DEV/100`
                                             reply    = `{"kind":"x","text":"</script>"}`
                                             projects = `[{"name":"A"}]` ) ).

    cl_abap_unit_assert=>assert_char_np( act = result
                                         exp = '*</script>*' ).
    cl_abap_unit_assert=>assert_char_cp( act = result
                                         exp = '*"lang":"tr"*"projects":[{"name":"A"}],"message":null*' ).
    cl_abap_unit_assert=>assert_char_cp(
      act = result
      exp = `*"reply":{"kind":"x","text":"` && escaped_less_than && `/script>"}}` ).
  ENDMETHOD.


  METHOD empty_post_gives_no_lines.
    DATA post_data TYPE cnht_post_data_tab.

    DATA(result) = cut->parse_payload( post_data ).

    cl_abap_unit_assert=>assert_initial( result ).
  ENDMETHOD.


  METHOD request_send_from_page.
    DATA post_data TYPE cnht_post_data_tab.
    DATA(body) = |payload={ escape( val = send_payload( ) format = cl_abap_format=>e_url_full ) }|.
    WHILE body IS NOT INITIAL.
      DATA(chunk_length) = nmin( val1 = 255 val2 = strlen( body ) ).
      INSERT CONV #( substring( val = body len = chunk_length ) ) INTO TABLE post_data.
      body = substring( val = body off = chunk_length ).
    ENDWHILE.

    DATA(result) = cut->parse_payload( post_data ).

    cl_abap_unit_assert=>assert_equals( act = cut->value_of( lines = result name = `url` )
                                        exp = `https://host:8443/sap/bc/srt/x?sap-client=100` ).
    cl_abap_unit_assert=>assert_equals( act = cut->value_of( lines = result name = `body` )
                                        exp = `<a>Iğdır & "çay" </a>` ).
    cl_abap_unit_assert=>assert_equals( act = cut->value_of( lines = result name = `pass` )
                                        exp = `p@ss:w0rd+/=` ).
    cl_abap_unit_assert=>assert_equals( act = cut->value_of( lines = result name = `project_id` )
                                        exp = `0123456789ABCDEF0123456789ABCDEF` ).
    cl_abap_unit_assert=>assert_equals(
      act = cut->headers_of( result )
      exp = VALUE zif_litmus_types=>headers( ( name = `SOAPAction` value = `"urn:x"` )
                                             ( name = `Content-Type` value = `text/xml;charset=UTF-8` ) ) ).
  ENDMETHOD.


  METHOD send_payload.
    result = `Vgl1aQlleUoyWlhKemFXOXVJam94TENKMFlXSnpJanBiWFgwPQpWCXByb2plY3RfaWQJTURFeU16UTFOamM0T1VGQ1`
          && `EwUkZSakF4TWpNME5UWTNPRGxCUWtORVJVWT0KVglyZXF1ZXN0X2lkCVJrVkVRMEpCT1RnM05qVTBNekl4TUVaRlJF`
          && `TkNRVGs0TnpZMU5ETXlNVEE9ClYJdXJsCWFIUjBjSE02THk5b2IzTjBPamcwTkRNdmMyRndMMkpqTDNOeWRDOTRQM0`
          && `5oY0MxamJHbGxiblE5TVRBdwpWCWJvZHkJUEdFK1NjU2ZaTVN4Y2lBbUlDTERwMkY1SWlBOEwyRSsKVglhdXRoX3R5`
          && `cGUJUWtGVFNVTT0KVgl1c2VyCVFVeEpRMFU9ClYJcGFzcwljRUJ6Y3pwM01ISmtLeTg5ClYJdGltZW91dAlNekE9Ck`
          && `gJU09BUEFjdGlvbglJblZ5YmpwNElnPT0KSAlDb250ZW50LVR5cGUJZEdWNGRDOTRiV3c3WTJoaGNuTmxkRDFWVkVZ`
          && `dE9BPT0=`.
  ENDMETHOD.


  METHOD form_body.
    " As the browser posts the form: other fields, then payload with "+", "/" and "=" escaped
    result = `x=1&payload=` && escape( val = page_payload format = cl_abap_format=>e_url_full ) && `&y=2`.
  ENDMETHOD.

ENDCLASS.

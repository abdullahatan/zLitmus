CLASS ltc_texts DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    METHODS turkish_logon_gives_turkish FOR TESTING.
    METHODS german_logon_gives_english FOR TESTING.
    METHODS every_key_in_both_languages FOR TESTING.
    METHODS unknown_key_gives_the_key FOR TESTING.
    METHODS error_message_has_variables FOR TESTING.
    METHODS long_variable_is_not_cut FOR TESTING.

    METHODS key_names
      RETURNING
        VALUE(result) TYPE string_table.
ENDCLASS.


CLASS ltc_texts IMPLEMENTATION.

  METHOD turkish_logon_gives_turkish.
    DATA(cut) = zcl_litmus_texts=>create( 'T' ).

    DATA(result) = cut->get( zcl_litmus_texts=>key-saved ).

    cl_abap_unit_assert=>assert_equals( act = result
                                        exp = `Kaydedildi.` ).
    cl_abap_unit_assert=>assert_equals( act = cut->language_code( )
                                        exp = `tr` ).
  ENDMETHOD.


  METHOD german_logon_gives_english.
    DATA(cut) = zcl_litmus_texts=>create( 'D' ).

    DATA(result) = cut->get( zcl_litmus_texts=>key-saved ).

    cl_abap_unit_assert=>assert_equals( act = result
                                        exp = `Saved.` ).
    cl_abap_unit_assert=>assert_equals( act = cut->language_code( )
                                        exp = `en` ).
  ENDMETHOD.


  METHOD every_key_in_both_languages.
    DATA(turkish) = zcl_litmus_texts=>create( 'T' ).
    DATA(english) = zcl_litmus_texts=>create( 'E' ).

    LOOP AT key_names( ) INTO DATA(name).
      cl_abap_unit_assert=>assert_differs( act = turkish->get( name )
                                           exp = name
                                           msg = |No Turkish text for { name }| ).
      cl_abap_unit_assert=>assert_differs( act = english->get( name )
                                           exp = name
                                           msg = |No English text for { name }| ).
    ENDLOOP.
  ENDMETHOD.


  METHOD unknown_key_gives_the_key.
    DATA(cut) = zcl_litmus_texts=>create( 'E' ).

    DATA(result) = cut->get( `NO_SUCH_KEY` ).

    cl_abap_unit_assert=>assert_equals( act = result
                                        exp = `NO_SUCH_KEY` ).
  ENDMETHOD.


  METHOD error_message_has_variables.
    DATA(cut) = zcl_litmus_texts=>create( 'T' ).

    TRY.
        cut->raise_error( text_key   = zcl_litmus_texts=>key-connection_error
                          variable_1 = `400`
                          variable_2 = `NIECONN_REFUSED` ).
        cl_abap_unit_assert=>fail( `No exception` ).
      CATCH zcx_litmus_error INTO DATA(error).
        cl_abap_unit_assert=>assert_equals( act = error->get_bapiret2_struc( )-message
                                            exp = `İstek gönderilemedi (kod 400): NIECONN_REFUSED` ).
    ENDTRY.
  ENDMETHOD.


  METHOD long_variable_is_not_cut.
    DATA(cut) = zcl_litmus_texts=>create( 'E' ).
    DATA(url) = `http://host.example.com:8000/sap/bc/srt/rfc/sap/service_name/100/binding?sap-client=100`.

    TRY.
        cut->raise_error( text_key   = zcl_litmus_texts=>key-url_invalid
                          variable_1 = url ).
        cl_abap_unit_assert=>fail( `No exception` ).
      CATCH zcx_litmus_error INTO DATA(error).
        cl_abap_unit_assert=>assert_equals( act = error->get_bapiret2_struc( )-message
                                            exp = |Invalid address: { url }| ).
    ENDTRY.
  ENDMETHOD.


  METHOD key_names.
    DATA(keys) = CAST cl_abap_structdescr( cl_abap_typedescr=>describe_by_data( zcl_litmus_texts=>key ) ).
    result = VALUE #( FOR component IN keys->components ( CONV string( component-name ) ) ).
  ENDMETHOD.

ENDCLASS.

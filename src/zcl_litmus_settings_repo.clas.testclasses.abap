CLASS ltc_settings_repo DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    CLASS-DATA environment TYPE REF TO if_osql_test_environment.

    DATA cut TYPE REF TO zif_litmus_settings_repo.

    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.

    METHODS new_user_gets_defaults FOR TESTING RAISING zcx_litmus_error.
    METHODS saved_settings_are_read FOR TESTING RAISING zcx_litmus_error.
    METHODS invalid_timeout_gets_default FOR TESTING RAISING zcx_litmus_error.
ENDCLASS.


CLASS ltc_settings_repo IMPLEMENTATION.

  METHOD class_setup.
    environment = cl_osql_test_environment=>create( i_dependency_list = VALUE #( ( 'ZLITMUS_USET' ) ) ).
  ENDMETHOD.


  METHOD class_teardown.
    environment->destroy( ).
  ENDMETHOD.


  METHOD setup.
    environment->clear_doubles( ).
    cut = NEW zcl_litmus_settings_repo( zcl_litmus_texts=>create( 'E' ) ).
  ENDMETHOD.


  METHOD new_user_gets_defaults.
    DATA(result) = cut->read( 'ALICE' ).

    cl_abap_unit_assert=>assert_equals( act = result-timeout_sec
                                        exp = 60 ).
    cl_abap_unit_assert=>assert_equals( act = result-ssl_id
                                        exp = 'ANONYM' ).
  ENDMETHOD.


  METHOD saved_settings_are_read.
    DATA(settings) = VALUE zif_litmus_types=>settings( timeout_sec = 120
                                                       ssl_id      = 'DFAULT'
                                                       proxy_host  = `proxy.local`
                                                       proxy_port  = `3128`
                                                       ui_prefs    = `{"wrap":true}` ).
    cut->save( uname    = 'ALICE'
               settings = settings ).

    cl_abap_unit_assert=>assert_equals( act = cut->read( 'ALICE' )
                                        exp = settings ).
    cl_abap_unit_assert=>assert_equals( act = cut->read( 'BOB' )-timeout_sec
                                        exp = 60 ).
  ENDMETHOD.


  METHOD invalid_timeout_gets_default.
    cut->save( uname    = 'ALICE'
               settings = VALUE #( timeout_sec = -5 ) ).

    DATA(result) = cut->read( 'ALICE' ).

    cl_abap_unit_assert=>assert_equals( act = result-timeout_sec
                                        exp = 60 ).
    cl_abap_unit_assert=>assert_equals( act = result-ssl_id
                                        exp = 'ANONYM' ).
  ENDMETHOD.

ENDCLASS.

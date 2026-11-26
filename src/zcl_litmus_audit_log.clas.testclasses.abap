CLASS ltc_audit_log DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    CLASS-DATA environment TYPE REF TO if_osql_test_environment.

    DATA cut TYPE REF TO zif_litmus_audit_log.

    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.

    METHODS secrets_in_query_are_masked FOR TESTING RAISING zcx_litmus_error.
    METHODS url_without_query_is_kept FOR TESTING RAISING zcx_litmus_error.
    METHODS entry_fields_are_written FOR TESTING RAISING zcx_litmus_error.

    METHODS logged_url
      RETURNING
        VALUE(result) TYPE string.
ENDCLASS.


CLASS ltc_audit_log IMPLEMENTATION.

  METHOD class_setup.
    environment = cl_osql_test_environment=>create( i_dependency_list = VALUE #( ( 'ZLITMUS_LOG' ) ) ).
  ENDMETHOD.


  METHOD class_teardown.
    environment->destroy( ).
  ENDMETHOD.


  METHOD setup.
    environment->clear_doubles( ).
    cut = NEW zcl_litmus_audit_log( uname = 'ALICE'
                                    texts = zcl_litmus_texts=>create( 'E' ) ).
  ENDMETHOD.


  METHOD secrets_in_query_are_masked.
    cut->write( VALUE #( method = `post`
                         url    = `https://h/x?user=a&password=s3cret&Token=abc&pwd=1&sap-client=100#top` ) ).

    cl_abap_unit_assert=>assert_equals( act = logged_url( )
                                        exp = `https://h/x?user=a&password=***&Token=***&pwd=***&sap-client=100#top` ).
  ENDMETHOD.


  METHOD url_without_query_is_kept.
    cut->write( VALUE #( method = `POST`
                         url    = `https://h/sap/bc/srt/rfc/sap/service` ) ).

    cl_abap_unit_assert=>assert_equals( act = logged_url( )
                                        exp = `https://h/sap/bc/srt/rfc/sap/service` ).
  ENDMETHOD.


  METHOD entry_fields_are_written.
    cut->write( VALUE #( project_id    = '0123456789ABCDEF0123456789ABCDEF'
                         method        = `post`
                         url           = `https://h/s`
                         http_status   = 500
                         duration_ms   = 147
                         response_size = 9321
                         error_text    = `Fault` ) ).

    SELECT SINGLE * FROM zlitmus_log INTO @DATA(row).
    cl_abap_unit_assert=>assert_equals( act = row-uname
                                        exp = 'ALICE' ).
    cl_abap_unit_assert=>assert_equals( act = row-method
                                        exp = 'POST' ).
    cl_abap_unit_assert=>assert_equals( act = row-project_id
                                        exp = '0123456789ABCDEF0123456789ABCDEF' ).
    cl_abap_unit_assert=>assert_equals( act = row-http_status
                                        exp = 500 ).
    cl_abap_unit_assert=>assert_equals( act = row-duration_ms
                                        exp = 147 ).
    cl_abap_unit_assert=>assert_equals( act = row-response_size
                                        exp = 9321 ).
    cl_abap_unit_assert=>assert_not_initial( row-logged_at ).
  ENDMETHOD.


  METHOD logged_url.
    SELECT SINGLE url FROM zlitmus_log INTO @result.
  ENDMETHOD.

ENDCLASS.

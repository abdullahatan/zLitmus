CLASS ltc_project_repo DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    CLASS-DATA environment TYPE REF TO if_osql_test_environment.

    DATA cut TYPE REF TO zif_litmus_project_repo.

    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.

    METHODS created_project_can_be_read FOR TESTING RAISING zcx_litmus_error.
    METHODS save_adds_changes_and_deletes FOR TESTING RAISING zcx_litmus_error.
    METHODS list_counts_requests FOR TESTING RAISING zcx_litmus_error.
    METHODS other_owner_is_rejected FOR TESTING RAISING zcx_litmus_error.
    METHODS same_name_is_rejected FOR TESTING RAISING zcx_litmus_error.
    METHODS empty_name_is_rejected FOR TESTING.
    METHODS rename_and_delete FOR TESTING RAISING zcx_litmus_error.
    METHODS wsdl_cache_round_trip FOR TESTING RAISING zcx_litmus_error.
    METHODS endpoints_and_details_are_kept FOR TESTING RAISING zcx_litmus_error.

    METHODS repository_of
      IMPORTING
        owner         TYPE syuname
      RETURNING
        VALUE(result) TYPE REF TO zif_litmus_project_repo.

    METHODS message_of
      IMPORTING
        error         TYPE REF TO zcx_litmus_error
      RETURNING
        VALUE(result) TYPE string.
ENDCLASS.


CLASS ltc_project_repo IMPLEMENTATION.

  METHOD class_setup.
    environment = cl_osql_test_environment=>create( i_dependency_list = VALUE #( ( 'ZLITMUS_PROJ' )
                                                                                 ( 'ZLITMUS_REQ' ) ) ).
  ENDMETHOD.


  METHOD class_teardown.
    environment->destroy( ).
  ENDMETHOD.


  METHOD setup.
    environment->clear_doubles( ).
    cut = repository_of( 'ALICE' ).
  ENDMETHOD.


  METHOD created_project_can_be_read.
    DATA(header) = cut->create( name     = `  Billing  `
                                wsdl_url = `http://host/billing?wsdl` ).

    DATA(result) = cut->read( header-project_id ).

    cl_abap_unit_assert=>assert_equals( act = result-header-name
                                        exp = `Billing` ).
    cl_abap_unit_assert=>assert_equals( act = result-header-owner
                                        exp = 'ALICE' ).
    cl_abap_unit_assert=>assert_equals( act = result-header-project_type
                                        exp = `SOAP` ).
    cl_abap_unit_assert=>assert_initial( result-requests ).
  ENDMETHOD.


  METHOD save_adds_changes_and_deletes.
    DATA(header) = cut->create( name     = `Billing`
                                wsdl_url = `http://host/billing?wsdl` ).
    DATA(first_save) = cut->save( VALUE #( header   = header
                                           requests = VALUE #(
                                             ( name = `Request 1` operation = `Get` interface_name = `Binding`
                                               headers = VALUE #( ( name = `X-Test` value = `1` ) ) )
                                             ( name = `Request 2` operation = `Get` interface_name = `Binding` ) ) ) ).
    DATA(kept) = first_save-requests[ 1 ].
    kept-body = `<a/>`.

    cut->save( VALUE #( header   = header
                        requests = VALUE #( ( kept )
                                            ( name = `Request 3` operation = `Put` interface_name = `Binding` ) ) ) ).

    DATA(result) = cut->read( header-project_id ).
    cl_abap_unit_assert=>assert_equals( act = lines( result-requests )
                                        exp = 2 ).
    cl_abap_unit_assert=>assert_equals( act = result-requests[ 1 ]-request_id
                                        exp = kept-request_id ).
    cl_abap_unit_assert=>assert_equals( act = result-requests[ 1 ]-body
                                        exp = `<a/>` ).
    cl_abap_unit_assert=>assert_equals( act = result-requests[ 1 ]-headers
                                        exp = kept-headers ).
    cl_abap_unit_assert=>assert_equals( act = result-requests[ 2 ]-name
                                        exp = `Request 3` ).
    cl_abap_unit_assert=>assert_equals( act = result-requests[ 2 ]-position
                                        exp = 2 ).
  ENDMETHOD.


  METHOD list_counts_requests.
    DATA(billing) = cut->create( name     = `Billing`
                                 wsdl_url = `http://host/billing?wsdl` ).
    cut->create( name     = `Orders`
                 wsdl_url = `http://host/orders?wsdl` ).
    repository_of( 'BOB' )->create( name     = `Other`
                                    wsdl_url = `http://host/other?wsdl` ).
    cut->save( VALUE #( header   = billing
                        requests = VALUE #( ( name = `Request 1` ) ( name = `Request 2` ) ) ) ).

    DATA(result) = cut->list_for_owner( ).

    cl_abap_unit_assert=>assert_equals( act = lines( result )
                                        exp = 2 ).
    cl_abap_unit_assert=>assert_equals( act = result[ name = `Billing` ]-request_count
                                        exp = 2 ).
    cl_abap_unit_assert=>assert_equals( act = result[ name = `Orders` ]-request_count
                                        exp = 0 ).
  ENDMETHOD.


  METHOD other_owner_is_rejected.
    DATA(header) = cut->create( name     = `Billing`
                                wsdl_url = `http://host/billing?wsdl` ).

    TRY.
        repository_of( 'BOB' )->read( header-project_id ).
        cl_abap_unit_assert=>fail( `No exception` ).
      CATCH zcx_litmus_error INTO DATA(error).
        cl_abap_unit_assert=>assert_equals( act = message_of( error )
                                            exp = `This project belongs to another user.` ).
    ENDTRY.
  ENDMETHOD.


  METHOD same_name_is_rejected.
    cut->create( name     = `Billing`
                 wsdl_url = `http://host/billing?wsdl` ).

    TRY.
        cut->create( name     = `BILLING`
                     wsdl_url = `http://host/other?wsdl` ).
        cl_abap_unit_assert=>fail( `No exception` ).
      CATCH zcx_litmus_error INTO DATA(error).
        cl_abap_unit_assert=>assert_equals( act = message_of( error )
                                            exp = `A project with this name already exists: BILLING` ).
    ENDTRY.
  ENDMETHOD.


  METHOD empty_name_is_rejected.
    TRY.
        cut->create( name     = `   `
                     wsdl_url = `http://host/billing?wsdl` ).
        cl_abap_unit_assert=>fail( `No exception` ).
      CATCH zcx_litmus_error INTO DATA(error).
        cl_abap_unit_assert=>assert_equals( act = message_of( error )
                                            exp = `The project name must not be empty.` ).
    ENDTRY.
  ENDMETHOD.


  METHOD rename_and_delete.
    DATA(header) = cut->create( name     = `Billing`
                                wsdl_url = `http://host/billing?wsdl` ).
    cut->save( VALUE #( header   = header
                        requests = VALUE #( ( name = `Request 1` ) ) ) ).

    cut->rename( project_id = header-project_id
                 name       = `Invoices` ).
    cl_abap_unit_assert=>assert_equals( act = cut->read( header-project_id )-header-name
                                        exp = `Invoices` ).

    cut->delete( header-project_id ).
    cl_abap_unit_assert=>assert_initial( cut->list_for_owner( ) ).
    SELECT COUNT(*) FROM zlitmus_req INTO @DATA(remaining_requests).
    cl_abap_unit_assert=>assert_equals( act = remaining_requests
                                        exp = 0 ).
  ENDMETHOD.


  METHOD wsdl_cache_round_trip.
    DATA(header) = cut->create( name     = `Billing`
                                wsdl_url = `http://host/billing?wsdl` ).
    DATA(wsdl) = VALUE zif_litmus_types=>wsdl_package(
      url       = `http://host/billing?wsdl`
      loaded_at = '20261125120000.1234567'
      documents = VALUE #( ( url          = `http://host/billing?wsdl`
                             status       = 200
                             content_type = `text/xml; charset=utf-8`
                             content      = cl_abap_codepage=>convert_to( `<definitions>Şğü</definitions>` ) )
                           ( url    = `http://host/types.xsd`
                             status = 404
                             error  = `HTTP 404 Not Found` ) ) ).

    cut->store_wsdl_cache( project_id = header-project_id
                           wsdl       = wsdl ).

    cl_abap_unit_assert=>assert_equals( act = cut->read_wsdl_cache( header-project_id )
                                        exp = wsdl ).
  ENDMETHOD.


  METHOD endpoints_and_details_are_kept.
    DATA(header) = cut->create( name     = `Billing`
                                wsdl_url = `http://host/billing?wsdl` ).
    header-endpoints = VALUE #( ( interface_name = `Binding` url = `http://test-host/billing` ) ).

    cut->save( VALUE #( header   = header
                        requests = VALUE #( ( name        = `Request 1`
                                              description = `Smoke test`
                                              encoding    = `iso-8859-9` ) ) ) ).

    DATA(result) = cut->read( header-project_id ).
    cl_abap_unit_assert=>assert_equals( act = result-header-endpoints
                                        exp = header-endpoints ).
    cl_abap_unit_assert=>assert_equals( act = result-requests[ 1 ]-description
                                        exp = `Smoke test` ).
    cl_abap_unit_assert=>assert_equals( act = result-requests[ 1 ]-encoding
                                        exp = `ISO-8859-9` ).
  ENDMETHOD.


  METHOD repository_of.
    result = NEW zcl_litmus_project_repo( owner = owner
                                          texts = zcl_litmus_texts=>create( 'E' ) ).
  ENDMETHOD.


  METHOD message_of.
    result = error->get_bapiret2_struc( )-message.
  ENDMETHOD.

ENDCLASS.

"! <p class="shorttext synchronized">zLitmus - HTTP client (CL_HTTP_CLIENT)</p>
"! SSL client identity, proxy, timeout, preemptive Basic authentication and duration in ms.
"! A 401 is a normal response: the SAP logon popup is switched off.
CLASS zcl_litmus_http_client DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_litmus_http_client.

    METHODS constructor
      IMPORTING
        texts TYPE REF TO zif_litmus_texts.

  PRIVATE SECTION.
    CONSTANTS default_method TYPE string VALUE `POST`.
    CONSTANTS masked_secret TYPE string VALUE `********`.
    CONSTANTS pseudo_header_prefix TYPE string VALUE `~`.
    CONSTANTS authorization_header TYPE string VALUE `Authorization`.

    CONSTANTS:
      BEGIN OF create_error,
        invalid_url       TYPE i VALUE 1,
        plugin_not_active TYPE i VALUE 2,
      END OF create_error.

    DATA texts TYPE REF TO zif_litmus_texts.

    METHODS creation_failure
      IMPORTING
        return_code   TYPE sysubrc
        url           TYPE string
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>http_response.

    "! Puts method, headers, authorization and body into the client; returns the headers as sent (masked)
    METHODS prepare
      IMPORTING
        client        TYPE REF TO if_http_client
        request       TYPE zif_litmus_types=>http_request
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>headers.

    METHODS basic_authorization
      IMPORTING
        credentials   TYPE zif_litmus_types=>credentials
      RETURNING
        VALUE(result) TYPE string.

    METHODS masked
      IMPORTING
        header        TYPE zif_litmus_types=>header
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>header.

    METHODS is_real_header
      IMPORTING
        name          TYPE string
      RETURNING
        VALUE(result) TYPE abap_bool.

    METHODS timeout_of
      IMPORTING
        connection    TYPE zif_litmus_types=>connection
      RETURNING
        VALUE(result) TYPE i.

    "! Sends and receives; returns the return code of the failed step, 0 when both worked
    METHODS exchange
      IMPORTING
        client        TYPE REF TO if_http_client
        timeout_sec   TYPE i
      RETURNING
        VALUE(result) TYPE sysubrc.

    METHODS communication_failure
      IMPORTING
        client        TYPE REF TO if_http_client
        url           TYPE string
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>http_response.

    METHODS response_of
      IMPORTING
        client        TYPE REF TO if_http_client
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>http_response.

    METHODS hint_for
      IMPORTING
        message       TYPE string
        url           TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS contains_any
      IMPORTING
        text          TYPE string
        words         TYPE string_table
      RETURNING
        VALUE(result) TYPE abap_bool.

ENDCLASS.



CLASS zcl_litmus_http_client IMPLEMENTATION.

  METHOD constructor.
    me->texts = texts.
  ENDMETHOD.


  METHOD zif_litmus_http_client~send.
    DATA client TYPE REF TO if_http_client.

    cl_http_client=>create_by_url( EXPORTING  url                = request-url
                                              ssl_id             = request-connection-ssl_id
                                              proxy_host         = request-connection-proxy_host
                                              proxy_service      = request-connection-proxy_port
                                   IMPORTING  client             = client
                                   EXCEPTIONS argument_not_found = 1
                                              plugin_not_active  = 2
                                              internal_error     = 3
                                              OTHERS             = 4 ).
    IF sy-subrc <> 0.
      result = creation_failure( return_code = sy-subrc
                                 url         = request-url ).
      RETURN.
    ENDIF.

    DATA(sent_headers) = prepare( client  = client
                                  request = request ).
    DATA(timer) = cl_abap_runtime=>create_hr_timer( ).
    DATA(started) = timer->get_runtime( ).
    DATA(return_code) = exchange( client      = client
                                  timeout_sec = timeout_of( request-connection ) ).
    DATA(duration_ms) = ( timer->get_runtime( ) - started ) / 1000.

    result = COND #( WHEN return_code = 0
                     THEN response_of( client )
                     ELSE communication_failure( client = client
                                                 url    = request-url ) ).
    result-time_ms = duration_ms.
    result-sent_headers = sent_headers.
    client->close( EXCEPTIONS OTHERS = 1 ).
  ENDMETHOD.


  METHOD creation_failure.
    CASE return_code.
      WHEN create_error-invalid_url.
        result-message = texts->format( text_key   = zcl_litmus_texts=>key-url_invalid
                                        variable_1 = url ).
      WHEN create_error-plugin_not_active.
        result-message = texts->get( zcl_litmus_texts=>key-icm_inactive ).
        result-hint = texts->get( zcl_litmus_texts=>key-hint_icm ).
      WHEN OTHERS.
        result-message = texts->format( text_key   = zcl_litmus_texts=>key-http_client_error
                                        variable_1 = |{ return_code }| ).
    ENDCASE.
  ENDMETHOD.


  METHOD prepare.
    client->propertytype_logon_popup = if_http_client=>co_disabled.
    client->request->set_method( COND #( WHEN request-method IS INITIAL
                                         THEN default_method
                                         ELSE to_upper( request-method ) ) ).
    client->request->set_version( if_http_request=>co_protocol_version_1_1 ).

    LOOP AT request-headers INTO DATA(header) WHERE name IS NOT INITIAL.
      IF is_real_header( header-name ) = abap_true.
        client->request->set_header_field( name  = header-name
                                           value = header-value ).
        INSERT masked( header ) INTO TABLE result.
      ENDIF.
    ENDLOOP.

    " Sent with the first request (preemptive): no extra round trip for the 401 challenge
    IF request-credentials-user IS NOT INITIAL.
      client->request->set_header_field( name  = authorization_header
                                         value = basic_authorization( request-credentials ) ).
      DELETE result WHERE name = authorization_header.
      INSERT VALUE #( name  = authorization_header
                      value = |Basic { masked_secret }| ) INTO TABLE result.
    ENDIF.

    IF request-body IS NOT INITIAL.
      client->request->set_data( request-body ).
    ENDIF.
  ENDMETHOD.


  METHOD basic_authorization.
    DATA(user_and_password) = cl_abap_codepage=>convert_to( |{ credentials-user }:{ credentials-password }| ).
    result = |Basic { cl_http_utility=>encode_x_base64( user_and_password ) }|.
  ENDMETHOD.


  METHOD masked.
    result = header.
    IF to_lower( header-name ) = to_lower( authorization_header ).
      result-value = |{ segment( val = header-value index = 1 sep = ` ` ) } { masked_secret }|.
    ENDIF.
  ENDMETHOD.


  METHOD is_real_header.
    " ICF pseudo fields (~status_code, ~server_protocol, ...) are no HTTP headers
    result = xsdbool( NOT name CP |{ pseudo_header_prefix }*| ).
  ENDMETHOD.


  METHOD timeout_of.
    result = COND #( WHEN connection-timeout_sec > 0
                     THEN connection-timeout_sec
                     ELSE zif_litmus_settings_repo=>defaults-timeout_sec ).
  ENDMETHOD.


  METHOD exchange.
    client->send( EXPORTING  timeout                    = timeout_sec
                  EXCEPTIONS http_communication_failure = 1
                             http_invalid_state         = 2
                             http_processing_failed     = 3
                             http_invalid_timeout       = 4
                             OTHERS                     = 5 ).
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    client->receive( EXCEPTIONS http_communication_failure = 1
                                http_invalid_state         = 2
                                http_processing_failed     = 3
                                OTHERS                     = 4 ).
    result = sy-subrc.
  ENDMETHOD.


  METHOD communication_failure.
    client->get_last_error( IMPORTING code    = DATA(code)
                                      message = DATA(error_text) ).
    result-message = texts->format( text_key   = zcl_litmus_texts=>key-connection_error
                                    variable_1 = |{ code }|
                                    variable_2 = error_text ).
    result-hint = hint_for( message = error_text
                            url     = url ).
  ENDMETHOD.


  METHOD response_of.
    DATA fields TYPE tihttpnvp.

    client->response->get_status( IMPORTING code   = result-status
                                            reason = result-reason ).
    client->response->get_header_fields( CHANGING fields = fields ).
    result-headers = VALUE #( FOR field IN fields WHERE ( name NP '~*' )
                              ( name = field-name value = field-value ) ).
    result-body = client->response->get_data( ).
    result-received = abap_true.
  ENDMETHOD.


  METHOD hint_for.
    DATA(upper_message) = to_upper( message ).
    IF contains_any( text  = upper_message
                     words = VALUE #( ( `SSL` ) ( `CERTIFICATE` ) ( `PEER` ) ( `HANDSHAKE` ) ) ) = abap_true.
      result = texts->get( zcl_litmus_texts=>key-hint_ssl ).
    ELSEIF contains_any( text  = upper_message
                         words = VALUE #( ( `TIMEOUT` ) ( `TIME OUT` ) ( `TIMED OUT` ) ) ) = abap_true.
      result = texts->get( zcl_litmus_texts=>key-hint_timeout ).
    ELSEIF contains_any( text  = upper_message
                         words = VALUE #( ( `HOSTTOADDR` ) ( `NAME RESOLUTION` ) ( `UNKNOWN HOST` )
                                          ( `NIEHOST_UNKNOWN` ) ) ) = abap_true.
      result = texts->get( zcl_litmus_texts=>key-hint_dns ).
    ELSEIF contains_any( text  = upper_message
                         words = VALUE #( ( `CONNECTION` ) ( `REFUSED` ) ( `NIECONN` ) ) ) = abap_true.
      result = texts->format( text_key   = zcl_litmus_texts=>key-hint_connection
                              variable_1 = url ).
    ENDIF.
  ENDMETHOD.


  METHOD contains_any.
    LOOP AT words INTO DATA(word).
      IF text CS word.
        result = abap_true.
        RETURN.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.


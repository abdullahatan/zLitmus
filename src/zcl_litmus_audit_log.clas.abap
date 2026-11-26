"! <p class="shorttext synchronized">zLitmus - audit log (table ZLITMUS_LOG)</p>
"! The caller commits.
CLASS zcl_litmus_audit_log DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_litmus_audit_log.

    METHODS constructor
      IMPORTING
        uname TYPE syuname
        texts TYPE REF TO zif_litmus_texts.

  PRIVATE SECTION.
    CONSTANTS masked_value TYPE string VALUE `***`.

    " Query parameters whose value is never written (compared in lower case)
    CONSTANTS:
      BEGIN OF secret_parameter,
        password     TYPE string VALUE `password`,
        pwd          TYPE string VALUE `pwd`,
        token        TYPE string VALUE `token`,
        sap_password TYPE string VALUE `sap-password`,
      END OF secret_parameter.

    DATA uname TYPE syuname.
    DATA texts TYPE REF TO zif_litmus_texts.

    METHODS masked_url
      IMPORTING
        url           TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS masked_parameter
      IMPORTING
        parameter     TYPE string
      RETURNING
        VALUE(result) TYPE string.

ENDCLASS.



CLASS zcl_litmus_audit_log IMPLEMENTATION.

  METHOD constructor.
    me->uname = uname.
    me->texts = texts.
  ENDMETHOD.


  METHOD zif_litmus_audit_log~write.
    DATA log_id TYPE sysuuid_x16.
    DATA logged_at TYPE timestampl.

    TRY.
        log_id = cl_system_uuid=>create_uuid_x16_static( ).
      CATCH cx_uuid_error INTO DATA(error).
        texts->raise_error( text_key   = zcl_litmus_texts=>key-database_error
                            variable_1 = error->get_text( ) ).
    ENDTRY.
    GET TIME STAMP FIELD logged_at.

    DATA(row) = VALUE zlitmus_log( log_id        = log_id
                                   uname         = uname
                                   logged_at     = logged_at
                                   project_id    = CONV #( entry-project_id )
                                   method        = to_upper( entry-method )
                                   url           = masked_url( entry-url )
                                   http_status   = entry-http_status
                                   duration_ms   = entry-duration_ms
                                   response_size = entry-response_size
                                   error_text    = entry-error_text ).
    INSERT zlitmus_log FROM @row.
    IF sy-subrc <> 0.
      texts->raise_error( text_key   = zcl_litmus_texts=>key-database_error
                          variable_1 = `INSERT ZLITMUS_LOG` ).
    ENDIF.
  ENDMETHOD.


  METHOD masked_url.
    DATA(query_start) = find( val = url sub = `?` ).
    IF query_start < 0.
      result = url.
      RETURN.
    ENDIF.

    DATA(query) = substring( val = url off = query_start + 1 ).
    DATA(fragment) = ``.
    DATA(fragment_start) = find( val = query sub = `#` ).
    IF fragment_start >= 0.
      fragment = substring( val = query off = fragment_start ).
      query = substring( val = query len = fragment_start ).
    ENDIF.

    SPLIT query AT `&` INTO TABLE DATA(parameters).
    DATA(masked) = VALUE string_table( FOR parameter IN parameters ( masked_parameter( parameter ) ) ).
    result = substring( val = url len = query_start + 1 ) && concat_lines_of( table = masked sep = `&` ) && fragment.
  ENDMETHOD.


  METHOD masked_parameter.
    DATA(name) = segment( val = parameter index = 1 sep = `=` ).
    CASE to_lower( name ).
      WHEN secret_parameter-password
        OR secret_parameter-pwd
        OR secret_parameter-token
        OR secret_parameter-sap_password.
        result = |{ name }={ masked_value }|.
      WHEN OTHERS.
        result = parameter.
    ENDCASE.
  ENDMETHOD.

ENDCLASS.


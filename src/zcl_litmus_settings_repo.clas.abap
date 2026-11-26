"! <p class="shorttext synchronized">zLitmus - user settings repository (database)</p>
"! Table ZLITMUS_USET. The caller commits.
CLASS zcl_litmus_settings_repo DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_litmus_settings_repo.

    METHODS constructor
      IMPORTING
        texts TYPE REF TO zif_litmus_texts.

  PRIVATE SECTION.
    CONSTANTS max_timeout_sec TYPE i VALUE 3600.

    DATA texts TYPE REF TO zif_litmus_texts.

    METHODS with_defaults
      IMPORTING
        settings      TYPE zif_litmus_types=>settings
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>settings.

ENDCLASS.



CLASS zcl_litmus_settings_repo IMPLEMENTATION.

  METHOD constructor.
    me->texts = texts.
  ENDMETHOD.


  METHOD zif_litmus_settings_repo~read.
    SELECT SINGLE timeout_sec, ssl_id, proxy_host, proxy_port, ui_prefs
      FROM zlitmus_uset
      WHERE uname = @uname
      INTO CORRESPONDING FIELDS OF @result.
    result = with_defaults( result ).
  ENDMETHOD.


  METHOD zif_litmus_settings_repo~save.
    DATA(checked) = with_defaults( settings ).
    DATA(row) = VALUE zlitmus_uset( uname       = uname
                                    timeout_sec = checked-timeout_sec
                                    ssl_id      = checked-ssl_id
                                    proxy_host  = condense( checked-proxy_host )
                                    proxy_port  = condense( checked-proxy_port )
                                    ui_prefs    = checked-ui_prefs ).
    MODIFY zlitmus_uset FROM @row.
    IF sy-subrc <> 0.
      texts->raise_error( text_key   = zcl_litmus_texts=>key-database_error
                          variable_1 = `MODIFY ZLITMUS_USET` ).
    ENDIF.
  ENDMETHOD.


  METHOD with_defaults.
    result = settings.
    IF result-timeout_sec <= 0 OR result-timeout_sec > max_timeout_sec.
      result-timeout_sec = zif_litmus_settings_repo=>defaults-timeout_sec.
    ENDIF.
    result-ssl_id = to_upper( condense( result-ssl_id ) ).
    IF result-ssl_id IS INITIAL.
      result-ssl_id = zif_litmus_settings_repo=>defaults-ssl_id.
    ENDIF.
  ENDMETHOD.

ENDCLASS.


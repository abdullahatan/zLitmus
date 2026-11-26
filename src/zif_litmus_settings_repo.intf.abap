"! <p class="shorttext synchronized">zLitmus - user settings repository</p>
INTERFACE zif_litmus_settings_repo
  PUBLIC.

  CONSTANTS:
    BEGIN OF defaults,
      timeout_sec TYPE i VALUE 60,
      ssl_id      TYPE ssfapplssl VALUE 'ANONYM',
    END OF defaults.

  "! Settings of a user; defaults when the user has none
  METHODS read
    IMPORTING
      uname         TYPE syuname
    RETURNING
      VALUE(result) TYPE zif_litmus_types=>settings
    RAISING
      zcx_litmus_error.

  METHODS save
    IMPORTING
      uname    TYPE syuname
      settings TYPE zif_litmus_types=>settings
    RAISING
      zcx_litmus_error.

ENDINTERFACE.

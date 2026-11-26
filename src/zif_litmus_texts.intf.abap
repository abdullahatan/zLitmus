"! <p class="shorttext synchronized">zLitmus - user texts (TR/EN)</p>
INTERFACE zif_litmus_texts
  PUBLIC.

  "! Text of a key (see ZCL_LITMUS_TEXTS=>KEY); the key itself when it is unknown
  METHODS get
    IMPORTING
      text_key      TYPE string
    RETURNING
      VALUE(result) TYPE string.

  "! Text of a key with &1 and &2 replaced
  METHODS format
    IMPORTING
      text_key      TYPE string
      variable_1    TYPE string OPTIONAL
      variable_2    TYPE string OPTIONAL
    RETURNING
      VALUE(result) TYPE string.

  "! Raises ZCX_LITMUS_ERROR with the formatted text of a key
  METHODS raise_error
    IMPORTING
      text_key   TYPE string
      variable_1 TYPE string OPTIONAL
      variable_2 TYPE string OPTIONAL
    RAISING
      zcx_litmus_error.

  "! Language of the texts for the page: tr or en
  METHODS language_code
    RETURNING
      VALUE(result) TYPE string.

ENDINTERFACE.

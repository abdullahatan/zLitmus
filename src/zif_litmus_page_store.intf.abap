"! <p class="shorttext synchronized">zLitmus - page in the MIME repository</p>
INTERFACE zif_litmus_page_store
  PUBLIC.

  "! The installed page (HTML with the boot marker)
  METHODS read
    RETURNING
      VALUE(result) TYPE string
    RAISING
      zcx_litmus_error.

  "! Lets the user choose zlitmus.html on the PC and writes it into the MIME repository
  METHODS install_from_frontend
    RAISING
      zcx_litmus_error.

ENDINTERFACE.

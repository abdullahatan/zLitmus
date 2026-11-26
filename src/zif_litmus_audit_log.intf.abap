"! <p class="shorttext synchronized">zLitmus - audit log of sent requests</p>
"! Neither the body nor any password is written; secrets in the URL query are masked.
INTERFACE zif_litmus_audit_log
  PUBLIC.

  METHODS write
    IMPORTING
      entry TYPE zif_litmus_types=>audit_entry
    RAISING
      zcx_litmus_error.

ENDINTERFACE.

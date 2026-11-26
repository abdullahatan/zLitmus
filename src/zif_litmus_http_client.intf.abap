"! <p class="shorttext synchronized">zLitmus - HTTP client</p>
"! Every request leaves from the SAP application server.
INTERFACE zif_litmus_http_client
  PUBLIC.

  "! Sends one request. Connection problems do not raise: they come back in MESSAGE and HINT
  "! with RECEIVED = abap_false, so the page can show them like a response.
  METHODS send
    IMPORTING
      request       TYPE zif_litmus_types=>http_request
    RETURNING
      VALUE(result) TYPE zif_litmus_types=>http_response.

ENDINTERFACE.

"! <p class="shorttext synchronized">zLitmus - page bridge (payload, boot JSON)</p>
"! Page to ABAP: form POST to SAPEVENT:&lt;ACTION&gt;, field PAYLOAD = base64 of lines
"! "KEY TAB NAME TAB base64(value)" (V = value, H = HTTP header).
"! ABAP to page: the whole page is shown again; the marker BOOT_MARKER is replaced by boot JSON.
CLASS zcl_litmus_bridge DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CONSTANTS version TYPE string VALUE `1.1.0`.
    CONSTANTS boot_marker TYPE string VALUE `__ZLITMUS_BOOT__`.
    CONSTANTS page_marker TYPE string VALUE `name="zlitmus"`.

    TYPES:
      BEGIN OF boot,
        language     TYPE string,
        user         TYPE string,
        system       TYPE string,
        "! JSON object
        settings     TYPE string,
        "! UI state of the page (JSON written by the page)
        ui           TYPE string,
        "! JSON object with the WSDL packages of the open projects
        workspace    TYPE string,
        message_type TYPE string,
        message_text TYPE string,
        "! JSON object, answer to the last action
        reply        TYPE string,
        "! JSON array with the saved projects of the user
        projects     TYPE string,
      END OF boot.

    "! Lines of the page payload in the POST data of a SAPEVENT (char or hex lines)
    METHODS parse_payload
      IMPORTING
        post_data     TYPE STANDARD TABLE
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>page_lines.

    "! Lines of a base64 payload as built by Bridge.encode of the page
    METHODS lines_of
      IMPORTING
        payload       TYPE string
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>page_lines.

    "! Value line (V) of a name; empty when it is missing
    METHODS value_of
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
        name          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    "! Header lines (H) in page order
    METHODS headers_of
      IMPORTING
        lines         TYPE zif_litmus_types=>page_lines
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>headers.

    METHODS build_boot
      IMPORTING
        boot          TYPE boot
      RETURNING
        VALUE(result) TYPE string.

    "! JSON string literal with quotes; "&lt;" is escaped so the text can sit in a script element
    METHODS json_string
      IMPORTING
        text          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    "! Escapes "&lt;" of a complete JSON text (it can only occur inside strings)
    METHODS script_safe
      IMPORTING
        json          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS to_base64
      IMPORTING
        text          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS from_base64
      IMPORTING
        base64        TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS to_utf8
      IMPORTING
        text          TYPE string
      RETURNING
        VALUE(result) TYPE xstring.

    "! UTF-8 text; invalid bytes become "#"
    METHODS from_utf8
      IMPORTING
        data          TYPE xstring
      RETURNING
        VALUE(result) TYPE string.

  PRIVATE SECTION.
    CONSTANTS payload_field TYPE string VALUE `payload=`.
    CONSTANTS null TYPE string VALUE `null`.
    " JSON escape of "<", written in two parts on purpose
    CONSTANTS escaped_less_than TYPE string VALUE `\` & `u003c`.

    METHODS post_data_text
      IMPORTING
        post_data     TYPE STANDARD TABLE
      RETURNING
        VALUE(result) TYPE string.

    "! Base64 of the PAYLOAD form field (form encoding removed)
    METHODS payload_field_of
      IMPORTING
        body          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS message_json
      IMPORTING
        boot          TYPE boot
      RETURNING
        VALUE(result) TYPE string.

    METHODS json_or_null
      IMPORTING
        json          TYPE string
      RETURNING
        VALUE(result) TYPE string.

ENDCLASS.



CLASS zcl_litmus_bridge IMPLEMENTATION.

  METHOD parse_payload.
    result = lines_of( payload_field_of( post_data_text( post_data ) ) ).
  ENDMETHOD.


  METHOD lines_of.
    IF payload IS INITIAL.
      RETURN.
    ENDIF.
    SPLIT from_base64( payload ) AT cl_abap_char_utilities=>newline INTO TABLE DATA(rows).
    LOOP AT rows INTO DATA(row) WHERE table_line IS NOT INITIAL.
      SPLIT row AT cl_abap_char_utilities=>horizontal_tab INTO DATA(key) DATA(name) DATA(value_base64).
      INSERT VALUE #( key   = key
                      name  = name
                      value = from_base64( value_base64 ) ) INTO TABLE result.
    ENDLOOP.
  ENDMETHOD.


  METHOD value_of.
    result = VALUE #( lines[ key = zif_litmus_types=>line_key-value name = name ]-value OPTIONAL ).
  ENDMETHOD.


  METHOD headers_of.
    result = VALUE #( FOR line IN lines WHERE ( key = zif_litmus_types=>line_key-header )
                      ( name = line-name value = line-value ) ).
  ENDMETHOD.


  METHOD build_boot.
    result = |\{"runtime":"sap","version":{ json_string( version ) },"lang":{ json_string( boot-language ) },|
          && |"user":{ json_string( boot-user ) },"system":{ json_string( boot-system ) },|
          && |"settings":{ json_or_null( boot-settings ) },|
          && |"ui64":{ json_string( to_base64( boot-ui ) ) },|
          && |"workspace64":{ json_string( to_base64( boot-workspace ) ) },|
          && |"projects":{ COND #( WHEN boot-projects IS INITIAL THEN `[]` ELSE boot-projects ) },|
          && |"message":{ message_json( boot ) },"reply":{ json_or_null( boot-reply ) }\}|.
    result = script_safe( result ).
  ENDMETHOD.


  METHOD json_string.
    DATA(escaped) = replace( val = text sub = `\` with = `\\` occ = 0 ).
    escaped = replace( val = escaped sub = `"` with = `\"` occ = 0 ).
    escaped = replace( val = escaped sub = cl_abap_char_utilities=>cr_lf with = `\n` occ = 0 ).
    escaped = replace( val = escaped sub = cl_abap_char_utilities=>newline with = `\n` occ = 0 ).
    escaped = replace( val = escaped sub = cl_abap_char_utilities=>cr_lf(1) with = `\r` occ = 0 ).
    escaped = replace( val = escaped sub = cl_abap_char_utilities=>horizontal_tab with = `\t` occ = 0 ).
    result = script_safe( |"{ escaped }"| ).
  ENDMETHOD.


  METHOD script_safe.
    result = replace( val = json sub = `<` with = escaped_less_than occ = 0 ).
  ENDMETHOD.


  METHOD to_base64.
    IF text IS INITIAL.
      RETURN.
    ENDIF.
    result = cl_http_utility=>encode_x_base64( to_utf8( text ) ).
  ENDMETHOD.


  METHOD from_base64.
    IF base64 IS INITIAL.
      RETURN.
    ENDIF.
    result = from_utf8( cl_http_utility=>decode_x_base64( base64 ) ).
  ENDMETHOD.


  METHOD to_utf8.
    result = cl_abap_codepage=>convert_to( text ).
  ENDMETHOD.


  METHOD from_utf8.
    IF data IS INITIAL.
      RETURN.
    ENDIF.
    TRY.
        result = cl_abap_conv_codepage=>create_in( replacement_char = '#' )->convert( data ).
      CATCH cx_sy_conversion_codepage.
        CLEAR result.
    ENDTRY.
  ENDMETHOD.


  METHOD post_data_text.
    IF post_data IS INITIAL.
      RETURN.
    ENDIF.
    DATA(table_type) = CAST cl_abap_tabledescr( cl_abap_typedescr=>describe_by_data( post_data ) ).
    DATA(line_type) = table_type->get_table_line_type( ).
    IF line_type->type_kind = cl_abap_typedescr=>typekind_hex.
      DATA bytes TYPE xstring.
      LOOP AT post_data ASSIGNING FIELD-SYMBOL(<hex_line>).
        CONCATENATE bytes <hex_line> INTO bytes IN BYTE MODE.
      ENDLOOP.
      result = from_utf8( bytes ).
    ELSE.
      " Char lines are padded with blanks; the payload itself has none
      LOOP AT post_data ASSIGNING FIELD-SYMBOL(<char_line>).
        result = result && <char_line>.
      ENDLOOP.
    ENDIF.
    " Hex lines can end with zero bytes
    result = replace( val = result sub = cl_abap_char_utilities=>minchar with = `` occ = 0 ).
  ENDMETHOD.


  METHOD payload_field_of.
    IF body IS INITIAL.
      RETURN.
    ENDIF.
    result = body.
    DATA(field_at) = find( val = result sub = payload_field ).
    IF field_at >= 0.
      result = substring( val = result off = field_at + strlen( payload_field ) ).
    ENDIF.
    result = segment( val = result index = 1 sep = `&` ).
    " Form encoding: "+", "/" and "=" arrive as %2B, %2F and %3D; base64 has no blanks
    IF result CS `%`.
      result = cl_http_utility=>unescape_url( result ).
    ENDIF.
    CONDENSE result NO-GAPS.
  ENDMETHOD.


  METHOD message_json.
    result = COND #( WHEN boot-message_text IS INITIAL
                     THEN null
                     ELSE |\{"type":{ json_string( boot-message_type ) },|
                       && |"text":{ json_string( boot-message_text ) }\}| ).
  ENDMETHOD.


  METHOD json_or_null.
    result = COND #( WHEN json IS INITIAL THEN null ELSE json ).
  ENDMETHOD.

ENDCLASS.


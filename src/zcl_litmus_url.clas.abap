"! <p class="shorttext synchronized">zLitmus - URL reference resolution</p>
"! Resolves the location of an imported WSDL/XSD document against the URL of the document
"! that imports it (RFC 3986 section 5, simplified to what WSDL imports use).
CLASS zcl_litmus_url DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    "! Absolute URL of a reference; absolute references, //host, /path, ?query, ./ and ../ are handled
    METHODS resolve
      IMPORTING
        base          TYPE string
        reference     TYPE string
      RETURNING
        VALUE(result) TYPE string.

    "! The URL names a file on the PC of the user (file:)
    METHODS is_file
      IMPORTING
        url           TYPE string
      RETURNING
        VALUE(result) TYPE abap_bool.

    "! C:\dir\a.wsdl -> file:///C:/dir/a.wsdl; \\server\share\a.wsdl -> file://server/share/a.wsdl
    METHODS file_url
      IMPORTING
        path          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    "! file:///C:/dir/a.wsdl -> C:\dir\a.wsdl; file://server/share/a.wsdl -> \\server\share\a.wsdl (%xx decoded)
    METHODS local_path
      IMPORTING
        url           TYPE string
      RETURNING
        VALUE(result) TYPE string.

  PRIVATE SECTION.
    CONSTANTS scheme_separator TYPE string VALUE `://`.
    CONSTANTS file_scheme TYPE string VALUE `file:`.
    CONSTANTS scheme_characters TYPE string VALUE `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+.-`.

    TYPES:
      BEGIN OF parts,
        scheme TYPE string,
        origin TYPE string,
        path   TYPE string,
      END OF parts.

    METHODS has_scheme
      IMPORTING
        reference     TYPE string
      RETURNING
        VALUE(result) TYPE abap_bool.

    "! Scheme, scheme://authority and path of a base URL (without query and fragment)
    METHODS split_base
      IMPORTING
        base          TYPE string
      RETURNING
        VALUE(result) TYPE parts.

    METHODS text_before
      IMPORTING
        text          TYPE string
        separator     TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS text_from
      IMPORTING
        text          TYPE string
        separator     TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS directory_of
      IMPORTING
        path          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    "! Removes . and .. segments and double slashes
    METHODS normalized
      IMPORTING
        path          TYPE string
      RETURNING
        VALUE(result) TYPE string.

ENDCLASS.



CLASS zcl_litmus_url IMPLEMENTATION.

  METHOD resolve.
    DATA(trimmed) = condense( reference ).
    IF trimmed IS INITIAL.
      RETURN.
    ENDIF.
    IF has_scheme( trimmed ) = abap_true.
      result = trimmed.
      RETURN.
    ENDIF.

    DATA(base_parts) = split_base( base ).
    IF base_parts-origin IS INITIAL.
      result = trimmed.
      RETURN.
    ENDIF.

    IF strlen( trimmed ) >= 2 AND substring( val = trimmed len = 2 ) = `//`.
      result = |{ base_parts-scheme }:{ trimmed }|.
      RETURN.
    ENDIF.
    IF substring( val = trimmed len = 1 ) = `?`.
      result = |{ base_parts-origin }{ base_parts-path }{ trimmed }|.
      RETURN.
    ENDIF.

    DATA(reference_path) = text_before( text = trimmed separator = `?` ).
    DATA(reference_query) = text_from( text = trimmed separator = `?` ).
    DATA(path) = COND string( WHEN substring( val = reference_path len = 1 ) = `/`
                              THEN reference_path
                              ELSE directory_of( base_parts-path ) && reference_path ).
    result = |{ base_parts-origin }{ normalized( path ) }{ reference_query }|.
  ENDMETHOD.


  METHOD has_scheme.
    DATA(colon) = find( val = reference sub = `:` ).
    IF colon <= 0.
      RETURN.
    ENDIF.
    DATA(scheme) = substring( val = reference len = colon ).
    result = xsdbool( scheme CO scheme_characters
                      AND to_upper( substring( val = scheme len = 1 ) ) CA sy-abcde ).
  ENDMETHOD.


  METHOD split_base.
    DATA(without_fragment) = text_before( text = base separator = `#` ).
    DATA(separator_at) = find( val = without_fragment sub = scheme_separator ).
    IF separator_at < 0.
      RETURN.
    ENDIF.
    result-scheme = substring( val = without_fragment len = separator_at ).
    DATA(authority_and_path) = substring( val = without_fragment off = separator_at + strlen( scheme_separator ) ).
    DATA(rest) = text_before( text = authority_and_path separator = `?` ).
    DATA(path_at) = find( val = rest sub = `/` ).
    IF path_at < 0.
      result-origin = |{ result-scheme }{ scheme_separator }{ rest }|.
      result-path = `/`.
    ELSE.
      result-origin = |{ result-scheme }{ scheme_separator }{ substring( val = rest len = path_at ) }|.
      result-path = substring( val = rest off = path_at ).
    ENDIF.
  ENDMETHOD.


  METHOD text_before.
    DATA(position) = find( val = text sub = separator ).
    result = COND #( WHEN position < 0 THEN text ELSE substring( val = text len = position ) ).
  ENDMETHOD.


  METHOD text_from.
    DATA(position) = find( val = text sub = separator ).
    IF position >= 0.
      result = substring( val = text off = position ).
    ENDIF.
  ENDMETHOD.


  METHOD directory_of.
    DATA(last_slash) = find( val = path sub = `/` occ = -1 ).
    result = substring( val = path len = last_slash + 1 ).
  ENDMETHOD.


  METHOD normalized.
    DATA segments TYPE string_table.
    DATA trailing_slash TYPE abap_bool.

    SPLIT path AT `/` INTO TABLE DATA(parts).
    DATA(last_index) = lines( parts ).
    LOOP AT parts INTO DATA(part) WHERE table_line IS NOT INITIAL.
      DATA(is_last) = xsdbool( sy-tabix = last_index ).
      CASE part.
        WHEN `.`.
          trailing_slash = is_last.
        WHEN `..`.
          trailing_slash = is_last.
          IF segments IS NOT INITIAL.
            DELETE segments INDEX lines( segments ).
          ENDIF.
        WHEN OTHERS.
          INSERT part INTO TABLE segments.
          trailing_slash = abap_false.
      ENDCASE.
    ENDLOOP.
    result = `/` && concat_lines_of( table = segments sep = `/` ).
    IF trailing_slash = abap_true AND segments IS NOT INITIAL.
      result = result && `/`.
    ENDIF.
  ENDMETHOD.

  METHOD is_file.
    result = xsdbool( to_lower( condense( url ) ) CP |{ file_scheme }*| ).
  ENDMETHOD.

  METHOD file_url.
    DATA(slashed) = replace( val = condense( path ) sub = `\` with = `/` occ = 0 ).
    result = COND #( WHEN strlen( slashed ) >= 2 AND substring( val = slashed len = 2 ) = `//`
                     THEN file_scheme && slashed
                     ELSE |{ file_scheme }///{ slashed }| ).
  ENDMETHOD.

  METHOD local_path.
    DATA(rest) = condense( url ).
    IF is_file( rest ) = abap_true.
      rest = substring( val = rest off = strlen( file_scheme ) ).
    ENDIF.
    IF strlen( rest ) >= 3 AND substring( val = rest len = 3 ) = `///`.
      rest = substring( val = rest off = 3 ).
    ENDIF.
    result = replace( val = cl_http_utility=>unescape_url( rest ) sub = `/` with = `\` occ = 0 ).
  ENDMETHOD.
ENDCLASS.


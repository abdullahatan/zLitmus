"! <p class="shorttext synchronized">zLitmus - WSDL loader (imports and includes)</p>
"! Downloads a WSDL and every document it references through wsdl:import, xsd:import,
"! xsd:include and xsd:redefine (breadth first, each URL once, at most MAX_DOCUMENTS).
CLASS zcl_litmus_wsdl_loader DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CONSTANTS max_documents TYPE i VALUE 40.

    METHODS constructor
      IMPORTING
        http_client TYPE REF TO zif_litmus_http_client.

    "! The first document is the WSDL itself. When it answers 401, AUTH_REQUIRED is set and
    "! REALM holds the realm of the WWW-Authenticate header.
    METHODS load
      IMPORTING
        url           TYPE string
        credentials   TYPE zif_litmus_types=>credentials
        connection    TYPE zif_litmus_types=>connection
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>wsdl_package.

  PRIVATE SECTION.
    CONSTANTS accept_types TYPE string VALUE `text/xml, application/xml, application/wsdl+xml, */*`.
    CONSTANTS status_unauthorized TYPE i VALUE 401.

    CONSTANTS:
      BEGIN OF reference_element,
        import   TYPE string VALUE `import`,
        include  TYPE string VALUE `include`,
        redefine TYPE string VALUE `redefine`,
      END OF reference_element.

    DATA http_client TYPE REF TO zif_litmus_http_client.
    DATA url_resolver TYPE REF TO zcl_litmus_url.

    METHODS document_of
      IMPORTING
        url           TYPE string
        response      TYPE zif_litmus_types=>http_response
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>wsdl_document.

    "! Locations of import / include / redefine elements, in document order, without duplicates
    METHODS references_in
      IMPORTING
        content       TYPE xstring
      RETURNING
        VALUE(result) TYPE string_table.

    METHODS location_in_tag
      IMPORTING
        tag           TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS attribute_value
      IMPORTING
        tag           TYPE string
        name          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    "! http(s) always; file: only when the WSDL itself is a local file (a remote WSDL never reads the PC)
    METHODS is_downloadable
      IMPORTING
        url           TYPE string
        root          TYPE string
      RETURNING
        VALUE(result) TYPE abap_bool.

    METHODS header_value
      IMPORTING
        headers       TYPE zif_litmus_types=>headers
        name          TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS realm_of
      IMPORTING
        authenticate  TYPE string
      RETURNING
        VALUE(result) TYPE string.

    METHODS text_of
      IMPORTING
        content       TYPE xstring
      RETURNING
        VALUE(result) TYPE string.

ENDCLASS.



CLASS zcl_litmus_wsdl_loader IMPLEMENTATION.

  METHOD constructor.
    me->http_client = http_client.
    url_resolver = NEW #( ).
  ENDMETHOD.


  METHOD load.
    result-url = condense( url ).
    DATA(queue) = VALUE string_table( ( result-url ) ).

    WHILE queue IS NOT INITIAL AND lines( result-documents ) < max_documents.
      DATA(current) = queue[ 1 ].
      DELETE queue INDEX 1.

      DATA(response) = http_client->send( VALUE #( method      = `GET`
                                                   url         = current
                                                   headers     = VALUE #( ( name = `Accept` value = accept_types ) )
                                                   credentials = credentials
                                                   connection  = connection ) ).
      DATA(document) = document_of( url      = current
                                    response = response ).
      INSERT document INTO TABLE result-documents.

      IF lines( result-documents ) = 1 AND response-status = status_unauthorized.
        result-auth_required = abap_true.
        result-realm = realm_of( header_value( headers = response-headers
                                               name    = `www-authenticate` ) ).
        EXIT.
      ENDIF.
      IF document-error IS NOT INITIAL.
        CONTINUE.
      ENDIF.

      LOOP AT references_in( document-content ) INTO DATA(reference).
        DATA(next) = url_resolver->resolve( base      = current
                                            reference = reference ).
        IF is_downloadable( url = next root = result-url ) = abap_true
            AND NOT line_exists( result-documents[ url = next ] )
            AND NOT line_exists( queue[ table_line = next ] ).
          INSERT next INTO TABLE queue.
        ENDIF.
      ENDLOOP.
    ENDWHILE.

    GET TIME STAMP FIELD result-loaded_at.
  ENDMETHOD.


  METHOD document_of.
    result = VALUE #( url          = url
                      status       = response-status
                      content_type = header_value( headers = response-headers
                                                   name    = `content-type` )
                      content      = response-body ).
    IF response-received = abap_false.
      result-error = condense( |{ response-message } { response-hint }| ).
    ELSEIF response-status < 200 OR response-status >= 300.
      result-error = condense( |HTTP { response-status } { response-reason }| ).
    ENDIF.
  ENDMETHOD.


  METHOD references_in.
    DATA(xml) = text_of( content ).
    DATA(position) = 0.
    DO.
      DATA(tag_start) = find( val = xml sub = `<` off = position ).
      IF tag_start < 0.
        EXIT.
      ENDIF.
      DATA(tag_end) = find( val = xml sub = `>` off = tag_start ).
      IF tag_end < 0.
        EXIT.
      ENDIF.
      position = tag_end + 1.

      DATA(location) = location_in_tag( substring( val = xml off = tag_start + 1 len = tag_end - tag_start - 1 ) ).
      IF location IS NOT INITIAL AND NOT line_exists( result[ table_line = location ] ).
        INSERT location INTO TABLE result.
      ENDIF.
    ENDDO.
  ENDMETHOD.


  METHOD location_in_tag.
    " Comments, declarations, processing instructions and end tags hold no reference
    IF tag IS INITIAL OR substring( val = tag len = 1 ) CA `/!?`.
      RETURN.
    ENDIF.
    DATA(flat_tag) = translate( val  = tag
                                from = |{ cl_abap_char_utilities=>horizontal_tab }{ cl_abap_char_utilities=>cr_lf }|
                                to   = `   ` ).
    DATA(element) = segment( val = flat_tag index = 1 sep = ` ` ).
    element = replace( val = element sub = `/` with = `` occ = 0 ).
    DATA(local_name) = to_lower( segment( val = element index = -1 sep = `:` ) ).
    IF local_name <> reference_element-import
        AND local_name <> reference_element-include
        AND local_name <> reference_element-redefine.
      RETURN.
    ENDIF.

    result = attribute_value( tag  = flat_tag
                              name = `schemaLocation` ).
    IF result IS INITIAL.
      result = attribute_value( tag  = flat_tag
                                name = `location` ).
    ENDIF.
  ENDMETHOD.


  METHOD attribute_value.
    DATA(name_at) = find( val = tag sub = | { name }| ).
    IF name_at < 0.
      RETURN.
    ENDIF.
    DATA(rest) = shift_left( val = substring( val = tag off = name_at + strlen( name ) + 1 ) sub = ` ` ).
    IF rest IS INITIAL OR substring( val = rest len = 1 ) <> `=`.
      RETURN.
    ENDIF.
    rest = shift_left( val = substring( val = rest off = 1 ) sub = ` ` ).
    IF rest IS INITIAL.
      RETURN.
    ENDIF.
    DATA(quote) = substring( val = rest len = 1 ).
    IF quote <> `"` AND quote <> `'`.
      RETURN.
    ENDIF.
    DATA(closing_at) = find( val = rest sub = quote off = 1 ).
    IF closing_at < 0.
      RETURN.
    ENDIF.
    result = substring( val = rest off = 1 len = closing_at - 1 ).
    result = condense( replace( val = result sub = `&amp;` with = `&` occ = 0 ) ).
  ENDMETHOD.


  METHOD is_downloadable.
    DATA(lower_url) = to_lower( url ).
    result = xsdbool( lower_url CP `http://*` OR lower_url CP `https://*`
                      OR ( url_resolver->is_file( url ) = abap_true AND url_resolver->is_file( root ) = abap_true ) ).
  ENDMETHOD.


  METHOD header_value.
    LOOP AT headers INTO DATA(header).
      IF to_lower( header-name ) = to_lower( name ).
        result = header-value.
        RETURN.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.


  METHOD realm_of.
    DATA(realm_at) = find( val = authenticate sub = `realm=` case = abap_false ).
    IF realm_at < 0.
      RETURN.
    ENDIF.
    result = substring( val = authenticate off = realm_at + strlen( `realm=` ) ).
    IF result CP `"*`.
      result = segment( val = substring( val = result off = 1 ) index = 1 sep = `"` ).
    ELSE.
      result = segment( val = result index = 1 sep = `,` ).
    ENDIF.
  ENDMETHOD.


  METHOD text_of.
    IF content IS INITIAL.
      RETURN.
    ENDIF.
    " Only the ASCII markup is scanned: Latin-1 never fails where UTF-8 may (invalid bytes)
    TRY.
        result = cl_abap_conv_codepage=>create_in( )->convert( content ).
      CATCH cx_sy_conversion_codepage.
        TRY.
            result = cl_abap_conv_codepage=>create_in( codepage = `ISO-8859-1` )->convert( content ).
          CATCH cx_sy_conversion_codepage.
            CLEAR result.
        ENDTRY.
    ENDTRY.
  ENDMETHOD.

ENDCLASS.


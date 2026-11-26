"! <p class="shorttext synchronized">zLitmus - project repository (database)</p>
"! Tables ZLITMUS_PROJ and ZLITMUS_REQ. The caller commits (one LUW per page action).
CLASS zcl_litmus_project_repo DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_litmus_project_repo.

    METHODS constructor
      IMPORTING
        owner TYPE syuname
        texts TYPE REF TO zif_litmus_texts.

  PRIVATE SECTION.
    TYPES request_rows TYPE STANDARD TABLE OF zlitmus_req WITH EMPTY KEY.

    DATA owner TYPE syuname.
    DATA texts TYPE REF TO zif_litmus_texts.

    "! Database key of a project of the owner; raises when it is missing or belongs to someone else
    METHODS owned_key
      IMPORTING
        project_id    TYPE zif_litmus_types=>id
      RETURNING
        VALUE(result) TYPE sysuuid_x16
      RAISING
        zcx_litmus_error.

    METHODS check_name_is_free
      IMPORTING
        name       TYPE string
        except_key TYPE sysuuid_x16
      RAISING
        zcx_litmus_error.

    METHODS clean_name
      IMPORTING
        name          TYPE string
      RETURNING
        VALUE(result) TYPE string
      RAISING
        zcx_litmus_error.

    METHODS new_key
      RETURNING
        VALUE(result) TYPE sysuuid_x16
      RAISING
        zcx_litmus_error.

    METHODS now
      RETURNING
        VALUE(result) TYPE timestampl.

    METHODS request_rows_of
      IMPORTING
        project       TYPE zif_litmus_types=>project
        project_key   TYPE sysuuid_x16
      RETURNING
        VALUE(result) TYPE request_rows
      RAISING
        zcx_litmus_error.

    METHODS check_requests_are_own
      IMPORTING
        rows        TYPE request_rows
        project_key TYPE sysuuid_x16
      RAISING
        zcx_litmus_error.

    METHODS to_header
      IMPORTING
        row           TYPE zlitmus_proj
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>project_header.

    METHODS to_request
      IMPORTING
        row           TYPE zlitmus_req
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>request
      RAISING
        zcx_litmus_error.

    METHODS to_request_row
      IMPORTING
        request       TYPE zif_litmus_types=>request
      RETURNING
        VALUE(result) TYPE zlitmus_req.

    METHODS headers_to_json
      IMPORTING
        headers       TYPE zif_litmus_types=>headers
      RETURNING
        VALUE(result) TYPE string.

    METHODS headers_from_json
      IMPORTING
        json          TYPE string
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>headers
      RAISING
        zcx_litmus_error.

    METHODS pack_wsdl
      IMPORTING
        wsdl          TYPE zif_litmus_types=>wsdl_package
      RETURNING
        VALUE(result) TYPE xstring
      RAISING
        zcx_litmus_error.

    METHODS unpack_wsdl
      IMPORTING
        content       TYPE xstring
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>wsdl_package
      RAISING
        zcx_litmus_error.

    METHODS raise_database_error
      IMPORTING
        statement TYPE string
      RAISING
        zcx_litmus_error.
    METHODS endpoints_to_json
      IMPORTING
        endpoints     TYPE zif_litmus_types=>endpoints
      RETURNING
        VALUE(result) TYPE string.
    METHODS endpoints_from_json
      IMPORTING
        json          TYPE string
      RETURNING
        VALUE(result) TYPE zif_litmus_types=>endpoints
      RAISING
        zcx_litmus_error.

ENDCLASS.



CLASS zcl_litmus_project_repo IMPLEMENTATION.

  METHOD constructor.
    me->owner = owner.
    me->texts = texts.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~list_for_owner.
    SELECT project_id, name, wsdl_url, changed_at
      FROM zlitmus_proj
      WHERE owner = @owner
      ORDER BY changed_at DESCENDING
      INTO TABLE @DATA(projects).
    IF projects IS INITIAL.
      RETURN.
    ENDIF.

    SELECT project_id, COUNT(*) AS request_count
      FROM zlitmus_req
      WHERE project_id IN ( SELECT project_id FROM zlitmus_proj WHERE owner = @owner )
      GROUP BY project_id
      INTO TABLE @DATA(counts).

    result = VALUE #( FOR project IN projects
                      ( project_id    = CONV #( project-project_id )
                        name          = project-name
                        wsdl_url      = project-wsdl_url
                        changed_at    = project-changed_at
                        request_count = VALUE #( counts[ project_id = project-project_id ]-request_count
                                                 OPTIONAL ) ) ).
  ENDMETHOD.


  METHOD zif_litmus_project_repo~read.
    DATA header_row TYPE zlitmus_proj.
    DATA(key) = owned_key( project_id ).

    SELECT SINGLE project_id, owner, project_type, name, wsdl_url, wsdl_loaded_at,
                  created_by, created_at, changed_by, changed_at, endpoints_json
      FROM zlitmus_proj
      WHERE project_id = @key
      INTO CORRESPONDING FIELDS OF @header_row.

    SELECT *
      FROM zlitmus_req
      WHERE project_id = @key
      ORDER BY position_no, name
      INTO TABLE @DATA(request_rows).

    result-header = to_header( header_row ).
    result-header-endpoints = endpoints_from_json( header_row-endpoints_json ).
    LOOP AT request_rows INTO DATA(request_row).
      INSERT to_request( request_row ) INTO TABLE result-requests.
    ENDLOOP.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~create.
    DATA(project_name) = clean_name( name ).
    check_name_is_free( name       = project_name
                        except_key = VALUE #( ) ).

    DATA(timestamp) = now( ).
    DATA(row) = VALUE zlitmus_proj( project_id   = new_key( )
                                    owner        = owner
                                    project_type = zif_litmus_types=>project_type-soap
                                    name         = project_name
                                    wsdl_url     = condense( wsdl_url )
                                    created_by   = owner
                                    created_at   = timestamp
                                    changed_by   = owner
                                    changed_at   = timestamp ).
    INSERT zlitmus_proj FROM @row.
    IF sy-subrc <> 0.
      raise_database_error( `INSERT ZLITMUS_PROJ` ).
    ENDIF.
    result = to_header( row ).
  ENDMETHOD.


  METHOD zif_litmus_project_repo~save.
    DATA(key) = owned_key( project-header-project_id ).
    DATA(rows) = request_rows_of( project     = project
                                  project_key = key ).
    check_requests_are_own( rows        = rows
                            project_key = key ).

    SELECT request_id
      FROM zlitmus_req
      WHERE project_id = @key
      INTO TABLE @DATA(stored).
    DATA obsolete TYPE request_rows.
    LOOP AT stored INTO DATA(old).
      IF NOT line_exists( rows[ request_id = old-request_id ] ).
        INSERT VALUE #( request_id = old-request_id ) INTO TABLE obsolete.
      ENDIF.
    ENDLOOP.
    IF obsolete IS NOT INITIAL.
      DELETE zlitmus_req FROM TABLE @obsolete.
    ENDIF.
    IF rows IS NOT INITIAL.
      MODIFY zlitmus_req FROM TABLE @rows.
      IF sy-subrc <> 0.
        raise_database_error( `MODIFY ZLITMUS_REQ` ).
      ENDIF.
    ENDIF.

    DATA(timestamp) = now( ).
    DATA(endpoints_json) = endpoints_to_json( project-header-endpoints ).
    UPDATE zlitmus_proj
      SET changed_by = @owner, changed_at = @timestamp, endpoints_json = @endpoints_json
      WHERE project_id = @key.
    result = zif_litmus_project_repo~read( project-header-project_id ).
  ENDMETHOD.


  METHOD zif_litmus_project_repo~rename.
    DATA(key) = owned_key( project_id ).
    DATA(project_name) = clean_name( name ).
    check_name_is_free( name       = project_name
                        except_key = key ).

    DATA(timestamp) = now( ).
    UPDATE zlitmus_proj
      SET name = @project_name, changed_by = @owner, changed_at = @timestamp
      WHERE project_id = @key.
    IF sy-subrc <> 0.
      raise_database_error( `UPDATE ZLITMUS_PROJ` ).
    ENDIF.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~delete.
    DATA(key) = owned_key( project_id ).
    DELETE FROM zlitmus_req WHERE project_id = @key.
    DELETE FROM zlitmus_proj WHERE project_id = @key.
    IF sy-subrc <> 0.
      raise_database_error( `DELETE ZLITMUS_PROJ` ).
    ENDIF.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~store_wsdl_cache.
    DATA(key) = owned_key( project_id ).
    DATA(content) = pack_wsdl( wsdl ).
    DATA(url) = condense( wsdl-url ).
    UPDATE zlitmus_proj
      SET wsdl_cache = @content, wsdl_loaded_at = @wsdl-loaded_at, wsdl_url = @url
      WHERE project_id = @key.
    IF sy-subrc <> 0.
      raise_database_error( `UPDATE ZLITMUS_PROJ` ).
    ENDIF.
  ENDMETHOD.


  METHOD zif_litmus_project_repo~read_wsdl_cache.
    DATA(key) = owned_key( project_id ).
    SELECT SINGLE wsdl_cache FROM zlitmus_proj WHERE project_id = @key INTO @DATA(content).
    IF content IS NOT INITIAL.
      result = unpack_wsdl( content ).
    ENDIF.
  ENDMETHOD.


  METHOD owned_key.
    result = CONV #( project_id ).
    SELECT SINGLE owner FROM zlitmus_proj WHERE project_id = @result INTO @DATA(project_owner).
    IF sy-subrc <> 0.
      texts->raise_error( zcl_litmus_texts=>key-project_not_found ).
    ENDIF.
    IF project_owner <> owner.
      texts->raise_error( zcl_litmus_texts=>key-not_authorized ).
    ENDIF.
  ENDMETHOD.


  METHOD check_name_is_free.
    SELECT project_id, name FROM zlitmus_proj WHERE owner = @owner INTO TABLE @DATA(projects).
    DATA(wanted) = to_upper( name ).
    LOOP AT projects INTO DATA(project) WHERE project_id <> except_key.
      IF to_upper( condense( project-name ) ) = wanted.
        texts->raise_error( text_key   = zcl_litmus_texts=>key-project_name_exists
                            variable_1 = name ).
      ENDIF.
    ENDLOOP.
  ENDMETHOD.


  METHOD clean_name.
    result = condense( name ).
    IF result IS INITIAL.
      texts->raise_error( zcl_litmus_texts=>key-project_name_empty ).
    ENDIF.
  ENDMETHOD.


  METHOD new_key.
    TRY.
        result = cl_system_uuid=>create_uuid_x16_static( ).
      CATCH cx_uuid_error INTO DATA(error).
        texts->raise_error( text_key   = zcl_litmus_texts=>key-database_error
                            variable_1 = error->get_text( ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD now.
    GET TIME STAMP FIELD result.
  ENDMETHOD.


  METHOD request_rows_of.
    DATA(timestamp) = now( ).
    LOOP AT project-requests INTO DATA(request).
      DATA(row) = to_request_row( request ).
      row-request_id = COND #( WHEN request-request_id IS INITIAL THEN new_key( ) ELSE row-request_id ).
      row-project_id = project_key.
      row-position_no = sy-tabix.
      row-changed_by = owner.
      row-changed_at = timestamp.
      INSERT row INTO TABLE result.
    ENDLOOP.
  ENDMETHOD.


  METHOD check_requests_are_own.
    IF rows IS INITIAL.
      RETURN.
    ENDIF.
    SELECT request_id
      FROM zlitmus_req
      FOR ALL ENTRIES IN @rows
      WHERE request_id = @rows-request_id
        AND project_id <> @project_key
      INTO TABLE @DATA(foreign_requests).
    IF foreign_requests IS NOT INITIAL.
      texts->raise_error( zcl_litmus_texts=>key-not_authorized ).
    ENDIF.
  ENDMETHOD.


  METHOD to_header.
    result = VALUE #( project_id     = CONV #( row-project_id )
                      owner          = row-owner
                      project_type   = row-project_type
                      name           = row-name
                      wsdl_url       = row-wsdl_url
                      wsdl_loaded_at = row-wsdl_loaded_at
                      created_by     = row-created_by
                      created_at     = row-created_at
                      changed_by     = row-changed_by
                      changed_at     = row-changed_at ).
  ENDMETHOD.


  METHOD to_request.
    result = VALUE #( request_id     = CONV #( row-request_id )
                      project_id     = CONV #( row-project_id )
                      interface_name = row-interface_name
                      operation      = row-operation
                      name           = row-name
                      position       = row-position_no
                      endpoint       = row-endpoint
                      body           = row-body
                      headers        = headers_from_json( row-headers_json )
                      auth_type      = row-auth_type
                      auth_user      = row-auth_user
                      timeout_sec    = row-timeout_sec
                      changed_by     = row-changed_by
                      changed_at     = row-changed_at
                      description    = row-description
                      encoding       = row-encoding ).
  ENDMETHOD.


  METHOD to_request_row.
    result = VALUE #( request_id     = CONV #( request-request_id )
                      interface_name = request-interface_name
                      operation      = request-operation
                      name           = request-name
                      endpoint       = request-endpoint
                      body           = request-body
                      headers_json   = headers_to_json( request-headers )
                      auth_type      = COND #( WHEN request-auth_type IS INITIAL
                                               THEN zif_litmus_types=>auth_type-none
                                               ELSE to_upper( request-auth_type ) )
                      auth_user      = request-auth_user
                      timeout_sec    = request-timeout_sec
                      description    = request-description
                      encoding       = to_upper( condense( request-encoding ) ) ).
  ENDMETHOD.


  METHOD headers_to_json.
    IF headers IS INITIAL.
      RETURN.
    ENDIF.
    DATA(writer) = cl_sxml_string_writer=>create( type = if_sxml=>co_xt_json ).
    CALL TRANSFORMATION id SOURCE headers = headers RESULT XML writer.
    result = cl_abap_codepage=>convert_from( writer->get_output( ) ).
  ENDMETHOD.


  METHOD headers_from_json.
    IF json IS INITIAL.
      RETURN.
    ENDIF.
    TRY.
        CALL TRANSFORMATION id SOURCE XML json RESULT headers = result.
      CATCH cx_transformation_error INTO DATA(error).
        texts->raise_error( text_key   = zcl_litmus_texts=>key-invalid_data
                            variable_1 = error->get_text( ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD pack_wsdl.
    DATA(writer) = cl_sxml_string_writer=>create( type = if_sxml=>co_xt_json ).
    CALL TRANSFORMATION id SOURCE wsdl = wsdl RESULT XML writer.
    TRY.
        cl_abap_gzip=>compress_binary( EXPORTING raw_in   = writer->get_output( )
                                       IMPORTING gzip_out = result ).
      CATCH cx_parameter_invalid_range cx_sy_buffer_overflow cx_sy_compression_error INTO DATA(error).
        texts->raise_error( text_key   = zcl_litmus_texts=>key-database_error
                            variable_1 = error->get_text( ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD unpack_wsdl.
    DATA json TYPE xstring.
    TRY.
        cl_abap_gzip=>decompress_binary( EXPORTING gzip_in = content
                                         IMPORTING raw_out = json ).
        CALL TRANSFORMATION id SOURCE XML json RESULT wsdl = result.
      CATCH cx_parameter_invalid_range cx_sy_buffer_overflow cx_sy_compression_error
            cx_transformation_error INTO DATA(error).
        texts->raise_error( text_key   = zcl_litmus_texts=>key-invalid_data
                            variable_1 = error->get_text( ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD raise_database_error.
    texts->raise_error( text_key   = zcl_litmus_texts=>key-database_error
                        variable_1 = statement ).
  ENDMETHOD.

  METHOD endpoints_to_json.
    IF endpoints IS INITIAL.
      RETURN.
    ENDIF.
    DATA(writer) = cl_sxml_string_writer=>create( type = if_sxml=>co_xt_json ).
    CALL TRANSFORMATION id SOURCE endpoints = endpoints RESULT XML writer.
    result = cl_abap_codepage=>convert_from( writer->get_output( ) ).
  ENDMETHOD.

  METHOD endpoints_from_json.
    IF json IS INITIAL.
      RETURN.
    ENDIF.
    TRY.
        CALL TRANSFORMATION id SOURCE XML json RESULT endpoints = result.
      CATCH cx_transformation_error INTO DATA(error).
        texts->raise_error( text_key   = zcl_litmus_texts=>key-invalid_data
                            variable_1 = error->get_text( ) ).
    ENDTRY.
  ENDMETHOD.
ENDCLASS.


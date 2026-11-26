"! <p class="shorttext synchronized">zLitmus - project repository</p>
"! Projects belong to one user: every method checks the owner (no sharing in phase 1).
INTERFACE zif_litmus_project_repo
  PUBLIC.

  "! Projects of the owner, newest change first
  METHODS list_for_owner
    RETURNING
      VALUE(result) TYPE zif_litmus_types=>project_summaries
    RAISING
      zcx_litmus_error.

  "! Header and requests of a project (without the WSDL cache)
  METHODS read
    IMPORTING
      project_id    TYPE zif_litmus_types=>id
    RETURNING
      VALUE(result) TYPE zif_litmus_types=>project
    RAISING
      zcx_litmus_error.

  "! Creates an empty SOAP project; the name must be unique for the owner
  METHODS create
    IMPORTING
      name          TYPE string
      wsdl_url      TYPE string
    RETURNING
      VALUE(result) TYPE zif_litmus_types=>project_header
    RAISING
      zcx_litmus_error.

  "! Saves the requests of a project: new and changed ones are written, missing ones deleted
  METHODS save
    IMPORTING
      project       TYPE zif_litmus_types=>project
    RETURNING
      VALUE(result) TYPE zif_litmus_types=>project
    RAISING
      zcx_litmus_error.

  METHODS rename
    IMPORTING
      project_id TYPE zif_litmus_types=>id
      name       TYPE string
    RAISING
      zcx_litmus_error.

  "! Deletes a project with its requests
  METHODS delete
    IMPORTING
      project_id TYPE zif_litmus_types=>id
    RAISING
      zcx_litmus_error.

  "! Stores the WSDL documents of a project (compressed)
  METHODS store_wsdl_cache
    IMPORTING
      project_id TYPE zif_litmus_types=>id
      wsdl       TYPE zif_litmus_types=>wsdl_package
    RAISING
      zcx_litmus_error.

  METHODS read_wsdl_cache
    IMPORTING
      project_id    TYPE zif_litmus_types=>id
    RETURNING
      VALUE(result) TYPE zif_litmus_types=>wsdl_package
    RAISING
      zcx_litmus_error.

ENDINTERFACE.

"! <p class="shorttext synchronized">zLitmus - page actions</p>
INTERFACE zif_litmus_action_handler
  PUBLIC.

  CONSTANTS:
    BEGIN OF action,
      project_list         TYPE string VALUE `PROJECT_LIST`,
      project_create       TYPE string VALUE `PROJECT_CREATE`,
      project_open         TYPE string VALUE `PROJECT_OPEN`,
      project_save         TYPE string VALUE `PROJECT_SAVE`,
      project_rename       TYPE string VALUE `PROJECT_RENAME`,
      project_refresh_wsdl TYPE string VALUE `PROJECT_REFRESH_WSDL`,
      project_delete       TYPE string VALUE `PROJECT_DELETE`,
      project_close        TYPE string VALUE `PROJECT_CLOSE`,
      request_send         TYPE string VALUE `REQUEST_SEND`,
      settings_save        TYPE string VALUE `SETTINGS_SAVE`,
      prefs_save           TYPE string VALUE `PREFS_SAVE`,
      exit                 TYPE string VALUE `EXIT`,
      " Quiet state update of the page; handled by ZCL_LITMUS_APP (kept, no answer, no page reload)
      ui_sync              TYPE string VALUE `UI_SYNC`,
      " Page menu: show the page again / choose the page file on the PC (handled by ZCL_LITMUS_APP)
      page_refresh         TYPE string VALUE `PAGE_REFRESH`,
      page_install         TYPE string VALUE `PAGE_INSTALL`,
      " Request / response as an XML file on the PC (handled by ZCL_LITMUS_APP)
      file_export          TYPE string VALUE `FILE_EXPORT`,
      " WSDL file on the PC: open dialog (handled by ZCL_LITMUS_APP)
      wsdl_browse          TYPE string VALUE `WSDL_BROWSE`,
    END OF action.

  CONSTANTS:
    BEGIN OF message_type,
      success TYPE string VALUE `S`,
      warning TYPE string VALUE `W`,
      error   TYPE string VALUE `E`,
    END OF message_type.

  TYPES:
    BEGIN OF reply,
      "! Answer for the page (boot field "reply")
      json           TYPE string,
      message_type   TYPE string,
      message_text   TYPE string,
      exit_requested TYPE abap_bool,
    END OF reply.

  "! Runs one page action; errors come back as a reply with ok = false
  METHODS handle
    IMPORTING
      action        TYPE string
      lines         TYPE zif_litmus_types=>page_lines
    RETURNING
      VALUE(result) TYPE reply.

  "! JSON with the WSDL documents of the projects that are open in this session
  METHODS workspace_json
    RETURNING
      VALUE(result) TYPE string.

  "! JSON with the settings of the user
  METHODS settings_json
    RETURNING
      VALUE(result) TYPE string.

  "! JSON array with the saved projects of the user (navigator list at start)
  METHODS project_list_json
    RETURNING
      VALUE(result) TYPE string.

ENDINTERFACE.

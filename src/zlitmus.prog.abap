*&---------------------------------------------------------------------*
*& zLitmus - The litmus test for your SAP web services.
*&---------------------------------------------------------------------*
* @author: Abdullah ATAN <abdullahatan92@gmail.com>
* @date: 25.11.2026 14:24:20
*&---------------------------------------------------------------------*
REPORT zlitmus.

TABLES sscrfields.

" Empty screen that carries the HTML control of zLitmus
SELECTION-SCREEN BEGIN OF SCREEN 1001 TITLE title.
SELECTION-SCREEN END OF SCREEN 1001.

CLASS lcl_screen DEFINITION FINAL CREATE PRIVATE.

  PUBLIC SECTION.
    CLASS-METHODS run.
    CLASS-METHODS output.
    CLASS-METHODS command
      IMPORTING
        ucomm TYPE syucomm.
    "! Back / Exit / Cancel (ON EXIT-COMMAND or a normal function code, depending on the GUI status)
    CLASS-METHODS leave
      IMPORTING
        ucomm TYPE syucomm.

  PRIVATE SECTION.
    CONSTANTS own_status TYPE sypfkey VALUE 'ZLITMUS_MAIN'.

    CLASS-DATA app TYPE REF TO zcl_litmus_app.
    "! The user chose Back / Exit / Cancel (the screen was left with LEAVE TO SCREEN 0)
    CLASS-DATA leave_requested TYPE abap_bool.

    "! Back / Exit / Cancel: codes of ZLITMUS_MAIN (CBAC, CEND, CCAN) and of the standard status (E, ENDE, ECAN)
    CLASS-METHODS is_leave_code
      IMPORTING
        ucomm         TYPE syucomm
      RETURNING
        VALUE(result) TYPE abap_bool.

    "! The optional GUI status ZLITMUS_MAIN exists (its short text is in the menu painter texts)
    CLASS-METHODS status_exists
      RETURNING
        VALUE(result) TYPE abap_bool.

ENDCLASS.


CLASS lcl_screen IMPLEMENTATION.

  METHOD run.
    app = zcl_litmus_app=>create( ).
    IF app->page_installed( ) = abap_false.
      DATA(not_installed) = app->texts( )->get( zcl_litmus_texts=>key-page_not_installed ).
      MESSAGE not_installed TYPE 'S' DISPLAY LIKE 'W'.
    ENDIF.

    DO.
      CLEAR leave_requested.
      CALL SELECTION-SCREEN 1001.
      DATA(left_by_user) = xsdbool( sy-subrc <> 0 OR leave_requested = abap_true ).
      IF app->exit_requested( ) = abap_true.
        EXIT.
      ENDIF.
      IF left_by_user = abap_true.
        " Back / Exit / Cancel of SAP GUI: without unsaved work leave, otherwise the page asks
        " "Save and exit | Cancel | Exit without saving" and ends with its EXIT action
        IF app->has_unsaved_changes( ) = abap_false.
          EXIT.
        ENDIF.
        app->request_exit_check( ).
      ENDIF.
      " F8 comes back here too: the screen is called again and the session (open projects) is kept
      app->release_control( ).
    ENDDO.
    app->free( ).
  ENDMETHOD.


  METHOD output.
    DATA excluded TYPE STANDARD TABLE OF syucomm WITH EMPTY KEY.

    DATA(texts) = app->texts( ).
    title = texts->get( zcl_litmus_texts=>key-screen_title ).
    " The page has its own menus: with ZLITMUS_MAIN the SAP menus of the selection screen are not shown
    IF status_exists( ) = abap_true.
      CALL FUNCTION 'RS_SET_SELSCREEN_STATUS'
        EXPORTING
          p_status  = own_status
          p_program = sy-repid
        TABLES
          p_exclude = excluded.
    ENDIF.
    app->pbo( ).
  ENDMETHOD.


  METHOD command.
    IF is_leave_code( ucomm ) = abap_true.
      leave( ucomm ).
      RETURN.
    ENDIF.
    app->user_command( ucomm ).
    IF app->exit_requested( ) = abap_true.
      LEAVE TO SCREEN 0.
    ENDIF.
  ENDMETHOD.


  METHOD leave.
    IF is_leave_code( ucomm ) = abap_false.
      RETURN.
    ENDIF.
    " RUN decides: without unsaved work the program ends, otherwise the page asks first
    leave_requested = abap_true.
    LEAVE TO SCREEN 0.
  ENDMETHOD.


  METHOD is_leave_code.
    result = xsdbool( ucomm = 'CBAC' OR ucomm = 'CEND' OR ucomm = 'CCAN'
                   OR ucomm = 'E' OR ucomm = 'ENDE' OR ucomm = 'ECAN' ).
  ENDMETHOD.


  METHOD status_exists.
    SELECT SINGLE @abap_true FROM rsmptexts
      WHERE progname = @sy-repid
        AND obj_type = 'C'
        AND obj_code = @own_status
      INTO @result.
  ENDMETHOD.

ENDCLASS.


AT SELECTION-SCREEN OUTPUT.
  lcl_screen=>output( ).

AT SELECTION-SCREEN ON EXIT-COMMAND.
  lcl_screen=>leave( sy-ucomm ).

AT SELECTION-SCREEN.
  lcl_screen=>command( sscrfields-ucomm ).

START-OF-SELECTION.
  lcl_screen=>run( ).

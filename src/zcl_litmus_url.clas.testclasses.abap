CLASS ltc_url DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    DATA cut TYPE REF TO zcl_litmus_url.

    METHODS setup.
    METHODS relative_to_directory FOR TESTING.
    METHODS dot_segment FOR TESTING.
    METHODS parent_directory FOR TESTING.
    METHODS absolute_reference FOR TESTING.
    METHODS root_relative_with_query FOR TESTING.
    METHODS query_only_reference FOR TESTING.
    METHODS wcf_xsd_import FOR TESTING.
    METHODS network_path_reference FOR TESTING.
    METHODS base_with_fragment_and_query FOR TESTING.
    METHODS host_without_path FOR TESTING.
    METHODS windows_path_to_file_url FOR TESTING.
    METHODS file_url_to_windows_path FOR TESTING.
    METHODS import_next_to_local_file FOR TESTING.
ENDCLASS.


CLASS ltc_url IMPLEMENTATION.

  METHOD setup.
    cut = NEW #( ).
  ENDMETHOD.


  METHOD relative_to_directory.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `https://host/svc/Service.svc?wsdl`
                          reference = `xsd/a.xsd` )
      exp = `https://host/svc/xsd/a.xsd` ).
  ENDMETHOD.


  METHOD dot_segment.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `http://h:8080/a/b/c.wsdl`
                          reference = `./d.xsd` )
      exp = `http://h:8080/a/b/d.xsd` ).
  ENDMETHOD.


  METHOD parent_directory.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `http://h/a/b/c.xsd`
                          reference = `../x/y.xsd` )
      exp = `http://h/a/x/y.xsd` ).
  ENDMETHOD.


  METHOD absolute_reference.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `http://h/a.wsdl`
                          reference = `https://other/b.xsd` )
      exp = `https://other/b.xsd` ).
  ENDMETHOD.


  METHOD root_relative_with_query.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `https://h/App/Service.svc?wsdl`
                          reference = `/sap/bc/srt/x?sap-client=100` )
      exp = `https://h/sap/bc/srt/x?sap-client=100` ).
  ENDMETHOD.


  METHOD query_only_reference.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `https://h/App/Service.svc?wsdl`
                          reference = `?xsd=xsd1` )
      exp = `https://h/App/Service.svc?xsd=xsd1` ).
  ENDMETHOD.


  METHOD wcf_xsd_import.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `https://h/App/Service.svc?wsdl`
                          reference = `https://h/App/Service.svc?xsd=xsd0` )
      exp = `https://h/App/Service.svc?xsd=xsd0` ).
  ENDMETHOD.


  METHOD network_path_reference.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `https://h/a/b.wsdl`
                          reference = `//cdn.example.com/types.xsd` )
      exp = `https://cdn.example.com/types.xsd` ).
  ENDMETHOD.


  METHOD base_with_fragment_and_query.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `http://h/dir/main.wsdl?a=1#part`
                          reference = `types.xsd` )
      exp = `http://h/dir/types.xsd` ).
  ENDMETHOD.


  METHOD host_without_path.
    cl_abap_unit_assert=>assert_equals(
      act = cut->resolve( base      = `http://h:8000?wsdl`
                          reference = `types.xsd` )
      exp = `http://h:8000/types.xsd` ).
  ENDMETHOD.


  METHOD windows_path_to_file_url.
    cl_abap_unit_assert=>assert_equals( act = cut->file_url( `C:\WSDL\demo service.wsdl` )
                                        exp = `file:///C:/WSDL/demo service.wsdl` ).
    cl_abap_unit_assert=>assert_equals( act = cut->file_url( `\\server\share\a.wsdl` )
                                        exp = `file://server/share/a.wsdl` ).
    cl_abap_unit_assert=>assert_true( cut->is_file( `FILE:///C:/a.wsdl` ) ).
    cl_abap_unit_assert=>assert_false( cut->is_file( `http://h/a?wsdl` ) ).
  ENDMETHOD.


  METHOD file_url_to_windows_path.
    cl_abap_unit_assert=>assert_equals( act = cut->local_path( `file:///C:/WSDL/demo%20service.wsdl` )
                                        exp = `C:\WSDL\demo service.wsdl` ).
    cl_abap_unit_assert=>assert_equals( act = cut->local_path( `file://server/share/a.wsdl` )
                                        exp = `\\server\share\a.wsdl` ).
  ENDMETHOD.


  METHOD import_next_to_local_file.
    cl_abap_unit_assert=>assert_equals( act = cut->resolve( base      = `file:///C:/WSDL/service.wsdl`
                                                            reference = `xsd/types.xsd` )
                                        exp = `file:///C:/WSDL/xsd/types.xsd` ).
    cl_abap_unit_assert=>assert_equals( act = cut->resolve( base      = `file:///C:/WSDL/x/service.wsdl`
                                                            reference = `../common.xsd` )
                                        exp = `file:///C:/WSDL/common.xsd` ).
  ENDMETHOD.

ENDCLASS.

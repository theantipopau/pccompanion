!macro NSIS_HOOK_POSTINSTALL
  StrCpy $R0 "$INSTDIR\binaries\PawnIO_setup.exe"
  IfFileExists "$R0" pawnio_install 0
  StrCpy $R0 "$INSTDIR\resources\binaries\PawnIO_setup.exe"
  IfFileExists "$R0" pawnio_install pawnio_done

  pawnio_install:
    DetailPrint "Installing Radium hardware sensor driver support..."
    DetailPrint "PawnIO installer path: $R0"
    nsExec::ExecToLog '"$R0" -install -silent'
    Pop $0
    DetailPrint "PawnIO installer exit code: $0"
    nsExec::ExecToLog 'sc.exe query PawnIO'
    Pop $0
    DetailPrint "PawnIO service query exit code: $0"
  pawnio_done:
!macroend

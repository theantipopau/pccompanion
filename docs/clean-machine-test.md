# Clean-Machine Install Test

Last reviewed: 2026-06-07

Use this checklist on a fresh Windows 11 machine or VM before any marketed release. Record the tester machine, Windows build, artifact path, and pass/fail notes in `docs/compatibility-matrix.md` after the run.

## Artifact Under Test

- Installer: `artifacts/radium/radium-pcs-companion-setup-20260607-102415.exe`
- Portable ZIP: `artifacts/radium/radium-pcs-companion-portable-20260607-102415.zip`
- Expected product name: `Radium PCs Companion`
- Expected publisher: `Radium PCs`
- Expected install mode: per-machine

## Pre-Install Checks

- Confirm artifact hash from latest `artifacts/radium/radium-artifact-manifest-*.json`.
- Run `scripts/pre_release_artifact_audit.ps1` against the copied installer and EXE.
- For signed release candidates, run `scripts/pre_release_artifact_audit.ps1 -RequireSignature`.
- Confirm Windows Defender does not quarantine the installer.
- Capture any SmartScreen prompt text and screenshot.

## Install Walkthrough

- Launch installer from a standard user account and confirm UAC behavior.
- Confirm installer name, icon, publisher, and app name are Radium-branded.
- Complete install.
- Confirm installed app appears in Start Menu as `Radium PCs Companion`.
- Confirm installed app appears in Windows Apps/Programs uninstall list.
- Confirm install directory contains bundled `binaries` resources.
- Confirm PawnIO installer hook behavior in installer logs where available.

## First Launch

- Launch from Start Menu.
- Confirm splash/onboarding are Radium-branded.
- Confirm Dashboard renders without clipped panels at the tester resolution.
- Confirm Dashboard current-state strip shows active profile, telemetry, tray/startup, and safety posture.
- Confirm browser-preview warning is not visible in packaged desktop mode.
- Confirm no automatic cloud upload prompt or network account requirement appears.

## Runtime Smoke

- Check Dashboard telemetry state and provider label.
- Open Telemetry Diagnostics and export diagnostics locally.
- Open System Passport and confirm readiness checklist renders.
- Toggle OSD on/off and confirm window behavior.
- Close main window and confirm close-to-tray behavior.
- Restore from tray.
- Start app with `--background` and confirm tray-only launch.
- Run quick RAM Cleaner in safe mode.
- Run Storage Cleaner scan, then cancel or dry-run cleanup only.
- Run Registry Cleaner scan and confirm backup requirement is visible before live clean.

## Reboot / Startup

- Enable Start with Windows and Start minimized.
- Reboot.
- Confirm app starts minimized/tray-only.
- Confirm logs appear under `%ProgramData%\Radium PCs Companion\logs`.
- Disable Start with Windows and reboot again.
- Confirm app no longer auto-starts.

## Uninstall / Reinstall

- Uninstall from Windows Apps/Programs.
- Confirm app process is stopped.
- Confirm Start Menu shortcut is removed.
- Confirm uninstall does not unexpectedly delete user diagnostics or registry backups without user consent.
- Reinstall the same artifact.
- Confirm settings migration/defaults behave sensibly after reinstall.

## Pass Criteria

- Product identity remains `Radium PCs Companion` throughout install, runtime, tray, logs, and uninstall surfaces.
- No silent destructive action runs during install, first launch, or uninstall.
- Native write actions require explicit user action and remain capability-gated.
- Defender/SmartScreen behavior is documented.
- Any missing telemetry is explained clearly instead of showing fabricated values.

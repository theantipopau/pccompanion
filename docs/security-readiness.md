# Radium PCs Companion Security Readiness

Last reviewed: 2026-06-01

This note tracks the app posture needed for a marketed or sold Windows desktop product. It complements `docs/current-state.md` and the release scripts.

## Current Safety Posture

- Local-first by default: diagnostics bundles, action history, CoPilot context, telemetry, and support exports stay on the machine unless the user deliberately sends them.
- Native write paths remain explicit and capability-gated. Firmware, EC, fan-table, undervolt, overclock, and RGB write paths are still blocked.
- External links are validated by the native backend in desktop mode; rejected links fail closed.
- Cleanup routines avoid unsafe targets, symlink traversal, and unreviewed destructive paths.
- Registry cleaning requires a backup path and uses guarded restore flow.
- Local CoPilot uses localhost-first runtime locking, advisory responses only, and no direct native mutation path.
- Sidecar loading is pinned to bundled install/resource paths instead of trusting arbitrary current-directory or environment locations.

## Release Checks

Run these before any customer-facing build:

```powershell
npm.cmd run quality:gate
npm.cmd run verify:radium-artifact
```

For a packaged walkthrough build, also confirm the copied artifact metadata:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pre_release_artifact_audit.ps1 `
  -ExePath artifacts/radium/radium-pcs-companion-20260601-201646.exe `
  -SetupPath artifacts/radium/radium-pcs-companion-setup-20260601-201646.exe
```

The artifact audit must fail if:

- `ProductName` or `FileDescription` is not `Radium PCs Companion`,
- the neutral `PC Companion` demo variant is supplied by mistake,
- required files are missing,
- `-RequireSignature` is used and Authenticode status is not `Valid`.

## Before Paid Distribution

- Obtain and apply an Authenticode code-signing certificate.
- Run `scripts/pre_release_artifact_audit.ps1 -RequireSignature` on the signed EXE and installer.
- Complete installer/uninstaller walkthrough on a clean tester machine.
- Validate Windows Defender / SmartScreen behavior on the signed package.
- Re-run lifecycle smoke and capture logs after signing.
- Keep third-party binary provenance evidence for PawnIO/LibreHardwareMonitor sidecar components.

## Residual Risks

- Current pre-release artifacts are unsigned unless a signing step is added outside this repo.
- Real hardware matrix remains incomplete for NVIDIA, AMD, Intel Arc, and hybrid GPU systems.
- CPU package temperature and board/fan sensors may require privileged provider paths on some systems.
- Local CoPilot setup needs clean-machine validation across no-runtime, runtime/no-model, and installed-model cases.

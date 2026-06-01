# Radium PCs Companion - Current State

Last reviewed: 2026-06-01

This is the short handoff brief. Keep long session history in `docs/context_log.md`; keep durable architecture in `docs/architecture.md`; keep validation coverage in `docs/compatibility-matrix.md`.

## Release Posture

- Target version: `0.1.0-pre`
- Channel: controlled public pre-release
- Runtime: Windows Tauri desktop app
- Distribution: NSIS installer plus release executable
- Product mode: local-first, no automatic cloud upload, native-only mutating operations

## Validated Baseline

- `npm.cmd run build` has passed.
- `npm.cmd run build` passed again on 2026-06-01 after the local CoPilot insight-card enhancement.
- `cargo check --manifest-path src-tauri/Cargo.toml` has passed.
- `npm.cmd run check:rust`, `npm.cmd run test:url-policy`, `npm.cmd run verify:demo-brand-leak`, and `npm.cmd run verify:demo-dev-config-restore` passed on 2026-06-01 for the local CoPilot enhancement pass.
- `npm.cmd run build:exe:demo` passed on 2026-06-01 after the GUI responsiveness pass.
- `npm.cmd run build:exe` passed on 2026-06-01 after clarifying that the requested walkthrough build should be Radium-branded, not the neutral demo variant.
- `npm.cmd run verify:radium-artifact` passed on 2026-06-01 and wrote a SHA-256 artifact manifest under `artifacts/radium/`.
- `scripts/pre_release_artifact_audit.ps1` also passed against the copied Radium walkthrough EXE and installer.
- `cargo test -q` has passed for library tests; full binary test execution may still require elevation on some hosts.
- `npm.cmd run build:exe` has produced the release executable and NSIS installer in prior validation passes.

## Current Product State

- Frontend pages are implemented and browser/native split is active.
- Browser mode uses mock data and shows a preview notice.
- Native mode propagates Tauri errors instead of silently falling back to mock data.
- Hardware monitoring uses sysinfo, WMI, NVML, AMD ADL, and staged Intel IGCL fallback paths.
- Storage scan has asynchronous lifecycle commands with progress and cancellation.
- Cleanup, registry, bloatware, startup, tray, diagnostics, OSD, and performance profile command surfaces are wired.
- Performance profile writes are limited to supported Windows power/timer controls; firmware/fan-table writes remain blocked.
- Local CoPilot preview is implemented as an offline-first surface with hardware-aware model recommendations, localhost runtime locking, persisted local runtime settings, typed confidence insight cards, and non-invasive advisory chat.
- CoPilot and shared panel responsive behavior has been tightened for tablet/mobile widths: long insight labels wrap cleanly, mobile CoPilot controls stretch to tap-friendly rows, and touch/narrow viewports avoid expensive hover transforms.
- Dashboard now includes a first-screen current-state strip for active profile, telemetry/provider freshness, tray/startup behavior, and local safety posture.
- Security readiness is tracked in `docs/security-readiness.md`.
- Latest Radium-branded walkthrough artifacts:
  - `artifacts/radium/radium-pcs-companion-20260601-203136.exe`
  - `artifacts/radium/radium-pcs-companion-setup-20260601-203136.exe`

## Main Release Risks

- Real hardware matrix coverage is still thin outside the Dell Latitude validation host.
- NVIDIA NVML and AMD ADL paths need fresh evidence on matching hardware.
- Intel Arc native sensor bindings remain staged; WMI/perf fallback is the active path.
- Interactive installer/uninstaller walkthrough still needs a dedicated tester-machine pass.
- Runtime performance targets exist but still need measured baselines.
- CoPilot runtime behavior still needs tester coverage across fresh Ollama installs, missing-model states, and systems with no local model runtime.
- Current pre-release artifacts are unsigned; paid distribution should use Authenticode signing and run `scripts/pre_release_artifact_audit.ps1 -RequireSignature`.

## Next Best Work

1. Validate on one NVIDIA desktop and one AMD GPU desktop.
2. Complete installer/uninstaller walkthrough with startup and tray lifecycle checks.
3. Measure idle RAM, monitor CPU overhead, WMI query latency, and IPC round-trip timing.
4. Keep documentation synced by updating this file first, then moving dated detail into `context_log.md`.
5. Continue small GUI fit/polish passes only where they reduce clipping, cramped grids, or support-readiness ambiguity.
6. Exercise the local CoPilot workflow on a clean machine: runtime install, model pull, model discovery, chat request, and offline failure states.

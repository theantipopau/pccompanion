# Radium PCs Companion - Current State

Last reviewed: 2026-05-25

This is the short handoff brief. Keep long session history in `docs/context_log.md`; keep durable architecture in `docs/architecture.md`; keep validation coverage in `docs/compatibility-matrix.md`.

## Release Posture

- Target version: `0.1.0-pre`
- Channel: controlled public pre-release
- Runtime: Windows Tauri desktop app
- Distribution: NSIS installer plus release executable
- Product mode: local-first, no automatic cloud upload, native-only mutating operations

## Validated Baseline

- `npm.cmd run build` has passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` has passed.
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

## Main Release Risks

- Real hardware matrix coverage is still thin outside the Dell Latitude validation host.
- NVIDIA NVML and AMD ADL paths need fresh evidence on matching hardware.
- Intel Arc native sensor bindings remain staged; WMI/perf fallback is the active path.
- Interactive installer/uninstaller walkthrough still needs a dedicated tester-machine pass.
- Runtime performance targets exist but still need measured baselines.

## Next Best Work

1. Validate on one NVIDIA desktop and one AMD GPU desktop.
2. Complete installer/uninstaller walkthrough with startup and tray lifecycle checks.
3. Measure idle RAM, monitor CPU overhead, WMI query latency, and IPC round-trip timing.
4. Keep documentation synced by updating this file first, then moving dated detail into `context_log.md`.
5. Continue small GUI fit/polish passes only where they reduce clipping, cramped grids, or support-readiness ambiguity.

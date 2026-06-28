# Radium PCs Companion - Current State

Last reviewed: 2026-06-27

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
- `npm.cmd run build` passed on 2026-06-02 after the CoPilot action-history context refinement.
- `npm.cmd run build`, `npm.cmd run check:rust`, `cargo test --manifest-path src-tauri/Cargo.toml --lib`, and `npm.cmd run build:sensor-sidecar` passed on 2026-06-02 after the responsiveness/maintenance safety pass.
- `npm.cmd run build`, `npm.cmd run check:rust`, `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `npm.cmd run test:url-policy`, `npm.cmd run verify:demo-dev-config-restore`, and `npm.cmd run verify:demo-brand-leak` passed on 2026-06-07 after the telemetry presentation and UI smoothness pass.
- `npm.cmd run test:telemetry-presentation` was added and passed on 2026-06-07 with 21 reducer tests covering startup, recovery, stale, provider-change, timestamp, unsupported-sensor, and sleep/resume-like transitions.
- `npm.cmd run test:telemetry-presentation`, `npm.cmd run build`, `npm.cmd run check:rust`, and `npm.cmd run test:url-policy` passed on 2026-06-12 after the Diagnostics support-status polish pass.
- `npm.cmd run build:exe` passed on 2026-06-12 and produced `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`.
- `npm.cmd run verify:radium-artifact` passed on 2026-06-12 and wrote `artifacts/radium/radium-artifact-manifest-20260612-170629.json`.
- Direct sidecar smoke passed on 2026-06-02 and confirmed the loaded LibreHardwareMonitor library version is `0.9.6+3d331e3370efb858411f19511373eff65a218701`.
- `cargo test -q` has passed for library tests; full binary test execution may still require elevation on some hosts.
- `npm.cmd run build:exe` has produced the release executable and NSIS installer in prior validation passes.
- On 2026-06-27, roughly two weeks of accumulated uncommitted changes (RGB Phase 1 OpenRGB discovery, OEM HTML support report export, hardware alert thresholds, Owner/Technician interface mode, Radium build identity provisioning with JSON seed import/export, OEM driver-update checks, dashboard chart code-splitting) were validated and committed. This machine previously had neither Node nor Rust on PATH and no Rust toolchain installed at all; Node was located at `C:\Program Files\nodejs`, and a Rust toolchain plus MSVC Build Tools were installed via `winget` specifically to validate this batch. `npm.cmd run build`, `npm.cmd run test:telemetry-presentation` (21/21), `cargo check --manifest-path src-tauri/Cargo.toml`, and `cargo test --manifest-path src-tauri/Cargo.toml --lib` (11/11, includes the URL policy validator tests) all passed on this machine before commit. Prior dated Rust-check entries above were recorded on a different machine/session.

## Current Product State

- Frontend pages are implemented and browser/native split is active.
- Browser mode uses mock data and shows a preview notice.
- Native mode propagates Tauri errors instead of silently falling back to mock data.
- Hardware monitoring uses sysinfo, WMI, NVML, AMD ADLX (preferred, added 2026-06-27) with legacy AMD ADL2 fallback for older cards, and staged Intel IGCL fallback paths.
- Storage scan has asynchronous lifecycle commands with progress and cancellation.
- Cleanup, registry, bloatware, startup, tray, diagnostics, OSD, and performance profile command surfaces are wired.
- Performance profile writes are limited to supported Windows power/timer controls; firmware/fan-table writes remain blocked.
- Local CoPilot preview is implemented as an offline-first surface with hardware-aware model recommendations, localhost runtime locking, persisted local runtime settings, typed confidence insight cards, local action-history context, and non-invasive advisory chat.
- CoPilot and shared panel responsive behavior has been tightened for tablet/mobile widths: long insight labels wrap cleanly, mobile CoPilot controls stretch to tap-friendly rows, and touch/narrow viewports avoid expensive hover transforms.
- Dense panel/list hover behavior has been further reduced for snappier maintenance and dashboard interaction; progress/RAM bar transitions now settle faster.
- System Cleaner reuses completed backend scan snapshots for cleanup, keeps review-only targets blocked, and limits Firefox cleanup to per-profile `cache2` contents.
- RAM Optimizer reports process scan/trim/skip coverage in addition to before/after memory.
- Registry Cleaner now detects unquoted missing file references with spaces while keeping risky categories review-only.
- Dashboard now includes a first-screen current-state strip for active profile, telemetry/provider freshness, tray/startup behavior, and local safety posture.
- Dashboard, shell, OSD, thermals, support, and passport surfaces now use a shared telemetry presentation model so startup, one-off degraded ticks, and stale readings do not cause abrupt UI label/value churn. Raw backend telemetry state remains visible in diagnostics and support context.
- Benchmark capture and CoPilot context continue to consume raw telemetry, not retained presentation samples. Telemetry Diagnostics now includes a read-only raw-vs-displayed presentation inspector for native runtime validation.
- Telemetry Diagnostics now shows visible refresh/export/probe failures, records failed export/probe actions in local history, and displays the last successful diagnostics refresh time.
- OmenCore optimizer functionality has been assessed in `docs/omencore-optimizer-assessment.md`; direct code import and broad Windows policy/service/network tweaks are deferred in favor of Radium's existing guarded Performance Profiles subset.
- RGB Phase 1 (validated and committed 2026-06-27): read-only OpenRGB SDK discovery over localhost `127.0.0.1:6742`, with bounded packet parsing and no lighting-write commands. Surfaced as a Utilities readiness card and included in diagnostics export under `rgbDiscovery`.
- OEM support reports (validated and committed 2026-06-27): a local HTML support report generator (`src/lib/supportReport.ts`) bundles Radium build identity, detected hardware, performance score, telemetry, storage, capabilities, sensor evidence, and recent local actions. Export is local-only; the owner/technician chooses whether to share it.
- Hardware alerts (validated and committed 2026-06-27): sustained-threshold CPU/GPU temperature, RAM pressure, and storage headroom alerts (`src/lib/hardwareAlerts.ts`) feed Dashboard and record cooldown-throttled local action history entries; thresholds are configurable in Settings.
- Owner/Technician interface mode and Radium build identity provisioning (validated and committed 2026-06-27): Settings now has an interface-mode toggle and a System Passport build-identity panel with local JSON seed import/export.
- Security readiness is tracked in `docs/security-readiness.md`; clean-machine walkthrough criteria are tracked in `docs/clean-machine-test.md`.
- Signing workflow scaffold is available through `npm.cmd run sign:radium`; Windows SDK `signtool.exe` is discoverable, but no signing identity is configured in this workspace yet.
- Latest Radium-branded audited build outputs (2026-06-27, includes the AMD ADLX provider, RGB Phase 1, support reports, hardware alerts, and Owner/Technician mode):
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`
  - `artifacts/radium/radium-artifact-manifest-20260628-140439.json`
  - Built and audited on the Ryzen 7 9800X3D + Radeon RX 9070 XT host; unsigned by deliberate choice for this personal test build (`npm.cmd run sign:radium` was not run). `npm.cmd run verify:radium-artifact` confirmed correct `Radium PCs Companion` product identity on both the EXE and installer.
  - Not yet installed/launched on real hardware as of this writing — installing and running it is the next step, and will also serve as the first real elevated-launch/tray/OSD/installer validation pass (dev-mode UAC automation was unreliable in the assistant's session; a normal end-user install/launch goes through UAC once, interactively, which should not have the same issue).

## Main Release Risks

- Real hardware matrix coverage is still thin outside the Dell Latitude validation host.
- NVIDIA NVML and AMD ADL paths need fresh evidence on matching hardware.
- Intel Arc native sensor bindings remain staged; WMI/perf fallback is the active path.
- Interactive installer/uninstaller walkthrough still needs a dedicated tester-machine pass.
- Runtime performance targets exist but still need measured baselines.
- CoPilot runtime behavior still needs tester coverage across fresh Ollama installs, missing-model states, and systems with no local model runtime.
- Current pre-release artifacts are unsigned; paid distribution should use Authenticode signing and run `npm.cmd run sign:radium` or `scripts/pre_release_artifact_audit.ps1 -RequireSignature`.
- Stricter lifecycle smoke now fails on leftover background processes; the current workspace needs an elevated tester pass because one release EXE process could not be terminated from this shell (`Access is denied`).

## Next Best Work

1. Validate on one NVIDIA desktop and one AMD GPU desktop.
2. Complete installer/uninstaller walkthrough with startup and tray lifecycle checks.
3. Measure idle RAM, monitor CPU overhead, WMI query latency, and IPC round-trip timing.
4. Keep documentation synced by updating this file first, then moving dated detail into `context_log.md`.
5. Continue small GUI fit/polish passes only where they reduce clipping, cramped grids, or support-readiness ambiguity.
6. Exercise the local CoPilot workflow on a clean machine: runtime install, model pull, model discovery, chat request, and offline failure states.
7. Add measured idle/render jitter baselines once a clean tester machine is available.
8. Manually validate native cold launch, monitoring restart, safe provider interruption, sleep/resume, OSD, and tray presentation labels on tester hardware.

# Changelog

All notable changes to Radium PCs Companion are recorded here. Format is loosely based on [Keep a Changelog](https://keepachangelog.com/). Detailed engineering rationale for this release lives in `docs/premium-experience-roadmap.md`.

## [0.3.0] - 2026-07-13

Premium-feel and reliability pass. No changes to hardware telemetry providers, native write paths, or the safety/capability-gating model in this release.

### Fixed
- **Theme desync**: switching themes now actually reskins the dashboard gauge and trend charts — they previously stayed hardcoded to the default palette regardless of the active theme.
- **Telemetry could silently stop updating**: a rare panic inside the 1 Hz hardware monitor loop could permanently poison a lock and kill telemetry until app restart. The monitor loop now recovers from a poisoned lock instead of cascading into repeated panics.
- Inconsistent "no data yet" messaging on Thermals, Dashboard, System Passport, and Benchmark (previously a mix of "Scanning" / "Pending" / "Unavailable" / "Awaiting scan" for the same underlying state) is now two consistent, distinct messages: one for "still loading" and one for "this hardware doesn't expose this metric."

### Changed
- Renamed the internal `--cyan` design token to `--accent` (it was always orange) — no visible effect, but removes a long-standing source of confusion for anyone touching the stylesheet.
- Extended entrance and list animations to 7 more pages (Performance Profiles, Startup Manager, Bloatware Remover, System Cleaner, Registry Cleaner, System Passport, Utilities) — filterable lists now animate items in/out instead of hard-cutting, and profile switching crossfades.
- The Radium Performance Score and its per-pillar breakdown on System Passport now count up/down smoothly instead of jumping.
- Unified every hover/press/transition animation in the app (CSS and JS) onto one consistent set of motion curves, replacing over a dozen slightly-different one-off timings accumulated over time. This is the biggest lever in this release for the app feeling like one cohesive product instead of a collection of screens.
- `SettingsPage` internals reorganized into `src/pages/settings/` (General, Build Identity, About, Game Mode) — no behavior change, purely maintainability.
- Converted 5 focus-ring styles from mouse+keyboard triggers to keyboard-only, matching the rest of the app and removing a focus-ring "flash" on ordinary mouse clicks.

### Internal
- Added 14 unit tests for hardware-detection/vendor-classification logic (Rust test suite: 11 → 25 passing).
- Memoized the two most frequently rendered dashboard widgets (gauge, metric card) so they skip re-render work when their displayed value hasn't actually changed.
- Reviewed the GPU-vendor-provider architecture, sensor-sidecar packaging, native NVMe health reads, fan-curve control, and a real in-game frame-time overlay as candidate follow-up work; deliberately deferred all of them pending access to real target hardware to validate against, consistent with this project's hardware-validation practice.

---

## [0.2.0] - 2026-06-28

See `docs/radium-improvement-audit.md` and `docs/current-state.md` for the full history prior to the changelog's introduction in 0.3.0, including: RGB Phase 1 (read-only OpenRGB discovery), OEM support report export, hardware alert thresholds, Owner/Technician interface mode, Radium build identity provisioning, the AMD ADLX GPU telemetry provider, and the WMI VRAM-reporting fix.

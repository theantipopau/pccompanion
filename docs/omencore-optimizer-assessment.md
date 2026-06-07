# OmenCore Optimizer Assessment

Last reviewed: 2026-06-07

This note records the local review of `F:\OmenCore\omencore\src\OmenCoreApp\Services\SystemOptimizer` for possible Radium PCs Companion integration.

## Decision

Do not import OmenCore optimizer code directly. Radium should keep its existing clean-room, Rust/Tauri command model and only borrow product ideas where they fit the current safety posture.

## Suitable Ideas

- Power-plan verification and drift reporting map well to Radium's existing Performance Profiles surface. Radium already applies Windows power plans, timer resolution, and processor policy through capability-gated native commands.
- Preflight summaries with risk, reboot, and recommendation metadata are worth adopting for any future optimizer expansion.
- Read-only optimizer state checks are a good fit for diagnostics or support context if implemented through Radium-owned backend code.

## Deferred Or Rejected Tweaks

- Service disabling, Windows telemetry policy writes, Delivery Optimization policy writes, broad TCP registry tweaks, Game DVR/Game Bar policy writes, visual-effects registry presets, 8.3 filename changes, prefetch/SysMain changes, and last-access timestamp writes are too broad for the current product promise.
- These actions require stronger per-setting explanations, reversible backups, admin/elevation UX, and hardware/workload validation before they should appear in Radium.
- OmenCore's in-memory backup service is not sufficient as-is for Radium release use. Radium should continue using explicit local backup paths and visible restore flows.

## Integration Path

1. Keep the current Performance Profiles implementation as the active safe subset.
2. Add future read-only optimizer diagnostics first: active power plan, Game Mode/HAGS state, TRIM state, and relevant Windows policy state.
3. If any write is added later, require preflight, explicit confirmation, durable backup, revert command, post-apply verification, and documentation in `docs/security-readiness.md`.

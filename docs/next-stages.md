# Radium PCs Companion Next Stages

## Purpose

This document captures the next phase after the current pre-release baseline. It focuses on the Utilities surface, how we should stage the remaining features, and which open-source patterns are worth borrowing from without copying their implementation.

## Current State Snapshot

As of May 2026 the following is live and shipped:

- **Utilities tab**: refactored into three groups (`Live now`, `Capability staged`, `Planned next`) with per-module status labels and action links. ✅ Slice A
- **Performance profiles**: full apply flow with planned-changes preview, per-profile summaries, confirmed-state updates, and gated low-level writes. ✅ Slice B
- **Benchmark page**: capture engine, live sensor trust panel, result cards, and a latest-vs-previous comparison block with per-metric deltas. ✅ Slice F
- **Thermal panel**: intake badge repositioned from a fixed `left: 70%` anchor to `right: 4%` so it stays inside the case frame at all panel widths.
- **Bug fixes shipped**: PawnIO silent flag, recycle-bin Win32 path, registry-cleaner idempotent delete, RAM-cleaner output clarity, NVIDIA badge copy.

Staged items still pending:

- App version display and update surfacing (Slice C — active next)
- Manual game profile mappings (Slice D)
- Sensor provider validation loop (Slice E)
- RGB and vendor extras (Stage 6)

## Recommended Next Stages

### Stage 1: Finish the utilities foundation

Goal: make the Utilities tab read as a coherent product roadmap instead of a mixed backlog.

Work:

- Split the current cards into clearer groups: live, staged, and planned.
- Add short explanatory labels for each card, such as `Live now`, `Capability staged`, and `Planned next`.
- Tighten the copy so each module states what is already working and what is still gated.
- Keep the "dangerous" actions visibly capability-gated.

Why:

- users should be able to tell at a glance what is safe to use today,
- staged items should feel intentional rather than incomplete,
- the Utilities tab should communicate product maturity, not just feature names.

### Stage 2: Make performance profiles first-class

Goal: turn Performance Profiles into the primary utility workflow for power users.

Work:

- expose the existing profile list more prominently in the Utilities tab,
- add clearer profile summaries for Quiet, Balanced, Creator, and Gaming,
- show what each profile changes before the user applies it,
- keep writes reversible and limited to supported OS controls,
- leave firmware and fan-table writes blocked until a safe adapter is proven.

How:

- reuse the existing profile backend contract,
- treat profile application as a service operation with explicit status,
- keep the UI optimistic only after the apply result is confirmed,
- preserve the current dry-run / capability-gated approach for anything low-level.

### Stage 2.5: Add app version and update surfacing

Goal: make software updates visible without turning the shell into a marketing banner.

Work:

- show the current Radium PCs Companion version in Settings,
- add a quiet "update available" indicator in the sidebar or top status strip,
- keep the indicator subtle by default, with a direct action only when an update exists,
- link the update state to the existing release channel / version metadata,
- avoid interruptive modal prompts unless the update is security-critical.

How:

- reuse the app version already defined in the Tauri metadata,
- fetch update availability through a small startup check or background poll,
- show a compact pill or badge rather than a dialog,
- let the user open release notes or the download page from Settings.

### Stage 3: Add game-aware profiles

Goal: let the app switch profiles around games without becoming a background gimmick.

Work:

- detect foreground game sessions or user-defined game entries,
- map a game or launcher to a profile preset,
- support simple triggers first: process name, executable path, and manual assignment,
- add a "launch profile" and "restore profile" flow,
- keep the switching local-only and reversible.

How:

- use a lightweight local rule engine rather than a cloud sync model,
- start with manual per-game mappings in Settings,
- promote automation only after the manual mapping path proves reliable,
- prefer explicit user consent over hidden auto-switching.

### Stage 4: Expand low-level sensor support

Goal: make the sensor provider feel like a real foundation, not a hidden experiment.

Work:

- finish the bundled sensor-sidecar packaging and diagnostics visibility,
- surface clearer messages when the provider is missing, blocked, or staged,
- continue vendor-specific work for AMD, Intel, and Ryzen package sensors,
- keep the installer path clean and fail-closed when the driver payload is not present.

How:

- keep using signed, bundled local components only,
- prefer vendor APIs or well-defined sensor libraries over ad hoc scraping,
- keep diagnostics readable enough for support staff to identify the path taken.

### Stage 5: Add benchmark and tuning surfaces

Goal: create a simple place for repeatable local performance checks.

Work:

- turn the benchmark page into a repeatable local test flow,
- keep result export simple and support-friendly,
- tie benchmarks back into the existing telemetry confidence model,
- use them to validate whether a profile actually improved the system.

How:

- make every benchmark run local and deterministic where possible,
- use the same telemetry provider state that the rest of the app trusts,
- avoid turning the benchmark into a synthetic marketing screen.

### Stage 6: RGB and vendor extras

Goal: support vendor extras only after the core power and thermal flows are stable.

Work:

- keep RGB integration behind a capability abstraction,
- wire vendor SDKs or OpenRGB-style adapters only if they are safe and reversible,
- avoid making the product depend on flashy but fragile integrations.

## Inspiration From Open Source

These are the patterns worth borrowing:

- LibreHardwareMonitor: strong sensor discovery, explicit sensor typing, and conservative vendor fallbacks.
- FanControl: practical profile-driven UX, clear presets, and a focus on reversible changes.
- OpenRGB: vendor abstraction and the idea that hardware capability should drive whether a control is visible.
- OmenCore: game-aware profile switching and per-game performance policy as a first-class feature.

The main lesson from those projects is not the UI styling; it is the control model:

- detect capability first,
- expose it only when it is safe,
- keep state transitions reversible,
- avoid pretending a feature is live if the backend is only partially staged.

## Recommended Implementation Order

1. ~~Clean up the Utilities tab grouping and status labels.~~ ✅ Done
2. ~~Promote performance profiles so they read as a supported workflow.~~ ✅ Done
3. **Add app version and non-intrusive update surfacing.** ← active next (Slice C)
4. Add manual per-game profile mappings.
5. Expand sensor-provider staging and diagnostics.
6. ~~Add benchmark validation and tuning feedback.~~ ✅ Done
7. Revisit RGB and vendor-specific extras last.

## Implementation Kickoff Plan

### Slice A: Utilities roadmap surface ✅ DONE

Shipped. `UtilitiesPage.tsx` has three groups (`live`, `staged`, `planned`), a `UtilityStatus` vocabulary, per-card one-line summaries, and action links for live modules. No further work needed here unless new modules are added.

### Slice B: Performance profile workflow ✅ DONE

Shipped. `PerformanceProfilesPage.tsx` has full apply flow, planned-changes preview panel, confirmed-state updates, error handling, and gated write visibility. Utilities page links directly to profiles.

### Slice C: Version and app update surfacing 🔜 ACTIVE NEXT

Scope:

- Add a `get_app_version` Tauri command that returns the Cargo package version string (already in `tauri.conf.json` / `Cargo.toml`).
- Show the current version in Settings near the native integration panel — small muted label, always visible offline.
- Add a quiet update-available pill in the sidebar status strip or topbar. Only shown when a check finds a newer tag; fails closed to nothing visible.
- Update check hits a small JSON endpoint (GitHub releases or a static file); no modal, no blocking UI.
- Wire `app_version` and optional `update_available: bool` into `AppMetadata` on the TS side.

Acceptance checks:

- Version string visible in Settings with no network access.
- Update check failure shows nothing (not an error banner).
- Update available → compact pill with "What's new" / download link, no startup dialog.
- Browser preview shows a hardcoded version label clearly marked `[preview]`.

Likely files:

- `src-tauri/src/lib.rs` — add `get_app_version` command
- `src/services/native.ts` — add `getAppVersion` invoke
- `src/services/systemService.ts` — add `getAppMetadata` + optional update poll
- `src/types/system.ts` — add `AppMetadata` type
- `src/pages/SettingsPage.tsx` — version display block
- `src/components/Shell.tsx` — sidebar update pill

### Slice D: Manual game profile mappings

Scope:

- Add a local-only game mapping model: process name, optional executable path, selected performance profile, restore profile.
- Start in Settings or a compact Game Mode page with manual add/edit/remove.
- Use current `listTopProcesses` as the first discovery aid.
- Keep automatic switching disabled by default; expose a reviewed "detect running game" step before background automation.

Acceptance checks:

- Users can create a mapping without auto-switching being enabled.
- Restore behavior is explicit: previous profile or chosen default profile.
- No cloud sync, hidden background rules, or unreviewed process mutation.

Likely files:

- `src/types/system.ts`
- `src/context/SettingsContext.tsx`
- `src/pages/SettingsPage.tsx` or a new `GameModePage.tsx`
- `src/pages/ProcessMonitorPage.tsx`

### Slice E: Sensor provider validation loop

Scope:

- Keep the PawnIO/LHM sidecar as the current validation path.
- Add clearer provider lifecycle states to Diagnostics: bundled, installed, service visible, sensor rows visible, CPU package accepted.
- Keep release packaging fail-closed when `PawnIO_setup.exe` is missing or unsigned.
- Capture the exact sidecar status in support export so tester-machine results are actionable.

Acceptance checks:

- On a machine with no matching sensors, the app explains "provider present but no CPU package row" rather than showing a blank.
- On Ryzen tester hardware, support can distinguish installer failure, driver/service failure, sidecar launch failure, and sensor matching failure.
- Diagnostics language stays short enough to avoid clipping in Settings.

Likely files:

- `tools/radium-sensor-sidecar/Program.cs`
- `src-tauri/src/sidecar_provider.rs`
- `src-tauri/src/hardware.rs`
- `src/pages/TelemetryDiagnosticsPage.tsx`
- `scripts/build-sensor-sidecar.ps1`

### Slice F: Benchmark proof of value ✅ DONE

Shipped. `BenchmarkPage.tsx` has a 30-second capture engine, live sensor trust panel with explicit trusted/missing chips, result cards (CPU/GPU avg+max, load, fan, power, RAM), and a latest-vs-previous comparison block with per-metric deltas and `lowerIsBetter` colouring. Results stay local; no cloud upload.
- `src/services/systemService.ts`
- `src/types/system.ts`
- `src-tauri/src/lib.rs`

## First PR Shape

Keep the first implementation PR small and UI-led:

1. Utilities grouping and status labels.
2. Compact profile preview on Utilities.
3. Settings app version display using local metadata only.

Defer network update checks, game mappings, benchmark execution, RGB, and any new hardware writes until the first PR proves the information architecture.

Current implementation progress:

- Utilities grouping/status labels: implemented.
- Compact profile preview on Utilities: implemented.
- Settings app version display from local metadata: implemented.
- Release notes/update status surfacing: implemented as a manual, non-intrusive link.
- Profile preview-before-apply flow: implemented.
- Exact active profile persistence: implemented through settings.
- Manual game profile mappings: implemented as local settings; background automation is still off.
- Sensor sidecar lifecycle strip: implemented in Diagnostics for bundled/runtime/driver/sensor-row/CPU-package states.
- Thermal page premium backdrop asset: implemented with live telemetry overlays, fan callouts, and CPU/GPU vendor marks.
- Benchmark capture page: implemented as a local telemetry window with trusted/missing sensor reporting and latest-vs-previous comparison.
- Security hardening pass: URL opening now uses HTTPS allow-listing, cleanup skips unsafe targets/symlink traversal, and release sidecar loading no longer trusts arbitrary environment/current-directory paths.
- Network update checks, RGB, background game automation, and new hardware writes: deferred.

## Guardrails

- Keep native mutations local and capability-gated.
- Do not ship firmware writes before the safety model is proven.
- Do not add background automation that the user cannot review.
- Keep the installer deterministic and bundled.
- Keep the support story readable in Diagnostics.

## Related Files

- [UtilitiesPage.tsx](../src/pages/UtilitiesPage.tsx)
- [current-state.md](current-state.md)
- [architecture.md](architecture.md)
- [context_log.md](context_log.md)

# Radium PCs Companion Next Stages

## Purpose

This document captures the next phase after the current pre-release baseline. It focuses on the Utilities surface, how we should stage the remaining features, and which open-source patterns are worth borrowing from without copying their implementation.

## Current State Snapshot

The Utilities tab already mixes live features with staged ones:

- Live: Performance profiles, startup manager, storage cleaner.
- Staged: fan control groundwork, radium sensor provider, network optimisation, RGB integration, benchmark page, game mode.
- Directional signal: the tab is moving from generic maintenance utilities toward capability-driven hardware control and game-aware profiles.

The current product already has:

- real hardware telemetry,
- vendor-aware GPU and chipset detection,
- staged low-level sensor provider work,
- safe cleanup and registry tools,
- profile plumbing that is intentionally conservative.

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

1. Clean up the Utilities tab grouping and status labels.
2. Promote performance profiles so they read as a supported workflow.
3. Add manual per-game profile mappings.
4. Expand sensor-provider staging and diagnostics.
5. Add benchmark validation and tuning feedback.
6. Revisit RGB and vendor-specific extras last.

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

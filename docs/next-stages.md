# Radium PCs Companion Next Stages

## Purpose

This document captures the next phase after the current pre-release baseline. It focuses on the Utilities surface, how we should stage the remaining features, and which open-source patterns are worth borrowing from without copying their implementation.

## Current State Snapshot

As of May 2026 the following is live and shipped:

- **Utilities tab**: refactored into three groups (`Live now`, `Capability staged`, `Planned next`) with per-module status labels and action links. ✅ Slice A
- **Performance profiles**: full apply flow with planned-changes preview, per-profile summaries, confirmed-state updates, and gated low-level writes. ✅ Slice B
- **Benchmark page**: capture engine, live sensor trust panel, result cards, and a latest-vs-previous comparison block with per-metric deltas. ✅ Slice F
- **Thermal panel**: intake badge repositioned from a fixed `left: 70%` anchor to `right: 4%` so it stays inside the case frame at all panel widths.
- **Bug fixes shipped**: PawnIO `-install -silent` invocation, installed sidecar lookup from `$INSTDIR\binaries`, recycle-bin Win32 path, registry-cleaner idempotent delete, RAM-cleaner output clarity, NVIDIA badge copy.
- **Registry cleaner scope**: expanded toward a CCleaner-style scan set while keeping risky areas review-only. Covered categories now include startup references, uninstall leftovers, application paths, missing shared DLL values, help file references, fonts, MUI cache, sound events, ActiveX/COM, type libraries, and file associations.
- **Branding and tray polish**: splash and first-run onboarding now include the Radium mark, the tray live icon has higher contrast typography, and tooltips expose the active performance mode.
- **Power profile clarity**: profile previews now explain expected behaviour, persistence, Windows power-plan writes, processor policy, timer resolution, and blocked firmware/EC controls.
- **Profile validation**: profile apply results now validate the active Windows power plan and processor min/max/boost policy after native writes complete.
- **Sidecar diagnostics**: Diagnostics now has a manual Radium sidecar probe that reports launch status, driver-row visibility, CPU package match, fan/storage rows, and checked sidecar paths.
- **Tray mode switching**: tray menu power modes now route through the native apply path for Quiet, Balanced, Gaming, and Creator instead of only changing local UI intent.
- **Owner support workflow**: About now prepares a local diagnostics bundle, drafts a Companion assistance email with system context, and shows local-only recent Companion action history.
- **Radium Care checklist**: System Passport now includes an owner-readiness checklist for telemetry, CPU package sensor state, GPU provider depth, storage headroom, and support bundle readiness.
- **Restore Centre**: About now lists local Registry Cleaner backups from Documents and can invoke the existing restore path without requiring the current Registry Cleaner session.
- **Action coverage**: Registry Cleaner, System Cleaner, Bloatware Remover, tray utilities, diagnostics export, and profile changes now write high-level local action records for support context.
- **Dashboard next actions**: the Radium Performance Score panel now suggests owner-friendly next steps such as checking sensor provider health, freeing storage, updating GPU drivers, reviewing profiles, or opening the System Passport.
- **Companion support routing**: app-level support CTAs now target `companion@radiumpcs.com.au`, while general Radium support remains listed for hardware/service requests.
- **First-run setup**: onboarding now lets owners choose tray metric, default profile, and Windows startup preference before entering the dashboard.

Staged items still pending:

- Network update checks / auto-updater. Local version display and manual release-note surfacing are live.
- Background game profile automation. Manual per-game mappings are live and automation stays opt-in.
- Deeper sensor provider telemetry for CPU package, fan, and SMART rows. Diagnostics and manual sidecar probing are live.
- Local AI insights and an optional local LLM copilot tab. No cloud dependency by default.
- Session summaries, build certificate export, richer notification policy, and OEM report/PDF export.
- RGB and vendor extras. These remain intentionally blocked until reversible adapters are proven.

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

### Stage 6: Local AI insights and optional local copilot

Goal: add meaningful "AI" value with zero cloud cost by default, then layer in an optional local LLM assistant.

Work:

- Ship a deterministic local insights engine first (no model required).
- Convert diagnostics, telemetry confidence, and recent actions into owner-friendly findings.
- Add confidence labels per insight (`High confidence`, `Medium confidence`, `Needs more data`).
- Keep all insight generation local and offline-capable.
- Add a preview Local AI tab that can summarize system state and explain recommendations.
- Keep all write actions behind existing capability gates and explicit user confirmation.

How:

- Start with a rule-based analyzer service that emits typed `InsightCard` records.
- Reuse existing context sources: diagnostics state, profile state, benchmark deltas, and action history.
- Add a local model recommender that maps hardware tiers to supported model profiles.
- Host any future LLM runtime in a separate local sidecar process with localhost-only IPC.
- Treat LLM output as advisory text; execution continues through existing guarded native commands.

### Stage 7: RGB and vendor extras

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
3. ~~Add app version and non-intrusive local update surfacing.~~ ✅ Done; network update checks deferred.
4. ~~Add manual per-game profile mappings.~~ ✅ Done; background automation deferred.
5. ~~Expand sensor-provider staging and diagnostics.~~ ✅ Done; deeper CPU/fan/storage telemetry pending.
6. ~~Add benchmark validation and tuning feedback.~~ ✅ Done
7. Add local AI insights and optional local copilot preview (read-only first).
8. Revisit RGB and vendor-specific extras last.

## Implementation Kickoff Plan

### Slice A: Utilities roadmap surface ✅ DONE

Shipped. `UtilitiesPage.tsx` has three groups (`live`, `staged`, `planned`), a `UtilityStatus` vocabulary, per-card one-line summaries, and action links for live modules. No further work needed here unless new modules are added.

### Slice B: Performance profile workflow ✅ DONE

Shipped. `PerformanceProfilesPage.tsx` has full apply flow, planned-changes preview panel, confirmed-state updates, error handling, and gated write visibility. Utilities page links directly to profiles.

### Slice C: Version and app update surfacing ✅ LOCAL SURFACE DONE

Scope:

- Add a `get_app_version` Tauri command that returns the Cargo package version string (already in `tauri.conf.json` / `Cargo.toml`).
- Show the current version in Settings near the native integration panel — small muted label, always visible offline.
- Add a quiet update-available pill in the sidebar status strip or topbar. Only shown when a check finds a newer tag; fails closed to nothing visible.
- Update check hits a small JSON endpoint (GitHub releases or a static file); no modal, no blocking UI.
- Wire `app_version` and optional `update_available: bool` into `AppMetadata` on the TS side.

Acceptance checks:

- Version string visible in Settings with no network access.
- Manual release-note surfacing stays non-intrusive and does not block startup.
- Future update check failure shows nothing (not an error banner).
- Future update available → compact pill with "What's new" / download link, no startup dialog.
- Browser preview shows a hardcoded version label clearly marked `[preview]`.

Status:

- Local version display and manual release-note/update link are implemented.
- Network update polling remains deferred so the current build has no startup network dependency.

Likely files:

- `src-tauri/src/lib.rs` — add `get_app_version` command
- `src/services/native.ts` — add `getAppVersion` invoke
- `src/services/systemService.ts` — add `getAppMetadata` + optional update poll
- `src/types/system.ts` — add `AppMetadata` type
- `src/pages/SettingsPage.tsx` — version display block
- `src/components/Shell.tsx` — sidebar update pill

### Slice D: Manual game profile mappings ✅ DONE

Scope:

- Add a local-only game mapping model: process name, optional executable path, selected performance profile, restore profile.
- Start in Settings or a compact Game Mode page with manual add/edit/remove.
- Use current `listTopProcesses` as the first discovery aid.
- Keep automatic switching disabled by default; expose a reviewed "detect running game" step before background automation.

Acceptance checks:

- Users can create a mapping without auto-switching being enabled.
- Restore behavior is explicit: previous profile or chosen default profile.
- No cloud sync, hidden background rules, or unreviewed process mutation.

Status:

- Manual mappings are implemented in local settings.
- Background foreground-game detection and automatic switching are deferred.

Likely files:

- `src/types/system.ts`
- `src/context/SettingsContext.tsx`
- `src/pages/SettingsPage.tsx` or a new `GameModePage.tsx`
- `src/pages/ProcessMonitorPage.tsx`

### Slice E: Sensor provider validation loop ✅ DIAGNOSTICS DONE

Scope:

- Keep the PawnIO/LHM sidecar as the current validation path.
- Add clearer provider lifecycle states to Diagnostics: bundled, installed, service visible, sensor rows visible, CPU package accepted.
- Keep release packaging fail-closed when `PawnIO_setup.exe` is missing or unsigned.
- Capture the exact sidecar status in support export so tester-machine results are actionable.

Acceptance checks:

- On a machine with no matching sensors, the app explains "provider present but no CPU package row" rather than showing a blank.
- On Ryzen tester hardware, support can distinguish installer failure, driver/service failure, sidecar launch failure, and sensor matching failure.
- Diagnostics language stays short enough to avoid clipping in Settings.

Status:

- Lifecycle diagnostics, checked-path reporting, manual probe, support export context, and sidecar/PawnIO installer fixes are implemented.
- Deeper CPU package matching, fan rows, and SMART rows remain the next native-provider work.

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

### Slice G: Local AI insights and copilot tab 🚧 IN PROGRESS

Scope:

- Add a deterministic local insights service that generates next actions from local telemetry and diagnostics.
- Add an `Insights` panel in Dashboard and a compact Utilities surface for "why" and "what next".
- Add an optional Local AI tab in preview mode with read-only context and no direct mutation path.
- Include hardware-aware model recommendations (for example, lightweight, balanced, high-capability tiers).
- Keep cloud providers out of scope for the first pass; this slice is local-only.

Acceptance checks:

- Insights render with no network access and no model runtime installed.
- Each insight shows source signals, confidence, and a safe suggested action.
- Local AI tab can summarize current system health from curated local context.
- AI-generated suggestions cannot directly execute native writes without user confirmation.
- If no local model is configured, the UI fails closed to deterministic insights only.

Status:

- Partially implemented (preview).
- CoPilot page is wired in the shell and Utilities surface with local-first recommendations.
- Runtime connectivity and installed-model discovery are active via local `GET /api/tags`.
- Chat calls use local `POST /api/chat` with optional safe context-pack injection.
- Localhost-only lock mode and non-invasive advisory defaults are active.
- CoPilot runtime preferences now persist locally per brand mode.
- Deterministic insights now emit typed cards with confidence labels, source signals, tone, and a safe suggested action.
- Recent local Companion action history now feeds CoPilot insight cards and the optional safe context pack.
- Local runtime requests now have a short timeout and clearer connection / endpoint / missing-model error messages.
- Remaining work: add Dashboard/Utilities insight-card surfaces, consolidate diagnostics/benchmark/action-history signals behind a shared analyzer contract, and validate clean-machine local-runtime setup.

Likely files:

- `src/types/system.ts` or `src/types/insights.ts`
- `src/services/systemService.ts`
- `src/lib/actionHistory.ts`
- `src/pages/DashboardPage.tsx`
- `src/pages/UtilitiesPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/AiCopilotPage.tsx` (new)
- `src/context/MonitorContext.tsx`

## First PR Shape

Keep the first implementation PR small and UI-led:

1. Utilities grouping and status labels.
2. Compact profile preview on Utilities.
3. Settings app version display using local metadata only.

The original UI-led PR scope is complete. Keep network update checks, background game automation, RGB, session summaries, OEM report export, and any new hardware writes deferred until the current support and diagnostics flows have had tester feedback.

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
- Native URL enforcement hardening (May 28, 2026): in native mode, external links now rely on backend validation only and no longer fall back to browser `window.open` when rejected.
- Browser-preview URL fallback hardening (May 28, 2026): `window.open` is now guarded so preview mode fails closed without throwing if the host environment does not expose it.
- URL policy alignment (May 28, 2026): backend allow-list expanded to include `example.com` and covered by focused unit tests.
- Settings accessibility hardening (May 28, 2026): Settings tabs now implement roving tabindex, Arrow/Home/End keyboard navigation, `tab`/`tabpanel` semantics, and explicit `aria-controls`/`aria-labelledby` linkage.
- CI backend quality extension (May 28, 2026): variant quality workflow now includes a dedicated Rust backend job for `cargo check` and URL validator tests.
- Validation pass completed (May 28, 2026): frontend production build, Rust cargo check, targeted Rust URL validator tests, and source-mode demo brand leak checks all passed.
- Git deployment (May 28, 2026): shipped to `main` as commit `d649dd3`.
- Repo hygiene (May 28, 2026): `.gitignore` now excludes generated variant build outputs (`src-tauri/target-*`), local demo artifact output (`artifacts/demo/`), and local installer binaries (`radium_pcs_companion.exe`) to prevent false "thousands of changes" noise in SCM.
- Visual polish pass (May 29, 2026): shared page chrome was refined with richer page-header cards, deeper panel depth, and a more premium settings tab strip without changing behavior.
- Showcase readiness pass (May 30, 2026): a fresh Radium NSIS installer was built at `src-tauri/target-radium-final/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe` with timestamp `2026-05-30 07:01:06`; lifecycle smoke passed across repeated background launch/exit cycles and release artifact metadata matched the expected Radium product identity.
- Network update checks, RGB, background game automation, and new hardware writes: deferred.
- Local AI insights engine and optional local LLM copilot tab: in progress (local preview, persisted runtime settings, typed insight cards, and runtime error taxonomy implemented; deeper source aggregation pending).
- Local CoPilot enhancement pass (June 1, 2026): runtime URL/model/context preferences now persist locally, deterministic insights render as confidence-typed cards with source signals and safe suggested actions, and local runtime failures are classified more clearly while remaining localhost-first.
- GUI responsiveness pass (June 1, 2026): CoPilot insight headers/signals now wrap safely, mobile CoPilot controls stretch into tap-friendly rows, chat/prompt textareas are shorter on narrow screens, and touch/narrow surfaces suppress hover transforms that could make the UI feel jumpy.
- Radium walkthrough installer rebuild (June 1, 2026): after clarifying that the requested demo/walkthrough package should keep Radium branding, `npm.cmd run build:exe` passed and the latest audited artifacts are `artifacts/radium/radium-pcs-companion-20260601-203136.exe` plus `artifacts/radium/radium-pcs-companion-setup-20260601-203136.exe`. Both artifacts report `ProductName` and `FileDescription` as `Radium PCs Companion`.
- Product-readiness pass (June 1, 2026): Dashboard now has a current-state strip for active profile, telemetry/provider freshness, tray/startup state, and local safety posture. `scripts/pre_release_artifact_audit.ps1` now fails on wrong Radium metadata, catches accidental neutral `PC Companion` artifacts, writes a SHA-256 manifest, and supports `-RequireSignature` for signed releases. Security posture is documented in `docs/security-readiness.md`, with clean-machine QA in `docs/clean-machine-test.md` and signing scaffolded through `npm.cmd run sign:radium`.
- Signing/lifecycle follow-up (June 1, 2026): `npm.cmd run sign:radium` now locates Windows SDK `signtool.exe` but fails closed until a signing identity is supplied. Lifecycle smoke now fails on lingering app processes; this workspace needs an elevated tester pass because one release EXE process remained access-denied after stop.
- Companion assistance flow: implemented with local bundle export, prefilled email context, and local action history. No automatic upload.
- Radium Care checklist: implemented in System Passport as support-friendly ownership readiness, not a firmware/OEM control layer.
- Restore Centre: implemented for Registry Cleaner backups. It reads existing backup manifests and restores through the same guarded backend command used by Registry Cleaner.
- Local action history: expanded across maintenance/support/profile flows. It stores only high-level local events in browser storage and can be cleared by the user.
- Dashboard next-best-action panel: implemented in the score card so users have clear follow-up actions without reading diagnostics first.
- Companion assistance routing: topbar/search support actions target the Companion mailbox; general Radium support remains visible in company contact details.
- First-run setup: implemented as lightweight local settings inside onboarding. It does not add hidden automation or firmware writes.

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

## May 29, 2026 Execution Plan (Radium + Demo)

### Shared quality gates (hooked in)

The following unified quality scripts are now the baseline gates for both variants:

- `npm run quality:gate` (radium baseline):
	- web build,
	- rust cargo check,
	- URL policy tests,
	- demo-dev config restore verifier.
- `npm run quality:gate:demo` (demo baseline with `VITE_BRAND_MODE=demo`):
	- demo web build,
	- demo brand leak source scan.

CI workflow now consumes these gate scripts directly to reduce drift between local and CI checks.

### Radium next

1. Finish deferred network update polling with fail-closed UI behavior.
2. Continue sensor-provider depth work (CPU package matching, fan rows, SMART rows).
3. Add deterministic local insight cards with confidence levels (no cloud dependency).

### Demo next

1. Expand feature-flag module gating to explicitly hide/lock premium-only flows.
2. Add artifact identity assertions for demo package metadata (name, identifier, icon).
3. Keep strict bundle leak scan as optional/nightly until dead-code elimination is fully deterministic.

### No-regression rule

For both variants, each implementation slice must keep `quality:gate` and `quality:gate:demo` green before merge.

### May 30 showcase status

- Radium walkthrough installer: ready.
- Verified artifact path: `src-tauri/target-radium-final/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`.
- Verified lifecycle smoke: pass.
- Verified bundle metadata: `ProductName` and `FileDescription` both report `Radium PCs Companion`.

# Radium PCs Companion Improvement Audit

Last updated: 2026-06-27

This is the living audit and improvement backlog for Radium PCs Companion. It captures product, engineering, UI/UX, packaging, validation, and future-feature work in one place so the project can be improved in steady slices.

## Rolling Changelog

### 2026-06-27

- Reviewed roughly two weeks of accumulated uncommitted changes (RGB Phase 1 discovery, OEM support reports, hardware alerts, Owner/Technician mode, Radium build identity provisioning, driver-update checks, dashboard chart splitting) against this audit's claims; manual review of `rgb_provider.rs`, `SettingsContext.tsx` migration, `supportReport.ts` HTML escaping, and IPC wiring found no defects.
- This machine had no Node/Rust on PATH and no Rust toolchain installed at all. Installed Rust via `winget install Rustlang.Rustup` and Visual Studio Build Tools (C++ workload) via `winget install Microsoft.VisualStudio.2022.BuildTools` to get a working `cargo check`/`cargo test` on this host.
- Validation: `npm.cmd run build` passed, `npm.cmd run test:telemetry-presentation` passed 21/21, `cargo check --manifest-path src-tauri/Cargo.toml` passed clean, `cargo test --manifest-path src-tauri/Cargo.toml --lib` passed 11/11 (includes `external_url_validator` tests).
- Committed the validated batch to `main` rather than continuing to stack new work on an uncommitted working tree.
- Updated `docs/architecture.md` (module list and IPC table were missing `amd_provider.rs`, `nvml_provider.rs`, `sidecar_provider.rs`, `rgb_provider.rs`, `driver_update.rs` and several registered commands), `docs/roadmap.md` (hardware alerts, RGB Phase 1, and HTML diagnostics export were still shown as unchecked), `docs/current-state.md`, and `docs/security-readiness.md` to match actual code state.
- Ran the first real AMD desktop validation pass (Ryzen 7 9800X3D + Radeon RX 9070 XT) via a temporary backend probe test, since the full Tauri dev binary's `requireAdministrator` manifest could not get a UAC approval through in this session. Findings recorded in `docs/compatibility-matrix.md`.
- **Found and fixed a real VRAM-reporting bug**: `Win32_VideoController.AdapterRAM` is a 32-bit field that wraps for GPUs with 4 GB or more VRAM — it reported the 16 GB Radeon RX 9070 XT as 4.00 GB. `wmi_provider.rs` now reads `HardwareInformation.qwMemorySize` from the display adapter's registry class key as the authoritative source, confirmed corrected to 15.92 GB on this hardware.
- **Found a real AMD GPU telemetry gap (not yet fixed)**: `AmdAdlContext::init()` in `amd_provider.rs` returns `None` on this RDNA4 card because no adapter responds to the legacy ADL2 Overdrive5 API used to pick the active adapter. AMD discrete GPU temperature/usage/clocks/fan/power on current-generation cards silently fall back to the weaker WMI path instead of ADL. Needs migration to Overdrive6/Overdrive8/ADLX — added to Priority 4 below.

### 2026-06-26

- Completed OEM support report slice: added a local HTML support report generator with Radium build identity, detected hardware, performance score, telemetry, storage, capabilities, sensor evidence, and recent local actions.
- Wired OEM report export into Settings > About and Diagnostics support workflow; reports download locally and require owner/technician choice before sharing.
- Completed RGB Phase 1 implementation slice: added a read-only OpenRGB localhost discovery adapter, frontend service/types, Utilities RGB discovery card, manual rescan, and diagnostics export inclusion.
- RGB discovery remains fail-closed and local-only: it connects only to `127.0.0.1:6742`, uses short timeouts, caps parsed controllers, and contains no lighting write commands.
- Validation: frontend production build passed; telemetry presentation tests passed 21/21; Rust `cargo check` still could not run because Cargo is not installed/discoverable in this shell.
- Completed Radium workshop provisioning slice: Settings > System Passport now supports local JSON seed import/export for build identity records, accepting both direct identity objects and `buildIdentity`/`radiumBuildIdentity` wrappers.
- Seed import/export records local action history and remains local-only; no cloud upload or native file write path was added.
- Completed support/export depth slice: visible diagnostics exports now pass Radium build identity, interface mode, profile state, monitoring/tray/overlay settings, hardware identity, telemetry state, and recent local actions into the native JSON bundle.
- Native diagnostics JSON now records a `frontendContext` object when supplied, while tray/command-palette exports still fail open with an explicit `provided: false` context marker.
- Validation: frontend production build passed; telemetry presentation tests passed 21/21; Rust `cargo check` could not run because Cargo is not installed/discoverable in this shell.
- Completed perceived-performance polish: nav hover/focus now prefetches lazy route chunks so owner and technician navigation warms the next page without restoring eager first-load cost.
- Added image loading and async decoding hints to non-critical OEM, vendor, Passport, utility, and thermal visual assets.
- Reduced hidden-window UI repaint work by slowing telemetry presentation refreshes when the app is backgrounded and the OSD is not active.
- Validation: frontend production build passed; telemetry presentation tests passed 21/21.

### 2026-06-25

- Created this living audit document from the broad project sweep.
- Recorded current validation status: frontend build passed, telemetry presentation tests passed, Rust check could not run in this shell because Cargo was not installed/discoverable.
- Added prioritized work tracks for Radium-first product focus, real hardware validation, UI/UX polish, package-size optimization, signing/distribution, sensor depth, OpenRGB/RGB integration, and future customer-facing features.
- Completed first release-optimization slice: production source maps are now opt-in through `VITE_ENABLE_SOURCEMAPS=1` or `RADIUM_ENABLE_SOURCEMAPS=1`.
- Completed first Radium-first workflow slice: default quality gate no longer runs demo restore checks, and demo CI now runs only when manually dispatched.
- Marked OpenRGB as the recommended first RGB adapter, behind capability detection and local-only fail-closed controls.
- Completed first UI/UX simplification slice: added Owner/Technician interface mode, defaulting to Owner, with Technician mode preserving dense sidebar telemetry and support panels.
- Completed Dashboard Clarity slice: added a current-status verdict and next-best-action strip driven by telemetry confidence, performance score, storage headroom, driver state, and active profile.
- Completed first Radium build identity slice: added local settings-backed provisioning fields for serial, build date, customer profile, motherboard, GPU, RAM, storage, QC seal, warranty tier, and support tier, with Passport fallbacks that say "not provisioned."
- Completed Passport support handoff slice: added a copyable build context block combining provisioned Radium identity, detected hardware, telemetry state, capability count, score, and storage headroom.
- Added runtime performance baseline pack with repeatable capture scenarios, metrics, and PowerShell sampling helper.
- Added Radium hardware validation playbook covering tester intake, required passes, provider evidence, and OpenRGB Phase 1 evidence capture.
- Improved Utilities RGB readiness card with OpenRGB localhost SDK details, read-only discovery scope, and write-block guardrails.
- Completed frontend resource optimization slice: replaced repeated 2 MB Radium wordmark usage with 4.7 kB transparent wordmark, pruned unused asset registry entries, lazy-loaded secondary pages, and moved Dashboard charts into a lazy chunk with stable skeletons.

## Current Health Snapshot

- Frontend production build passes once the local command PATH includes Node/npm.
- Telemetry presentation tests pass: 21/21.
- Git working tree was clean at audit time.
- Rust/Cargo validation could not be rerun from this shell because Cargo was unavailable, but project docs record previous successful Rust checks. Latest Rust-touching diagnostics and OpenRGB discovery changes still need native compile verification on a Rust-equipped workstation.
- Main release risk is still hardware evidence, not basic feature completeness.

## Guiding Product Direction

Radium PCs should now be treated as the primary product target. The app already has a mature local-first support, telemetry, diagnostics, and maintenance foundation. The next work should make that foundation more trustworthy on real Radium hardware, easier for customers to understand, and simpler for the Radium team to support.

Core principles:

- Keep native mutations local, explicit, reversible, and capability-gated.
- Prefer Radium customer value over generic PC utility breadth.
- Validate on real hardware before promoting staged features to live.
- Keep the UI premium but calmer, denser only where technicians need density.
- Treat RGB, fan control, firmware, EC, undervolt, and overclock paths as gated hardware features, not decorative extras.

## Priority 0: Release Readiness

### Hardware Validation Matrix

Goal: prove the app on real Radium-relevant configurations.

Work:

- Added `docs/radium-hardware-validation-playbook.md` for repeatable tester intake and evidence capture.
- Validate Intel + NVIDIA desktop.
- Validate AMD + NVIDIA desktop.
- Validate AMD + AMD desktop.
- Validate Intel + Intel Arc desktop.
- Validate hybrid GPU laptops if Radium supports or services them.
- Capture provider evidence for NVML, AMD ADL, Intel fallback/IGCL, WMI, sysinfo, sidecar, and PawnIO.
- Add tester notes for CPU package temperature, GPU telemetry, VRAM, fan rows, storage telemetry, tray lifecycle, OSD, startup/minimize, installer, and uninstaller.

Acceptance:

- Compatibility matrix has at least one validated NVIDIA desktop and one validated AMD desktop before broader distribution.
- Diagnostics export clearly explains every missing/degraded sensor.
- No user-facing surface shows missing hardware data as zero.

### Signing And Distribution

Goal: make paid or broad public distribution safe.

Work:

- Obtain Authenticode certificate.
- Configure `npm.cmd run sign:radium`.
- Run artifact audit with signature requirement.
- Complete clean-machine install/uninstall walkthrough.
- Validate Windows Defender and SmartScreen behavior.
- Re-run lifecycle smoke after signing.

Acceptance:

- EXE and NSIS installer have valid signatures.
- Artifact audit rejects unsigned or neutral/demo artifacts when Radium build is expected.
- Install, tray launch, background launch, close-to-tray, OSD, and uninstall all pass on a clean tester machine.

## Priority 1: Radium-First Simplification

### Reduce Demo Variant Overhead

Goal: stop paying unnecessary QA and brand-leak cost if Radium is now the only active product direction.

Options:

- Keep demo support but quarantine it behind rarely used scripts and CI.
- Remove demo build scripts and demo brand assets.
- Keep brand abstraction only if it still helps future white-label/OEM work.

Recommended first step:

- Move demo tasks out of the default quality gate and into a manual or separate workflow if demo is no longer active.
- Keep Radium artifact audit as the primary release path.

Acceptance:

- A normal Radium release workflow does not depend on demo checks.
- No Radium UI or artifact can accidentally ship with neutral `PC Companion` identity.

### Radium Build Identity

Goal: make the app feel purpose-built for Radium owners and technicians.

Work:

- Added local settings-backed build identity fields: serial, build date, customer build profile, motherboard, GPU, RAM config, storage config, QC seal, warranty tier, and support tier.
- Added editable provisioning controls under Settings > System Passport.
- System Passport now prefers provisioned Radium metadata and shows "not provisioned" for missing build fields instead of treating them as detection failures.
- Added a copyable Passport support context for technician handoff and support tickets.
- Added typed frontend support context for visible diagnostics exports, including provisioned Radium build identity, current interface/profile state, telemetry state, hardware identity, and recent local actions.
- Native diagnostics JSON now stores supplied frontend context under `frontendContext` for technician handoff.
- Added local JSON seed import/export controls for Radium workshop provisioning under Settings > System Passport.

Next work:

- Add build identity context to tray-triggered exports if a safe settings bridge is added outside React.
- Consider a signed workshop seed handoff once signing/distribution is mature.

Acceptance:

- A technician can open System Passport and immediately identify the machine, build family, and support posture.
- Missing identity data is shown as "not provisioned" rather than "unknown failure."

## Priority 2: Performance And Package Optimization

### Frontend Asset Optimization

Goal: reduce app payload and improve cold load.

Findings:

- Built frontend is about 10 MB.
- Largest image assets include Radium header imagery and thermal chamber artwork.
- Production sourcemaps are currently emitted.

Work:

- Make sourcemaps release-channel dependent or disable for customer release builds.
- Replaced repeated Radium wordmark usage with compact transparent PNG and pruned unused eager asset registry entries.
- Lazy-loaded secondary pages so maintenance, settings, CoPilot, thermals, and benchmark code split from the first dashboard path.
- Moved Dashboard chart panels into a lazy chart chunk with skeleton placeholders to reduce first-render JS pressure.
- Added hover/focus route prefetching for lazy secondary pages so navigation feels immediate after user intent.
- Added lazy loading and async decoding hints to non-critical images across utility, Passport, vendor badge, and thermal surfaces.
- Convert remaining large thermal/marketing PNG assets to WebP or AVIF where Windows WebView support is acceptable.
- Keep PNG fallback only where needed.

Acceptance:

- Customer build excludes sourcemaps unless explicitly requested.
- Large visual assets are reduced without visible quality loss.
- Dashboard remains visually rich but cold load is faster.
- Current production build entry chunk remains about 314 kB after page/chart splitting, prefetch wiring, export context plumbing, build-seed controls, and local OEM report export; repeated Radium wordmark asset is now about 4.7 kB instead of about 2 MB.

### Native Bundle Size

Goal: keep installer reliable without carrying unnecessary runtime weight.

Findings:

- `src-tauri/binaries` is roughly 84 MB.
- Most weight is the private .NET runtime and sensor-sidecar dependency tree.

Work:

- Confirm whether win-x86 and win-arm64 runtime folders are needed for x64-only package.
- Confirm whether all .NET runtime files are required for the sidecar path.
- Consider self-contained trimmed sidecar publishing if it remains reliable with LibreHardwareMonitor.
- Keep PawnIO and LibreHardwareMonitor provenance/signature checks.

Acceptance:

- Installer size reduction is measured.
- Sensor sidecar still launches on a clean machine without requiring external .NET install.
- Build script continues to fail closed if required reviewed binaries are missing or unsigned.

### Runtime Performance Baselines

Goal: measure before optimizing sensor and UI loops.

Work:

- Added `docs/runtime-performance-baselines.md` with capture scenarios, metrics, and a PowerShell sampling helper.
- Record idle CPU and RAM for main app.
- Record monitor-thread CPU overhead.
- Record WMI query latency.
- Record hardware sample IPC round-trip.
- Record dashboard render time and chart interaction cost.
- Record tray icon update cost.
- Record background/minimized polling overhead.
- Slowed telemetry presentation repaint scheduling while the app is hidden and OSD is inactive, using foreground cadence only for visible/overlay scenarios.

Acceptance:

- Baseline table exists in docs.
- Changes that affect polling, charts, tray icons, OSD, or sidecar can compare before/after numbers.

## Priority 3: UI/UX And GUI Polish

### Owner Mode And Technician Mode

Goal: make the app feel calmer for owners while preserving dense tools for support staff.

Work:

- Added Owner/Technician interface mode in Settings, defaulting new installs to Owner mode.
- Owner mode now simplifies the persistent sidebar and emphasizes daily readiness plus a diagnostics path.
- Technician mode keeps the live sensor strip, dense support/contact panels, and existing diagnostic power.

Next work:

- Extend the mode split into Dashboard content density and Diagnostics export paths.
- Add visual regression screenshots for both modes once screenshot automation is in place.

Acceptance:

- Owner mode first screen answers "is my PC okay and what should I do next?"
- Technician mode keeps existing diagnostic power.

### Dashboard Clarity

Goal: make Dashboard action-led instead of metric-led.

Work:

- Added a current-status verdict strip above the dashboard metric grid.
- Verdict states now show "Healthy," "Needs attention," or "Support evidence recommended."
- Next-best action is tied to telemetry confidence, performance score, storage headroom, GPU driver state, and active profile.
- CPU/GPU/RAM/network metrics remain visible below the owner-facing summary.

Next work:

- Tune verdict thresholds after real Radium hardware validation.
- Add technician-specific evidence shortcuts once the Owner/Technician split reaches Diagnostics.

Acceptance:

- A non-technical owner can understand status without opening Diagnostics.
- A technician can still jump to raw evidence quickly.

### Visual System Cleanup

Goal: make styling easier to maintain.

Work:

- Rename misleading CSS tokens, especially `--cyan` in Radium theme where it represents orange.
- Reduce overuse of radial gradients and glowing accents where they compete with content.
- Normalize panel/card radius and density.
- Add screenshot visual regression for Dashboard, Thermals, Settings, Storage Cleaner, Diagnostics, and CoPilot.

Acceptance:

- New UI work can use semantic tokens like `--accent`, `--accent-soft`, and `--support-ok`.
- Screenshots catch clipping and overlap regressions before release.

### Responsive Quality

Goal: keep the app usable on smaller windows and technician laptops.

Work:

- Review sidebar behavior at minimum app size.
- Check topbar search, tray preview, support link, and OSD button collisions.
- Ensure tables degrade into scroll or stacked layouts intentionally.
- Verify long hardware names, motherboard names, driver versions, and file paths wrap cleanly.

Acceptance:

- No incoherent overlap at minimum supported size.
- Tables and dense panels remain usable without visual breakage.

## Priority 4: Sensor Depth

### CPU Package Temperature

Goal: improve confidence on AMD Ryzen and modern Intel desktops.

Work:

- Continue sidecar/PawnIO/LibreHardwareMonitor validation.
- Record exact sensor row names accepted or rejected.
- Expand diagnostics for "driver installed but no matching package row."
- Validate on Radium AMD Ryzen builds.

Acceptance:

- CPU package temp works where hardware/provider exposes it.
- Missing CPU temp is explained accurately and support can see why.

### GPU Provider Maturity

Goal: validate and harden NVML, AMD ADL, and Intel fallback paths.

Work:

- Validate NVIDIA telemetry on desktop hardware.
- Validate AMD discrete telemetry on desktop hardware. Done 2026-06-27 on a Radeon RX 9070 XT — see `docs/compatibility-matrix.md` AMD Desktop Findings.
- **AMD ADL2 Overdrive5 does not initialize on current-generation RDNA3/RDNA4 cards** (confirmed: `AmdAdlContext::init()` returns `None` on a Radeon RX 9070 XT). `amd_provider.rs` needs an Overdrive6/Overdrive8/ADLX code path, or at minimum a documented/diagnostics-visible explanation, before AMD discrete GPU temp/usage/clock/fan/power telemetry can be trusted on new hardware. Until fixed, these cards silently get WMI-only quality instead of ADL quality.
- Fixed 2026-06-27: `Win32_VideoController.AdapterRAM` 32-bit wraparound under-reported VRAM on GPUs >= 4 GB; `wmi_provider.rs` now prefers the registry `HardwareInformation.qwMemorySize` QWORD.
- Keep Intel Arc IGCL bindings staged until native readings are real.
- Add provider timing/errors to diagnostics export.

Acceptance:

- NVIDIA and AMD desktop telemetry have real evidence.
- Intel Arc remains explicit as fallback/staged rather than pretending full support.

### Storage SMART/NVMe Health

Goal: move beyond storage usage to support-useful drive health.

Work:

- Add read-only SMART/NVMe temperature where available.
- Add health/wear/TBW confidence fields.
- Show unsupported/degraded state per drive.
- Avoid destructive or firmware-level storage operations.

Acceptance:

- System Passport and Diagnostics can show whether storage health telemetry is trusted.
- Missing SMART channels are clear and not alarming.

## Priority 5: RGB Integration

### Recommended Direction: OpenRGB Adapter

OpenRGB is the best first RGB path because it already provides a cross-vendor hardware abstraction and a network SDK. It should be optional and local-only at first.

Key external facts:

- OpenRGB offers a network-based SDK for third-party apps.
- The SDK uses a versioned binary TCP protocol.
- Default SDK server port is `6742`.
- The protocol exposes controllers, modes, zones, LEDs, colors, profiles, and update commands.

Reference sources:

- https://openrgb.org/
- https://openrgb.org/sdk.html
- https://gitlab.com/CalcProgrammer1/OpenRGB/-/raw/master/Documentation/OpenRGBSDK.md

### RGB Phase 1: Read-Only Discovery

Goal: detect RGB capability without writing anything.

Work:

- Added `src-tauri/src/rgb_provider.rs` read-only OpenRGB adapter.
- Connects only to `127.0.0.1:6742` by default.
- Added short timeout and fail-closed behavior.
- Detects negotiated protocol version where the SDK responds.
- Lists controllers, vendors, names, zones, LED counts, modes, and current colors where available.
- Improved Utilities RGB readiness card with OpenRGB SDK endpoint, read-only scope, write-block guardrails, live discovery summary, and manual rescan.
- Added frontend RGB discovery types/service and Utilities RGB capability panel.
- Added diagnostics export field for RGB provider state under `rgbDiscovery`.

Acceptance:

- If OpenRGB is not running, app shows "OpenRGB not detected" without error noise.
- If OpenRGB is running, app lists detected controllers and zones.
- No RGB writes exist in Phase 1.
- Native adapter is verified with `cargo check` and at least one real OpenRGB SDK server capture before Phase 2.

### RGB Phase 2: Safe Static Controls

Goal: add reversible, low-risk RGB writes.

Work:

- Add static color apply for selected controller/zone.
- Add brightness where supported.
- Add "off" state.
- Add "restore previous state" from captured pre-write state.
- Add explicit confirmation before first write.
- Record local action history for every RGB write.

Acceptance:

- User can set a static color and restore the prior state.
- Unsupported devices/zones remain read-only.
- All writes are local and visible.

### RGB Phase 3: Profiles And Radium Presets

Goal: make RGB useful but not gimmicky.

Work:

- Add Radium presets: Radium Orange, Cool White, Thermal Warning, Quiet Night, Benchmark Mode.
- Optional profile sync with performance profile.
- Optional temperature-reactive lighting using existing telemetry.
- Keep automation opt-in.

Acceptance:

- RGB never changes automatically unless the user enables that behavior.
- Presets degrade gracefully when devices lack direct mode or zone support.

### RGB Licensing And Distribution Guardrails

Work:

- Start with SDK protocol integration only.
- Do not statically link OpenRGB code into Radium app without license review.
- Do not bundle OpenRGB until license, update, support, and signing implications are clear.
- Provide a setup guide or detection prompt first.

Acceptance:

- Radium app can interoperate with OpenRGB without becoming dependent on it.
- Legal/support risk is understood before bundling any OpenRGB component.

## Priority 6: Future Product Features

### Game-Aware Profiles

Work:

- Build on existing manual mappings.
- Add foreground process detection.
- Add launch profile and restore profile behavior.
- Keep automation disabled by default.
- Add activity log entries for profile switches.

### Local Update Checks

Work:

- Keep current manual update metadata.
- Add fail-closed update polling against a Radium-controlled endpoint or release feed.
- Do not show blocking modals.
- Add signed updater only after signing process is mature.

### Hardware Alerts

Work:

- Add threshold notifications for sustained high CPU temp, GPU temp, RAM pressure, storage full, and provider failure.
- Avoid noisy one-off alerts by using sustained thresholds and cooldowns.
- Tie alerts to OSD/tray settings.

### OEM Support Reports

Work:

- Added local HTML support report export.
- Includes Radium identity, detected hardware, performance score, telemetry state, storage, capabilities, sensor evidence, and recent actions.
- Keep export local; no automatic upload.
- Consider PDF export after print styling and signing/distribution are mature.

### CoPilot/Insights Consolidation

Work:

- Consolidate deterministic insights into a shared analyzer.
- Feed Dashboard, CoPilot, Diagnostics, and Support export from the same typed insight records.
- Keep local LLM advisory only.
- No direct AI-triggered native writes.

## Working Backlog

### Now

- Validate on NVIDIA desktop.
- AMD desktop validated 2026-06-27 (backend probe only; full UI/tray/OSD/installer pass still pending elevated access on that machine).
- Migrate `amd_provider.rs` off ADL2 Overdrive5 (confirmed non-functional on RDNA4) to Overdrive6/Overdrive8/ADLX, or surface the fallback explicitly in diagnostics instead of silently degrading to WMI-only quality.
- Complete signing path.
- Convert largest PNG assets or add optimized variants.

### Next

- Add SMART/NVMe read-only telemetry.
- Validate RGB Phase 1 OpenRGB discovery against a real OpenRGB SDK server.
- Re-check WMI GPU usage-percent accuracy on an AMD desktop under actual GPU load (the 2026-06-27 pass only observed it idle at 0.0%, which is inconclusive).

### Later

- RGB static writes and restore.
- RGB Radium presets.
- Game-aware profile automation.
- Local update checks/updater.
- PDF support report export or print-flow polish.
- More advanced CoPilot insight surfaces.

## Decision Log

### 2026-06-25: OpenRGB First For RGB

Decision: Use OpenRGB as the first RGB adapter path, starting read-only and local-only.

Why:

- It covers mixed-vendor RGB better than motherboard-specific SDKs.
- Its TCP SDK maps well to Radium's capability-gated architecture.
- It can be optional, avoiding hard dependency and bundling risk.

Constraints:

- Connect to localhost by default.
- No writes in the discovery phase.
- License and support review before any bundling.

### 2026-06-25: Hardware Evidence Before More Writes

Decision: Prioritize validation and diagnostics over new low-level write controls.

Why:

- The app already has many surfaces.
- Real hardware matrix coverage is still thin.
- Trustworthy telemetry is more valuable to Radium customers than unvalidated controls.

### 2026-06-25: Radium-First Product Focus

Decision: Treat Radium PCs as the main product direction.

Why:

- The user clarified Radium PCs is the main area now.
- Demo/neutral variant support adds QA overhead and brand-leak risk.

Open question:

- Should demo mode be fully removed, or retained as a manual partner/demo path?


# Dual Variant Enhancement Log (Radium + Demo)

## Scope

This document tracks:

- historical work already completed to split and maintain both variants (`radium` and `demo`) in one codebase,
- new enhancements implemented in the current pass,
- recommended next implementation phases.

Date: 2026-05-28

---

## 1) Historical Work Already Completed (Before This Pass)

### 1.1 Brand split foundation

- Introduced a central brand abstraction in `src/lib/branding.ts`.
- Added mode gating by `VITE_BRAND_MODE` with default to `radium`.
- Added separate first-run/settings/action-history storage keys per brand mode.

### 1.2 Demo-specific build path

- Added demo dev command and demo EXE build command.
- Added `scripts/build_demo_exe.ps1` for demo packaging with isolated Cargo target.
- Added temporary Tauri config rewrite during demo build (productName, identifier, window title, bundle metadata), with restore in `finally`.

### 1.3 White-label visual and copy pass

- Added neutral demo logos:
  - `images/demo/pc-companion-mark.svg`
  - `images/demo/pc-companion-wordmark.svg`
- Routed demo splash/shell/logo surfaces to neutral assets.
- Removed/neutralized many hardcoded Radium user-visible strings across pages and services.

### 1.4 Demo icon and runtime identity improvements

- Added dedicated demo icon: `src-tauri/icons/demo-icon.ico`.
- Wired demo packaging to use demo icon for app bundle and NSIS installer.
- Updated demo desktop dev script to temporarily rewrite Tauri config and restore it on exit.
- Added verifier for dev config restoration:
  - `scripts/verify_demo_dev_config_restore.ps1`
  - npm script: `verify:demo-dev-config-restore`

---

## 2) New Enhancements Implemented In This Pass

### 2.1 Brand profile hardening (feature flags + cleaner mode split)

Updated `src/lib/branding.ts`:

- Added typed feature flags:
  - `advancedSupport`
  - `oemReporting`
  - `demoPresentationMode`
  - `simulationOnlySensitiveActions`
- Added helper: `isFeatureEnabled(feature)`.
- Refactored brand profile construction to be mode-gated (`getBrandProfile(mode)`) instead of eager spread composition.

Why this matters:

- Reduces accidental cross-variant coupling.
- Makes per-brand feature gating explicit and scalable.
- Improves chances of dead-code elimination for non-active brand profile content in variant builds.

### 2.2 Settings migration framework (versioned envelope)

Updated `src/context/SettingsContext.tsx`:

- Added `SETTINGS_STORAGE_VERSION`.
- Switched persisted settings format to envelope:
  - `{ version, data }`
- Added migration loader with compatibility for legacy v1 direct object payload.

Why this matters:

- Enables safe, incremental settings schema evolution.
- Reduces risk of breakage during future upgrades.

### 2.3 Automated demo leakage check

Added:

- `scripts/verify_demo_brand_leak.ps1`
- npm script: `verify:demo-brand-leak`

Current behavior:

- Scans source files for forbidden Radium customer markers outside allowed brand-definition files.
- Optional strict mode scans built demo bundle (`dist/assets/index-*.js`) for forbidden markers.
- Fails non-zero on detection.

Mode notes:

- Default mode is source scan (stable for CI and catches new hardcoded leakage in user-facing code).
- Strict bundle mode can be enabled later once brand profile dead-code elimination is fully enforced in the bundle.

Why this matters:

- Adds enforceable guardrail against white-label regressions.

### 2.4 CI quality matrix for both variants

Added workflow:

- `.github/workflows/variant-quality-matrix.yml`

Jobs:

- `web-radium`: install, build (radium), verify config-restore safety script.
- `web-demo`: install, build with `VITE_BRAND_MODE=demo`, run demo brand leak check.

Why this matters:

- Validates both product variants on each PR/push.
- Catches drift early before packaging.

### 2.5 Additional copy neutralization

Updated brand-sensitive hardcoded strings in:

- `src/pages/AiCopilotPage.tsx`
- `src/pages/ThermalsPage.tsx`
- `src/services/mockData.ts`
- `src/services/systemService.ts`

Why this matters:

- Further reduces user-visible Radium leakage in demo mode.

---

## 3) Commands Added / Used

- `npm run verify:demo-dev-config-restore`
- `npm run verify:demo-brand-leak`

For demo web leak checks:

1. Build demo web bundle:
   - `set VITE_BRAND_MODE=demo && npm run build` (Windows shell)
2. Run leak check:
   - `npm run verify:demo-brand-leak`

---

## 4) Recommended Next Phases

### Phase A (now): Expand feature flags into module gating

- Apply `brand.features` to Utilities modules and support workflows.
- Make demo mode intentionally hide/lock select premium/support flows.

### Phase B: Artifact-level checks in CI

- Add demo EXE/installer metadata verification in CI (name, identifier, icon).
- Add checksum manifest generation for release artifacts.

### Phase C: Release process hardening

- Add signed artifact pipeline.
- Add release note + artifact manifest publishing automation.

### Phase D: UX quality and reliability

- Accessibility pass (focus/contrast/reduced-motion).
- Startup/runtime performance budgets and regression checks.

---

## 5) Notes

- This log complements `docs/next-stages.md` by focusing specifically on dual-variant architecture, white-label reliability, and CI safeguards.
- Continue keeping one repository with explicit brand packs and automation guardrails rather than forking.

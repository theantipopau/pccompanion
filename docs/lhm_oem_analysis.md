# LibreHardwareMonitor OEM Adaptation Analysis

## Purpose

This document captures a practical adaptation strategy for the Radium PCs Companion OEM phase using implementation patterns already proven in LibreHardwareMonitor (LHM), then maps those patterns to our Rust + Tauri architecture.

## Key Findings From LHM

### 1) Super I/O and EC support is model-aware, not generic magic

- LHM identifies Super I/O chips through low-level LPC detection paths and chip IDs (Nuvoton, ITE, Winbond, Fintek families).
- Sensor naming and control mappings are heavily board-model specific.
- EC support is defined through board-family/model records with explicit register maps.

Implication for Radium:
- We should not ship blind fan-write support.
- We should introduce capability profiles per motherboard family/model and gate write controls until a profile is validated.

### 2) EC access on Windows is explicitly treated as risky without model-safe methods

- LHM's Windows EC implementation notes race-condition risk for universal ACPI EC I/O.
- It uses retries, bank switching discipline, and mutex locking patterns to reduce unsafe collisions.

Implication for Radium:
- Any future EC write path must be staged behind:
  1) capability detection,
  2) strict read-only default,
  3) signed profile allow-list,
  4) rollback/restore path.

### 3) Intel Arc / Intel GPU telemetry is hybrid and IGCL-centric

- LHM uses Intel Graphics Control Library (IGCL / ControlLib.dll) telemetry for both discrete and integrated Intel graphics data where available.
- It merges that with D3D paths for memory/utilization context.

Implication for Radium:
- Our Intel Arc roadmap should target a hybrid provider:
  - IGCL first for temps/power/fans/clock domains,
  - D3D/WMI fallback for utilization and memory context,
  - confidence flags surfaced to UI.

### 4) Storage telemetry quality comes from layered SMART + performance sensors

- LHM's storage path includes SMART-derived metrics, temperatures, life/health, host reads/writes, and activity/perf counters.

Implication for Radium:
- Our OEM storage score should consume both static health (life/wear/temp thresholds) and dynamic activity context.
- Device-level confidence should be explicit when SMART channels are unavailable.

### 5) Vendor GPU paths are best effort and capability-gated

- LHM uses vendor SDK/API surfaces (NVAPI/NVML/ADL/IGCL) and only activates sensors if supported.

Implication for Radium:
- Keep current provider abstraction and add per-sensor confidence state so OEM diagnostics can distinguish:
  - unavailable,
  - unsupported,
  - degraded,
  - live.

## Proposed Radium OEM Architecture Slices

## Slice A: System Passport (implemented foundation)

- A dedicated identity surface that combines:
  - hardware fingerprint,
  - telemetry confidence matrix,
  - OEM metadata placeholders (serial, batch, QC seal, image revision).

## Slice B: Radium Performance Score (implemented foundation)

- Weighted score composed from:
  - thermal envelope,
  - CPU headroom,
  - memory headroom,
  - storage health,
  - telemetry confidence.

## Slice C: Hardware Capability Registry (next)

- Introduce backend capability map keyed by platform fingerprint:
  - fan control read/write support,
  - EC access mode,
  - sensor confidence per provider.

## Slice D: IGCL Provider for Intel Arc (next)

- Add Rust provider module (dynamic library load + graceful fallback) mirroring existing NVML/ADL strategy.

## Slice E: OEM Safety Envelope (next)

- Add explicit execution policy states:
  - read-only,
  - safe-write,
  - blocked,
  with structured reason codes and rollback hooks.

## Immediate Build Notes

- Frontend side (passport + score) is safe and provider-agnostic.
- Backend deeper provider work should be split into isolated modules with feature flags and confidence contracts before UI exposure.

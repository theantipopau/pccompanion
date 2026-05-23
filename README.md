<p align="center">
  <img src="images/radiumcompanion-marketing.png" alt="Radium PCs Companion" width="720" />
</p>

# Radium PCs Companion

Premium Windows companion utility for Radium PCs custom gaming and workstation systems. Built with Tauri v2, React 19, TypeScript, and a Rust hardware backend.

---

## What it does

| Feature | Status |
|---|---|
| Live hardware monitoring (CPU · GPU · RAM · Storage · Network) | ✅ Live |
| System tray with live metric icon (temp / usage gauge) | ✅ Live |
| Minimize to tray / start hidden / restore on double-click | ✅ Live |
| Sidebar live sensor strip (always-visible on every page) | ✅ Live |
| In-app OSD overlay (transparent always-on-top window) | ✅ Live |
| RAM cleaner (standby list release + working set trim) | ✅ Live |
| Startup Manager (HKCU Run, HKLM Run, startup folder) | ✅ Live |
| Bloatware scanner and remover | ✅ Live |
| Storage cleaner (browser caches, temp files, WU cache) | ✅ Live |
| Registry cleaner with step-guide and backup workflow | ✅ Live |
| Performance profiles (power plan switching) | ✅ Live |
| Thermals page with animated case airflow visualisation | ✅ Live |
| Diagnostics export (local hardware snapshot bundle) | ✅ Live |
| NSIS standalone installer (`npm run build:exe`) | ✅ Live |
| Browser preview mode with mock data | ✅ Live |

---

## Architecture

- **Shell:** Tauri v2 — small native footprint, WebView2, Windows integration
- **Frontend:** React 19 · TypeScript · Vite · Framer Motion · Recharts · Lucide icons
- **Hardware backend:** Rust — sysinfo, NVML (NVIDIA), ADL2 (AMD), WMI/ACPI
- **Safety model:** Local-first, no accounts, no outbound telemetry, dry-run browser isolation, explicit degraded states

The app is designed to run as a Tauri desktop program. Browser preview (`npm run dev`) uses mock data only and never touches the system. All hardware reads and system mutations require the Tauri desktop shell (`npm run desktop`).

---

## Quick start

```powershell
npm install

# Check prerequisites (Node, npm, Rust, Tauri CLI)
npm run check:desktop

# Run as desktop app with live hardware data
npm run desktop

# Build standalone NSIS installer
npm run build:exe
```

**Browser-only UI preview (no Rust required):**
```powershell
npm run dev
```
An amber banner is shown in the Dashboard when running in browser mode.

---

## Scripts

| Script | What it does |
| Responsive sidebar and topbar shell layout | ✅ Live |
|---|---|
| `npm run dev` | Vite browser preview (mock data, no Rust needed) |
| `npm run desktop` / `npm run dev:desktop` | Tauri dev mode — real hardware, live data |
| `npm run build` | Vite production build (frontend only) |
| `npm run build:exe` / `npm run package:windows` | Full Tauri build → NSIS installer |
| `npm run package:portable` | Portable ZIP via `scripts/package-portable.ps1` |
| `npm run check:desktop` | Prerequisite check (Node · npm · rustc · cargo) |

`npm run desktop` and `npm run build:exe` require the Rust toolchain and Tauri prerequisites on PATH.

---
## Output paths

| Artifact | Path |
|---|---|
| Development binary | `src-tauri/target/debug/` |
| CPU temperature | ROOT\\WMI ACPI thermal zones (primary) · sysinfo components with ACPI / thermal / package fallbacks |
| NSIS installer | `src-tauri/target/release/bundle/nsis/` |
| Portable ZIP | `dist-portable/` (after `package:portable`) |

The packaged app is fully standalone — no npm, Vite, or browser window required on the customer machine.

---


```
src/
  components/     UI primitives (Shell, Panel, Gauge, MetricCard, OSD overlay…)
  context/        MonitorContext (hardware polling) · SettingsContext (persistence)
  hooks/          useHardwareMonitor · useAnimatedNumber
  lib/            assets · format · trayIcon (canvas renderer) · trayIcon
  pages/          All page views
  services/       systemService (IPC) · native (Tauri detection) · mockData
  types/          system · navigation

src-tauri/src/
  lib.rs          All Tauri commands + tray setup + window lifecycle
  hardware.rs     HardwareSample aggregation
  wmi_provider.rs WMI / ACPI queries
  nvml_provider.rs NVML dynamic loading (NVIDIA)
  amd_provider.rs  ADL2 dynamic loading (AMD)
  cleanup.rs      RAM optimise · bloatware · storage · registry
  windows_util.rs  Startup registration · process utilities

docs/
  architecture.md  System design
  roadmap.md       Feature status and backlog
  context_log.md   Full session history
  telemetry-engine.md  Hardware provider details
  desktop-build.md  Build and packaging guide
```

---

## Hardware sensor sources

| Metric | Source |
|---|---|
| CPU temperature | ROOT\\WMI ACPI thermal zones (primary) · sysinfo (fallback) |
| GPU temperature / clocks / VRAM / fan / power | NVML (NVIDIA) · ADL2 (AMD) · WMI (Intel Arc fallback) |
| CPU usage / clock / core count | sysinfo |
| RAM usage / total | sysinfo |
| Storage drives | sysinfo |
| Network adapters | sysinfo |
| Fan channels | sysinfo · GPU vendor API |

---

## Tray icon

The system tray icon is dynamically rendered each poll cycle using `OffscreenCanvas`. It shows a 32×32 arc gauge of whichever metric the user selects in **Settings → Tray behaviour → Live tray icon**: CPU temperature, GPU temperature, CPU%, GPU%, or RAM%. Color-coded green → amber → red by threshold. Static app icon is the default.

---

## Safety notes

- All mutating operations (startup changes, bloatware removal, registry cleaning, storage cleanup) run through the `callNative` adapter — browser mode never touches the system.
- Registry cleaner writes a key export backup to Documents before removing anything.
- RAM cleaner uses only `K32EmptyWorkingSet` and standby list — never terminates processes.
- Performance profiles switch Windows Power Plans via `powercfg` — no firmware writes.
- `applyPerformanceProfile` with `dryRun: true` remains the default until power plan GUIDs are validated per machine.


## Architecture

- **Shell:** Tauri v2 desktop app for a small native footprint and Windows integration.
- **Frontend:** React, TypeScript, Framer Motion, Recharts, and lucide icons.
- **Native layer:** Rust command services for system information, monitoring samples, safe RAM cleanup, bloatware scanning, and future restore-point guarded actions.
- **Safety model:** Local-first operation, browser-preview isolation, explicit degraded/unavailable telemetry states, and no ads, accounts, or outbound telemetry.

The app is designed to run as a native Tauri desktop program. Browser preview is only for visual UI work and uses mock data. Real hardware telemetry, tray integration, OSD windows, and system utilities require the Tauri desktop shell.

## Commands

```powershell
npm install
npm run check:desktop
npm run desktop
npm run build
npm run build:exe
```

Useful script aliases:

- `npm.cmd run dev` starts browser preview only.
- `npm.cmd run desktop` runs the real desktop app through `tauri dev`.
- `npm.cmd run check:desktop` checks Node/npm/Rust prerequisites.
- `npm.cmd run build:exe` creates the standalone Windows executable/installer bundle.

`npm.cmd run desktop` and `npm.cmd run build:exe` require the Rust toolchain and Windows Tauri prerequisites.

## Native Modules

- Hardware monitoring command contracts are defined in `src-tauri/src/lib.rs`.
- Frontend service adapters live in `src/services/systemService.ts`.
- Mock/fallback telemetry lives in `src/services/mockData.ts`.
- Cleanup actions remain dry-run until restore-point creation, logging, and reinstall metadata are implemented.
- System tray menu events are bridged through Tauri events such as `tray://open-dashboard`, `tray://toggle-osd`, and `tray://quick-ram-clean`.
- OSD support has both an in-app draggable preview and a Tauri transparent always-on-top overlay window route at `index.html?overlay=1`.
- Settings are persisted locally through `SettingsProvider` and include tray, overlay, monitoring, theme, units, refresh cadence, and animation preferences.
- Thermals now include a case airflow visualisation that maps CPU, GPU, memory, storage, PSU bay, and fan zones to live monitoring data.
- Startup Manager, Bloatware Remover, Registry Cleaner, and Storage Cleaner call native command adapters when running in the Tauri desktop shell. Browser preview never performs system changes.

## OmenCore-Inspired Safety Notes

The companion follows the useful patterns observed in OmenCore's public architecture and release notes: local-first monitoring, tray/OSD visibility, safety-gated low-level controls, explicit degraded states, and diagnostics/export groundwork. Radium PCs Companion keeps those ideas modular so future fan, RGB, power-limit, and OC adapters can be added without coupling them to the dashboard UI.

## Asset Notes

Branding and hardware vendor logos are loaded through `src/lib/assets.ts`. Cleaned transparent PNG variants live in `/images/clean/` so logos render correctly on dark glass surfaces and Tauri has a real PNG app icon for executable packaging.

## Building An Executable

After installing the Rust toolchain and Tauri prerequisites:

```powershell
npm.cmd run check:desktop
npm.cmd run build:exe
```

The Windows executable is emitted under `src-tauri/target/release/`. The installer bundle is emitted under `src-tauri/target/release/bundle/nsis/`.

The packaged app is independent. It does not need `npm`, Vite, or a browser window on the customer machine.

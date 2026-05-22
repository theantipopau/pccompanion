# Radium PCs Companion — Roadmap

## Release Phases

---

## Phase 0 — Foundation ✅ Complete

- [x] Tauri 2 + React + TypeScript project scaffold
- [x] All UI pages implemented (Dashboard, Thermals, RAM Cleaner, Bloatware, Startup Manager, Storage Cleaner, Diagnostics, Settings, Utilities)
- [x] OSD overlay window (transparent, always-on-top)
- [x] System tray integration (menu + double-click)
- [x] Settings persistence (SettingsContext)
- [x] Mock data for all pages

---

## Phase 1 — Real Telemetry Backend ✅ Complete (pending build validation)

- [x] Hardware abstraction layer (`hardware.rs`)
- [x] Background monitoring thread (1 Hz polling)
- [x] Real CPU usage and clock speed (sysinfo)
- [x] Real RAM usage (sysinfo)
- [x] Real network throughput (sysinfo delta)
- [x] Real disk usage percentages (sysinfo)
- [x] CPU temperature via WMI thermal zones
- [x] GPU name/VRAM via WMI `Win32_VideoController`
- [x] GPU usage via WMI GPU performance counters
- [x] System identity (CPU name, MB, BIOS, RAM speed) via WMI
- [x] 60-point rolling history on backend
- [x] Real RAM cleaner (`K32EmptyWorkingSet`)
- [x] Real storage scanner (actual file sizes)
- [x] Real startup manager (registry read/write)
- [x] Real bloatware scanner (PowerShell AppX queries)
- [ ] **Build validation** ← next immediate step

---

## Phase 2 — Polish & Reliability ✅ Mostly Complete

- [x] Fix any Phase 1 build errors *(pending first build validation)*
- [x] TypeScript type update: `StartupItem.location` → `string`
- [x] Improve degraded state UI (sensor source availability cards on dashboard)
- [ ] Error boundary in React for IPC failures
- [ ] Retry logic in MonitorContext if invoke throws
- [x] Thermal zone formula validation at runtime (range check 0–120°C; ACPI path uses decikelvin formula)
- [ ] Add more bloatware entries to `BLOATWARE_SPECS`
- [x] Add browser cache paths to storage scanner (Edge, Chrome, Firefox)
- [x] Add Windows Update delivery optimisation cache to storage scanner
- [x] Startup scanner: `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce` support
- [x] Startup scanner: Startup folder (`shell:startup`) support
- [ ] Unit tests for `cleanup.rs` and `windows_util.rs` (dry-run paths)
- [x] Error boundary wired around all page renders (IPC failures show recovery UI)
- [x] Retry logic in MonitorContext — exponential backoff on consecutive IPC errors (capped at 30 s)
- [x] Gauge circle readability fix (dark-on-dark text was unreadable; now explicit bright colors)
- [x] Thermals page clipping fix (`thermals-grid` / `case-visual` min-width overflows resolved)
- [x] Registry cleaner UX — step guide (Scan/Review/Backup/Clean), improved layout, guarantees panel
- [x] Persistent live metric strip in sidebar (CPU temp, GPU temp, CPU%, GPU%, RAM% — always visible)
- [x] Global text contrast improvements (metric cards, detail rows, gauge labels, airflow notes)
- [x] **Full dark theme** — converted entire app from mixed light/dark to consistent dark (`:root`, body, sidebar, topbar, panels, thermal case, registry/cleaner elements)
- [x] Storage cleaner layout clipping fix (`manager-table` now spans correct columns in `cleaner-shell`)
- [x] RAM Cleaner → **Memory page** redesign with live memory bar, in-use/available/utilization stats from MonitorContext
- [x] **Process Monitor page** — top 40 processes by CPU/memory, live auto-refresh every 3s, sort by CPU/memory/name, mini CPU bar per process
- [x] Sidebar brand-lockup: icon only (wordmark stays on dashboard homepage)
- [x] Browser-mode status indicator in sidebar (amber dot + "Browser preview / Run: npm run desktop")

---

## Phase 3 — Enhanced Sensors ✅ Mostly Complete

- [x] NVML direct integration (NVIDIA GPUs — `nvml.dll` dynamic loading)
- [x] AMD ADL2 direct integration (AMD GPUs — `atiadlxx.dll` dynamic loading)
- [x] GPU temperature (NVML / ADL2 / WMI fallback)
- [x] GPU VRAM usage (NVML / ADL2)
- [x] GPU core/memory clock speeds (NVML / ADL2)
- [x] GPU fan speed % and RPM (NVML / ADL2)
- [x] GPU power draw in watts (NVML / ADL2)
- [x] Intel Arc GPU: WMI usage% with UI notice (IGCL deferred)
- [ ] LibreHardwareMonitor sidecar *(deferred — NVML/ADL2 covers main GPU metrics directly)*
- [ ] Per-core CPU temperatures *(kernel driver / MSR required — deferred)*
- [ ] Fan RPM for CPU cooler / case fans *(SuperIO kernel driver required — deferred)*
- [ ] NVMe SSD temperatures via SMART *(DeviceIoControl — future)*
- [ ] PSU load estimation *(hardware-dependent — deferred)*

---

## Phase 4 — Performance Profiles ✅ UI Complete (firmware writes pending)

- [x] Performance profiles page (Balanced / Gaming / Creator / Quiet)
- [x] Profile selection UI with recommended use-case labels
- [x] Profile intent stored and applied to Companion state
- [ ] Power plan switching via `powercfg` *(next: wire `apply_performance_profile` to real Win32 calls)*
- [ ] Fan curve profile writes *(requires vendor API or SuperIO driver)*
- [ ] Process priority management
- [ ] CPU park/unpark control
- [ ] Timer resolution optimisation (NtSetTimerResolution)

---

## Phase 5 — Packaging & Distribution ✅ Mostly Complete

- [x] NSIS installer bundle configured (`tauri.conf.json` — targets: nsis, publisher, installer icon, per-machine install)
- [x] Desktop run scripts (`npm run desktop` / `npm run dev:desktop`)
- [x] Standalone build script (`npm run build:exe` / `npm run package:windows`)
- [x] Portable package script (`npm run package:portable` → PowerShell script)
- [x] Desktop prerequisite checker (`npm run check:desktop` → PowerShell script)
- [x] `--background` / `--silent` launch flag: hides main window, starts in tray only
- [x] Runtime launch log written to `%ProgramData%\Radium PCs Companion\logs\`
- [x] Window close → hides to tray (does not exit process)
- [x] Double-click tray icon → restores main window
- [ ] **Validate Tauri dev/build once Rust is installed on PATH** ← next immediate step
- [ ] Generate first signed release EXE/installer
- [ ] Auto-update mechanism (tauri-plugin-updater)
- [ ] Code signing certificate
- [ ] Windows Defender / SmartScreen reputation building
- [ ] Radium PCs OEM pre-install package

---

## Phase 6 — Advanced Features 🔲 In Progress

- [x] **Live tray icon** — dynamic 32×32 RGBA metric icon with arc gauge; user picks metric in Settings → Tray behaviour
- [x] **Sidebar live sensor strip** — persistent CPU/GPU temp + usage chips in sidebar, color-coded by threshold, visible on all pages
- [x] **Gauge circle readability** — dark gauge face, corrected SVG track contrast, explicit light text in center
- [x] **Registry cleaner UX** — step guide (Scan→Review→Backup→Clean), safety legend, row layout fix, guarantees list
- [x] **Wire `apply_performance_profile`** to real Win32 power plan calls (`powercfg /setactive <GUID>`)
- [ ] Hardware alert notifications (temp threshold exceeded, RAM critical, etc.)
- [ ] RGB integration (OpenRGB API)
- [ ] Per-game profiles (detect active game process, apply profile)
- [ ] Historical data logging to SQLite
- [ ] Export diagnostics report (HTML/PDF)
- [ ] Remote monitoring (optional local network)
- [ ] OSD themes and layout customisation
- [ ] Search functionality (the search bar in the topbar is currently decorative)
- [ ] Startup folder (`shell:startup`) scanning in StartupManagerPage
- [ ] `RunOnce` key scanning in registry startup sources

---

## Deferred / Won't Do (for now)

| Feature | Reason |
|---|---|
| Kernel-mode driver | Requires WHQL signing; significant legal/support overhead |
| Undocumented Win32 APIs | Security/stability risk; fails Defender scans |
| Direct GPU vendor SDK bundling | NVML/ADL require runtime presence of vendor drivers; acceptable as opt-in but not as default |
| PSU USB HID monitoring | Hardware-dependent; requires specific PSU models |
| Linux/macOS support | Product is Windows-exclusive (Radium PCs systems) |

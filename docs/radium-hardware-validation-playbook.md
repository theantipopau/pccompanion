# Radium Hardware Validation Playbook

Last updated: 2026-06-25

Purpose: make real-machine validation repeatable across Radium desktops and service/test benches. This complements `docs/compatibility-matrix.md` with the exact evidence to capture per machine.

## Tester Intake

| Field | Value |
|---|---|
| Tester | pending |
| Date | pending |
| App version | pending |
| Install type | dev / portable / installer |
| Windows build | pending |
| Radium serial | pending |
| Build profile | pending |
| Motherboard | pending |
| BIOS version | pending |
| CPU | pending |
| GPU | pending |
| RAM | pending |
| Storage | pending |
| Cooling | pending |
| RGB controller/motherboard vendor | pending |

## Required Passes

| Pass | What To Verify | Status | Evidence |
|---|---|---|---|
| First launch | App opens, dashboard renders, no demo branding leak | pending | screenshot/log |
| Telemetry warmup | Startup state stabilizes without false zero readings | pending | diagnostics screenshot |
| CPU telemetry | Usage plus package temperature or clear unavailable reason | pending | diagnostics export |
| GPU telemetry | Provider, temperature, usage, VRAM, driver version | pending | diagnostics export |
| Storage | Inventory, used percent, and degraded SMART/NVMe state if missing | pending | System Passport |
| Tray lifecycle | Minimize, close-to-tray, restore, tooltip, metric icon | pending | notes/screenshot |
| OSD | Enable, click-through behavior, scale/position sanity | pending | screenshot |
| Startup integration | Windows startup toggle and start minimized behavior | pending | notes |
| System Passport | Provisioned build identity visible and copyable support context works | pending | copied context |
| Diagnostics export | Local JSON bundle created; no upload | pending | export path |
| Uninstall | App removes cleanly and leaves no unexpected startup entry | pending | notes |

## Provider Evidence Checklist

- WMI provider state and fallback reason.
- NVML state on NVIDIA builds.
- AMD ADL state on AMD discrete GPU builds.
- Intel fallback/IGCL staged state on Intel Arc or iGPU builds.
- Sidecar/PawnIO state if CPU package temperature is expected.
- Sensor discovery attempts for missing CPU package temperature.
- Any provider error text, timeout, or DLL availability issue.

## OpenRGB Phase 1 Evidence

Do not write colors during validation. Capture only readiness:

- OpenRGB installed: yes/no.
- OpenRGB SDK server running: yes/no.
- SDK endpoint: `127.0.0.1:6742` unless deliberately changed.
- Controller names/vendors detected by OpenRGB.
- Motherboard RGB controller present: yes/no.
- RAM/GPU/peripheral RGB controllers present: yes/no.
- Zones and LED counts visible in OpenRGB.
- Any unsupported or duplicate controllers.

## Exit Criteria

- At least one NVIDIA desktop and one AMD desktop are validated before broader distribution.
- Missing telemetry is explained in Diagnostics and Passport without showing zero as truth.
- Support context and diagnostics export together identify the machine, provider state, and support posture.

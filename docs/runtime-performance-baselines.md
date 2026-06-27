# Runtime Performance Baselines

Last updated: 2026-06-25

Purpose: record repeatable runtime measurements before optimizing polling, charts, tray updates, OSD, or sensor providers. Baselines should be captured on real Radium-relevant hardware and compared before/after each performance-sensitive change.

## Baseline Rules

- Use a Radium build unless the row is explicitly marked browser preview.
- Record AC power state, Windows power plan, active Companion profile, and whether the app is foreground, background, minimized, or tray-only.
- Let the app idle for at least 2 minutes before taking steady-state numbers.
- Use the same refresh settings for before/after comparisons.
- Record missing tooling as `blocked`, not zero.

## Capture Matrix

| Scenario | Window state | Monitoring | OSD | Tray metric | Duration | Status | Notes |
|---|---|---|---|---|---|---|---|
| Cold launch to Dashboard | foreground | on | off | CPU temp | first 60s | pending | Capture startup CPU/memory peak and time to first usable telemetry. |
| Dashboard idle | foreground | on | off | CPU temp | 5 min | pending | Capture steady CPU, memory, handle count, and chart render smoothness. |
| Diagnostics open | foreground | on | off | CPU temp | 3 min | pending | Capture provider refresh cost and UI responsiveness. |
| Tray-only idle | minimized/tray | on | off | selected metric | 10 min | pending | Capture background polling and tray icon update cost. |
| OSD visible | foreground | on | on | selected metric | 5 min | pending | Capture overlay render overhead and interaction cost. |
| Monitoring paused | foreground | off | off | disabled | 5 min | pending | Capture quiet baseline and verify no hidden polling loop. |

## Metrics To Record

| Metric | Source | Target/Watchpoint | Result |
|---|---|---|---|
| App process CPU average | Task Manager, Process Explorer, or PowerShell sampling | Low single-digit idle CPU | pending |
| App process working set | Task Manager or PowerShell sampling | Stable after warmup | pending |
| WebView child process memory | Task Manager process tree | No unbounded growth during idle | pending |
| Main thread responsiveness | Manual interaction and resize | No visible jank on Dashboard/Diagnostics | pending |
| Hardware sample interval | Diagnostics/provider logs | Matches configured refresh within tolerance | pending |
| Tray update cadence | Tray tooltip/icon observation | No noisy updates while hidden | pending |
| OSD render overhead | Manual observation plus process CPU | No sustained spike when overlay is idle | pending |
| Diagnostics export time | Export action timing | Completes locally without blocking UI excessively | pending |

## PowerShell Sampling Helper

Run from an elevated or normal PowerShell window after launching the app:

```powershell
$durationSec = 120
$intervalSec = 2
$samples = for ($i = 0; $i -lt ($durationSec / $intervalSec); $i++) {
  Get-Process | Where-Object { $_.ProcessName -like '*Radium*Companion*' -or $_.MainWindowTitle -like '*Radium*Companion*' } | ForEach-Object {
    [pscustomobject]@{
      Time = Get-Date
      Id = $_.Id
      ProcessName = $_.ProcessName
      CPU = $_.CPU
      WorkingSetMB = [math]::Round($_.WorkingSet64 / 1MB, 1)
      PrivateMB = [math]::Round($_.PrivateMemorySize64 / 1MB, 1)
      Handles = $_.HandleCount
    }
  }
  Start-Sleep -Seconds $intervalSec
}
$samples | Export-Csv "$env:TEMP\radium-runtime-baseline.csv" -NoTypeInformation
$samples | Format-Table -AutoSize
```

## Acceptance For Optimization Work

- A before/after row exists for any change that touches polling, charts, tray icon rendering, OSD, diagnostics refresh, or sensor provider orchestration.
- Any regression over 10% in steady-state CPU or memory is explained or reverted.
- Baseline evidence is linked from the release checklist before broad customer distribution.

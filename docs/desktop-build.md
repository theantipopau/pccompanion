# Desktop Runtime And EXE Packaging

Radium PCs Companion is a Tauri desktop application. The browser/Vite path is useful for fast UI work, but it is not the product runtime.

## Runtime Modes

| Command | Purpose | Hardware/native access |
|---|---|---|
| `npm.cmd run dev` | Browser preview for UI work | No, mock data only |
| `npm.cmd run desktop` | Tauri desktop app for real testing | Yes |
| `npm.cmd run build:exe` | Release EXE and NSIS installer | Yes |

The Dashboard shows an amber browser-preview notice when the app is not running inside Tauri.

## Prerequisites

Install these on the build machine:

1. Node.js LTS
2. Rust via `rustup`
3. Microsoft C++ Build Tools / Visual Studio Build Tools with the Windows SDK
4. WebView2 Runtime, normally already present on Windows 11

After installing Rust, restart VS Code or the terminal so `cargo` is on `PATH`.

Run:

```powershell
npm.cmd run check:desktop
```

## Development

Use this for real hardware data, tray integration, OSD windows, and native command testing:

```powershell
npm.cmd run desktop
```

Tauri will run the Vite dev server through `beforeDevCommand`, then launch the desktop shell.

## Standalone EXE

Build the production executable and installer:

```powershell
npm.cmd run build:exe
```

Expected outputs:

- App EXE: `src-tauri\target\release\radium_pcs_companion.exe`
- Installer: `src-tauri\target\release\bundle\nsis\`

The packaged app does not require `npm`, Vite, or a browser. It runs as a standalone Windows desktop program.

## Troubleshooting: Cargo Missing

If a fresh terminal cannot run Tauri because `cargo` is missing from `PATH`, the usual failure is:

```text
failed to run 'cargo metadata' command ... program not found
```

Fix by installing Rust from `https://rustup.rs`, then opening a fresh terminal so PATH refreshes:

```powershell
cargo --version
npm.cmd run check:desktop
npm.cmd run desktop
```

Current release validation should be tracked in `docs/current-state.md` and `docs/compatibility-matrix.md`, not in this troubleshooting note.

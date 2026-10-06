<div align="center">

# GitHub Copilot Usage

A compact Windows widget and system-tray app for GitHub Copilot and Claude Code usage.

[![Latest release](https://img.shields.io/github/v/release/Alexis-Fiolleau-LaPoste-BGPN/github-copilot-usage-tauri?style=for-the-badge)](https://github.com/Alexis-Fiolleau-LaPoste-BGPN/github-copilot-usage-tauri/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

![Widget design reference](screenshots/app-screenshot.png)

*Visual reference for the pill. The Windows app also includes hover controls and a Details view.*

## What it does

The app keeps a small floating pill on screen with a five-segment usage meter and percentage. It can show GitHub Copilot premium-request usage or Claude Code usage, and keeps the same information available from the system tray.

## Download

Download the Windows x64 executable from [Releases](https://github.com/Alexis-Fiolleau-LaPoste-BGPN/github-copilot-usage-tauri/releases/latest):

`GitHubCopilotUsage-0.7.0-windows-x64.exe`

This is a portable executable, not an installer. Run it on Windows 11; the app uses the WebView2 runtime included with current Windows installations. If WebView2 is missing, install the [Evergreen WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

## Features

- Floating pill with live percentage and left-to-right usage segments.
- Drag anywhere on the pill to move it; resize it from the window edges.
- Hover controls to pin on top, open Details, or hide to the tray.
- Details preserves the pill's custom size when opened and restores it when closed.
- Hiding or minimizing unpins the window; the pin state is cleared when the widget returns.
- Tray menu for source selection, usage breakdown, refresh, show/hide, start-at-login, and quit.
- GitHub Copilot login through GitHub's device flow or a manually supplied token.
- Claude Code usage from the existing Claude Code login on the same machine.
- Automatic refresh every 1, 5, 15, or 30 minutes (5 minutes by default).

## First run

1. Start the executable and open Details from the pill.
2. Select GitHub Copilot and sign in with GitHub, or enter a Copilot token.
3. To view Claude usage, sign in with the Claude Code CLI on the same machine, then select Claude.
4. Use the tray menu to switch sources, refresh, or restore a hidden pill.

The Copilot token is stored in the app's local WebView storage. The app does not encrypt that value itself; use a token you are comfortable storing on this device and remove it with **Change Token** before handing the device to someone else.

Claude usage depends on the login maintained by Claude Code. The app reads the local credentials and requests usage data; it does not sign in to Claude separately.

## Build from source on Windows

Requirements:

- Windows x64
- Node.js 20 or newer
- Rust stable via `rustup`
- MSYS2 installed at `%LOCALAPPDATA%\Programs\MSYS2`, with the MINGW64 GCC and binutils packages

Install MSYS2 from [msys2.org](https://www.msys2.org/). In its MINGW64 terminal, install the compiler tools:

```bash
pacman -Syu
pacman -S --needed mingw-w64-x86_64-gcc mingw-w64-x86_64-binutils
```

Then, from PowerShell at the repository root, run:

```powershell
.\scripts\build-windows.ps1
```

The script installs frontend dependencies and builds the portable executable at:

```text
src-tauri\target\x86_64-pc-windows-gnu\release\GitHubCopilotUsage.exe
```

To run the frontend and Tauri app during development, install dependencies with `npm ci`, then use `npm run tauri dev` with the standard Tauri prerequisites for your Rust toolchain.

## Usage data and APIs

- GitHub Copilot usage comes from GitHub's Copilot usage endpoint.
- Claude usage uses the endpoint used by Claude Code's own usage display.

These endpoints are not stable public APIs and may change. Usage data is refreshed on demand or at the selected interval; it is not guaranteed to be real-time.

## Repository layout

```text
src/                    React + TypeScript interface
src-tauri/              Tauri and Rust application
scripts/build-windows.ps1  Reproducible Windows GNU build
screenshots/             Widget visual reference
```

## License

MIT. See [LICENSE](LICENSE).

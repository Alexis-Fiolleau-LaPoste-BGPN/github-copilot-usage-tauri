# Overview (/docs)

GCT (GitHub Copilot Tracker) is a lightweight Windows widget that shows GitHub Copilot AI-credit
usage or Claude Code usage in a compact, movable pill.

## Install [#install]

1. Download the latest Windows release from [GitHub Releases](https://github.com/Potowai/github-copilot-tracker/releases/latest).
2. Extract `gct.exe` and `WebView2Loader.dll` from the ZIP into the same folder.
3. Run `gct.exe`. Windows 11 with the Microsoft WebView2 Runtime is required (most installs already have it).

## Connect a usage source [#connect-a-usage-source]

Open **Details** from the pill, then:

- For GitHub Copilot, sign in with GitHub or paste a personal access token.
- For Claude Code, sign in to the Claude Code CLI on the same machine (`claude`, then `/login`), then select Claude in the tray menu.

## Settings [#settings]

Use **Settings** in the Details panel to choose English or French and a currency for the AI-credit
estimate (EUR, USD, GBP, or CHF). Estimates use GitHub's published $0.01-per-credit rate and a
daily USD exchange rate; they are not billing amounts.

## Updates [#updates]

GCT checks the latest published GitHub Release once a day. When a newer stable release is
available, it shows a banner in Details and sends a notification if notifications are already
permitted. Updates are user-initiated — GCT never replaces itself silently.

<Cards>
  <Card title="Source code" href="https://github.com/Potowai/github-copilot-tracker" />
  <Card title="Latest release" href="https://github.com/Potowai/github-copilot-tracker/releases/latest" />
</Cards>

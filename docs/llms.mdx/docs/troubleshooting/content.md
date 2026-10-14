# Troubleshooting (/docs/troubleshooting)

## No Claude Code login found [#no-claude-code-login-found]

GCT reads Claude Code's existing login on the same machine. If Details shows "No Claude Code
login was found", run the Claude Code CLI once (`claude`, then `/login`) and refresh.

## Currency estimate is missing [#currency-estimate-is-missing]

The estimate needs a daily USD exchange rate fetched over the network. If the rate cannot be
fetched (for example, no network access), GCT keeps the last cached rate and label date; the
usage numbers themselves stay visible even without an estimate.

## Resetting the GitHub token [#resetting-the-github-token]

Use **Change Token** in Details to remove the stored GitHub personal access token before handing
the device to someone else. GCT does not encrypt the token itself; it is stored in the app's
local WebView storage.

## Build from source [#build-from-source]

See the [source repository](https://github.com/Potowai/github-copilot-tracker) README for the
Windows build prerequisites (Node.js 20+, Rust stable, and MSYS2 MinGW64 tools).

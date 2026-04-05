﻿# Argus

Local dashboard for monitoring and controlling your GitHub Copilot CLI and Claude Code sessions: real-time output, remote stop, all in a browser tab.

## Requirements

- Node.js 22 LTS
- GitHub Copilot CLI and/or Claude Code installed

## Getting Started

```sh
# 1. Install dependencies (once)
npm install

# 2. Build the frontend (once, or after frontend changes)
cd frontend && npm run build && cd ..

# 3. Start the server
npm run dev
```

Open **http://localhost:7411**

## Monitor

See everything happening across all your AI sessions without switching terminals.

### Session Cards

Each session card on the dashboard shows:

- **Type badge** (copilot-cli / claude-code) and **status badge** (active / idle / ended / ...)
- **Model**: the AI model name when known (e.g. `claude-opus-4-5`), displayed in small monospace text next to the type badge
- **PID** when known, or **session ID prefix** (e.g. `ID: abc12345`) for Claude Code sessions without a detected PID
- **Elapsed time** and a **View details** link to the full session page
- **Last output line**: most recent output truncated to one line

### Session Output

Click anywhere on a session card to open a **live output pane** on the right side of the dashboard. The card list stays visible on the left. Press **Escape** or click **X** to close the pane. Click a different card to switch the pane to that session.

Output lines are labelled **YOU** / **AI** so conversations are easy to follow at a glance. For Claude Code sessions, Argus reads JSONL conversation files in real-time and streams all content including tool calls.

### Session Detection

Argus auto-detects sessions already running when it starts. For Claude Code, it only re-activates sessions whose JSONL file was modified in the last 30 minutes (prevents ghost sessions). New sessions are picked up every 5 seconds. The OS PID is captured for Claude Code sessions when possible.

## Control

Act on any session directly from the dashboard without touching the terminal.

### Quick Commands

Buttons appear on each active session card:

| Button | Action |
|--------|--------|
| **Esc** | Send an interrupt signal (SIGINT / Ctrl+Break) to cancel the current operation |
| **Exit** | Send `/exit` (requires confirmation) |
| **Merge** *(claude-code only)* | Send `merge current branch with main` |
| **Pull latest** *(claude-code only)* | Send `pull latest changes from main branch` |

### Inline Prompt

Active Claude Code cards include a text input. Type a message and press **Enter** (or click **Send**) to send it directly to the session.

### Repository Management

Click **Add Repository** and use the native folder picker to select a repo. If the selected folder is a git repo it is added immediately; if not, Argus scans all subdirectories and adds every git repo found in one go. Already-registered repos are skipped automatically.

## Dashboard Settings

Click the **gear icon** in the top-right of the dashboard header to open the Settings panel.

| Setting | Default | Description |
|---------|---------|-------------|
| Hide ended sessions | Off | When turned on, sessions with status `completed` or `ended` are hidden from all repository cards |
| Hide repos with no active sessions | Off | When turned on, repository cards are hidden if they have no sessions with status `active`, `idle`, `waiting`, or `error` (including repos with zero sessions) |
| Hide inactive sessions | Off | When turned on, sessions with no output in the last 20 minutes are hidden from all repository cards |

Settings are saved automatically in your browser (`localStorage`) and restored on every page load.

## Onboarding

First-time users are guided through the Dashboard with a 6-step interactive tour. The session detail page shows dismissible hint badges (`?`) on key controls.

| Feature | Behaviour |
|---------|-----------|
| **Welcome tour** | Auto-launches on first Dashboard load; advance, skip, or close any time |
| **Restart Tour** | Available in the Settings panel: replays tour from step 1 |
| **Reset Onboarding** | Available in the Settings panel: clears stored state so the welcome tour auto-launches again |
| **Session hints** | Three dismissible `?` badges on the session detail page; hover/focus for tooltip; persisted globally |

## Storage

Argus stores config and the session database in `~/.argus/`:

| File | Purpose |
|------|---------|
| `~/.argus/config.json` | Port, retention settings, watched directories |
| `~/.argus/argus.db` | SQLite: repos, sessions, output |

Default port: **7411**. Override in `~/.argus/config.json`:
```json
{ "port": 7411, "sessionRetentionHours": 24 }
```

## For Contributors

See [docs/README-CONTRIBUTORS.md](docs/README-CONTRIBUTORS.md) for API reference, security model, CI pipeline, and development guides.
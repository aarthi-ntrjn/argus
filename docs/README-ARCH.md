# Argus: Architecture

Argus is a local dashboard that gives you centralized visibility and remote control over Claude Code and GitHub Copilot CLI sessions running on your machine. It runs a Fastify backend (Node/TypeScript) that watches AI tool files on disk and injects hooks, stores everything in SQLite, and streams updates to a React frontend over WebSockets.

```mermaid
flowchart TB
    subgraph Browser["🌐 Browser (React + Vite)"]
        direction TB
        Dashboard["DashboardPage\nSessionCard · OutputPane"]
        SessionPg["SessionPage\nSessionDetail · ControlPanel"]
        TQ["TanStack Query\nREST cache + invalidation"]
        WSClient["socket.ts\nWebSocket · auto-reconnect"]
    end

    subgraph ArgusLaunch["🚀 argus launch CLI Process"]
        direction TB
        PTY["node-pty\nPTY spawn (ConPTY / POSIX)"]
        LaunchClient["ArgusLaunchClient\nWebSocket client"]
        PTY <--> LaunchClient
    end

    subgraph Backend["⚙️ Fastify Backend: port 7411"]
        direction TB

        subgraph API["HTTP Layer"]
            REST["REST API  /api/v1\nsessions · repositories · fs"]
            HookEndpoint["POST /hooks/claude\nhook receiver"]
        end

        LauncherWS["WebSocket  /launcher\nregister · prompt ack\nsession_ended"]

        WSServer["WebSocket  /ws\nevent-dispatcher\nsession.created · session.updated\nsession.ended · session.output"]

        PtyRegistry["PtyRegistry\nMap sessionId → WS\npending-promise ack (10 s)"]

        SessionController["SessionController\nsendPrompt()"]

        subgraph Monitor["Session Monitor  (5 s poll)"]
            direction LR

            subgraph CCD["ClaudeCodeDetector"]
                direction TB
                CC1["1 · injectHooks()\n→ ~/.claude/settings.json"]
                CC2["2 · scanExisting()\nJSONL mtime &lt; 30 min\n+ ps-list PID check"]
                CC3["3 · chokidar watch\n~/.claude/projects/\n{encoded}/{id}.jsonl"]
                CC4["4 · parseClaudeJsonl\nuser · assistant\ntool_use · tool_result\nextract model"]
                CC1 --> CC2 --> CC3 --> CC4
            end

            subgraph CPD["CopilotCliDetector"]
                direction TB
                CP1["1 · scan\n~/.copilot/session-state/"]
                CP2["2 · read\nworkspace.yaml\ninuse.PID.lock"]
                CP3["3 · chokidar watch\nevents.jsonl"]
                CP4["4 · parseJsonlLine\nuser.message\nassistant.message\ntool.exec_*"]
                CP1 --> CP2 --> CP3 --> CP4
            end
        end

        OutputStore["OutputStore\ninsertOutput → broadcast"]
        DB[("SQLite\n~/.argus/argus.db\n─────────────\nrepositories\nsessions\nsession_output\ncontrol_actions")]
    end

    subgraph ClaudeCode["🤖 Claude Code Process"]
        CCSettings["~/.claude/settings.json\ninjected hooks"]
        CCFiles["~/.claude/projects/**/*.jsonl\nconversation history"]
    end

    subgraph CopilotCLI["🤖 Copilot CLI Process"]
        CPFiles["~/.copilot/session-state/{uuid}/\nworkspace.yaml\nevents.jsonl\ninuse.{PID}.lock"]
    end

    %% Browser <-> Backend
    TQ -- "HTTP REST" --> REST
    WSClient -- "WS events" --> WSServer
    WSServer -- "push updates" --> WSClient

    %% PTY launcher flow
    LaunchClient -- "WS /launcher\nregister · ack" --> LauncherWS
    LauncherWS -- "send_prompt" --> LaunchClient
    LaunchClient -- "writes to PTY stdin" --> PTY
    LauncherWS <--> PtyRegistry
    SessionController --> PtyRegistry

    %% Hook flow
    CCSettings -- "curl POST" --> HookEndpoint
    HookEndpoint --> CCD

    %% File watching
    CC3 -. "chokidar" .-> CCFiles
    CP3 -. "chokidar" .-> CPFiles

    %% Data flow
    CC4 --> OutputStore
    CP4 --> OutputStore
    OutputStore --> WSServer
    Monitor --> DB
    REST --> DB
```

## Key Design Decisions

- **No agents/APIs**: detection is purely file-system based (no Copilot API calls, no Claude API calls)
- **Claude Code hooks** are injected into `~/.claude/settings.json` to receive push events; Copilot is detected passively via file watching
- **WebSocket push** keeps the UI live; TanStack Query handles caching and cache invalidation on WS events
- **SQLite** stores full session history with configurable retention via `pruning-job.ts`

### PTY Prompt Delivery

When a user runs `argus launch <tool>` instead of invoking the tool directly, Argus gains reliable bidirectional control over the session.

**Why PTY?** Injecting text into a running process via stdin (`TIOCSTI`) was removed from macOS after Ventura and is unavailable on Windows. PTY allocation (via `node-pty`, which uses Windows ConPTY and POSIX PTY, the same infrastructure VS Code uses for its integrated terminal) is the only cross-platform mechanism for writing to a terminal-attached process stdin without kernel privilege.

**Send-prompt flow:**

1. The browser submits a prompt via `POST /api/v1/sessions/:id/send`.
2. `SessionController.sendPrompt()` checks `launchMode`. If the session is `'pty'` but no launcher WebSocket is registered, it returns a `failed` control action immediately.
3. `PtyRegistry.sendPrompt(sessionId, actionId, prompt)` sends a `send_prompt` message over the `/launcher` WebSocket connection held by that session's `argus launch` process.
4. The `ArgusLaunchClient` inside the `argus launch` process receives the message and writes the prompt text to the PTY stdin, so the spawned tool receives it as if the user typed it.
5. The CLI acknowledges with `prompt_delivered` (or `prompt_failed`), which resolves the pending promise in `PtyRegistry` within a 10-second timeout.
6. `SessionController` updates the control action to `completed` (or `failed`) and broadcasts a WebSocket event to the browser.

**Session lifecycle**: On disconnect of the `/launcher` WebSocket, the route handler marks the session as ended and unregisters the entry from `PtyRegistry`. The frontend `SessionPromptBar` shows a "live" badge for PTY sessions and disables prompt input entirely for passively detected sessions (no launcher connected).

## Development Tooling

All feature work follows a Speckit specification-driven pipeline (`specify → clarify → plan → tasks → analyze → implement`). See `CLAUDE.md` for the full workflow: it is the single source of truth for both Claude Code and the GitHub Copilot CLI.

Speckit skill definitions live in `.claude/commands/`. The CI pipeline (`.github/workflows/ci.yml`) enforces lockfile integrity, action SHA pinning, and critical CVE auditing on every push.

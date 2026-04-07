# Research: PTY Launcher for Prompt Delivery

## Delivery Mechanism Selection

**Decision**: PTY launcher via `node-pty`. Argus spawns the AI tool inside a PTY it owns and holds the master write handle.

**Rationale**: Stdin injection into already-running processes is not feasible on modern macOS (TIOCSTI removed in 12.3+) and unreliable on Windows for processes Argus did not spawn. The PTY launcher is the only cross-platform approach that works consistently for both Claude Code and Copilot CLI without OS-level hacks. `node-pty` is the same library VS Code uses for its integrated terminal.

**Alternatives considered**:
- Stdin injection into running processes: macOS TIOCSTI removed, Windows AttachConsole unreliable cross-version
- `claude --resume --print`: Claude Code only, creates a parallel process, may conflict with running session
- Playwright/Electron automation: VS Code only, fragile DOM selectors, breaks on VS Code updates
- tmux send-keys: requires tmux, Windows not supported natively

---

## PTY–Backend Communication Channel

**Decision**: Launcher process connects to Argus backend via WebSocket at `/launcher`. The backend holds a `Map<sessionId, WebSocket>` and routes send_prompt commands through it.

**Rationale**: The PTY master handle lives in the launcher process (running in the user's terminal). The backend cannot hold it directly. A persistent WebSocket connection is the lightest-weight IPC for a localhost service. No new ports needed — the existing Argus backend port (7411) serves both the frontend WebSocket (`/ws`) and the new launcher WebSocket (`/launcher`).

**Alternatives considered**:
- Named pipe per session: more complex path management, harder to clean up on crash
- Launcher exposes its own HTTP server: requires dynamic port allocation and discovery
- Backend spawns the PTY directly: backend cannot proxy user terminal stdin/stdout from a server process

---

## Session Type vs Launch Mode

**Decision**: Keep `type` as `'claude-code'` or `'copilot-cli'` based on the tool being launched. Add a separate `launch_mode` column (`'pty'` | `'detected'`) to indicate the control channel.

**Rationale**: Session type drives output parsing behavior (JSONL watcher for Claude Code, events.jsonl for Copilot CLI). Launch mode drives the control capability. These are orthogonal concerns. Mixing them into a `'pty-claude-code'` type would duplicate parsing logic.

**Alternatives considered**:
- New session type `'pty-launcher'`: requires duplicating or branching output parsing; conflates two orthogonal concerns
- In-memory PTY registry check: not persistent, UI cannot distinguish after backend restart

---

## Output Parsing for PTY Sessions

**Decision**: Output parsing is unchanged. Claude Code writes JSONL files that the existing watcher reads regardless of how Claude Code was started. Copilot CLI writes `events.jsonl` similarly. The PTY is purely a stdin injection channel; stdout flows to both the user's terminal (via PTY proxy) and the existing file-based watchers.

**Rationale**: Zero duplication. The file-based parsers already handle structured output correctly. Raw PTY stdout is not structured and would require a separate parser.

**Alternatives considered**:
- Parse PTY stdout directly: unstructured terminal output, ANSI escape codes, harder to parse correctly than JSONL

---

## Launcher Process Lifecycle

**Decision**: The launcher process runs for the lifetime of the AI tool session. When the tool exits, the launcher cleans up: closes PTY, sends `session_ended` to backend, exits. If the backend is unavailable, the launcher still spawns the tool and runs normally — it just won't be controllable from Argus.

**Rationale**: Graceful degradation means `argus launch claude` never blocks the user from using Claude Code even if Argus is not running.

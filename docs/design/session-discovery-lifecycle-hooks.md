# Session Discovery, Lifecycle, and Hook Management

## Overview

Argus discovers and tracks AI coding sessions (Claude Code and GitHub Copilot CLI) through two complementary mechanisms running in parallel: a real-time HTTP hook receiver and a periodic disk scan. This dual-path design ensures sessions are never missed, even when hooks are unavailable, and that crashed or silently exited sessions are promptly detected.

## Key Components

| Component | File | Role |
|---|---|---|
| `SessionMonitor` | `services/session-monitor.ts` | Orchestrates the scan loop and broadcasts lifecycle events |
| `BaseCliDetector` | `services/base-cli-detector.ts` | Abstract scan pipeline and hook dispatch shared by both detectors |
| `ClaudeCodeDetector` | `services/claude-code-detector.ts` | Reads `~/.claude/sessions/*.json` for Claude sessions |
| `CopilotCliDetector` | `services/copilot-cli-detector.ts` | Reads `~/.copilot/session-state/*/` for Copilot sessions |
| `ClaudeCodeHooksInjector` | `services/claude-code-hooks-injector.ts` | Injects hooks into `~/.claude/settings.json` |
| `CopilotCliHooksInjector` | `services/copilot-cli-hooks-injector.ts` | Injects hooks into each repo's `.github/hooks/hooks.json` |
| `CliManager` | `services/cli-manager.ts` | Single ownership point for both detectors and injectors |
| Hook routes | `api/routes/hooks.ts` | HTTP endpoints `/hooks/claude` and `/hooks/copilot` |

---

## Session Discovery

### Dual-Path Architecture

```
                       Real-time path
CLI tool fires hook ──────────────────────► /hooks/claude or /hooks/copilot
                                                   │
                                             handleHookPayload()
                                                   │
                                         create/update DB session immediately

                       Scan path (every 5 seconds)
SessionMonitor ──────► BaseCliDetector.scan()
                              │
                        readSessionEntries()    ← disk read
                              │
                        for each entry:
                          - check PID liveness
                          - upsert DB session
                          - diff vs last cycle → fire callbacks
```

The two paths are independent and idempotent. A session discovered by a hook is reconciled against disk on the next scan cycle without duplication. A session on disk with no hook (launched outside Argus, or hooks not yet configured) is picked up by the scan cycle.

### Claude Code Session Files

Claude writes a JSON file per session to `~/.claude/sessions/<pid>.json`. Each file contains:

```json
{
  "pid": 12345,
  "sessionId": "<uuid>",
  "cwd": "/path/to/repo"
}
```

The detector reads all files in that directory on each scan. The filename is the PID, so PID is always known (`pidSource = 'session_registry'`).

### Copilot CLI Session Directories

Copilot writes a directory per session to `~/.copilot/session-state/<sessionId>/`. Each directory contains:

- `workspace.yaml`: session metadata (summary, timestamps)
- `inuse.<pid>.lock`: a lock file whose name encodes the PID

The detector reads directory listings and parses both files. PID can be `null` if the lock file has not been created yet (`pidSource = 'lockfile'` once resolved).

**Mtime optimization:** On each scan cycle, only directories whose mtime changed since the last scan are fully re-read, plus any that were live on the previous cycle (to catch immediate termination).

---

## Scan Pipeline

`BaseCliDetector.scan()` is the canonical entry point for both detectors. The sequence is:

```
scan(force?)
  ├─ readSessionEntries(force)         reads disk, returns raw entries
  ├─ for each entry:
  │   ├─ isExpectedProcessAlive()      PID liveness + identity check
  │   ├─ onAliveEntry()                detector-specific tracking (Copilot only)
  │   ├─ resolveRepoOrWarn()           ensure repo is registered
  │   └─ buildSessionFromEntry()       create or update DB row
  │       ├─ resolvePtyLinkage()       decide if this is a PTY-launched session
  │       ├─ createPtySession()        brand-new PTY-linked session
  │       └─ upsertActiveSession()     regular scan-sourced session
  └─ dispatchSessionEvents(sessions)   diff sigCache, fire session callbacks
```

### PID Liveness and Identity

`isExpectedProcessAlive()` uses `process.kill(pid, 0)` (near-zero cost) to check if the process exists. It then verifies process identity (command-line substring or start-time comparison) to guard against PID reuse: a recycled PID for an unrelated process must not keep the session alive.

### Signature Cache

`dispatchSessionEvents()` compares each session's current shape (a hash of key fields) against a per-session cache from the previous cycle. Only sessions whose signature changed trigger callbacks, preventing repeated `session.updated` events for unchanged sessions.

### Ended-session Detection

**Claude Code:** Tracks `currentAlivePids` per cycle. Any PID that was alive last cycle but absent now triggers `handleSessionEnd()`.

**Copilot CLI:** The lock file disappears when the process exits. A directory present with no lock file (and a stale mtime) signals termination.

### Reconciliation

`reconcileActiveSessions()` runs at startup and after any repo removal. It finds all DB sessions still marked active for a detector's type and checks each against current disk state, ending any orphaned sessions (repo removed while a session was running, process crashed without cleanup).

---

## Session Lifecycle

### States

```
                 hook or scan detects session
                         │
                      active
                      /    \
                   active   idle  (crossing restingThresholdMinutes with no activity)
                      \    /
                      active
                         │
                       ended
```

Sessions transition via:

- **`SessionStart` hook or first scan detection:** Session created with `status = 'active'`.
- **Inactivity:** When `lastActivityAt` crosses `restingThresholdMinutes`, a single `session.updated` is broadcast. The session remains in the DB; it is not ended.
- **`SessionEnd` hook, process death, or file/lock removal:** `handleSessionEnd()` marks the session `status = 'ended'`, closes the JSONL watcher, and fires `session.ended`.

### Key Session Fields

```typescript
interface Session {
  id: string;
  repositoryId: string;
  type: 'claude-code' | 'copilot-cli';
  launchMode: 'pty' | null;      // 'pty' if launched via Argus, null if auto-detected
  pid: number | null;
  hostPid: number | null;        // Shell wrapper PID on Windows
  pidSource: 'session_registry' | 'pty_registry' | 'lockfile' | null;
  status: 'active' | 'idle' | 'waiting' | 'error' | 'completed' | 'ended';
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  yoloMode: boolean | null;      // true when hostPid !== pid (shell wrapper detected)
  ptyLaunchId: string | null;
  reconciled: boolean;
}
```

### PTY Linkage

When a session is launched via `argus launch`, a PTY launcher pre-registers in `PtyRegistry` with a `ptyLaunchId`. When the detector first encounters that session (via hook or scan), `resolvePtyLinkage()` runs:

1. **Already claimed:** Session already has `launchMode = 'pty'`; apply any disk-side PID correction.
2. **Registry has it:** `ptyRegistry` knows this `sessionId`; mark as PTY.
3. **Fresh claim:** New session; call `ptyRegistry.claimForSession()` to link to a pending launcher.
4. **Default:** Not PTY; PID comes from disk.

---

## Hook Management

### Hook Injection

Hooks are shell commands that the AI tool invokes on lifecycle events. Argus injects these commands into the tool's configuration so they POST event payloads to Argus's HTTP server.

**Claude Code (global):**

Target file: `~/.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart":  [{ "hooks": [{ "type": "command", "command": "curl -sf -X POST http://127.0.0.1:{port}/hooks/claude -H 'Content-Type: application/json' -d @-" }] }],
    "SessionEnd":    [...],
    "PreToolUse":    [...],
    "PostToolUse":   [...]
  }
}
```

One global file covers all repos. Stale entries from previous ports are removed before re-injecting. `injectForRepo()` is equivalent to `injectForAll()` here.

**Copilot CLI (per-repo):**

Target file: `<repo>/.github/hooks/hooks.json`

Each repo gets its own hooks file with both `bash` and `powershell` commands. Events injected: `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`. The Copilot event name is appended as `?event={name}` in the URL so the server can distinguish event types.

```json
{
  "hooks": {
    "sessionStart": {
      "bash":        "curl -sf -X POST http://127.0.0.1:{port}/hooks/copilot?event=sessionStart ...",
      "powershell":  "Invoke-RestMethod -Uri http://127.0.0.1:{port}/hooks/copilot?event=sessionStart ..."
    }
  }
}
```

### Hook Endpoint Processing

**`POST /hooks/claude`** (body is JSON):

```
1. Validate session_id is UUID v4; reject malformed
2. Reject if payload PID conflicts with existing session PID
3. Accept only: SessionStart, SessionEnd, PreToolUse/PostToolUse with tool_name='AskUserQuestion'
4. Route to CliManager.handleClaudeHookPayload()
5. Return { ok: true }
```

**`POST /hooks/copilot?event={event}`** (body is JSON):

```
1. Extract event from query string, normalize to PascalCase
2. Validate sessionId is UUID v4
3. Parse toolArgs JSON string into tool_input
4. Accept only: lifecycle events and ask_user tool events
5. Route to CliManager.handleCopilotHookPayload()
6. Return { ok: true }
```

### Hook Payload Handling

`BaseCliDetector.handleHookPayload()` dispatches based on event type:

```
SessionEnd hook
  └─ handleSessionEnd() → mark ended, close JSONL watcher, broadcast, telemetry

PreToolUse + AskUserQuestion (or ask_user)
  └─ handlePreAskQuestion() → store pending choice, broadcast session.pending_choice

PostToolUse + AskUserQuestion (or ask_user)
  └─ handlePostAskQuestion() → clear pending choice, broadcast resolved

Any other hook (typically first SessionStart)
  ├─ Try claimForSession() from PTY registry
  ├─ If claimed: createPtySession()
  └─ Else: upsertActiveSession()
```

---

## Pending Choice (AskUserQuestion)

When the AI tool needs user input, it invokes the `AskUserQuestion` (Claude) or `ask_user` (Copilot) tool. Argus intercepts this and presents the question to the user via the frontend.

### Flow

```
1. PreToolUse hook fires with question and choices in tool_input
2. parsePendingChoicePayload() normalizes to { question, choices[], allQuestions[] }
3. Stored in detector's pendingChoices map (keyed by sessionId)
4. Broadcast via WebSocket: session.pending_choice
5. Frontend displays banner with question and choice buttons
6. User selects choice → POST /api/v1/sessions/{id}/send-with-choice
7. SessionController sends encoded choice to PTY via ptyRegistry.sendChoiceWithPrompt()
8. PostToolUse hook fires when tool completes
9. handlePostAskQuestion() clears pending choice, broadcasts resolved
10. Frontend dismisses banner
```

### Payload Formats

**Claude Code (multi-question):**
```typescript
{
  questions: [
    {
      question: string,
      options: (string | { label: string, description: string })[],
      header?: string
    }
  ]
}
```

**Copilot CLI (flat):**
```typescript
{
  question: string,
  choices: string[]
}
```

---

## SessionMonitor and Event Broadcasting

`SessionMonitor` owns both detector instances and wires their callbacks into WebSocket broadcasts:

```
SessionMonitor
  ├─ ClaudeCodeDetector   onSessionCreated → broadcast session.created
  │                       onSessionUpdated → broadcast session.updated
  │                       onSessionEnded   → broadcast session.ended
  └─ CopilotCliDetector   (same callbacks)
```

The scan loop runs every 5 seconds by default. Each cycle calls `scan()` on both detectors sequentially. Callbacks fire synchronously within the scan cycle when a signature change is detected.

### Events Emitted

| Event | Trigger |
|---|---|
| `session.created` | New session first seen (hook or scan) |
| `session.updated` | Session field changed (status, lastActivityAt, summary, model, yoloMode, pid) |
| `session.ended` | Session ended (hook, process death, or file removal) |
| `session.pending_choice` | AskUserQuestion PreToolUse received |
| `session.pending_choice.resolved` | AskUserQuestion PostToolUse received or interrupt sent |

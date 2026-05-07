# Launch with Argus

## Overview

"Launch with Argus" lets users start a Claude Code or Copilot CLI session through Argus rather than running the tool directly in a terminal. The launcher wraps the AI tool in a PTY (pseudo-terminal), opens a persistent WebSocket connection back to Argus, and enables real-time prompt injection, choice delivery, and session control from the Argus UI. Sessions started this way are flagged `launchMode = 'pty'` and support all interactive control features.

## Key Components

| Component | File | Role |
|---|---|---|
| `PtyRegistry` | `launch-pty/pty-registry.ts` | In-memory registry of pending launchers and claimed sessions |
| Launcher route | `api/routes/launcher.ts` | WebSocket endpoint `/launcher?id={ptyLaunchId}` |
| `SessionController` | `services/session-controller.ts` | Orchestrates stop, send-prompt, interrupt, dismiss |
| `SessionPidResolver` | `cli/session-pid-resolver.ts` | Resolves PID to sessionId from on-disk session files |
| Session routes | `api/routes/sessions.ts` | REST endpoints for session control actions |

---

## Launch Flow

```
User runs: argus launch <cwd> [claude|copilot]
      │
      ▼
Launcher executable (Node.js wrapper)
  ├─ Spawns the AI tool in a PTY
  └─ Opens WebSocket: ws://127.0.0.1:{port}/launcher?id={ptyLaunchId}
      │
      ▼
Sends 'register' message
  { type: 'register', hostPid, pid, sessionType, cwd }
      │
      ▼
Argus: registerPending() holds connection
  (no DB session yet; waiting for the AI tool to fire its first hook)
      │
      ▼
AI tool fires first hook (SessionStart or other)
  └─ BaseCliDetector.handleHookPayload()
      └─ claimForSession(sessionId, repoPath, sessionType)
          └─ Moves pending entry to connections[sessionId]
      │
      ▼
Session created in DB with launchMode = 'pty'
      │
      ▼
Prompt delivery, choice delivery, stop/interrupt now available
```

---

## PtyRegistry State Machine

```
                 registerPending()
                       │
               pendingByLaunchId[id]
               /         |          \
      update_pid()  linkToSession()  promotePendingToSession()
      (Windows PID  (pre-link via   (server restart reconnect)
       resolution)   PID match)
               \         |          /
                claimForSession()
                       │
               connections[sessionId]
                       │
               unregister() / close
```

A launcher stays in the pending map until a detector claims it for a specific `sessionId`. This decoupling is necessary because the AI tool's session ID is not known until it fires its first hook or writes its first session file, which can happen seconds after the launcher opens the WebSocket.

---

## WebSocket Message Protocol

### Launcher to Argus

**`register`** - Sent immediately after WebSocket opens:
```json
{
  "type": "register",
  "hostPid": 12345,
  "pid": 12346,
  "sessionType": "claude-code",
  "cwd": "/path/to/repo"
}
```
`hostPid` is the shell wrapper process (e.g., `powershell.exe` on Windows). `pid` is the AI tool process. On Windows, `pid` may be `null` initially and resolved via `update_pid`.

**`update_pid`** - Windows only, sent after the launcher walks the process tree to find the real tool PID:
```json
{
  "type": "update_pid",
  "pid": 12346
}
```

**`prompt_delivered`** - Confirms that a prompt was written to the PTY stdin:
```json
{
  "type": "prompt_delivered",
  "actionId": "<uuid>"
}
```

**`prompt_failed`** - Reports a delivery failure:
```json
{
  "type": "prompt_failed",
  "actionId": "<uuid>",
  "error": "reason"
}
```

**`session_ended`** - Sent when the AI tool process exits:
```json
{
  "type": "session_ended",
  "exitCode": 0
}
```

**`diagnostic`** - Debug information (logged but not acted on):
```json
{
  "type": "diagnostic",
  "actionId": "<uuid>",
  "detail": "..."
}
```

### Argus to Launcher

**`connected`** - Sent immediately after the WebSocket handshake succeeds:
```json
{ "type": "connected" }
```

**`send_prompt`** - Inject text into the AI tool's stdin:
```json
{
  "type": "send_prompt",
  "actionId": "<uuid>",
  "prompt": "text to send",
  "skipEnter": false
}
```
`skipEnter: true` sends the text without appending a newline (used for Ctrl+C).

**`send_choice_with_prompt`** - Deliver a numbered choice selection plus optional followup text:
```json
{
  "type": "send_choice_with_prompt",
  "actionId": "<uuid>",
  "choiceNumber": "1",
  "prompt": "additional instructions"
}
```

---

## Launcher Route Processing

**`register` message:**
1. Store `repoPath`.
2. `ensureRepository()` - auto-create the repo record if it does not already exist.
3. `ptyRegistry.registerPending()` - hold the WebSocket in the pending map.
4. On non-Windows (pid is known): call `tryLinkByPid()` to resolve `sessionId` from on-disk session files and pre-link in the registry.
5. Check `getSessionByPtyLaunchId()` for a server-restart scenario: if a session exists in the DB for this `ptyLaunchId` and its process is still alive, call `promotePendingToSession()`, restore `status = 'active'`, and broadcast `session.updated` with `ptyConnected = true`.

**`update_pid` message (Windows):**
1. Update the pending entry's `pid`.
2. Retry `tryLinkByPid()` now that the real tool PID is known.
3. If the session is already claimed, update `session.pid` in the DB and broadcast.

**`prompt_delivered` / `prompt_failed` messages:**
1. `ptyRegistry.handleAck(actionId, success, error)` resolves or rejects the pending Promise held by `sendPrompt()` or `sendChoiceWithPrompt()`.
2. The control action record is marked `'completed'` or `'failed'`.
3. Broadcast `action.updated` to the frontend.

**`session_ended` message:**
1. Find session via `getClaimedId()`.
2. Mark session `status = 'ended'` in the DB.
3. Broadcast `session.ended`.
4. Send telemetry.
5. Clean up `ptyRegistry`.

**WebSocket `close` event:**
- If session is claimed and process is still alive: broadcast `ptyConnected = false` (reconnecting).
- If session is claimed and process is dead: mark session ended.
- If session is never claimed (still pending): remove from `pendingByLaunchId`.

---

## Prompt Delivery

`PtyRegistry.sendPrompt()` writes to the launcher WebSocket and waits for acknowledgment:

```typescript
sendPrompt(sessionId, actionId, prompt, timeoutMs = 30_000, skipEnter = false)

// Internally:
new Promise((resolve, reject) => {
  timeout = setTimeout(() => {
    pending.delete(actionId);
    reject(new Error(`Prompt delivery timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  pending.set(actionId, { resolve, reject, timeout });
  ws.send(JSON.stringify({ type: 'send_prompt', actionId, prompt, skipEnter }));
})
```

`handleAck()` resolves the promise on `prompt_delivered` and rejects it on `prompt_failed`. Unresolved promises are automatically rejected after 30 seconds.

---

## Session Control Actions

All control actions go through `SessionController` and are persisted as `ControlAction` records so the frontend can track their status.

**`stopSession(sessionId)`**

1. Validate session exists and is not already ended.
2. Validate PID ownership (must be a Claude/Copilot process, not an unrelated process).
3. Create a pending `ControlAction`.
4. Kill the process via a system signal.
5. Mark the action completed or failed.
6. Send telemetry.

**`sendPrompt(sessionId, prompt, skipEnter)`**

1. Validate session is not ended.
2. Require `launchMode = 'pty'` and an active `ptyRegistry` entry.
3. Create a pending `ControlAction`.
4. `ptyRegistry.sendPrompt()` - blocks until delivered or timed out.
5. Mark action completed or failed; broadcast `action.updated`.

**`sendChoiceWithPrompt(sessionId, choiceNumber, prompt)`**

Same flow as `sendPrompt`, using `ptyRegistry.sendChoiceWithPrompt()`. Used when the AI tool is waiting on an `AskUserQuestion` / `ask_user` response.

**`interruptSession(sessionId)`**

1. `sendPrompt()` with `prompt = '\x03'` and `skipEnter = true` (Ctrl+C).
2. Clear any pending choice from the detector.
3. Broadcast `session.pending_choice.resolved`.

**`dismissSession(sessionId)`**

Marks the session `status = 'ended'` without sending any signal to the process. Used when the session is read-only (no PTY) or when the process has already exited but the session was not cleaned up.

---

## REST Endpoints

All endpoints are under `POST /api/v1/sessions/{id}/`:

| Endpoint | Action |
|---|---|
| `/stop` | Kill the process |
| `/interrupt` | Send Ctrl+C (clears pending choice) |
| `/send` | Send a prompt (auto-routes to choice if one is pending) |
| `/send-with-choice` | Send a numbered choice + optional prompt |
| `/reject-tool` | Ctrl+C and clear pending choice |
| `/dismiss` | Mark ended without killing |

---

## Server Restart Reconnect

If Argus restarts while a PTY session is still running, the launcher re-connects via a new WebSocket and sends `register` again with the same `ptyLaunchId`.

On the `register` handler:
1. `getSessionByPtyLaunchId(ptyLaunchId)` finds the existing DB session.
2. If the process is still alive (checked via `hostPid` or `pid`): `promotePendingToSession()` upgrades the pending entry to a claimed connection.
3. Session `status` is restored to `'active'` if it was previously set to `'ended'` by the disconnect.
4. `session.updated` is broadcast with `ptyConnected = true`.

Prompt delivery resumes immediately with no manual intervention needed.

---

## Windows Considerations

On Windows, the AI tool spawns inside a PowerShell process tree. The PID reported by the launcher at `register` time is the `hostPid` (the shell). The real tool process PID is discovered asynchronously by walking the child process tree, then sent via `update_pid`.

Until `update_pid` arrives, Argus uses `hostPid` for liveness checks. Once `update_pid` is received, `session.pid` is updated to the tool PID and `session.hostPid` retains the shell PID. The `yoloMode` flag is set to `true` when `hostPid !== pid`, indicating that a shell wrapper is in use.

---

## PTY vs. Detected Sessions

| | PTY session (`launchMode = 'pty'`) | Detected session (`launchMode = null`) |
|---|---|---|
| How started | `argus launch` | User ran CLI directly |
| Prompt injection | Supported | Not supported |
| Choice delivery | Supported | Not supported |
| Stop | Kill via system signal | Kill via system signal |
| Interrupt | Ctrl+C via PTY | Not supported |
| Reconnect after restart | Automatic | N/A |

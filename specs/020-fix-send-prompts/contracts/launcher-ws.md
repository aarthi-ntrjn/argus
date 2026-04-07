# Contract: /launcher WebSocket

**Endpoint**: `ws://127.0.0.1:7411/launcher`  
**Purpose**: Bidirectional control channel between `argus launch` process and Argus backend

## Message Contract

All messages are JSON. No binary frames.

### Launcher → Backend

#### register
Sent immediately on connect.

```json
{
  "type": "register",
  "sessionId": "string (UUID)",
  "pid": "number",
  "sessionType": "claude-code | copilot-cli",
  "cwd": "string (absolute path)"
}
```

**Backend response**: Creates/upserts session with `launchMode: 'pty'`, broadcasts `session.created`.

#### prompt_delivered
Sent after successfully writing prompt to PTY.

```json
{
  "type": "prompt_delivered",
  "actionId": "string (UUID)"
}
```

#### prompt_failed
Sent when PTY write fails.

```json
{
  "type": "prompt_failed",
  "actionId": "string (UUID)",
  "error": "string (human-readable)"
}
```

#### session_ended
Sent when the tool process exits.

```json
{
  "type": "session_ended",
  "sessionId": "string (UUID)",
  "exitCode": "number | null"
}
```

### Backend → Launcher

#### send_prompt
Instructs launcher to write prompt to PTY stdin.

```json
{
  "type": "send_prompt",
  "actionId": "string (UUID)",
  "prompt": "string"
}
```

Launcher MUST respond with either `prompt_delivered` or `prompt_failed`.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Launcher connects but sessionId already has a live connection | Backend closes the old connection, accepts new |
| Backend receives `send_prompt` request but launcher is not connected | `sendPrompt()` returns `failed` action immediately |
| Launcher sends malformed JSON | Backend logs warning, closes connection |
| No `prompt_delivered`/`prompt_failed` ack within 10s | Backend marks action as `failed` with `DELIVERY_TIMEOUT` |
| Launcher disconnects without `session_ended` | Backend marks session as `ended` after disconnect |

## Session API change: GET /api/v1/sessions

The `Session` response now includes `launchMode`:

```json
{
  "id": "string",
  "repositoryId": "string",
  "type": "claude-code | copilot-cli",
  "launchMode": "pty | detected | null",
  "pid": "number | null",
  "status": "active | idle | ...",
  "startedAt": "ISO8601",
  "endedAt": "ISO8601 | null",
  "lastActivityAt": "ISO8601",
  "summary": "string | null",
  "expiresAt": "ISO8601 | null",
  "model": "string | null"
}
```

### Test Cases

| Scenario | Expected |
|----------|----------|
| GET /sessions — PTY session | `launchMode: "pty"` in response |
| GET /sessions — hook-detected session | `launchMode: "detected"` or `null` |
| POST /sessions/:id/send — PTY session, launcher connected | 202, action `completed` |
| POST /sessions/:id/send — PTY session, launcher disconnected | 202, action `failed`, message "Session is not connected" |
| POST /sessions/:id/send — detected session | 202, action `failed`, message "Prompt delivery requires starting this session via argus launch" |
| POST /sessions/:id/send — Copilot CLI, PTY session | 202, action `completed` |

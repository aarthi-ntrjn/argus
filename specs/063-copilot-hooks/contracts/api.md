# API Contracts: Copilot CLI Hooks Integration

## New Endpoints

---

### POST /hooks/copilot

Receives Copilot CLI hook payloads forwarded from the injected shell command via stdin.

**Authentication**: None (bound to `127.0.0.1` only; local network isolation per §VI exception).

**Body size limit**: 64 KB (same as `/hooks/claude`).

#### Query Parameters

| Param | Required | Values | Notes |
|---|---|---|---|
| `event` | Yes | `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse` | The hook event that fired. Set by the injected command URL. |

#### Request Body

Raw Copilot CLI hook payload forwarded from stdin. JSON object. Fields vary by event (see data-model.md `CopilotHookPayload`).

**Example — preToolUse:**
```json
{
  "timestamp": 1704614600000,
  "cwd": "/path/to/project",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "toolName": "ask_user",
  "toolArgs": "{\"question\":\"Which approach do you prefer?\",\"choices\":[\"Option A\",\"Option B\"]}"
}
```

**Example — sessionStart:**
```json
{
  "timestamp": 1704614400000,
  "cwd": "/path/to/project",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "new",
  "initialPrompt": "Help me refactor this module"
}
```

**Example — sessionEnd:**
```json
{
  "timestamp": 1704618000000,
  "cwd": "/path/to/project",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "complete"
}
```

#### Validation

| Check | Condition | Response |
|---|---|---|
| Missing/invalid `event` param | `event` absent or not one of the four values | 400 `INVALID_HOOK_EVENT` |
| Missing/invalid `sessionId` | `sessionId` absent **and** `cwd` absent or matches no registered repo | 400 `INVALID_SESSION_ID` |
| `sessionId` not UUID v4 (when present) | `sessionId` present but fails UUID v4 regex | 400 `INVALID_SESSION_ID` |
| Body too large | Body > 64 KB | 413 |

**Note**: If `sessionId` is absent but `cwd` matches a registered repository, the request is accepted and a provisional session is created using a generated UUID. This handles the case where `sessionId` is not present in some Copilot versions.

#### Responses

**200 OK — payload accepted and processed:**
```json
{ "ok": true }
```

**400 Bad Request — invalid event parameter:**
```json
{
  "error": "INVALID_HOOK_EVENT",
  "message": "event query parameter must be one of: sessionStart, sessionEnd, preToolUse, postToolUse",
  "requestId": "uuid"
}
```

**400 Bad Request — invalid or missing session identifier:**
```json
{
  "error": "INVALID_SESSION_ID",
  "message": "sessionId must be a valid UUID v4, or cwd must match a registered repository",
  "requestId": "uuid"
}
```

**413 Request Entity Too Large:**
Standard Fastify 413 response.

#### Processing Behavior

The endpoint normalizes the Copilot payload to `NormalizedHookPayload` (see data-model.md) and calls `CopilotCliDetector.handleHookPayload()`:

| Event | Action |
|---|---|
| `sessionStart` | Create provisional session if unknown; update `lastActivityAt` if known. Start JSONL watcher. |
| `sessionEnd` | Mark session as `ended` immediately. Close JSONL watcher. |
| `preToolUse` (toolName: `ask_user`) | Broadcast `session.pending_choice` via WebSocket + `pendingChoiceEvents` bus. |
| `preToolUse` (other tools) | Update `lastActivityAt`. No pending choice. |
| `postToolUse` (toolName: `ask_user`) | Broadcast `session.pending_choice.resolved` via WebSocket + `pendingChoiceEvents` bus. |
| `postToolUse` (other tools) | Update `lastActivityAt`. |

**Silent discard conditions** (returns 200 without error):
- `cwd` maps to no registered repository
- `sessionEnd` for a session not in DB

---

## Modified Endpoints

### POST /hooks/claude (unchanged contract)

No changes to the existing `/hooks/claude` endpoint contract. The new `/hooks/copilot` endpoint is additive.

---

## WebSocket Events (existing, triggered by new endpoint)

These events are emitted by the new Copilot hook path using the same types already emitted by the Claude Code hook path:

| Event type | Trigger |
|---|---|
| `session.created` | `sessionStart` hook or any hook for unknown session (provisional session creation) |
| `session.updated` | Any hook for known active session |
| `session.ended` | `sessionEnd` hook |
| `session.pending_choice` | `preToolUse` for `ask_user` |
| `session.pending_choice.resolved` | `postToolUse` for `ask_user` |

---

## Injected Hook Commands

These are the command strings written to `.github/hooks/hooks.json` for each registered repository. PORT is substituted at injection time.

### Bash (Linux/macOS)
```bash
curl -sf -X POST 'http://127.0.0.1:PORT/hooks/copilot?event=EVENT' -H "Content-Type: application/json" -d @- 2>/dev/null || true
```

### PowerShell (Windows)
```powershell
$input | Invoke-RestMethod -Uri 'http://127.0.0.1:PORT/hooks/copilot?event=EVENT' -Method POST -ContentType 'application/json' -ErrorAction SilentlyContinue
```

**Note**: `|| true` / `-ErrorAction SilentlyContinue` ensures Copilot is never blocked if Argus is not running (FR-004, Story 4 acceptance scenario 3).

---

## Modified Service Interfaces

### CopilotCliDetector (extended)

New method added to the existing class:

```typescript
handleHookPayload(payload: NormalizedHookPayload): Promise<void>
```

**Behavior**: Mirrors `ClaudeCodeDetector.handleHookPayload()` but creates `copilot-cli` type sessions.

### CopilotHooksInjector (new)

```typescript
class CopilotHooksInjector {
  injectForRepo(repoPath: string): void    // Called on repository add
  removeForRepo(repoPath: string): void   // Called on repository delete
  injectForAll(): void                    // Called on server startup
}
```

**Failure contract**: Each method catches all errors, logs a `warn` with repo path and reason, and returns normally. Never throws.

### pending-choice-utils.ts (new)

```typescript
function parsePendingChoicePayload(
  toolInput: Record<string, unknown>
): { question: string; choices: string[]; allQuestions: PendingChoiceItem[] }
```

**Input**: The `tool_input` object from a `NormalizedHookPayload` (already parsed from `toolArgs` JSON string for Copilot).
**Output**: Normalized question/choices structure ready for broadcast.
**Behavior**: Pure function, no side effects. Handles both multi-question format (Claude Code) and flat format (`{ question, choices }` used by Copilot / `ask_user`).

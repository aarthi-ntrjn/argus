# Data Model: Copilot CLI Hooks Integration

## Entities

---

### CopilotHookPayload

The raw JSON object received from Copilot CLI via stdin when a hook fires. Field names are confirmed from official GitHub Docs and community implementations.

**Source**: `POST /hooks/copilot?event={eventName}` request body

| Field | Type | Present in | Notes |
|---|---|---|---|
| `timestamp` | `number` | All events | Unix milliseconds |
| `cwd` | `string` | All events | Working directory of the Copilot session |
| `sessionId` | `string?` | Likely all events | Copilot session UUID (camelCase; present in community code, undocumented officially) |
| `source` | `string?` | `sessionStart` | `"new"`, `"resume"`, or `"startup"` |
| `initialPrompt` | `string?` | `sessionStart` | User's initial prompt text |
| `reason` | `string?` | `sessionEnd` | `"complete"`, `"error"`, `"abort"`, `"timeout"`, `"user_exit"` |
| `prompt` | `string?` | `userPromptSubmitted` | User's prompt text |
| `toolName` | `string?` | `preToolUse`, `postToolUse` | camelCase tool name (e.g., `"bash"`, `"ask_user"`) |
| `toolArgs` | `string?` | `preToolUse`, `postToolUse` | JSON-encoded **string** of tool arguments (must be `JSON.parse()`d) |
| `toolResult` | `object?` | `postToolUse` | `{ resultType: string, textResultForLlm: string }` |

---

### NormalizedHookPayload

The shared interface used by `CopilotCliDetector.handleHookPayload()` after endpoint-level normalization. Matches the existing `HookPayload` interface in `hooks.ts`.

The `POST /hooks/copilot` endpoint maps from `CopilotHookPayload` to this shape:

| Normalized field | Source | Transformation |
|---|---|---|
| `hook_event_name` | `?event` query param | Read from URL; normalize `sessionStart` → `SessionStart` etc. (PascalCase to match Claude Code convention) |
| `session_id` | `payload.sessionId` | Rename camelCase → snake_case |
| `cwd` | `payload.cwd` | Direct copy |
| `tool_name` | `payload.toolName` | Rename camelCase → snake_case |
| `tool_input` | `payload.toolArgs` | `JSON.parse(payload.toolArgs)` if present; default `{}` |
| `tool_result` | `payload.toolResult` | Direct copy if present |

---

### HooksJson

The structure of `.github/hooks/hooks.json` (or any `.json` file in `.github/hooks/`) as read and written by `CopilotHooksInjector`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | `number` | Yes | Must be `1`. Argus writes `1`; preserved from existing file if already present. |
| `hooks` | `Record<string, HookEntry[]>` | Yes | Map of event name to array of hook command entries. Keys: `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`. |

---

### HookEntry

A single command entry in a `hooks.json` event array. Confirmed from official GitHub Docs.

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `string` | Yes | Must be `"command"` |
| `bash` | `string?` | Required on Unix | Shell command for Linux/macOS |
| `powershell` | `string?` | Required on Windows | PowerShell command for Windows |
| `cwd` | `string?` | No | Working dir relative to repo root |
| `env` | `Record<string, string>?` | No | Environment variable overrides |
| `timeoutSec` | `number?` | No | Default: 30 seconds |

**Argus-owned identification**: An entry is Argus-owned if either `bash` or `powershell` contains the pattern `/hooks/copilot`. Used for safe removal (FR-012) and stale-entry cleanup (FR-003).

---

### ArgusHookEntry

The specific `HookEntry` values written by Argus. One per injected event.

| Field | Value |
|---|---|
| `type` | `"command"` |
| `bash` | `curl -sf -X POST 'http://127.0.0.1:{PORT}/hooks/copilot?event={EVENT}' -H "Content-Type: application/json" -d @- 2>/dev/null || true` |
| `powershell` | `$input \| Invoke-RestMethod -Uri 'http://127.0.0.1:{PORT}/hooks/copilot?event={EVENT}' -Method POST -ContentType 'application/json' -ErrorAction SilentlyContinue` |

**Substitutions**: `{PORT}` = `config.port` (default `7411`); `{EVENT}` = event name (e.g., `sessionStart`).

---

### ParsedPendingChoice

The normalized structure extracted from `tool_input` by `parsePendingChoicePayload()` in `pending-choice-utils.ts`. Shared by both `ClaudeCodeDetector` and `CopilotCliDetector`.

| Field | Type | Notes |
|---|---|---|
| `question` | `string` | Primary question text |
| `choices` | `string[]` | Array of choice strings |
| `allQuestions` | `PendingChoiceItem[]` | All questions (minimum 1 item) |

---

## State Transitions

### Session lifecycle via hooks (Copilot)

```
                   sessionStart hook OR any hook for unknown sessionId
                   ────────────────────────────────────────────────────►
[no session]  →  [provisional active, pid=null, reconciled=false]
                                    │
                                    │ next polling scan (lock file found)
                                    ▼
                            [active, pid filled, reconciled=true]
                                    │
                                    │ sessionEnd hook (immediate)
                                    │ OR polling detects lock file absent
                                    ▼
                                 [ended]
```

- **Provisional active**: Created immediately when a hook fires for an unknown session ID (FR-009). `pid`, `hostPid` are `null`. `reconciled = false`.
- **Active + reconciled**: Next polling scan fills PID from lock file, sets `reconciled = true`.
- **Ended**: `sessionEnd` hook marks immediately (FR-010); polling also detects via lock file absence.

---

## Relationships

- `CopilotHooksInjector` reads `getRepositories()` (DB) and writes to `<repo>/.github/hooks/hooks.json` (filesystem)
- `CopilotCliDetector.handleHookPayload()` reads `getSession()` / `getRepositoryByPath()` (DB) and writes via `upsertSession()` / `updateSessionStatus()` (DB)
- `CopilotHooksInjector` is triggered from `repositories.ts` (add/delete) and `session-monitor.ts` (startup), parallel to `ClaudeCodeDetector.injectHooks()` / `removeAllHooks()`
- `pending-choice-utils.ts` is a pure utility with no DB or network dependencies
- `pendingChoiceEvents` (existing EventEmitter) is the shared bus between detectors and notification integrations (Teams, Slack)


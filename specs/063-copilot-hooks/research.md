# Research: Copilot CLI Hooks Integration

**Sources**: Official GitHub Docs (https://docs.github.com/en/copilot/reference/hooks-configuration), VS Code internal spec (microsoft/vscode), community implementation (erha19/ping-island).

## Phase 0 Decisions

---

### Decision 1: Copilot hooks.json schema — confirmed

**Decision**: `hooks.json` lives at `<repo>/.github/hooks/*.json` (any `.json` filename in that directory). The file has `version: 1` at the top level, and a `hooks` object keyed by camelCase event name. Each entry is an array of command objects. Each command object has `type: "command"` (required), `bash` (Unix shell command), `powershell` (Windows command), and optional `cwd`, `env`, `timeoutSec`.

**Confirmed schema** (from official GitHub Docs):

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "bash": "curl -sf -X POST 'http://127.0.0.1:7411/hooks/copilot?event=sessionStart' -H \"Content-Type: application/json\" -d @- 2>/dev/null || true",
        "powershell": "$input | Invoke-RestMethod -Uri 'http://127.0.0.1:7411/hooks/copilot?event=sessionStart' -Method POST -ContentType 'application/json' -ErrorAction SilentlyContinue"
      }
    ]
  }
}
```

**Note**: The `type: "command"` field is required in every entry (not present in Claude Code's settings.json format).

**Rationale**: Official docs confirm `bash`/`powershell` field structure directly matching FR-014. The `type: "command"` field is always written.

**Alternatives considered**: Internal VS Code spec shows an older `command`/`args`/`timeout` schema — this was rejected in favor of the official public schema which is what the Copilot CLI runtime uses.

---

### Decision 2: No `hook_event_name` in Copilot payload — use query parameter for event type

**Decision**: Copilot CLI does NOT include an event-type field in the stdin payload. The event type is implicit from which hook fired. Argus solves this by injecting different URL query parameters per event: `?event=sessionStart`, `?event=sessionEnd`, `?event=preToolUse`, `?event=postToolUse`. The endpoint reads `?event` as the hook event name.

**Confirmed payload fields** (from official GitHub Docs):

| Event | Payload fields |
|---|---|
| `sessionStart` | `timestamp` (ms), `cwd`, `source` (`"new"/"resume"/"startup"`), `initialPrompt` |
| `sessionEnd` | `timestamp`, `cwd`, `reason` (`"complete"/"error"/"abort"/"timeout"/"user_exit"`) |
| `preToolUse` | `timestamp`, `cwd`, `toolName` (camelCase), `toolArgs` (JSON-encoded **string**) |
| `postToolUse` | `timestamp`, `cwd`, `toolName`, `toolArgs`, `toolResult.resultType`, `toolResult.textResultForLlm` |

**Key divergences from Claude Code**:
- `tool_input` (object) → `toolArgs` (JSON-encoded **string** — must be `JSON.parse()`d)
- `tool_name` (snake_case) → `toolName` (camelCase)
- `hook_event_name` in payload → **absent** (use `?event` query param instead)
- `session_id` → `sessionId` (camelCase, present in community code, undocumented officially)

**Normalization strategy**: The endpoint reads `?event` and injects it as `hook_event_name` before passing the normalized payload to `CopilotCliDetector.handleHookPayload()`. It also renames `toolName` → `tool_name` and JSON-parses `toolArgs` → `tool_input`. This isolates all field-name differences to a single mapping layer at the endpoint.

**Rationale**: A query parameter is cleaner than multiple endpoint paths — it keeps Argus-owned entries identifiable by the single URL pattern `*/hooks/copilot` (per spec clarification in FR-003), while still communicating the event type.

**Alternatives considered**: Separate endpoint paths per event (e.g., `/hooks/copilot/session-start`) — rejected because the spec's identification pattern `*/hooks/copilot` maps more cleanly to a single base path with query params. Merging event type into injected command as JSON manipulation (e.g., `jq`) — rejected as fragile and adds a hard dependency on `jq`.

---

### Decision 3: `sessionId` — handle as optional, fall back to cwd lookup

**Decision**: `sessionId` (camelCase) appears in community implementations of Copilot hook payload handling but is absent from official documentation. The endpoint handles it opportunistically: if present, use it as the session ID. If absent, attempt to find an active session for the `cwd` by matching against registered repositories.

**Rationale**: Community code (erha19/ping-island Swift mapper) explicitly handles `sessionId` from Copilot payloads, strongly suggesting it is present in real payloads but simply undocumented. Using it when available gives precise session matching; the `cwd` fallback handles the edge case.

**Alternatives considered**: Requiring `sessionId` and rejecting payloads without it — rejected because it would break if the field is indeed absent in some events or Copilot versions; treating `cwd` as the only identifier — rejected because it cannot distinguish two simultaneous sessions in the same repo.

---

### Decision 4: ask_user tool name — match existing JSONL detection

**Decision**: The Copilot hook handler checks `toolName === 'ask_user'` for pending choice detection, matching the tool name already used by `CopilotJsonlWatcher`. There is no Copilot-native documented "ask user" tool, but the JSONL watcher's existing `ask_user` detection is evidence the name is correct for the runtime in use.

**Rationale**: The `CopilotJsonlWatcher` already successfully detects `ask_user` via JSONL. If Copilot fires `preToolUse` for `ask_user`, the hook path should handle the same tool name. This avoids introducing a divergence.

**Pre-existing gap noted**: The official Copilot preToolUse payload examples only show system tools like `bash`, `edit`, `view`. There is no confirmed Copilot-native ask-user tool in the public docs. The hook-based pending choice detection is best-effort and degrades gracefully (hooks accelerate JSONL detection, they do not replace it per FR-015).

**Alternatives considered**: Hardcoding a set of question tool names — deferred to implementation; the hook handler can be extended once the exact tool name is confirmed in a live environment.

---

### Decision 5: CopilotHooksInjector as standalone service

**Decision**: `CopilotHooksInjector` is a separate class from `CopilotCliDetector`, instantiated as a module-level singleton.

**Rationale**: Injection concerns (file I/O to `hooks.json`, repository iteration) are distinct from detection concerns (scanning session dirs, handling lock files). Each is testable in isolation (§I). The repositories route triggers injection without importing the full detector.

**Alternatives considered**: Merging injection into `CopilotCliDetector` — rejected (existing scope is already large; cross-concern imports make unit testing harder).

---

### Decision 6: Shared pending choice utility

**Decision**: `parsePendingChoicePayload(toolInput)` is extracted to `backend/src/services/pending-choice-utils.ts`. Both `ClaudeCodeDetector` and `CopilotCliDetector` import and call it. Broadcasting (`pendingChoiceEvents.emit`, `broadcast()`) stays in each detector.

**Rationale**: FR-011 prohibits duplicate broadcasting logic. A shared utility satisfies this without creating a cross-dependency between detectors.

**Alternatives considered**: Delegating from `CopilotCliDetector` to `ClaudeCodeDetector.handlePreAskQuestion()` — rejected (cross-detector dependency, session type would be wrong in logs).

---

### Decision 7: Port in injected commands — read from config at injection time

**Decision**: The hook command URL uses the port from `loadConfig().port` at injection time (default `7411`). The existing Claude Code command is also hardcoded to `7411`; this feature reads the config value so custom ports (via `ARGUS_PORT`) are correctly reflected.

**Alternatives considered**: Always hardcoding `7411` — rejected (breaks custom port configurations).

---

### Decision 8: Copilot pending_choice via JSONL vs. hooks — no change to JSONL watcher

**Decision**: The hook handler emits via both `broadcast()` and `pendingChoiceEvents.emit()`. The existing `CopilotJsonlWatcher` continues to emit via `broadcast()` only. No change to the JSONL watcher in this feature.

**Pre-existing gap noted**: `CopilotJsonlWatcher` does not emit on `pendingChoiceEvents`, so Teams/Slack integrations miss Copilot pending choices via the JSONL fallback. This is a pre-existing gap and is out of scope here.

**Rationale**: Scope discipline per CLAUDE.md — only modify code directly required by this feature.

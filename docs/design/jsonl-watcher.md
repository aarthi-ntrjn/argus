# JSONL Watcher

## Overview

The JSONL watcher system reads per-session output files produced by Claude Code and Copilot CLI in real time. As each AI tool appends new lines to its log file, the watcher parses them into structured `SessionOutput` rows, persists them to the database, and emits live updates to the frontend. It also drives secondary signals: session activity timestamps, model detection, summary extraction, and pending-choice detection from tool invocations embedded in the log.

## Key Components

| Component | File | Role |
|---|---|---|
| `JsonlWatcherBase` | `cli/jsonl-watcher-base.ts` | Abstract base: file monitoring, line reading, output storage |
| `ClaudeCodeJsonlWatcher` | `cli/claude-code/claude-code-jsonl-watcher.ts` | Claude path resolution and pending-choice tracking |
| `CopilotCliJsonlWatcher` | `cli/copilot-cli/copilot-cli-jsonl-watcher.ts` | Copilot path resolution and pending-choice detection |
| `ClaudeCodeJsonlParser` | `cli/claude-code/claude-code-jsonl-parser.ts` | Parses Claude JSONL entries into `SessionOutput[]` |
| `CopilotCliJsonlParser` | `cli/copilot-cli/copilot-cli-jsonl-parser.ts` | Parses Copilot JSONL entries into `SessionOutput[]` |
| `OutputStore` | `db/output-store.ts` | Persists `SessionOutput` rows, manages pagination |

---

## File Locations

| Tool | JSONL path |
|---|---|
| Claude Code | `~/.claude/projects/<repo-dir-name>/<sessionId>.jsonl` |
| Copilot CLI | `~/.copilot/session-state/<sessionId>/events.jsonl` |

Watchers are attached when a session is first discovered (scan cycle or hook) and closed when the session ends.

---

## Watcher Lifecycle

```
watchFile(sessionId, path)
  └─ attachWatcher(sessionId, filePath)
      ├─ Stat the file to get current size
      ├─ Seek to max(0, size - TAIL_BYTES)   ← tail-only, never re-read full history
      ├─ Initialize sequenceCounter from DB max + 1
      ├─ readNewLines() once (catch up since seek point)
      └─ chokidar.watch() on 'change' event
             └─ readNewLines() on every change

closeWatcher(sessionId)
  └─ chokidar instance destroyed, maps cleared
```

`TAIL_BYTES` is 16 KB. Reading from the tail means the watcher never scans the entire file on startup, regardless of how long the session has been running. This keeps the scan cycle fast when a watcher is attached mid-session.

---

## Line Reading Pipeline

Every `chokidar` `change` event triggers `readNewLines()`:

```
readNewLines(sessionId, filePath)
  ├─ stat file → currentSize
  ├─ if currentSize ≤ lastPos: return (no growth)
  ├─ Read bytes [lastPos, currentSize)
  ├─ Split on newline, track byteOffset per line
  ├─ For each non-empty line:
  │   ├─ Increment sequenceNumber
  │   ├─ parseLine() → SessionOutput[]
  │   ├─ Record model name if present in line
  │   └─ Accumulate outputs
  ├─ insertOutput(sessionId, outputs)
  ├─ If any outputs produced:
  │   ├─ applyActivityUpdate()     update session.lastActivityAt
  │   ├─ onNewOutputs()            detector-specific hook (see below)
  │   ├─ applyModelUpdate()        update session.model
  │   └─ applySummaryUpdate()      extract session.summary from first user message
  └─ filePositions[sessionId] = currentSize
```

`lastPos` is maintained per session in `filePositions`. It advances only forward; file truncation is not supported (the tools do not truncate their logs).

---

## Output ID Generation

Each `SessionOutput` gets a stable, deterministic ID:

```
<sessionId>-<byteOffset>-<blockIndex>
```

- **`byteOffset`**: byte position of the line in the file. Same line always produces the same offset.
- **`blockIndex`**: index within a single line that produces multiple outputs (e.g., a Claude assistant entry with several content blocks).

This scheme ensures idempotency: inserting the same JSONL line twice produces the same IDs and does not create duplicates.

---

## Sequence Numbers

A per-session `sequenceCounter` is initialized from the database maximum on watcher attach:

```
initialSequence = getMaxSequenceNumber(sessionId) + 1
```

Every line read increments the counter. Sequence numbers are stored with each `SessionOutput` and used for pagination in the output stream API.

---

## JSONL Formats

### Claude Code

Each line is a JSON object:

```json
{
  "type": "user" | "assistant" | "file-history-snapshot",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": {
    "role": "user" | "assistant",
    "model": "claude-opus-4-7",
    "content": "string or content block array"
  },
  "isMeta": false
}
```

Content block array members:

```json
{ "type": "text", "text": "..." }
{ "type": "tool_use", "id": "...", "name": "...", "input": {} }
{ "type": "tool_result", "tool_use_id": "...", "content": "..." }
```

Parsed into `SessionOutput` types:
- `"message"` for text blocks
- `"tool_use"` for tool invocations
- `"tool_result"` for tool results

`file-history-snapshot` lines are skipped. `isMeta: true` lines are included but marked accordingly.

### Copilot CLI

Each line is an event object:

```json
{
  "type": "assistant.message" | "tool.execution_start" | "tool.execution_complete" | ...,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "content": "string or block array",
    "model": "copilot-gpt-4",
    "arguments": {},
    "result": { "content": "...", "detailedContent": "..." }
  }
}
```

Event-to-output-type mapping:

| Event type | OutputType |
|---|---|
| `assistant.message` | `message` |
| `tool.execution_start` | `tool_use` |
| `tool.execution_complete` | `tool_result` |

Content is extracted from nested locations depending on the event type. Unknown event types produce no output rows.

---

## Model Detection

`parseModelFromLine()` inspects every line for a model name:

- Claude: reads `message.model` on assistant entries
- Copilot: reads top-level `model` or `data.model`

The first model name found is stored to `session.model` via `applyModelUpdate()`. Once set, subsequent scan cycles do not re-extract it.

---

## Summary Extraction

`applySummaryUpdate()` runs whenever new outputs are produced. It takes the content of the first user-role message in the batch, truncates it to approximately 100 characters, and stores it as `session.summary` if none is set yet. This gives the session list a meaningful display label without requiring a separate pass over the data.

---

## Pending Choice Detection (JSONL-level)

Pending choice is primarily signaled by HTTP hooks (`PreToolUse` / `PostToolUse`). The JSONL watcher provides a secondary, belt-and-suspenders path by watching the output file directly. This catches cases where the hook fires but the signal is lost (network error, restart) or where Copilot does not use hooks for choice delivery.

### Claude Code (`ClaudeCodeJsonlWatcher.onNewOutputs`)

```
For each output in batch:
  If type='tool_use' and toolName='AskUserQuestion':
    Store toolCallId in pendingAskUserCallIds

  If type='tool_result' and toolCallId in pendingAskUserCallIds:
    Clear toolCallId from map
    Broadcast session.pending_choice.resolved

  If type='message' and content contains interrupt sentinel:
    '[Request interrupted by user for tool use]'
    Broadcast session.pending_choice.resolved
```

The interrupt sentinel handles the case where the user sends Ctrl+C to cancel the pending question: Claude appends a sentinel message, and the watcher broadcasts resolved so the frontend dismisses the banner.

### Copilot CLI (`CopilotCliJsonlWatcher.onNewOutputs`)

```
For each output in batch:
  If type='tool_use' and toolName='ask_user':
    Extract question and choices from content (JSON parse if string)
    Store toolCallId in pendingAskUserCallIds
    Broadcast session.pending_choice with question/choices

  If type='tool_result' and toolCallId in pendingAskUserCallIds:
    Clear toolCallId from map
    Broadcast session.pending_choice.resolved
```

For Copilot, the JSONL watcher is the primary source of pending-choice broadcasts (not just a fallback), because Copilot hooks may not carry full choice payload data.

---

## Output Persistence and Streaming

`OutputStore.insertOutput()` persists `SessionOutput[]` rows in a single batch insert. The frontend polls or subscribes (via WebSocket `session.output.batch` events) to receive new outputs as they arrive.

Pagination uses sequence numbers: clients request outputs with `sequenceAfter` to receive only rows appended after their last known position.

---

## Performance Constraints

The JSONL watcher is called on every `chokidar` `change` event, which can fire multiple times per second during active sessions. The design must stay lightweight:

- **Tail seek on attach:** Never read from byte 0 when attaching mid-session.
- **Incremental reads:** Only bytes since `lastPos` are read; no full-file reads on change.
- **No extra stat calls:** File size is obtained once at the top of `readNewLines` and reused.
- **No sequential per-session loops inside `readNewLines`:** Each invocation is scoped to a single session.

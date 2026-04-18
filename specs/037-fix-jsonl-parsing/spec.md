# Feature Specification: Fix JSONL Parsing Logic Differences Between Claude and Copilot

**Feature Branch**: `037-fix-jsonl-parsing`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "i want to work on a branch to fix the jsonl parsing logic differences between claude and copilot"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Message Display (Priority: P1)

As a developer monitoring both Claude Code and GitHub Copilot sessions in Argus, I want all session messages (user messages, assistant responses, and tool activity) to appear correctly and completely in the session output panel, regardless of which agent type produced them.

Currently, Claude Code sessions and Copilot sessions use different JSONL event formats, and small parsing differences can cause messages to be missing, truncated, or wrongly structured for one session type but not the other.

**Why this priority**: Correct message display is the core value of Argus. If session output is missing or malformed for either agent type, the tool is unreliable for monitoring real work.

**Independent Test**: Start a Claude Code session and a Copilot session side by side. Send a message, trigger a tool call, and observe the output panel for both. Both should show the same categories of information (user message, assistant reply, tool name, tool result) in a similarly structured way.

**Acceptance Scenarios**:

1. **Given** a Claude Code session with a multi-block assistant response (text + tool_use + tool_result), **When** Argus parses the JSONL, **Then** each block is represented as a distinct output entry with the correct role and content.
2. **Given** a Copilot session with an `assistant.message` event containing a content-block array, **When** Argus parses the JSONL, **Then** all text content is captured and no block is silently dropped.
3. **Given** a Copilot session with a `tool.execution_start` event, **When** Argus parses the JSONL, **Then** the tool name and arguments are surfaced as a tool_use entry (not a raw JSON dump).
4. **Given** a Copilot session with a `tool.execution_complete` event, **When** Argus parses the JSONL, **Then** the tool result content is surfaced as a tool_result entry.
5. **Given** a Claude Code session with a `file-history-snapshot` entry, **When** Argus parses the JSONL, **Then** the entry is silently skipped and no spurious output appears.

---

### User Story 2 - Consistent Model Detection (Priority: P1)

As a developer viewing session cards or the session detail panel, I want to see the AI model name (e.g., `claude-opus-4-5`, `gpt-4o`) displayed for both Claude Code and Copilot sessions, so I know which model handled each session.

**Why this priority**: Model detection is broken or unreliable on at least one parser path. This is observable information that users rely on to understand their sessions.

**Independent Test**: Start a new session for each agent type, let it produce at least one assistant response, and confirm the session card shows a non-empty model name within one scan cycle.

**Acceptance Scenarios**:

1. **Given** a Claude Code session whose JSONL contains an assistant entry with a `message.model` field, **When** Argus parses the entry, **Then** the session record is updated with the correct model name.
2. **Given** a Copilot session whose `events.jsonl` contains an `assistant.message` event with a nested `data.model` field, **When** Argus parses the entry, **Then** the session record is updated with the correct model name.
3. **Given** a session whose model was already detected in a previous scan, **When** new JSONL lines arrive without a model field, **Then** the previously detected model is preserved (not overwritten with null).
4. **Given** a session where model detection occurs mid-session (not on the first event), **When** Argus eventually encounters the model field, **Then** the session card is updated to show the model without requiring a restart.

---

### User Story 3 - No Spurious or Missing Output on Session Watch Start (Priority: P2)

As a developer who opens an in-progress Copilot session in Argus, I want to see the full historical output of that session, not a blank or partially cleared panel, and I want the view to stay consistent as new lines arrive.

**Why this priority**: The Copilot watcher currently clears all existing output every time file watching starts. This can cause output to disappear unexpectedly on reconnect or on first load.

**Independent Test**: Start a Copilot session, let it produce several exchanges, then restart the Argus backend. Observe that the previously generated output is shown correctly rather than being wiped.

**Acceptance Scenarios**:

1. **Given** a Copilot session with existing output stored in Argus, **When** the file watcher (re)starts on `events.jsonl`, **Then** previously stored output is not cleared.
2. **Given** a Copilot session being watched for the first time, **When** Argus reads the tail of `events.jsonl`, **Then** only recent events are replayed (the tail optimization is preserved) and duplicates are not introduced.
3. **Given** a Claude Code session and a Copilot session both being actively monitored, **When** new JSONL lines arrive for either session, **Then** existing output in both sessions is preserved and only new lines are appended.

---

### User Story 4 - Blank and Meta Message Suppression Parity (Priority: P2)

As a developer viewing session output, I want only meaningful messages to appear in the output panel for both agent types. Internal bookkeeping events (like `turn.start`, `session.start`) and blank assistant messages (where the assistant made only tool calls without any text response) should not clutter the output.

**Why this priority**: Claude and Copilot have different suppression rules today. Making them consistent improves the output quality for Copilot sessions and sets a clear, uniform policy.

**Independent Test**: Trigger a tool-call-only turn in both a Claude session and a Copilot session (where the assistant makes a tool call but writes no text). Confirm neither session shows a blank message entry for that turn.

**Acceptance Scenarios**:

1. **Given** a Copilot `turn.start` event, **When** Argus parses it, **Then** it produces no output entry (treated as a bookkeeping event).
2. **Given** a Copilot `session.start` event, **When** Argus parses it, **Then** it produces a status_change entry (not a blank message).
3. **Given** a Copilot `assistant.message` event with no extractable text content (only tool calls in the turn), **When** Argus parses it, **Then** no blank message entry is stored.
4. **Given** a Claude Code assistant entry with only `tool_use` content blocks and no `text` block, **When** Argus parses it, **Then** the tool_use entries are stored but no blank text message entry is produced.

---

### Edge Cases

- What happens when a JSONL line is malformed (invalid JSON)? The line is skipped and the error is logged; subsequent valid lines continue to be processed.
- What happens when a content-block array contains neither `text` nor `tool_use` nor `tool_result` blocks (e.g., an unknown block type)? Unknown blocks are silently skipped; known blocks in the same array are still processed.
- What happens when `data.content` is an empty array or empty string? The event is treated as having no extractable content and, if it is a message-role event, it is suppressed.
- What happens when model detection finds conflicting values across events in the same session? The first non-null value wins and subsequent detections are ignored (existing model is preserved).
- What happens when the `events.jsonl` file is truncated or rotated by Copilot? The watcher detects the smaller file size and resets its read position to the beginning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Claude parser MUST produce a distinct output entry for each content block type (`text`, `tool_use`, `tool_result`) in a multi-block response, preserving block order.
- **FR-002**: The Copilot parser MUST extract tool name and arguments from `tool.execution_start` events via `data.toolName` and `data.arguments`, not via fallback JSON dump.
- **FR-003**: The Copilot parser MUST extract tool result content from `tool.execution_complete` events via `data.result.content` (and `data.result.detailedContent` as fallback).
- **FR-004**: Both parsers MUST detect the AI model name from their respective event formats and update the session record the first time a model field is observed.
- **FR-005**: Both parsers MUST preserve an already-detected model name; a subsequent event with no model field MUST NOT overwrite the session's existing model with null.
- **FR-006**: The Copilot watcher MUST NOT clear previously stored session output when the file watcher starts or restarts.
- **FR-007**: Both parsers MUST suppress blank message entries where no text content is extractable for message-role events.
- **FR-008**: The Copilot parser MUST suppress `turn.start` and similarly bookkeeping-only events, producing no output entry.
- **FR-009**: Both parsers MUST handle malformed JSONL lines (invalid JSON) by logging a warning and skipping the line without crashing.
- **FR-010**: Both parsers MUST skip entries whose type is not recognized and that carry no meaningful content (no silent data loss, but no spurious output either).

### Key Entities

- **JSONL Entry (Claude format)**: An object with top-level `type` (`user`, `assistant`, `file-history-snapshot`), a `message` object containing `role`, optional `model`, and `content` (string or ContentBlock array).
- **JSONL Event (Copilot format)**: An object with dot-notation `type` (e.g., `assistant.message`, `tool.execution_start`), optional flat `content`/`model` fields, and a nested `data` object holding the real payload.
- **OutputEntry**: The normalized, parser-agnostic record stored in Argus representing a single message, tool_use, or tool_result output with `role`, `content`, and `toolName` fields.
- **Session record**: The in-memory and persisted state for a monitored session, including `model`, `summary`, `lastActivityAt`, and the list of `OutputEntry` items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All content blocks (text, tool_use, tool_result) in a Claude Code assistant response appear as separate, correctly typed output entries with no blocks dropped.
- **SC-002**: All Copilot tool events (`tool.execution_start`, `tool.execution_complete`) produce output entries with tool name and content visible, not raw JSON strings.
- **SC-003**: The model name is shown on the session card for 100% of Claude Code sessions and 100% of Copilot sessions where the agent reported a model name in its events.
- **SC-004**: Restarting the Argus backend does not cause previously displayed output for an in-progress Copilot session to disappear.
- **SC-005**: Zero blank or whitespace-only message entries appear in the output panel for either session type under normal operation.
- **SC-006**: Existing unit tests for both parsers pass without modification, and new tests cover each fixed behavior.

## Assumptions

- The Claude Code JSONL format and Copilot CLI event format are considered stable; this feature does not add support for new or undocumented event types.
- Fixing the output-clearing bug (FR-006) does not require changing the tail-read optimization (reading only the last 16 KB on first watch); both behaviors are independent and the tail read is preserved.
- The parsers are intentionally separate modules (`claude-code-jsonl-parser.ts` and `events-parser.ts`) because the two formats differ significantly; this feature aligns their behavior without merging them into a single parser.
- Both parsers share the same `OutputEntry` type as their output contract; this type is not changed as part of this feature.
- Model detection correctness is defined as: the session record shows the value reported by the agent in its events. If the agent never reports a model, the field remains null, and that is correct behavior.

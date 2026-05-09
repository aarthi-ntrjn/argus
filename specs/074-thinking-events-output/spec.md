# Feature Specification: Thinking Events in Output Stream and Preview

**Feature Branch**: `074-thinking-events-output`
**Created**: 2026-05-08
**Status**: Clarified
**Input**: add thinking events to the output stream. Also include tools summary and thinking event in the output preview as well

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View thinking blocks in the output stream (Priority: P1)

When monitoring a Claude Code session, the user can see the model's thinking blocks in the output pane alongside messages and tool calls. Each thinking block is visually distinct and labeled so it does not clutter the message thread but is available for inspection. In verbose mode, thinking blocks are shown fully expanded.

**Why this priority**: Thinking blocks are a first-class output from extended-thinking models. Without surfacing them, the user has no visibility into the model's reasoning, which is one of the key diagnostic signals in Argus.

**Independent Test**: Open a session that was run with extended thinking enabled, navigate to the session detail output pane in verbose mode, and verify that thinking entries appear in the stream fully expanded with a distinct visual treatment.

**Acceptance Scenarios**:

1. **Given** a Claude Code session where the model emitted thinking blocks, **When** the user opens the session output pane in verbose mode, **Then** thinking entries appear fully expanded in chronological order interleaved with messages and tool calls.
2. **Given** a thinking entry in the output pane, **When** the user views it, **Then** it has a distinct label (e.g., "THINK") and the full thinking text is readable.
3. **Given** a session with no thinking blocks, **When** the user views the output pane, **Then** no thinking entries appear and the stream is unchanged.
4. **Given** a thinking block of type `redacted_thinking`, **When** the user views it in the output pane, **Then** the THINK badge is shown alongside a "(redacted)" placeholder instead of content.

---

### User Story 2 - Thinking entries are collapsed but expandable in focused mode (Priority: P2)

A user in focused mode sees thinking blocks in a compact collapsed form. They can expand an individual thinking block to read its content without switching the entire stream to verbose mode.

**Why this priority**: Thinking blocks can be long and numerous. Focused mode already filters noise — showing thinking collapsed keeps the stream scannable while preserving access to the reasoning.

**Independent Test**: Switch to focused mode on a session with thinking blocks. Verify blocks appear collapsed. Click one to expand and verify the full content appears.

**Acceptance Scenarios**:

1. **Given** the output pane is in focused mode, **When** a session contains thinking blocks, **Then** each thinking entry is shown in a collapsed state (THINK badge visible, content hidden).
2. **Given** a collapsed thinking entry in focused mode, **When** the user clicks or expands it, **Then** the full thinking text is revealed inline.
3. **Given** the output pane is in verbose mode, **When** a session contains thinking blocks, **Then** thinking entries are shown fully expanded without requiring a click.

---

### User Story 3 - Session card preview shows thinking content (Priority: P1)

On the session card (the dashboard tile for a session), when the session has thinking blocks, the preview area shows the thinking content rather than the last assistant message. This immediately signals to the user that the model was reasoning and surfaces the thinking as the primary context.

**Why this priority**: The preview is the primary at-a-glance view on the dashboard. When thinking is present, it is more informative than a response message for monitoring the model's activity.

**Independent Test**: On the dashboard, find a session card where the model produced thinking blocks. Verify the preview area shows thinking content (not the last message text).

**Acceptance Scenarios**:

1. **Given** a session with thinking blocks, **When** the user views the session card, **Then** the preview shows the thinking content (truncated if long) instead of the last assistant message.
2. **Given** a session with only a plain assistant message and no thinking, **When** the user views the session card, **Then** the preview shows the message text as before.
3. **Given** a session with only redacted thinking blocks, **When** the user views the session card, **Then** the preview shows a "(redacted)" placeholder.
4. **Given** a session with thinking in progress (no complete assistant message yet), **When** the user views the card, **Then** the thinking content is still shown in the preview.

---

### User Story 4 - Session card preview shows tool call count (Priority: P2)

On the session card, a tool call count indicator shows how many tool calls occurred in the session, giving at-a-glance insight into activity level.

**Why this priority**: Tool call counts help the user quickly assess how much work the model did in a session without opening the detail pane.

**Independent Test**: On the dashboard, find a session card where tool calls were made. Verify a count like "3 tool calls" appears in the preview area.

**Acceptance Scenarios**:

1. **Given** a session where tool calls were made, **When** the user views the session card, **Then** a tool call count (e.g., "3 tool calls") appears in the preview area.
2. **Given** a session with no tool calls, **When** the user views the session card, **Then** no tool call count indicator appears.
3. **Given** a session with both thinking and tool calls, **When** the user views the session card, **Then** the thinking preview is shown and the tool count indicator also appears.

---

### Edge Cases

- What happens when a thinking block contains very long text? The session card preview truncates after a fixed character limit; the output pane shows the full text when expanded.
- What if a JSONL file contains multiple consecutive thinking blocks before a single assistant message? Each is stored as a separate output event and displayed individually in sequence.
- What if `thinking` content is an empty string? The entry is shown with the THINK badge and a placeholder "(empty)" rather than a blank row.
- What happens to thinking events in sessions that predate this feature? Historical sessions are rescanned; if no thinking blocks were recorded, none appear.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse `thinking` content blocks from Claude Code JSONL assistant entries and store each as a session output event of type `thinking`.
- **FR-002**: The system MUST parse `redacted_thinking` content blocks and store each as a `thinking` output event with a flag indicating the content is redacted.
- **FR-003**: The output pane MUST display `thinking` entries in chronological sequence alongside messages and tool calls.
- **FR-004**: Each thinking entry in the output pane MUST be visually labeled (e.g., a "THINK" badge) and styled distinctly from message and tool entries.
- **FR-005**: In verbose output mode, thinking entries MUST be shown fully expanded.
- **FR-006**: In focused output mode, thinking entries MUST be shown collapsed (content hidden) but individually expandable by user interaction.
- **FR-007**: A thinking entry with redacted content MUST display a "(redacted)" placeholder rather than encrypted data.
- **FR-008**: The session card preview MUST show the thinking content (truncated) when the session has one or more thinking events, in place of the last assistant message.
- **FR-009**: The session card preview MUST display a tool call count indicator when the session has one or more `tool_use` output events.
- **FR-010**: `thinking` output events MUST be stored persistently so they are available for historical and restarted sessions.
- **FR-011**: The `thinking` output type MUST be added to the shared output type enumeration so all parts of the system recognize it.

### Key Entities

- **ThinkingOutput**: A session output event with type `thinking`, containing the model's reasoning text as `content` (empty string for redacted blocks), a boolean `isRedacted` flag, a `sequenceNumber` preserving ordering, and no `role` or `toolName`.
- **OutputType**: The enumeration of output event types, extended to include `thinking` alongside `message`, `tool_use`, `tool_result`, `error`, and `status_change`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of thinking and redacted_thinking blocks present in a Claude Code JSONL file appear as stored output events after the session is scanned, with no blocks silently dropped.
- **SC-002**: Thinking entries are visible in the output pane within the same render pass as adjacent message and tool events (no separate load step required).
- **SC-003**: Session card preview reflects thinking content within one polling interval of the session generating those events.
- **SC-004**: Toggling between focused and verbose mode changes thinking entry expansion state immediately, with no network request.
- **SC-005**: Session cards for sessions without thinking or tool calls are visually unchanged (no regressions to the existing preview display).
- **SC-006**: Expanding a collapsed thinking entry in focused mode reveals its full content without navigating away from the current view.

## Assumptions

- Thinking blocks appear in Claude Code JSONL files as content array entries with `type: "thinking"` (readable) or `type: "redacted_thinking"` (encrypted) inside assistant messages, parallel to `text` and `tool_use` blocks. This matches the Claude API extended-thinking format.
- Thinking is a Claude Code-only feature; Copilot CLI sessions do not produce thinking blocks. Parser changes are scoped to the Claude Code JSONL parser.
- When a session has thinking events, the session card preview shows thinking content as the primary preview, replacing the last assistant message. Tool call count appears as a secondary indicator.
- The tool call count in the session card preview is derived from stored `tool_use` output events, not recomputed from JSONL on each render.
- Thinking events do not participate in the tool pairing logic and are never matched with a `tool_result`.
- The `isRedacted` flag is stored on the output event; redacted blocks have an empty `content` string.

## Clarifications

### Session 2026-05-08

- **Focused mode behavior**: Thinking entries in focused mode are shown collapsed (not hidden). The user can expand individual entries to read the full content without switching to verbose mode.
- **Verbose mode behavior**: Thinking entries in verbose mode are always shown fully expanded.
- **Session card preview**: When thinking is present, the preview shows the thinking content (not the last assistant message). The thinking replaces the message as the primary preview content.
- **Redacted thinking**: Blocks of type `redacted_thinking` are surfaced with a THINK badge and "(redacted)" placeholder. They are not silently dropped.

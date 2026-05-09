# Feature Specification: Thinking Events in Output Stream and Preview

**Feature Branch**: `074-thinking-events-output`
**Created**: 2026-05-08
**Status**: Draft
**Input**: add thinking events to the output stream. Also include tools summary and thinking event in the output preview as well

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View thinking blocks in the output stream (Priority: P1)

When monitoring a Claude Code session, the user can see the model's thinking blocks in the output pane alongside messages and tool calls. Each thinking block is visually distinct and labeled so it does not clutter the message thread but is available for inspection.

**Why this priority**: Thinking blocks are a first-class output from extended-thinking models. Without surfacing them, the user has no visibility into the model's reasoning, which is one of the key diagnostic signals in Argus.

**Independent Test**: Open a session that was run with extended thinking enabled, navigate to the session detail output pane, and verify that thinking entries appear in the stream with a distinct visual treatment.

**Acceptance Scenarios**:

1. **Given** a Claude Code session where the model emitted thinking blocks, **When** the user opens the session output pane, **Then** thinking entries appear in chronological order interleaved with messages and tool calls.
2. **Given** a thinking entry in the output pane, **When** the user views it, **Then** it has a distinct label (e.g., "THINK") and the thinking text is readable.
3. **Given** a session with no thinking blocks, **When** the user views the output pane, **Then** no thinking entries appear and the stream is unchanged.
4. **Given** the output pane is in verbose mode, **When** thinking entries are present, **Then** thinking entries are visible in the stream.

---

### User Story 2 - Thinking entries respect the focused/verbose display mode (Priority: P2)

A user who prefers a clean stream can use focused mode to suppress thinking blocks, keeping the view concise. In verbose mode, thinking blocks are always shown.

**Why this priority**: Thinking blocks can be long and numerous. The verbose/focused toggle already controls output density — thinking should respect this setting so the stream is not overwhelming by default.

**Independent Test**: Toggle between verbose and focused output modes on a session with thinking blocks and verify visibility changes accordingly.

**Acceptance Scenarios**:

1. **Given** the output pane is in focused mode, **When** a session contains thinking blocks, **Then** thinking entries are not shown (hidden, same as orphaned tool results).
2. **Given** the output pane is in verbose mode, **When** a session contains thinking blocks, **Then** thinking entries are visible.

---

### User Story 3 - Session card preview shows thinking and tool activity indicators (Priority: P1)

On the session card (the dashboard tile for a session), the preview area conveys at-a-glance activity indicators: how many tool calls were made and whether the model produced thinking blocks. This gives monitoring context without requiring the user to open the detail pane.

**Why this priority**: The preview is the primary at-a-glance view on the dashboard. Showing thinking and tool activity there improves situational awareness without requiring drill-in for every session.

**Independent Test**: On the dashboard, find a session card with tool calls and thinking blocks. Verify the preview area shows indicators for both without opening the session detail.

**Acceptance Scenarios**:

1. **Given** a session where tool calls were made, **When** the user views the session card, **Then** a tool call count (e.g., "3 tool calls") appears in the preview area.
2. **Given** a session where thinking blocks were emitted, **When** the user views the session card, **Then** a thinking indicator appears in the preview area.
3. **Given** a session with both tool calls and thinking, **When** the user views the session card, **Then** both indicators appear together.
4. **Given** a session with only a plain assistant message and no tool calls or thinking, **When** the user views the session card, **Then** neither indicator appears and the preview shows the message text as before.
5. **Given** a session with thinking but no assistant message yet, **When** the user views the card, **Then** the thinking indicator is shown even without a text message.

---

### Edge Cases

- What happens when a thinking block contains very long text? The output pane shows the full text; the session card preview truncates after a fixed character limit.
- What if a JSONL file contains multiple consecutive thinking blocks before a single assistant message? Each is stored as a separate output event and displayed individually in sequence.
- What if `thinking` content is an empty string? The entry is shown with the THINK label and a placeholder like "(empty)" rather than a blank row.
- What happens to thinking events in sessions that predate this feature? Historical sessions are rescanned; if no thinking blocks were recorded, none appear.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse `thinking` content blocks from Claude Code JSONL assistant entries and store each as a session output event of type `thinking`.
- **FR-002**: The output pane MUST display `thinking` entries in chronological sequence alongside messages and tool calls.
- **FR-003**: Each thinking entry in the output pane MUST be visually labeled (e.g., a "THINK" badge) and styled distinctly from message and tool entries.
- **FR-004**: In verbose output mode, thinking entries MUST be visible in the output pane.
- **FR-005**: In focused output mode, thinking entries MUST be hidden (treated as non-essential, same as orphaned tool results).
- **FR-006**: The session card preview MUST display a tool call count indicator when the session has one or more `tool_use` output events.
- **FR-007**: The session card preview MUST display a thinking indicator when the session has one or more `thinking` output events.
- **FR-008**: Preview indicators (tool call count, thinking) MUST appear in the preview area alongside the existing last-message text.
- **FR-009**: `thinking` output events MUST be stored persistently so they are available for historical and restarted sessions.
- **FR-010**: The `thinking` output type MUST be added to the shared output type enumeration so all parts of the system recognize it.

### Key Entities

- **ThinkingOutput**: A session output event with type `thinking`, containing the model's reasoning text as `content`, a `sequenceNumber` preserving ordering, and no `role` or `toolName`.
- **OutputType**: The enumeration of output event types, extended to include `thinking` alongside `message`, `tool_use`, `tool_result`, `error`, and `status_change`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of thinking blocks present in a Claude Code JSONL file appear as stored output events after the session is scanned, with no blocks silently dropped.
- **SC-002**: Thinking entries are visible in the output pane within the same render pass as adjacent message and tool events (no separate load step required).
- **SC-003**: Session card preview indicators (tool count, thinking) reflect the session state within one polling interval of the session generating those events.
- **SC-004**: Toggling between focused and verbose mode changes thinking entry visibility immediately, with no network request.
- **SC-005**: Session cards for sessions without thinking or tool calls are visually unchanged (no regressions to the existing preview display).

## Assumptions

- Thinking blocks appear in Claude Code JSONL files as content array entries with `type: "thinking"` inside assistant messages, parallel to `text` and `tool_use` blocks. This matches the Claude API extended-thinking format.
- Thinking is a Claude Code-only feature; Copilot CLI sessions do not produce thinking blocks. Parser changes are scoped to the Claude Code JSONL parser.
- The preview indicators are additive: they appear alongside the existing last-message text, not replacing it.
- The tool call count in the session card preview is derived from stored `tool_use` output events, not recomputed from JSONL on each render.
- Thinking events do not participate in the tool pairing logic and are never matched with a `tool_result`.
- Thinking blocks in focused mode are fully hidden rather than collapsed into a counter, since they are reasoning artifacts rather than actions.

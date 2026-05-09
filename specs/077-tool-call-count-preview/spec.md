# Feature Specification: Tool Call Count in Session Card Preview

**Feature Branch**: `077-tool-call-count-preview`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "last output preview should show the tool call count so the user does not think nothing is happening. it should work for both claudecode and copilot cli"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Progress When AI Is Working (Priority: P1)

A user is monitoring multiple sessions on the dashboard. One of their Claude Code or Copilot CLI sessions is actively running a task that involves many tool calls (reading files, running commands, etc.) but has not yet produced a new text reply. The session card preview currently shows "Waiting for output..." even though significant work is underway. The user cannot tell if the session is stuck or actively making progress.

With this feature, the preview area shows a count of how many tool calls have been made in the current turn, so the user immediately knows the session is active and making progress.

**Why this priority**: This is the core user problem — false "nothing is happening" signals cause users to interrupt sessions unnecessarily or lose confidence in the tool. It is the primary motivation for this feature.

**Independent Test**: Trigger a session task that involves multiple tool calls before producing output. Verify the session card preview shows an incrementing tool call count rather than "Waiting for output...".

**Acceptance Scenarios**:

1. **Given** a session is active and has made tool calls but not yet produced a new assistant text reply, **When** the user views the session card on the dashboard, **Then** the preview area shows the number of tool calls made in the current work cycle (e.g., "Running... 14 tool calls").
2. **Given** a session has made zero tool calls and has no assistant text output yet, **When** the user views the session card, **Then** the preview shows "Waiting for output..." (unchanged behavior).
3. **Given** a session produces a new assistant text reply after tool calls, **When** the user views the session card, **Then** the preview switches back to showing the assistant text message (existing behavior).

---

### User Story 2 - See Ongoing Tool Activity After a Reply (Priority: P2)

A user has a session that produced a text reply and then immediately continued making more tool calls in a follow-up action. The last assistant message is stale but still shown in the preview, giving no indication that more work is happening.

With this feature, when tool calls have occurred after the most recent assistant text reply, the preview supplements or replaces the text with the current tool call count so the user knows the session is still active.

**Why this priority**: Improves accuracy of the session state signal, but is secondary to Story 1 since having any count visible is the primary need.

**Independent Test**: Create a session that replies and then immediately continues with tool calls. Verify the card preview reflects the ongoing tool activity rather than just the stale text reply.

**Acceptance Scenarios**:

1. **Given** a session has an assistant text reply followed by one or more tool calls, **When** the user views the session card, **Then** the preview shows the last reply text with the tool call count appended inline (e.g., "Here are the results... +8 tool calls").
2. **Given** a session is ended or completed, **When** the user views the session card, **Then** the preview shows only the last assistant text message and no tool call count (tool count is not relevant for finished sessions).

---

### User Story 3 - Consistent Behavior Across Both AI Platforms (Priority: P1)

A user monitors sessions from both Claude Code and Copilot CLI on the same dashboard. The tool call count should appear in session cards for both platforms identically — neither platform should appear broken or missing the indicator.

**Why this priority**: Parity is critical. A feature that works for one platform but not the other creates a confusing inconsistency on the dashboard.

**Independent Test**: Run an active session for each platform with tool calls in progress. Verify both session cards display the tool call count in an equivalent format.

**Acceptance Scenarios**:

1. **Given** a Claude Code session with active tool calls, **When** the user views the card, **Then** the tool call count is shown.
2. **Given** a Copilot CLI session with active tool calls, **When** the user views the card, **Then** the tool call count is shown in the same format as the Claude Code card.

---

### Edge Cases

- What happens when a session has exactly 1 tool call? The label should be grammatically correct ("1 tool call", not "1 tool calls").
- What if the output history is very short and contains no tool calls? The preview falls back to "Waiting for output..." unchanged.
- What if a session ends while tool calls are still in the output history? No tool call count is shown for ended/completed sessions.
- What if the tool call count increments rapidly? The preview should reflect the latest count; no animation or throttling is required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The session card preview MUST display the number of tool calls made in the current work cycle when the session is active and the most recent output is a tool call (not an assistant text message).
- **FR-002**: The tool call count MUST be derived from tool call events in the session output stream, covering both Claude Code and Copilot CLI session types. The backend MUST emit a notification when tool call output is recorded so the session card refreshes its output snapshot.
- **FR-003**: The tool call count displayed MUST represent calls made since the most recent assistant text reply. If no assistant text reply exists yet in the session, the count covers all tool calls in the available output history.
- **FR-004**: When the session is ended or completed, the preview MUST NOT show a tool call count — it MUST show the last assistant text message only (or "Waiting for output..." if none exists).
- **FR-005**: When an assistant text reply is the most recent output (no subsequent tool calls), the preview MUST show the text reply and no tool call count (existing behavior preserved).
- **FR-006**: When tool calls are the most recent output (session is still working), the preview MUST show the tool call count instead of "Waiting for output...".
- **FR-007**: When tool calls have occurred after the most recent assistant text reply, the preview MUST show the last text reply with the subsequent tool call count appended inline (e.g., "Here are the results... +8 tool calls").
- **FR-009**: The backend MUST trigger a `session.updated` broadcast when tool call output is recorded for a session, so the session card refreshes its output snapshot in response.

### Key Entities

- **Tool Call Event**: A recorded event in the session output stream indicating the AI invoked an external tool or command. Has a type distinct from text messages. Applies to both Claude Code and Copilot CLI.
- **Work Cycle**: The span of output events from the most recent assistant text reply (exclusive) to the present. If no assistant text reply exists, the work cycle covers all output events.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user monitoring an active session with 5 or more tool calls in progress can see a non-zero tool call count in the session card preview within one refresh cycle of the tool calls being recorded.
- **SC-002**: The tool call count is accurate to the events in the output stream with no more than one refresh cycle of lag.
- **SC-003**: The preview for a completed or ended session shows no tool call count in 100% of cases.
- **SC-004**: Both Claude Code and Copilot CLI session cards display the tool call count in an identical format, with zero platform-specific omissions.
- **SC-005**: The singular/plural label is grammatically correct in 100% of cases (1 tool call vs N tool calls).

## Clarifications

### Session 2026-05-09

- Q: Should the tool call count be derived from the full work cycle or the existing limited output query? → A: The tool call count is already correctly computed in the full output pane. The root problem is that the backend does not emit a session update event when new tool calls are recorded, so the session card's cached output snapshot never refreshes. The fix is: (1) the backend must fire a session-level notification when tool call output is recorded, and (2) the session card must react to that notification to refresh its output snapshot and then derive the count from it.

- Q: When a reply exists and subsequent tool calls have occurred, how should the preview display them? → A: Show the reply text with the count appended inline (e.g., "Here are the results... +8 tool calls").

## Assumptions

- Tool call count logic is already correctly implemented in the full output pane; no new counting logic needs to be invented.
- The backend currently does NOT emit a session-level notification when tool call output is recorded; this must be added as part of this feature.
- Once the backend emits the notification, the session card can refresh its output snapshot and derive the count from the same output stream — no additional API is needed.
- The count is read-only informational display; no interaction or drill-down into individual tool calls is in scope for this feature.
- Animation or real-time streaming of the count is out of scope; the count updates on the same event-driven cadence as other session card data.

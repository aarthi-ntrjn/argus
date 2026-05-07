# Feature Specification: Bash Command Approval Surfacing

**Feature Branch**: `072-bash-approval-surface`
**Created**: 2025-07-17
**Status**: Draft
**Input**: User description: "when not running in yolo mode bash command approvals are not bubbled to the session card"

## Clarifications

### Session 2026-05-06

- Q: Should approval/denial use dedicated Approve/Deny buttons or reuse the existing numbered-choice panel? → A: Reuse the existing numbered-choice panel — surface as choices (e.g., "Yes, run it" / "No, skip it").
- Q: Should the Claude Code hooks injector use a wildcard/empty matcher or register specific tool names for PreToolUse? → A: Wildcard/empty matcher — receive all PreToolUse events; filter on the Argus side.
- Q: Should tool approval prompts be visually distinct from ask_user prompts? → A: No — same visual treatment; tool input rendered as plain question text using the existing panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Bash Approval on Session Card (Priority: P1)

A developer monitors Claude Code or GitHub Copilot CLI sessions in Argus. One session is running without full auto-approval (non-YOLO mode for Claude Code, or without `--allow-all` for Copilot CLI). The agent encounters a shell command and pauses to wait for the user's approval. Currently the session card shows nothing — the user must look at the terminal directly to see why the session appears stuck. With this feature, the session card immediately shows the command awaiting approval, so the user can act from the Argus dashboard without switching to the terminal.

**Why this priority**: Without this, users cannot act on pending bash approvals from the dashboard. The session appears frozen with no indication of what is needed. This is the core gap the feature closes.

**Independent Test**: Launch a Claude Code session (or Copilot CLI session) without auto-approval mode and trigger a shell command. Verify the session card shows a pending approval prompt displaying the command text, without needing to visit the terminal.

**Acceptance Scenarios**:

1. **Given** a Claude Code session running in non-YOLO mode, **When** Claude attempts to run a shell command, **Then** the session card transitions to a "waiting" state and displays the command text awaiting approval.
2. **Given** a Copilot CLI session running without `--allow-all`, **When** Copilot attempts to run a shell command, **Then** the session card transitions to a "waiting" state and displays the command text awaiting approval.
3. **Given** a session card showing a bash approval prompt, **When** the user approves the command from the Argus dashboard, **Then** the approval is sent to the session and execution resumes.
4. **Given** a session card showing a bash approval prompt, **When** the user denies the command, **Then** the denial is sent and the agent handles the rejection.
5. **Given** a session card showing a bash approval prompt, **When** the command is resolved (approved or denied), **Then** the session card returns to its normal active state and the approval prompt disappears.

---

### User Story 2 - Approval Prompt in Session Detail View (Priority: P2)

A user viewing the full session detail panel while a Claude Code or Copilot CLI session is waiting for shell command approval sees the same approval prompt as in the card view, with the full command visible and the same approve/deny actions available.

**Why this priority**: The session detail view provides more screen space and context. A consistent approval UX there is important for users who drill into sessions to monitor them closely.

**Independent Test**: Navigate to session detail while a bash approval is pending (for either agent type). Verify the prompt and command are visible, and approval/denial works from the detail view.

**Acceptance Scenarios**:

1. **Given** a session detail page open for a non-auto-approval session (Claude Code or Copilot CLI), **When** a shell approval is pending, **Then** the approval panel is visible with the command text and approve/deny options.
2. **Given** the session detail page shows a bash approval prompt, **When** the user approves or denies, **Then** the action is sent and the prompt clears.

---

### Edge Cases

- What happens when the session is not PTY-connected at the time of approval? The approve/deny actions should be visually disabled (matching existing behavior for non-PTY pending choices), and the prompt is shown read-only.
- What happens when a bash approval arrives for a session that is in YOLO mode? YOLO sessions auto-approve; this event should never appear. If it does arrive (e.g., misdetected YOLO state), display it as a normal approval prompt.
- What happens when multiple bash approval prompts arrive in rapid succession? Each prompt replaces the previous one; only the current pending approval is shown.
- What if the command text is very long? The command is displayed with a scrollable or truncated view so the card layout is not broken.
- What happens when the user closes Argus while an approval is pending? The approval remains pending in the terminal. No data is lost; the prompt reappears when Argus reconnects and the session is still waiting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect when a Claude Code or Copilot CLI session running without auto-approval has any tool use awaiting approval and surface this as a pending approval event to the session card. This includes bash/shell commands and any other tool type that the agent pauses on.
- **FR-002**: The session card MUST display the full text of the command or tool input pending approval.
- **FR-003**: The session card MUST transition to the same "waiting" state and use the same `PendingChoicePanel` visual treatment for tool approval prompts as it does for `ask_user` prompts. No distinct visual styling is required.
- **FR-004**: Users MUST be able to approve a pending tool use from the session card without leaving the Argus dashboard, using the existing pending-choice panel with "Yes, run it" as a numbered choice.
- **FR-005**: Users MUST be able to deny a pending tool use from the session card without leaving the Argus dashboard, using the existing pending-choice panel with "No, skip it" as a numbered choice.
- **FR-006**: When a bash approval is resolved (approved or denied), the session card MUST return to its normal state and the approval prompt MUST disappear.
- **FR-007**: The approve/deny actions MUST be disabled (read-only prompt still visible) when the session is not PTY-connected.
- **FR-008**: The feature MUST NOT affect sessions running in YOLO mode — YOLO sessions auto-approve and should never show an approval prompt.
- **FR-009**: The approval prompt MUST be visible in both the session card view and the session detail view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a Claude Code or Copilot CLI session pauses for bash/shell approval, the approval prompt appears on the session card within 2 seconds of the pause.
- **SC-002**: A user can approve or deny a bash command entirely from the Argus dashboard — zero terminal interactions required.
- **SC-003**: After approval or denial, the session card returns to its previous state within 2 seconds.
- **SC-004**: No approval prompts appear on sessions running in auto-approval mode (YOLO for Claude Code, `--allow-all` for Copilot CLI).

## Assumptions

- Both Claude Code and Copilot CLI fire a `PreToolUse` hook event for every tool use when not in auto-approval mode. Argus registers to receive all `PreToolUse` events (wildcard/empty matcher for Claude Code; Copilot CLI already sends all). Filtering of which events to surface as approval prompts is done inside Argus — `ask_user`/`AskUserQuestion` events are already handled as pending choices and excluded from this feature's path.
- The existing `PendingChoicePanel` is reused for tool approval prompts. The tool name and input are mapped to a question string, and fixed choices "Yes, run it" / "No, skip it" are provided. The panel sends the numbered response ("1" or "2") to the PTY.
- Sessions launched outside Argus (not via PTY) that enter a bash approval state will show the prompt as read-only (no approve/deny actions), since Argus has no PTY channel to send the response.

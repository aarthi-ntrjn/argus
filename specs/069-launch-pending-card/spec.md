# Feature Specification: Launch Pending Session Card

**Feature Branch**: `069-launch-pending-card`
**Created**: 2026-05-06
**Status**: Draft
**Input**: User description: "when i launch with argus - i want to show a placeholder session card with a spinner"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Immediate Visual Feedback on Launch (Priority: P1)

A user clicks "Launch with Argus" and selects Claude or Copilot from the dropdown. Currently nothing changes in the sessions list until the AI tool fires its first hook and a real session is created, which can take several seconds. The user wants to see an immediate placeholder card appear in the sessions list under the relevant repository, showing a spinner and the tool name, so they know the launch is in progress and do not wonder if anything happened.

**Why this priority**: This is the core of the feature. Without it there is no visible feedback between the click and the session appearing, creating a dead period that makes the UI feel broken.

**Independent Test**: Can be fully tested by clicking "Launch with Argus" for any repo and observing that a placeholder card appears immediately in the sessions list under that repo, before any real session shows up.

**Acceptance Scenarios**:

1. **Given** the dashboard is open and a repository is visible, **When** the user clicks "Launch with Argus" and selects a tool, **Then** a placeholder session card appears immediately in that repository's session list showing the selected tool icon, a "Starting..." label, and an animated spinner.
2. **Given** a placeholder card is visible, **When** the real session is detected and appears in the list, **Then** the placeholder card disappears and is replaced by the real session card without a visible flash or duplicate entry.
3. **Given** a placeholder card is visible, **When** the user navigates away from and back to the dashboard, **Then** the placeholder card is no longer shown (it is transient, not persisted).

---

### User Story 2 - Placeholder Removal on Launch Failure (Priority: P2)

When the AI tool process exits before creating a session (e.g., the tool is not configured or the user closes the terminal immediately), the placeholder card should be removed so the sessions list does not accumulate stale "Starting..." cards.

**Why this priority**: Without cleanup, repeated failed launches would clutter the sessions list with orphaned placeholders.

**Independent Test**: Can be tested by observing the placeholder card disappears after a configurable timeout (e.g., 30 seconds) if no real session has been created.

**Acceptance Scenarios**:

1. **Given** a placeholder card is visible, **When** no real session appears within 30 seconds, **Then** the placeholder card is automatically removed from the sessions list.
2. **Given** a placeholder card is visible, **When** the Argus server reports the launcher disconnected without creating a session, **Then** the placeholder card is removed promptly.

---

### Edge Cases

- What happens when two launches are triggered for the same repository in quick succession? Both placeholder cards should appear (one per launch action).
- What happens when the page is refreshed while a placeholder is showing? The placeholder does not survive a page reload, as it is transient client-side state.
- What happens in headless mode (no terminal available, user is shown the command to copy)? No placeholder card is shown because no launch has actually been initiated by Argus.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a placeholder session card immediately after the user initiates a "Launch with Argus" action that successfully triggers the terminal launch (non-headless path).
- **FR-002**: The placeholder card MUST show the tool type (Claude Code or Copilot CLI), the repository path, and an animated spinner indicating the session is starting.
- **FR-003**: The placeholder card MUST be visually distinct from real session cards to communicate that it is not yet an active session.
- **FR-004**: System MUST automatically remove the placeholder card when the corresponding real session appears in the sessions list.
- **FR-005**: System MUST automatically remove the placeholder card if no real session appears within 30 seconds.
- **FR-006**: System MUST NOT show a placeholder card when the headless (copy-command) path is used, since no launch was initiated by Argus.
- **FR-007**: Multiple simultaneous launch actions MUST each produce their own independent placeholder card.
- **FR-008**: The placeholder card MUST NOT be interactive (no stop, send-prompt, or other session controls).

### Key Entities

- **Pending Launcher**: A transient, client-side-only record created when the user clicks "Launch with Argus" and the server confirms the launch. Contains the tool type, repository path, and a creation timestamp. It is not persisted to the database.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A placeholder card appears within 500ms of the user clicking "Launch with Argus" on a successful terminal launch.
- **SC-002**: The placeholder card disappears within 2 seconds of the real session card appearing in the list.
- **SC-003**: After 30 seconds with no real session, the placeholder card is no longer visible in the sessions list.
- **SC-004**: No placeholder card is shown when the headless (copy-command) response is returned.
- **SC-005**: Two simultaneous launches for the same repository result in two visible placeholder cards.

## Assumptions

- The feature targets only the terminal-launch path ("Launch with Argus" button). Sessions started by running the CLI directly are not affected.
- The placeholder card does not require backend persistence; it is a transient UI state scoped to the current browser session.
- The 30-second timeout for auto-removal is a reasonable default covering normal startup latency; it does not need to be user-configurable in this version.
- The headless/copy-command path (status 422 from the launch endpoint) does not trigger a placeholder because Argus did not initiate the launch.
- The existing real-time session update mechanism (WebSocket or SSE) already delivers new sessions to the frontend and can be used to detect when a placeholder should be replaced.

# Feature Specification: Fix Send Prompts

**Feature Branch**: `020-fix-send-prompts`
**Created**: 2026-04-07
**Status**: Clarified
**Input**: User description: "investigate send prompts message not working"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Sends a Prompt to an Active Session (Priority: P1)

An Argus operator types a message into the session prompt bar and submits it. The prompt should be delivered to the running Claude Code session and Claude Code should act on it.

**Why this priority**: This is the core purpose of the prompt bar. Without it, all remote control interactions that rely on text prompts are silently dropped, with no feedback that anything is wrong.

**Independent Test**: Can be tested by typing a prompt in the session detail view, clicking the enter button, and confirming Claude Code receives and responds to the message.

**Acceptance Scenarios**:

1. **Given** a Claude Code session is active, **When** the operator submits a non-empty prompt, **Then** the prompt is delivered to the Claude Code process and Claude Code begins acting on it.
2. **Given** a Claude Code session is active, **When** the operator submits a prompt, **Then** the session prompt bar shows a loading indicator until the delivery is confirmed.
3. **Given** a Claude Code session is active, **When** the prompt is delivered successfully, **Then** the prompt bar clears and no error is shown.

---

### User Story 2 - Operator Receives an Error When Delivery Fails (Priority: P1)

If prompt delivery fails (session unreachable, process not running, remote trigger unavailable), the operator sees a meaningful error message rather than a silent failure.

**Why this priority**: Currently the action is recorded as `'sent'` regardless of whether delivery succeeded. Operators cannot tell if their prompt was received.

**Independent Test**: Can be tested by attempting to send a prompt to a session whose underlying process has exited, and verifying an error is shown.

**Acceptance Scenarios**:

1. **Given** a session whose process has ended, **When** the operator submits a prompt, **Then** an error message is shown explaining delivery failed.
2. **Given** a transient delivery failure, **When** the prompt cannot be delivered, **Then** the action status in the system reflects the failure (not `'sent'`).

---

### User Story 3 - Quick Commands Are Delivered (Priority: P2)

The actions menu quick commands (Merge, Pull latest) use the same send-prompt path. They should work once prompt delivery is fixed.

**Why this priority**: These are important workflow shortcuts but depend entirely on the core fix.

**Independent Test**: Can be tested by triggering a Merge or Pull latest command and verifying Claude Code receives and executes it.

**Acceptance Scenarios**:

1. **Given** a Claude Code session is active, **When** the operator selects "Merge" from the actions menu and confirms, **Then** Claude Code receives the merge prompt and begins execution.
2. **Given** a Claude Code session is active, **When** the operator selects "Pull latest" and confirms, **Then** Claude Code receives the pull prompt.

---

### Edge Cases

- What happens when the session is active in the registry but the underlying Claude Code process has already exited?
- How does the system handle a prompt submitted while a previous prompt is still being processed by Claude Code?
- What happens when the Claude Code remote trigger endpoint is temporarily unavailable?
- What if the session's remote trigger credentials or endpoint URL are unknown or missing?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST deliver a submitted prompt to the running Claude Code process associated with the session.
- **FR-002**: The system MUST update the `ControlAction` status to reflect actual delivery outcome: `completed` on success, `failed` on failure.
- **FR-003**: The system MUST expose the delivery failure reason to the frontend so the operator can see a meaningful error.
- **FR-004**: The system MUST NOT mark a `ControlAction` as `'sent'` until delivery to the Claude Code process has been confirmed or attempted.
- **FR-005**: The system MUST handle sessions where the underlying process is no longer reachable and return an appropriate error.
- **FR-006**: All quick-command prompts (merge, pull, exit) sent via the actions menu MUST follow the same delivery path as manually typed prompts.
- **FR-007**: The system MUST provide an `argus launch <tool>` command that starts the AI tool inside a PTY session owned by Argus.
- **FR-008**: PTY-launched sessions MUST be automatically registered in Argus and appear in the dashboard alongside hook-detected sessions.
- **FR-009**: The session detail view MUST visually distinguish PTY-launched sessions (prompt-capable) from hook-detected sessions (read-only), so operators know whether prompt injection is available.

### Key Entities

- **ControlAction**: Represents a remote control instruction sent to a session. Has a lifecycle: `pending` during delivery, `completed` on success, `failed` on failure. Currently bypasses the pending state for `send_prompt`.
- **Session**: An active Claude Code process tracked by Argus. Has a `pid`, `id`, `type`, and `status`. The delivery mechanism needs a way to address the Claude Code process.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A prompt submitted via the session prompt bar reaches the Claude Code session within 3 seconds under normal conditions.
- **SC-002**: 100% of failed prompt deliveries result in a visible error to the operator, with no silent failures.
- **SC-003**: The `ControlAction` record accurately reflects the delivery outcome (completed or failed) for every send-prompt attempt.
- **SC-004**: All existing session control actions (stop, interrupt) continue to work without regression after the fix.
- **SC-005**: Quick-command prompts (merge, pull) are delivered successfully when the session is active.

## Assumptions

- Users start their AI tool sessions via `argus launch <tool>` (e.g., `argus launch claude`, `argus launch gh copilot`). Sessions started outside Argus remain read-only (detected via hooks, no write channel).
- The PTY launcher uses `node-pty` which supports Windows (ConPTY) and Mac/Linux (POSIX PTY) without platform-specific code paths in the application layer.
- The fix applies to both `claude-code` and `copilot-cli` session types. Both tools accept prompt text via stdin.
- The existing `ControlAction` database schema and broadcast infrastructure are reused without structural changes.
- The Argus backend process stays running for the lifetime of any launched session; if the backend restarts, PTY handles are lost and those sessions become read-only.
- `argus launch` works identically inside any terminal host (VS Code integrated terminal, Windows Terminal, iTerm2, etc.).

## Clarifications

### Session 2026-04-07

- **Delivery mechanism**: PTY launcher using `node-pty`. Argus spawns the AI tool process inside a PTY it owns. The user runs `argus launch claude` or `argus launch gh copilot` instead of the tool directly. Argus holds the PTY master write handle and injects text on demand. Works cross-platform for both Claude Code and GitHub Copilot CLI. Stdin injection of already-running (hook-detected) sessions is not feasible; those sessions remain read-only.

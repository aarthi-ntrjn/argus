# Feature Specification: Copilot CLI Hooks Integration

**Feature Branch**: `063-copilot-hooks`
**Created**: 2026-05-03
**Status**: Draft
**Input**: User description: "Copilot actually supports hooks. Our implementation incorrectly assumed it does not. Mirror the Claude Code hooks approach for Copilot with an appropriate hooks adapter, sharing as much code and interfaces as possible."

## Context

Argus currently detects GitHub Copilot CLI sessions using file polling: it scans `~/.copilot/session-state/` every 5 seconds for lock files and reads `events.jsonl` for output. This means Copilot session starts, session ends, and Attention Needed (ask_user) events are all detected reactively and with up to a 5-second lag.

GitHub Copilot CLI supports a hooks system via a `hooks.json` file in `.github/hooks/` of the working directory, with events `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`, `userPromptSubmitted`, and `errorOccurred`. This is structurally equivalent to Claude Code's hook system (which Argus already uses). Copilot delivers hook payloads via stdin to a shell command, whereas Claude Code delivers them via HTTP POST with environment variables.

This feature adds a Copilot hooks adapter that injects hooks into each registered repository, receives payloads via a new endpoint, and processes them through shared interfaces that are already used by the Claude Code hooks path.

## Clarifications

### Session 2026-05-03

- Q: How should Argus identify its own entries in `hooks.json` for safe removal? → A: Match by command string pattern — the same approach used for Claude Code. Any entry whose `bash` or `powershell` field contains the Argus endpoint URL (`127.0.0.1:{PORT}/hooks/copilot`) is considered Argus-owned and may be removed on unregister.
- Q: How should stale hook entries (wrong port from a previous Argus instance) be handled? → A: Always remove and re-inject all Argus-owned entries on startup, identical to how Claude Code's `injectHooks()` works. Any entry matching the `*/hooks/copilot` URL pattern is removed and replaced with the current port.
- Q: What should Argus do when a hook payload arrives for an unknown session ID (hook fires before lock file scan)? → A: Create a provisional session record immediately from hook data. The lock file scan reconciles PID and full metadata on its next cycle. Mirrors how Claude Code handles hook-first session creation.
- Q: Should both `bash` and `powershell` variants be written into every injected hook entry, or only the platform-detected one? → A: Always write both variants in every entry. Copilot's `hooks.json` has dedicated `bash` and `powershell` fields for this purpose, and writing both ensures a committed `hooks.json` works on any OS.

## User Scenarios & Testing

### User Story 1 - Immediate Attention Needed Detection (Priority: P1)

An Argus user is monitoring a Copilot CLI session. Copilot asks a question via the ask_user tool. The Attention Needed panel should appear on the Argus dashboard immediately when Copilot fires the preToolUse hook, not after the JSONL file is written and scanned.

**Why this priority**: This is the most impactful user-visible gap. Currently the Attention Needed panel appears with a noticeable delay because Copilot has no hook-based detection. Immediate notification is the primary value of adding hooks.

**Independent Test**: Register a repository with Copilot active. Trigger an ask_user prompt. Measure time from Copilot firing the hook to the Attention Needed panel appearing in Argus. Delivers immediate question visibility without polling delay.

**Acceptance Scenarios**:

1. **Given** a Copilot session is active in a registered repository, **When** Copilot fires a `preToolUse` hook for `ask_user`, **Then** the Attention Needed panel appears in the Argus dashboard within 500ms.
2. **Given** the Attention Needed panel is showing, **When** Copilot fires a `postToolUse` hook for `ask_user`, **Then** the panel is dismissed immediately.
3. **Given** Argus receives a `preToolUse` hook payload, **When** the payload contains question text and choices, **Then** the panel shows the correct question and all choices.

---

### User Story 2 - Immediate Session Start and End Detection (Priority: P1)

A user launches a Copilot CLI session in a registered repository. The session should appear in the Argus dashboard within 1 second, not after the next 5-second polling cycle. When the session ends, it should update immediately.

**Why this priority**: Session discovery lag makes Argus feel unreliable for Copilot users compared to Claude Code users. This is the foundational improvement the hooks system enables.

**Independent Test**: Register a repository. Start a Copilot CLI session. Verify the session card appears in Argus within 1 second. End the session and verify the status updates immediately. Delivers visible, measurable improvement with no other feature required.

**Acceptance Scenarios**:

1. **Given** a repository is registered in Argus, **When** a Copilot session starts in that repository, **Then** the session card appears in the Argus dashboard within 1 second.
2. **Given** a Copilot session is tracked by Argus, **When** the session ends and Copilot fires the `sessionEnd` hook, **Then** the session status updates to ended immediately.
3. **Given** Argus is restarted while a Copilot session is running, **When** the session fires its next hook, **Then** Argus recognizes the session and resumes tracking it.

---

### User Story 3 - Automatic Hook Injection for Registered Repositories (Priority: P1)

When a user registers a repository with Argus, Copilot hooks are automatically written to that repository's `.github/hooks/hooks.json` so no manual configuration is needed.

**Why this priority**: Without automatic injection, none of the hook benefits apply. This is the prerequisite for all other stories.

**Independent Test**: Register a new repository with Argus. Verify `.github/hooks/hooks.json` is created or updated with Argus hook entries. Delivers the prerequisite for stories 1 and 2.

**Acceptance Scenarios**:

1. **Given** a repository has no `.github/hooks/hooks.json`, **When** it is registered with Argus, **Then** the file is created with Argus hooks for `sessionStart`, `sessionEnd`, `preToolUse`, and `postToolUse`.
2. **Given** a repository already has a `.github/hooks/hooks.json` with user-defined hooks, **When** it is registered with Argus, **Then** Argus hooks are added without removing the existing entries.
3. **Given** a repository is removed from Argus, **Then** the Argus-injected hooks are removed from `hooks.json`, and the file is deleted if it becomes empty.
4. **Given** Argus starts with already-registered repositories, **When** startup completes, **Then** hooks are re-injected into all registered repositories idempotently.

---

### User Story 4 - Graceful Fallback When Hooks Are Unavailable (Priority: P2)

If hook injection fails (repository is read-only, Copilot version does not support hooks, or the `.github/` directory cannot be created), Argus falls back to the existing polling-based detection and logs a clear warning.

**Why this priority**: Polling already works. Graceful fallback ensures the new hooks path does not break existing users whose environments do not support it.

**Independent Test**: Make `.github/hooks/` non-writable in a registered repository. Verify Argus logs a warning naming the repository and reason, and continues detecting the session via JSONL polling.

**Acceptance Scenarios**:

1. **Given** hook injection fails for a repository, **When** Argus logs the failure, **Then** the message names the repository and the reason (permission denied, unsupported version, etc.).
2. **Given** hook injection failed, **When** a Copilot session starts in that repository, **Then** Argus still detects and tracks it via JSONL polling.
3. **Given** a hook delivery fails (Argus server not yet started when hook fires), **When** the error occurs, **Then** Copilot is not disrupted and Argus continues operating.

---

### Edge Cases

- What happens when two Copilot sessions start simultaneously in different repositories and both fire `sessionStart` hooks at the same time?
- What happens when `hooks.json` is corrupted or contains invalid JSON before Argus tries to inject?
- When a hook payload arrives for a session ID not yet in the lock file scan, Argus creates a provisional session record immediately; the next lock file scan reconciles PID and full metadata.
- What happens when the Argus server port changes between the time Copilot reads `hooks.json` and the time it fires a hook?
- What happens if Copilot fires a `preToolUse` hook for a tool other than `ask_user`?
- What happens when two Argus instances are running and both inject hooks into the same repository?

## Requirements

### Functional Requirements

- **FR-001**: Argus MUST inject Copilot hook entries into `<repo-path>/.github/hooks/hooks.json` for every registered repository when the repository is added and on server startup.
- **FR-002**: Injected hooks MUST cover at minimum `sessionStart`, `sessionEnd`, `preToolUse` (for `ask_user`), and `postToolUse` (for `ask_user`) events.
- **FR-003**: Hook injection MUST be idempotent and self-healing: on every startup, all existing Argus-owned entries (identified by URL pattern) are removed and re-injected with the current port, so stale entries from a previous Argus instance are automatically corrected.
- **FR-004**: Hook injection MUST preserve any existing non-Argus hooks already present in `hooks.json`.
- **FR-005**: Argus MUST expose a new HTTP endpoint to receive Copilot hook payloads, distinct from the existing Claude Code hook endpoint (`POST /hooks/claude`).
- **FR-006**: The Copilot hook endpoint MUST accept the hook payload forwarded from Copilot's stdin and process it using the same shared interfaces used by the Claude Code hook path (shared pending choice event bus, shared session upsert logic).
- **FR-007**: On receiving a `preToolUse` payload for `ask_user`, Argus MUST broadcast the pending choice event immediately using the same `pendingChoiceEvents` bus used by Claude Code.
- **FR-008**: On receiving a `postToolUse` payload for `ask_user`, Argus MUST dismiss the pending choice immediately.
- **FR-009**: On receiving any hook payload for an unknown session ID, Argus MUST create a provisional session record immediately from the hook data without waiting for the next polling cycle. The lock file scan reconciles PID and full metadata on its next run.
- **FR-010**: On receiving a `sessionEnd` payload, Argus MUST mark the session as ended immediately.
- **FR-011**: No duplicate pending choice broadcasting logic may be introduced: the Copilot hooks path MUST reuse the same interfaces as `ClaudeCodeDetector`.
- **FR-012**: When a repository is removed from Argus, the Argus-managed hook entries MUST be removed from `hooks.json`.
- **FR-013**: If hook injection fails for a repository, Argus MUST log a warning and continue operating with polling-based detection for that repository.
- **FR-014**: Every injected hook entry MUST include both a `bash` field (Linux/macOS) and a `powershell` field (Windows) regardless of the platform Argus is running on, so a committed `hooks.json` works correctly on any OS.
- **FR-015**: JSONL-based watching and polling MUST remain as a fallback for repositories where hook injection is unavailable or hooks are not fired.

### Key Entities

- **CopilotHookPayload**: The JSON object received from Copilot via stdin, containing the event name (equivalent to `hook_event_name` in Claude Code), session ID, working directory, tool name, and tool arguments. Normalized to the same shape as the Claude Code `HookPayload` interface after parsing.
- **HooksJson**: The structure of `.github/hooks/hooks.json` as read and written by Argus. Includes a version field and a hooks map keyed by event name, each containing an array of command entries.
- **ArgusHookEntry**: A command entry written by Argus into `hooks.json`. Identified by the presence of the Argus endpoint URL in its `bash` or `powershell` command string (e.g., `127.0.0.1:{PORT}/hooks/copilot`), matching the same pattern used for Claude Code hook identification. No custom metadata field required.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Attention Needed panels for Copilot sessions appear within 500ms of Copilot firing the `preToolUse` hook, compared to the current up to 5-second polling delay.
- **SC-002**: Copilot session cards appear in the Argus dashboard within 1 second of session start, compared to the current up to 5-second delay.
- **SC-003**: Hook injection runs without errors for 100% of writable registered repositories on server startup.
- **SC-004**: No new pending choice broadcasting logic is duplicated: the Copilot hooks path reuses the same interfaces and event bus as the Claude Code hooks path, verifiable by code review.
- **SC-005**: Removing a repository from Argus leaves its `hooks.json` in a valid state with all Argus entries removed and no user-defined hooks affected.
- **SC-006**: All existing Copilot polling and JSONL watching behavior continues to work correctly after hooks are added, with hooks accelerating detection rather than replacing the fallback.

## Assumptions

- Copilot CLI installed in the user's environment supports the `hooks.json` system. Users on older versions fall back to polling without hooks and receive a logged warning.
- The Argus backend is running and listening on `127.0.0.1` at a known port when Copilot fires hooks. The injected hook command uses this loopback address.
- Copilot delivers hook payloads as JSON via stdin to the configured shell command. The injected command reads stdin and forwards the payload to Argus via HTTP.
- The Copilot `preToolUse` hook fires before the question is shown to the user, equivalent to Claude Code's `PreToolUse` hook, enabling proactive panel display.
- Repositories registered with Argus are writable by the process running Argus. If not writable, the fallback path is used.
- The `userPromptSubmitted` and `errorOccurred` hook events are out of scope for v1. Only session lifecycle and ask_user hooks are needed to reach Claude Code parity.
- The `hooks.json` schema used by Copilot CLI is stable across minor version updates.
- Multiple Copilot sessions in different repositories each fire their own hooks independently; no cross-session coordination is needed in the hook endpoint.

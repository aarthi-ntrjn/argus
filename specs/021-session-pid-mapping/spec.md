# Feature Specification: Session-to-PID Mapping

**Feature Branch**: `021-session-pid-mapping`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "The detection of Claude Code sessions is super buggy. There is no mapping between Claude Code JSONL files and process ID. Argus should do this mapping and maintain it internally, for both Claude Code and Copilot CLI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Claude Code session-to-PID mapping (Priority: P1)

As a developer running one or more Claude Code sessions, I want Argus to correctly identify which operating system process owns each Claude Code session, so that Argus can reliably detect when a session starts, ends, or goes idle, and can terminate sessions via the dashboard.

**Why this priority**: This is the root cause of most session detection bugs. Without a reliable PID mapping, Argus cannot tell sessions apart, cannot detect session end, and cannot offer "Stop Session" functionality. Every other session lifecycle feature depends on this mapping being correct.

**Independent Test**: Start two Claude Code sessions in two different registered repos. Both sessions appear on the dashboard, each with its own PID displayed. Stop one session (type `/exit`). That session transitions to "ended" within 10 seconds while the other remains "running".

**Acceptance Scenarios**:

1. **Given** Argus is running and one Claude Code session is active, **When** the session's first hook fires, **Then** Argus resolves the session's PID by correlating the hook's `cwd` and `session_id` with the process list (matching processes whose command line references Claude) and stores it on the session record.
2. **Given** two Claude Code sessions are active in different repos, **When** each session fires a hook, **Then** Argus assigns the correct PID to each session independently (no ambiguity).
3. **Given** a Claude Code session has an assigned PID, **When** that PID exits, **Then** the session is marked "ended" within one reconciliation cycle (5 seconds).
4. **Given** a Claude Code session was detected via JSONL scan (no hook fired yet), **When** exactly one Claude process is found for that repo's encoded project directory, **Then** Argus assigns that process's PID to the session.

---

### User Story 2 - Copilot CLI PID mapping robustness (Priority: P2)

As a developer running Copilot CLI sessions, I want Argus to maintain PID mappings for Copilot CLI sessions using the existing lock file mechanism but with improved fallback behavior when the lock file is missing or stale.

**Why this priority**: Copilot CLI already has a working PID mechanism via `inuse.{PID}.lock` files. This story hardens that path so it handles edge cases like lock files disappearing mid-session or stale lock files from crashed processes.

**Independent Test**: Start a Copilot CLI session. Verify the PID is shown on the dashboard. Kill the Copilot process externally. Verify the session transitions to "ended" within 10 seconds.

**Acceptance Scenarios**:

1. **Given** a Copilot CLI session directory with `inuse.{PID}.lock`, **When** Argus scans, **Then** the PID from the lock filename is stored on the session.
2. **Given** a Copilot CLI session whose lock file disappears while the session is active, **When** the next scan runs, **Then** Argus marks the session ended (lock file is the source of truth for Copilot CLI liveness).
3. **Given** a stale lock file referencing a PID that is no longer running, **When** Argus scans, **Then** the session is marked "ended".

---

### User Story 3 - Internal PID mapping table with audit trail (Priority: P2)

As a developer or Argus maintainer, I want Argus to maintain an internal `session_pids` table that records every PID assignment for a session (with timestamps and source), so that PID resolution is traceable and debuggable.

**Why this priority**: The current code assigns PIDs in multiple places with no audit trail. When PID assignment fails, there is no way to debug what happened. A dedicated mapping table makes the system observable and supports multiple PID reassignment scenarios (e.g., process restart, PID resolved later).

**Independent Test**: Start a Claude Code session. Query `GET /api/v1/sessions/:id` and verify the response includes the PID and the source of the PID assignment (e.g., "hook_cwd_match", "pty_registry", "lockfile"). Check the `session_pids` table in the database and verify a row exists with the assignment timestamp.

**Acceptance Scenarios**:

1. **Given** a session is created, **When** a PID is assigned via any mechanism, **Then** a row is inserted into `session_pids` with: `session_id`, `pid`, `assigned_at` (ISO timestamp), `source` (enum: "pty_registry", "hook_cwd_match", "scan_single_process", "lockfile", "process_tree_walk"), and `is_current` (boolean).
2. **Given** a session's PID is reassigned (e.g., launcher resolves real PID from shell wrapper), **When** the new PID is stored, **Then** the old mapping row has `is_current=false` and a new row is inserted with `is_current=true`.
3. **Given** a session with PID mapping history, **When** querying the API, **Then** the response includes the current PID and the source of the mapping.

---

### User Story 4 - Process-tree-based PID resolution on Windows (Priority: P3)

As a Windows user, I want Argus to walk the process tree to find the real Claude Code process when the immediate process is a shell wrapper (e.g., `powershell.exe` spawning `claude.exe`), so that PID-based liveness checks and kill commands target the correct process.

**Why this priority**: On Windows, `node-pty` spawns `powershell.exe`, not `claude.exe` directly. The launcher already has process tree walking logic. This story centralizes that logic for use by both the launcher and the detector.

**Independent Test**: On Windows, launch Claude via Argus. Verify the session card shows the `claude.exe` PID (not the `powershell.exe` PID). Open Task Manager to confirm the PID matches the actual Claude process.

**Acceptance Scenarios**:

1. **Given** a session launched via PTY on Windows, **When** the initial PID is a shell wrapper, **Then** Argus walks the process tree (max depth 5) to find the innermost non-`conhost.exe` child and updates the session PID.
2. **Given** a detected Claude Code session on Windows, **When** a Claude process is found by name (`claude.exe` or `node.exe` with `claude` in the command line), **Then** that PID is assigned to the session regardless of whether it matches the original wrapper PID.

---

### Edge Cases

- What happens when two Claude Code sessions run in the same repo? Each has a distinct session ID and JSONL file. Argus MUST scan all recent JSONL files per repo and attempt PID assignment for each. If the PIDs cannot be distinguished (same process name, same repo), both sessions get `pid=null` and rely on JSONL freshness.
- What happens when a Claude process crashes without firing the Stop hook? The PID will no longer appear in the process list; `reconcileStaleSessions()` MUST detect this and mark the session ended.
- What happens when Argus starts after Claude is already running? `scanExistingSessions()` MUST find JSONL files and attempt PID resolution via the process list.
- What happens when the process list query (`psList`) fails or times out? PID assignment MUST be best-effort; session creation should proceed with `pid=null` and retry on the next poll cycle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST resolve the PID for each Claude Code session by matching the hook payload's `cwd` against running Claude processes (via `psList` with command-line inspection).
- **FR-002**: System MUST store PID assignments in a `session_pids` table with columns: `id`, `session_id`, `pid`, `assigned_at`, `source`, `is_current`.
- **FR-003**: System MUST handle multiple concurrent Claude Code sessions by resolving PIDs independently per session (not relying on a single-process assumption).
- **FR-004**: System MUST fall back to JSONL file freshness checks when PID resolution fails (e.g., `psList` error, no matching process found).
- **FR-005**: System MUST mark a session as "ended" within one reconciliation cycle (5 seconds) when its assigned PID is no longer in the process list.
- **FR-006**: System MUST continue to use the `inuse.{PID}.lock` mechanism for Copilot CLI sessions, with the session marked ended when the lock file is missing or the PID is not running.
- **FR-007**: System MUST expose the current PID and its assignment source in the `GET /api/v1/sessions/:id` API response.
- **FR-008**: System MUST re-attempt PID resolution on every poll cycle for sessions that have `pid=null`, until either a PID is found or the session is ended.
- **FR-009**: On Windows, system MUST walk the process tree to resolve shell wrappers (e.g., `powershell.exe`) to the real tool process (e.g., `claude.exe`).
- **FR-010**: System MUST NOT create duplicate session records when the same JSONL file is scanned multiple times across poll cycles.

### Key Entities

- **Session**: Existing entity, gains reliable `pid` field and `pidSource` metadata.
- **SessionPidMapping**: New entity tracking every PID assignment for a session, including source and timestamp.
- **ProcessInfo**: Transient in-memory structure representing a running process from `psList` (pid, name, cmd, ppid).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When two Claude Code sessions run simultaneously in different repos, both sessions have non-null PIDs on the dashboard within 10 seconds of their first hook.
- **SC-002**: When a Claude Code process exits, the corresponding session transitions to "ended" within 10 seconds (two reconciliation cycles).
- **SC-003**: The `session_pids` table contains at least one row per session that was assigned a PID, with correct `source` and `assigned_at` values.
- **SC-004**: On Windows, PTY-launched sessions show the real tool PID (not the shell wrapper PID) within 15 seconds of launch.
- **SC-005**: Copilot CLI sessions continue to detect PID from lock files and transition to "ended" within 10 seconds of process exit.
- **SC-006**: Sessions with `pid=null` are retried for PID resolution on each 5-second poll cycle.

## Assumptions

- `psList` npm package returns process name, PID, parent PID, and command line on all supported platforms (Windows, macOS, Linux).
- On Windows, `psList` may not return `cwd` per process, so matching relies on command-line string inspection or process tree walking.
- Claude Code sessions always have a corresponding JSONL file at `~/.claude/projects/{encodedPath}/{sessionId}.jsonl`.
- Copilot CLI sessions always have a session directory at `~/.copilot/session-state/{sessionId}/`.
- The Argus server polls every 5 seconds (existing behavior, not changed by this feature).
- The `session_pids` table is append-only for audit purposes; old rows are never deleted, only marked `is_current=false`.

# Research: Fix Session Disappears After 30-Minute Inactivity

**Date**: 2026-04-07
**Branch**: `020-fix-session-refresh-timeout`

## Decision Log

### D-001: JSONL mtime as primary trigger, PID as tiebreaker

**Decision**: Keep JSONL mtime as the staleness detector. When mtime exceeds the threshold, use a PID check to decide between `idle` (process alive) and `ended` (process dead). This replaces the current dual-path logic (PID check for sessions with PIDs, mtime check for sessions without).

**Rationale**: JSONL mtime is reliable across all OSes and requires no OS-specific permission. PID checks add precision only when needed (stale mtime). Avoids PID-reuse false positives by not using PID as the primary signal.

**Alternatives considered**:
- PID-first approach: rejected — PID reuse (especially on Windows short-lived process cycles) can keep a dead session alive
- File-handle detection (is the JSONL file held open?): rejected — OS-specific, requires elevated permissions on some systems, adds significant complexity

---

### D-002: Reuse existing `idle` status — no schema migration

**Decision**: The `SessionStatus` TypeScript union already includes `'idle'`. The SQLite `sessions` table has no CHECK constraint on the status column. No migration is needed.

**Rationale**: `idle` was already anticipated in the type system but never exercised. All existing query filters that restrict by status (`getSessions({ status: 'active' })`) will naturally exclude `idle` sessions unless explicitly expanded — making the change backward-safe for all non-reconciliation code paths.

**Note**: The existing `session-monitor.test.ts` has a comment `// T092: idle status no longer exists for Claude Code`. This is factually incorrect — the type exists; the status was simply never set. The tests in that file that assert `ended` on missing JSONL are still correct (missing JSONL with any PID state → `ended`). New tests cover the `stale JSONL + alive PID → idle` path.

---

### D-003: Dynamic config read per reconciliation cycle

**Decision**: `reconcileClaudeCodeSessions` calls `loadConfig()` on each invocation rather than caching the threshold at startup.

**Rationale**: `loadConfig()` is a cheap synchronous file read (< 1ms). Reconciliation runs every 5s. Dynamic reading makes threshold changes effective within 5 seconds without any restart or reload endpoint. The `saveConfig()` + `loadConfig()` pairing in the config module already supports this pattern.

**Alternatives considered**:
- Cache config at startup, expose a `/reload` endpoint: rejected — unnecessary complexity
- Config change event / file watcher: rejected — overkill for a 5-second polling system

---

### D-004: New `GET/PATCH /api/v1/settings` endpoint

**Decision**: Add a settings API so the dashboard UI can expose the threshold as a configurable field.

**Rationale**: SC-003 requires configurability without restart. An API endpoint aligns with the existing RESTful pattern and allows the frontend settings panel to read/write the threshold in-app.

**Alternatives considered**:
- Environment variable only: rejected — not changeable at runtime
- Dedicated `/api/v1/settings/idle-threshold` endpoint: rejected — a general settings endpoint is more extensible and consistent with existing config shape

---

### D-005: Default threshold raised to 60 minutes

**Decision**: Change the default `idleSessionThresholdMinutes` from 30 to 60.

**Rationale**: 30 minutes is shorter than many typical focused coding sessions. 60 minutes covers most meeting/break durations. Users can lower it if desired.

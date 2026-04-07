# Implementation Plan: Fix Session Disappears After 30-Minute Inactivity

**Branch**: `020-fix-session-refresh-timeout` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/020-fix-session-refresh-timeout/spec.md`

## Summary

Sessions disappear from the Argus dashboard after 30 minutes of Claude Code inactivity because the reconciliation logic treats JSONL staleness as a terminal signal (marks `ended`) without checking whether the underlying process is still running. The fix reuses the existing `idle` status (already in the TypeScript type union but never set by the backend) and introduces a two-step reconciliation: JSONL mtime is the primary staleness trigger; a PID liveness check is the tiebreaker that decides between `idle` (process alive) and `ended` (process dead). A new settings API allows the threshold to be changed without restarting Argus.

## Technical Context

**Language/Version**: TypeScript 5 (Node.js 22)
**Primary Dependencies**: Fastify 5, better-sqlite3 3.9, chokidar 4, ps-list 8, Vitest 3, React 18
**Storage**: SQLite (`~/.argus/argus.db`) — no schema migration needed (status column has no CHECK constraint; `idle` status already in TS type union)
**Testing**: Vitest 3 — test files in `backend/tests/{unit,integration,contract}/` and `frontend/__tests__/`
**Target Platform**: Local developer tool (Windows, macOS, Linux)
**Project Type**: Web application (Fastify API + React SPA), npm workspaces monorepo
**Performance Goals**: Reconciliation cycle every 5s; idle/ended classification must resolve within one cycle
**Constraints**: `updateSessionStatus(id, status, endedAt | null)` accepts null endedAt — use null when transitioning to `idle`
**Scale/Scope**: §VIII exception applies — single local user, target ≥10 concurrent sessions

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| §I Engineering — simple, reversible | PASS | Config file change is reversible; default threshold increase is the only permanent change |
| §II Architecture — versioned API boundaries | PASS | New settings route follows existing Fastify route pattern; no cross-service DB access |
| §III Code Standards — functions < 50 lines | PASS | `reconcileClaudeCodeSessions` currently 43 lines; refactored version stays within limit |
| §IV Test-First | REQUIRED | Tests written before implementation in every phase |
| §V Testing — unit + integration + E2E | REQUIRED | Unit tests for reconciliation logic, contract tests for settings API, E2E for dashboard persistence |
| §VI Security — localhost exception | PASS | Service bound to 127.0.0.1; §VI exception declared in spec |
| §VII Observability — structured logs | REQUIRED | Add structured log on each `active → idle` and `idle → ended` transition |
| §VIII Performance — localhost exception | PASS | §VIII exception applies; ≥10 concurrent sessions target |
| §IX AI usage | N/A | No AI-specific code changes |
| §X Definition of Done | REQUIRED | All checklist items satisfied before merge |
| §XI Documentation | REQUIRED | README update included in final phase |
| §XII Error Handling | REQUIRED | JSONL missing, PID check permission denied: handle gracefully with structured log |

## Project Structure

### Documentation (this feature)

```text
specs/020-fix-session-refresh-timeout/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── settings-api.md
└── tasks.md
```

### Source Code (changed files)

```text
backend/src/
├── models/index.ts                          (add idleSessionThresholdMinutes to ArgusConfig)
├── config/config-loader.ts                  (add idleSessionThresholdMinutes default: 60)
├── services/session-monitor.ts              (new reconciliation logic — core of the fix)
├── api/routes/settings.ts                   (new: GET + PATCH /api/v1/settings)
└── api/server.ts                            (register settings route)

frontend/src/
├── types.ts                                 (add idleSessionThresholdMinutes to ArgusConfig)
└── utils/sessionUtils.ts                    (exclude idle from isInactive())

backend/tests/
├── unit/session-monitor.test.ts             (extend: add idle/ended disambiguation cases)
└── contract/settings.test.ts               (new: GET + PATCH /api/v1/settings contract tests)

frontend/__tests__/                          (extend: sessionUtils idle exclusion tests)
README.md                                    (document idle status, new threshold default, settings API)
```

**Structure Decision**: Web application layout (Option 2). Changes span both workspaces but each file is touched minimally.

## Implementation Phases

### Phase 1 — Backend reconciliation fix (core bug fix)

**Goal**: Sessions with a live process are marked `idle` instead of `ended` after JSONL inactivity.

**New `reconcileClaudeCodeSessions` logic** (`session-monitor.ts`):

```
Query sessions WHERE status IN ('active', 'idle') AND type = 'claude-code'
For each session:
  1. Resolve JSONL path for session's repository
  2. Get JSONL mtime:
     - If file missing: PID dead or null → ended; PID alive → ended (no file = abandoned)
     - If mtime FRESH (within threshold): if session.status === 'idle' → transition to active; else no change
     - If mtime STALE (beyond threshold):
       - Check PID: alive → idle; dead or null → ended
  3. On idle transition: updateSessionStatus(id, 'idle', null); emit 'session.updated'
  4. On ended transition: updateSessionStatus(id, 'ended', now); closeWatcher; emit 'session.ended'
  5. On active restore: updateSessionStatus(id, 'active', null); emit 'session.updated'
  6. Log each transition: { sessionId, fromStatus, toStatus, reason: 'jsonl_stale'|'pid_dead'|'jsonl_fresh' }
```

**Threshold source**: `loadConfig().idleSessionThresholdMinutes * 60_000` — read fresh each cycle (not cached) so config changes take effect within 5s.

**`reconcileStaleSessions` update** (startup-time sweep):

- Currently queries `active` sessions only. Extend to also query `idle` sessions.
- For `idle` sessions with a dead PID: mark `ended` (process died while Argus was down).

### Phase 2 — Config + Settings API

**Goal**: Threshold is configurable; default changed from 30 to 60 minutes.

- `ArgusConfig` gets `idleSessionThresholdMinutes: number` (both backend model and frontend type)
- Default: `60` (increased from 30)
- `GET /api/v1/settings`: returns full `ArgusConfig`
- `PATCH /api/v1/settings`: merges partial update, validates `idleSessionThresholdMinutes` is a positive integer ≥1, calls `saveConfig()`. No restart required — reconciliation reads config dynamically.

### Phase 3 — Frontend idle indicator

**Goal**: Dashboard shows idle sessions distinctly; `hideEndedSessions` does not hide them.

- `sessionUtils.isInactive()`: add `|| session.status === 'idle'` short-circuit to return `false` for already-classified idle sessions (prevents double-handling via the time-based resting check)
- `ENDED_STATUSES` in DashboardPage: already excludes `idle` — no change needed
- Visual indicator for `idle` status: add an "Idle" badge to session display (same location as the existing "resting" badge). The "resting" badge (20-min frontend timer) remains for `active` sessions that haven't been classified yet by the backend.

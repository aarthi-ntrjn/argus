# Implementation Plan: Tool Call Count in Session Card Preview

**Branch**: `077-tool-call-count-preview` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/077-tool-call-count-preview/spec.md`

## Summary

Session cards currently show "Waiting for output..." while the AI is actively making tool calls. Tool call events (`type: 'tool_use'`) are already written to the DB, broadcast via `session.output.batch`, and appended to the `session-output-last` React Query cache in real time — but the SessionCard preview logic only looks for `type === 'message' && role === 'assistant'` items and silently ignores them. The fix is **purely frontend**: extract a `derivePreviewState()` helper that counts `tool_use` items from the cached snapshot and renders one of three display states per the spec. No DB changes, no new backend events, and no new API calls are needed.

## Technical Context

**Language/Version**: TypeScript (Node 20 backend, React 18 frontend)
**Primary Dependencies**: Fastify (backend), React Query (frontend), SQLite (via better-sqlite3)
**Storage**: SQLite — `session_output` table, columns: `type`, `tool_name`, `tool_call_id`, `role`, `sequence_number`
**Testing**: Vitest (backend + frontend unit), Playwright (e2e)
**Target Platform**: Local desktop (single-user localhost)
**Project Type**: Web application — Node.js backend + React frontend
**Performance Goals**: Preview update within one WebSocket event cycle (~100ms)
**Constraints**: Session card output query currently fetches last 10 items; live WS events append to the cache, so the count grows accurately during an open session
**Scale/Scope**: ≥10 concurrent sessions (single-user localhost tool)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering — testable in isolation | PASS | Preview logic is a pure derivation from output items; unit-testable |
| §III Code Standards — functions < 50 lines | PASS | Preview derivation will be extracted to a helper |
| §IV Test-First | REQUIRED | Tests must be written before implementation |
| §V Testing — unit + integration + e2e | REQUIRED | Unit: preview derivation helper; e2e: SC-001 |
| §VII Observability | PASS | No new service; existing logging sufficient |
| §VIII Performance | PASS | Exempt (single-user localhost); one WS event cycle target defined |
| §XI Documentation | REQUIRED | README.md must be updated (user-facing behavior change) |

No constitution violations. All REQUIRED items are captured as tasks.

## Project Structure

### Documentation (this feature)

```text
specs/077-tool-call-count-preview/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── tasks.md             ← Phase 2 output (/speckit.tasks)
└── checklists/
    └── requirements.md
```

### Source Code (files affected)

```text
frontend/src/
├── components/
│   └── SessionCard/
│       └── SessionCard.tsx      ← update preview logic to show tool call count
└── utils/
    └── sessionUtils.ts          ← add derivePreviewState() helper

frontend/src/
└── __tests__/
    └── SessionCard.test.tsx     ← unit tests for all four preview display states

frontend/tests/e2e/
└── sc-077-tool-call-count.spec.ts   ← e2e for SC-001
```

No backend changes. No DB schema changes.

## Phase 0: Research

### Finding 1 — tool_use events are already fully handled by the backend

- `parseLine()` in the JSONL watcher base converts tool_use JSONL entries to `SessionOutput` with `type: 'tool_use'`
- `outputStore.insertOutput()` writes each row to the `session_output` DB table
- After any new output (including `tool_use`): `applyActivityUpdate(sessionId)` is called → updates `lastActivityAt` → broadcasts `session.updated`
- Simultaneously `insertOutput` broadcasts `session.output.batch` with the new outputs
- **Decision**: No backend changes required. FR-009 ("backend must emit session.updated on tool_use") is already satisfied by `applyActivityUpdate`.

### Finding 2 — Frontend session-output-last cache is already kept current

- `applyOutputBatchEvent` in `socket.ts` (lines 111–136) handles `session.output.batch` and appends all output types (including `tool_use`) to `['session-output-last', sessionId]` via `setQueryData`, keeping the most recent 10 items
- When a page loads mid-session, the initial API fetch (`getSessionOutput(id, { limit: 10 })`) returns the most recent 10 rows from the DB, which already includes any `tool_use` rows
- **Decision**: No changes to `socket.ts` or the query. The `session-output-last` cache already has the data the preview needs.

### Finding 3 — Current preview logic in SessionCard ignores tool_use

- **File**: `frontend/src/components/SessionCard/SessionCard.tsx` (lines 65–73)
- **Current behaviour**: only finds `type === 'message' && role === 'assistant'` items; all `tool_use` entries in the cache are ignored
- **Decision**: Replace with `derivePreviewState(items, isTerminated)` helper returning a discriminated union. SessionCard renders based on the returned state.

### Finding 4 — Copilot CLI parity is free

- Copilot CLI output goes through the same `JsonlWatcherBase` → `outputStore.insertOutput` → `applyActivityUpdate` path. `type: 'tool_use'` is already set for Copilot tool invocations. No platform-specific branching needed.

## Phase 1: Design

### Data Model

No schema changes. The existing `session_output` table already stores:

| Column | Relevant values |
|--------|----------------|
| `type` | `'tool_use'` for tool invocations |
| `role` | `null` for tool_use rows |
| `sequence_number` | Used to determine ordering (work cycle boundary) |

**Work Cycle boundary rule**: The most recent row with `type = 'message'` AND `role = 'assistant'` defines the boundary. Tool_use rows with a higher `sequence_number` than that boundary row belong to the current work cycle.

### Preview State Derivation (frontend helper)

```
function derivePreviewState(items: SessionOutput[], isTerminated: boolean):
  | { kind: 'waiting' }
  | { kind: 'text-only';  content: string }
  | { kind: 'tool-count-only'; count: number }
  | { kind: 'text-plus-count'; content: string; count: number }
```

Logic:

1. If terminated → find last assistant message → return `text-only` (or `waiting` if none).
2. Find last assistant message item (highest sequence_number with type=message, role=assistant).
3. Count tool_use items with sequence_number > last assistant message's sequence_number (or all tool_use items if no assistant message exists).
4. If tool count > 0 AND no assistant message → `tool-count-only`.
5. If tool count > 0 AND assistant message exists → `text-plus-count`.
6. If tool count = 0 AND assistant message exists → `text-only`.
7. If tool count = 0 AND no assistant message → `waiting`.

### Preview Rendering

| State | Preview box content |
|-------|-------------------|
| `waiting` | _"Waiting for output..."_ (italic, gray — unchanged) |
| `text-only` | Rendered Markdown of assistant message (unchanged) |
| `tool-count-only` | `"Running... N tool call(s)"` (monospace, gray-300) |
| `text-plus-count` | Rendered Markdown + `" +N tool call(s)"` appended inline |

Singular/plural: `count === 1 ? '1 tool call' : `${count} tool calls``

### Contracts

No new API endpoints or WebSocket event types. No backend changes.


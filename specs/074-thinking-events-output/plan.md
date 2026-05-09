# Implementation Plan: Thinking Events in Output Stream and Preview

**Branch**: `074-thinking-events-output` | **Date**: 2026-05-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/074-thinking-events-output/spec.md`

## Summary

Add `thinking` and `redacted_thinking` block parsing to the Claude Code JSONL parser, store them as a new `thinking` output event type, render them in the session detail output pane (expanded in verbose mode, collapsed-but-expandable in focused mode), and update the session card preview to show thinking content as the primary preview when thinking events are present, with a tool call count indicator.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 22 backend, React 18 frontend)
**Primary Dependencies**: better-sqlite3 (backend storage), React Query (frontend data fetching), Tailwind CSS (styling)
**Storage**: SQLite via existing `session_output` table — no schema changes required
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Local desktop (Electron-adjacent web app served on localhost)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Output pane renders within one render pass; no additional network requests for expand/collapse
**Constraints**: Focused/verbose toggle must be instant (client-side only, no network); preview must not regress for sessions without thinking
**Scale/Scope**: Single local user, up to ~50 active sessions, JSONL files up to tens of MB

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, testable, observable) | PASS | All new logic covered by unit + E2E tests |
| §II Architecture (versioned API boundaries) | PASS | No new endpoints; existing `/sessions/:id/output` already returns all types |
| §III Code Standards (< 50 lines, readable) | PASS | Changes are localized; no function will exceed 50 lines |
| §IV Test-First | PASS | Tests written before implementation in each task phase |
| §V Testing Requirements | PASS | Unit tests for parser, DB, display utils; E2E for UI flows |
| §VI Security — §VI Exception applies | PASS | Local single-user tool; auth exception declared in spec |
| §VII Observability | PASS | No new services; existing logging is sufficient |
| §VIII Performance — §VIII Exception applies | PASS | Single local user; expand/collapse is client-side |
| §X Definition of Done | PASS | README update included in final phase |
| §XI Documentation | PASS | README update task included in tasks |
| §XII Error Handling | PASS | No new error paths; empty/redacted content handled gracefully |

## Project Structure

### Documentation (this feature)

```text
specs/074-thinking-events-output/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Type definitions and DB notes
├── contracts/           # API contract (no change; documented for clarity)
└── tasks.md             # Phase output from /speckit.tasks
```

### Source Code (files modified or added)

```text
backend/
├── src/
│   ├── models/index.ts                                          # Add 'thinking' to OutputType
│   └── services/
│       └── claude-code/
│           └── claude-code-jsonl-parser.ts                     # Parse thinking + redacted_thinking blocks
└── tests/
    └── unit/
        └── claude-code-jsonl-parser.test.ts                    # New test cases for thinking blocks

frontend/
├── src/
│   ├── components/
│   │   ├── SessionCard/
│   │   │   └── SessionCard.tsx                                 # Preview shows thinking content + tool count
│   │   └── SessionDetail/
│   │       ├── SessionDetail.tsx                               # THINK badge + collapsed/expanded render
│   │       └── sessionDetailUtils.ts                          # thinking passes through buildDisplayItems
│   └── types/
│       └── index.ts (or types.ts)                              # OutputType extended to include 'thinking'
└── tests/
    ├── unit/
    │   ├── sessionDetailUtils.test.ts                          # thinking items pass through as singles
    │   └── SessionDetail.test.tsx                              # THINK badge rendering tests
    └── e2e/
        └── sc-074-thinking-events.spec.ts                      # E2E: stream display + preview
```

# Implementation Plan: Todo List Filter

**Branch**: `068-todo-filter` | **Date**: 2026-05-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/068-todo-filter/spec.md`

## Summary

Add live text filtering to the Todo panel by making the existing add-todo input dual-purpose: typing filters the visible list in real time; Enter still creates a new todo and clears the filter. Blur no longer creates a todo (current behavior removed by this feature). The change is frontend-only: pure client-side filter on already-loaded data with no new API surface.

## Technical Context

**Language/Version**: TypeScript 5.x / React 18  
**Primary Dependencies**: React, React Query (TanStack Query v5), Tailwind CSS  
**Storage**: N/A (client-side state only; no new persistence)  
**Testing**: Vitest + React Testing Library  
**Target Platform**: Web browser (all modern browsers)  
**Project Type**: Web application frontend component  
**Performance Goals**: Filter result visible within 100ms of each keystroke (trivially met by synchronous in-memory filtering)  
**Constraints**: Must not introduce any additional HTTP requests; must preserve all existing keyboard shortcuts  
**Scale/Scope**: Single user, single TodoPanel instance; no concurrency concerns

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering: simple, testable, reversible | PASS | Pure state change; no new abstractions |
| §II Architecture: no cross-service DB access | PASS | No backend changes |
| §III Code Standards: functions < 50 lines, self-documenting | PASS | New filter logic is a single memo line |
| §IV Test-First (NON-NEGOTIABLE) | PASS | Tests written before implementation |
| §V Testing: unit + integration coverage | PASS | RTL component tests cover all scenarios |
| §VI Security: auth/authz | PASS | Exception §VI applies: local single-user tool |
| §VII Observability: structured logs | PASS | No new server-side paths; no new logging required |
| §VIII Performance: p95 < 500ms | PASS | Exception §VIII applies: local developer tool; client-side filter is synchronous |
| §IX AI usage | PASS | Standard |
| §X Definition of Done | PASS | All gates tracked in tasks.md |
| §XI Documentation: README.md updated | PASS | README update task included |
| §XII Error Handling | PASS | No new error surfaces introduced |

## Project Structure

### Documentation (this feature)

```text
specs/068-todo-filter/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (affected files only)

```text
frontend/
├── src/
│   └── components/
│       └── TodoPanel/
│           └── TodoPanel.tsx          # All changes live here
└── src/
    └── components/
        └── TodoPanel/
            └── TodoPanel.test.tsx     # New test file (test-first)
```

## Phase 0: Research

See [research.md](research.md).

## Phase 1: Design

No new API endpoints, no new entities, no data-model changes. The feature is a pure frontend state change.

**Filter logic** (single expression, applied in `reversedTodos` memo):

```
const needle = filterText.trim().toLowerCase();
todos
  .slice()                            // preserve original order
  .reverse()
  .filter(todo => showDone || !todo.done)
  .filter(todo => needle === '' || todo.text.toLowerCase().includes(needle))
```

**Controlled input migration**: The add-todo input changes from `defaultValue=""` / `key={addRowId}` (uncontrolled reset) to `value={filterText}` / `onChange` (controlled). The key-based remount mechanism and its associated state (`addRowId`, `shouldFocusAdd`, `resetAddRow`) are removed. On todo creation success, `setFilterText('')` clears the input and `addRowRef.current?.focus()` restores focus.

**Blur behavior change**: `handleBlur` for draft rows currently creates a todo. Under the new spec, blur on the draft row does nothing (text stays; filter stays active). Only Enter creates a todo. This is a deliberate, user-requested behavior change.

**Empty-filter state message**: When `filterText.trim()` is non-empty and `reversedTodos` is empty (and not loading/error), render a short inline message: "No todos match your filter."

# Implementation Plan: Bash Command Approval Surfacing

**Branch**: `072-bash-approval-surface` | **Date**: 2026-05-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/072-bash-approval-surface/spec.md`

## Summary

Surface tool-use approval prompts (bash commands and any other PreToolUse event) on the session card for Claude Code and Copilot CLI sessions running without auto-approval. Both CLIs fire `PreToolUse` hooks to Argus for every tool use in non-YOLO mode. Currently `base-cli-detector.ts` only handles `PreToolUse` for `AskUserQuestion`/`ask_user` — all other tool approvals are silently dropped. The fix has two parts: (1) extend the Claude Code hooks injector to register a wildcard PreToolUse hook (Copilot CLI already sends all events), and (2) extend `handleHookPayload` in `base-cli-detector.ts` to surface non-ask_user PreToolUse events as `session.pending_choice` WS events using the existing `PendingChoicePanel` with fixed "Yes, run it" / "No, skip it" choices.

## Technical Context

**Language/Version**: TypeScript (Node.js 20, ESM)
**Primary Dependencies**: Fastify (backend HTTP), ws (WebSockets), better-sqlite3, vitest (testing)
**Storage**: SQLite via `better-sqlite3` — no schema changes required
**Testing**: vitest — unit tests in `backend/tests/unit/`, integration tests in `backend/tests/integration/`
**Target Platform**: Local developer tool (single user, localhost)
**Project Type**: Full-stack web service (Node.js backend + React frontend)
**Performance Goals**: Hook processing < 50ms (already fast synchronous path)
**Constraints**: No frontend changes required; no new WS event types; no DB schema changes
**Scale/Scope**: ≥10 concurrent sessions (single-user localhost tool; §VIII exception applies)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, testable, reversible) | PASS | Extends existing hook pipeline; easily reverted |
| §II Architecture (API boundaries, inter-service via API) | PASS | No new service boundaries; same HTTP hook endpoint |
| §III Code Standards (readable, <50 lines, documented) | PASS | New handler function will be <50 lines |
| §IV Test-First (NON-NEGOTIABLE) | PASS | Tests written before implementation |
| §V Testing (unit, integration, e2e) | PASS | Unit tests for new logic; existing integration tests cover the pipeline |
| §VI Security | PASS | §VI exception applies: service bound to 127.0.0.1, single local user |
| §VII Observability (structured logs) | PASS | Existing `createTaggedLogger` used in `base-cli-detector.ts` |
| §VIII Performance (500ms p95) | PASS | §VIII exception: single-user localhost; hook processing is synchronous and fast |
| §IX AI Usage | PASS | No security-critical code paths |
| §X Definition of Done | PASS | Tests, docs, README update required |
| §XI Documentation (README update in same PR) | PASS | README update task included |
| §XII Error Handling (structured errors, human-friendly UX) | PASS | Malformed tool_input handled gracefully; existing error path reused |

## Project Structure

### Documentation (this feature)

```text
specs/072-bash-approval-surface/
├── plan.md              ← this file
├── research.md
└── tasks.md
```

### Source Code

```text
backend/src/services/
├── base-cli-detector.ts          ← extend handleHookPayload: new non-ask_user PreToolUse branch
├── claude-code-hooks-injector.ts ← add empty-matcher PreToolUse entry to HOOK_EVENTS
└── pending-choice-utils.ts       ← add buildToolApprovalChoice(toolName, toolInput)

backend/tests/unit/
├── claude-code-detector-hook.test.ts  ← add tests: non-ask_user PreToolUse / PostToolUse
└── pending-choice-utils.test.ts       ← add tests for buildToolApprovalChoice

docs/
└── README-CONTRIBUTORS.md        ← document wildcard hook matcher behavior
README.md                         ← update with tool approval feature
```

Frontend: **no changes required**. The existing `PendingChoicePanel`, `session.pending_choice` WS event, and numbered-choice response mechanism already handle this.


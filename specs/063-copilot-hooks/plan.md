# Implementation Plan: Copilot CLI Hooks Integration

**Branch**: `063-copilot-hooks` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/063-copilot-hooks/spec.md`

## Summary

Add a Copilot CLI hooks adapter that injects `hooks.json` into each registered repository's `.github/hooks/` directory, receives hook payloads via a new `POST /hooks/copilot` endpoint, and processes them using the same shared interfaces (`pendingChoiceEvents` bus, `broadcast()`, `upsertSession()`) already used by the Claude Code hooks path. This eliminates the current 5-second polling lag for Copilot session start, session end, and Attention Needed events.

## Technical Context

**Language/Version**: TypeScript, Node.js 18+ (same as existing backend)
**Primary Dependencies**: Fastify (existing), `fs` (built-in), SQLite via `better-sqlite3` (existing)
**Storage**: SQLite (shared DB), `hooks.json` files per repository on disk
**Testing**: Vitest (existing), supertest (contract tests)
**Target Platform**: macOS, Linux, Windows (local developer tool, `127.0.0.1` only)
**Project Type**: Web service backend (existing Fastify app)
**Performance Goals**: Hook endpoint responds within 500ms p95 (Constitution §VIII). All file I/O is synchronous and local; expected < 10ms per injection.
**Constraints**: `127.0.0.1`-only binding (no external exposure); auth exemption per §VI applies. Hook injection failures must not crash the server.
**Scale/Scope**: ≥10 concurrent Copilot sessions (single-user localhost tool, per §VIII exception).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| §I | Reliable, observable, debuggable | PASS | Hook failures logged with repo name and reason (FR-013). |
| §II | Clear API boundaries | PASS | New endpoint `POST /hooks/copilot` is distinct from `POST /hooks/claude`. |
| §III | Readable, self-documenting | PASS | No function will exceed 50 lines; logic mirrors existing ClaudeCodeDetector patterns. |
| §IV | Test-first | PASS | Tests written before implementation per workflow. |
| §V | All features have unit tests | PASS | Unit tests for injector, handler, and contract tests for endpoint. |
| §VI | Auth / security | PASS | Endpoint on `127.0.0.1` only. No new secrets. Exception declared in spec (Assumptions). |
| §VII | Observability | PASS | Hook events logged at `info` level; injection failures at `warn` level with tagged logger. |
| §VIII | Performance | PASS | Injection is sync local file I/O; hook endpoint async with no blocking ops. |
| §IX | AI usage | PASS | Human review required before merge. |
| §X | Definition of done | PASS | All checklist items to be satisfied. |
| §XI | Documentation | PASS | README updated (task included). |
| §XII | Error handling | PASS | Server errors include full context. UX messages are human-readable. |

> **§XI**: README.md MUST be updated in the same PR. Task included in tasks.md.

**Verdict**: PASS — no violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/063-copilot-hooks/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code Layout

```text
backend/
├── src/
│   ├── services/
│   │   ├── copilot-hooks-injector.ts     # NEW: per-repo hooks.json injection/removal
│   │   ├── pending-choice-utils.ts       # NEW: shared parsePendingChoicePayload() helper
│   │   ├── copilot-cli-detector.ts       # MODIFIED: add handleHookPayload() method
│   │   └── claude-code-detector.ts       # MODIFIED: refactor to use shared pending-choice-utils
│   └── api/
│       └── routes/
│           ├── hooks.ts                  # MODIFIED: add POST /hooks/copilot + setCopilotDetector()
│           └── repositories.ts           # MODIFIED: inject/remove Copilot hooks on add/delete
├── tests/
│   ├── contract/
│   │   └── hooks.test.ts                 # MODIFIED: add POST /hooks/copilot contract tests
│   └── unit/
│       ├── copilot-hooks-injector.test.ts  # NEW: injection/removal unit tests
│       ├── copilot-hook-handler.test.ts    # NEW: handleHookPayload unit tests
│       └── pending-choice-utils.test.ts    # NEW: shared utility unit tests
```

**Structure Decision**: Web application (backend-only change). The feature adds two new backend services, extends one API route, and modifies two existing services. No frontend changes required — the existing WebSocket broadcast mechanism already delivers hook-triggered events to the UI.

## Architecture Decisions

### AD-001: Per-repo injection vs. global settings

Claude Code injects hooks once globally into `~/.claude/settings.json`. Copilot hooks are per-repository in `<repo>/.github/hooks/hooks.json`. The `CopilotHooksInjector` class must iterate over all registered repositories for startup injection, inject on add, and remove on delete. It is not a singleton on `CopilotCliDetector` — it is a separate injectable service, keeping injection concerns separate from detection concerns.

### AD-002: Hook handler placement — on CopilotCliDetector

`handleHookPayload()` is added to `CopilotCliDetector` (not a separate class) for symmetry with `ClaudeCodeDetector.handleHookPayload()`. This keeps session creation and lifecycle management in the detector that owns Copilot sessions.

### AD-003: Shared pending choice logic via extracted utility

FR-011 prohibits duplicating pending choice broadcasting logic. `ClaudeCodeDetector.handlePreAskQuestion()` parses question/choices and broadcasts. This parsing logic is extracted to `pending-choice-utils.ts` as `parsePendingChoicePayload(toolInput)`. Both detectors import and call this utility. The broadcasting (`pendingChoiceEvents.emit`, `broadcast()`) stays in each detector so session-type context is preserved.

### AD-004: Copilot hook payload normalization

The Copilot `hooks.json` payload field names differ from Claude Code (confirmed in research.md after Phase 0). The hook endpoint normalizes the incoming payload to the shared `HookPayload` interface before passing to `CopilotCliDetector.handleHookPayload()`. Normalization is isolated to the endpoint handler, not spread across the detector.

### AD-005: Idempotent injection — URL-pattern identification

Argus-owned entries in `hooks.json` are identified by the URL pattern `*/hooks/copilot` in their `bash` or `powershell` field (per spec clarification). On every startup and re-inject, all matching entries are removed and re-injected with the current port. This heals stale entries from previous Argus instances.

### AD-006: Both bash and powershell always written

Every injected hook entry writes both `bash` and `powershell` fields regardless of host OS (FR-014), so a committed `hooks.json` works on any OS. The bash command uses `curl`; the PowerShell command uses `Invoke-RestMethod`.

## Complexity Tracking

No constitution violations to justify. All principles pass without exception.

## Post-Phase 1 Constitution Re-check

After generating research.md, data-model.md, and contracts/api.md:

| # | Principle | Re-check result |
|---|-----------|----------------|
| §II | API boundaries | PASS — `POST /hooks/copilot` is a distinct, versioned endpoint. |
| §III | Functions < 50 lines | PASS — `CopilotHooksInjector` methods are short; `handleHookPayload` follows `ClaudeCodeDetector` pattern. |
| §VI | Security | PASS — No new auth surface. `127.0.0.1`-only. Exception already declared. |
| §XII | Error handling | PASS — Injection failures logged with repo+reason. Endpoint returns structured errors with `requestId`. |

**Verdict**: PASS — no violations introduced by design. Ready for `/speckit.tasks`.

# Tasks: Bash Command Approval Surfacing

**Branch**: `072-bash-approval-surface` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1 — Setup

> Infrastructure checks. No production code yet.

- [ ] T001 [P] Confirm `backend/tests/unit/pending-choice-utils.test.ts` exists and passes (`npm run test --workspace=backend -- --testPathPattern=pending-choice-utils`)
- [ ] T002 [P] Confirm `backend/tests/unit/claude-code-detector-hook.test.ts` exists and passes (`npm run test --workspace=backend -- --testPathPattern=claude-code-detector-hook`)

---

## Phase 2 — Foundational (CRITICAL gate)

> Any task failure here blocks all subsequent phases.

- [ ] T003 [P] [US1] Write failing unit test for `buildToolApprovalChoice` in `backend/tests/unit/pending-choice-utils.test.ts`: given `toolName='Bash'` and `tool_input={command:'rm -rf /'}`, returns `{ question: 'Bash: rm -rf /', choices: ['Yes, run it', 'No, skip it'], allQuestions: [...] }`
- [ ] T004 [P] [US1] Write failing unit test for `buildToolApprovalChoice` fallback: given `toolName='Write'` and empty `tool_input={}`, returns `{ question: 'Write', choices: ['Yes, run it', 'No, skip it'], allQuestions: [...] }`
- [ ] T005 Implement `buildToolApprovalChoice(toolName: string, toolInput: Record<string, unknown>)` in `backend/src/services/pending-choice-utils.ts` — extracts primary string value from `tool_input` (prefers `command`, then `file_path`, then `path`, then first string value); formats question as `"<toolName>: <value>"` or `"<toolName>"` if no string value found; choices fixed to `['Yes, run it', 'No, skip it']`; returns same shape as `parsePendingChoicePayload`

---

## Phase 3 — User Story 1: See Approval on Session Card (P1)

### Test-first for Claude Code hooks injector

- [ ] T006 [P] [US1] Write failing unit test for `ClaudeCodeHooksInjector.injectForAll()` in a new test file `backend/tests/unit/claude-code-hooks-injector.test.ts`: after inject, `settings.json` must contain a `PreToolUse` entry with `matcher: ''` (wildcard) in addition to the `AskUserQuestion` entry
- [ ] T007 [P] [US1] Write failing unit tests for `handleHookPayload` tool approval path in `backend/tests/unit/claude-code-detector-hook.test.ts`:
  - `PreToolUse` with `tool_name='Bash'` (not `AskUserQuestion`) emits `session.pending_choice` WS event with `question='Bash: <cmd>'` and `choices=['Yes, run it', 'No, skip it']`
  - `PostToolUse` with `tool_name='Bash'` clears the pending choice and emits `session.pending_choice.resolved`
  - `PreToolUse` with `tool_name='AskUserQuestion'` is NOT handled by the new path (existing path handles it)

### Implementation

- [ ] T008 [US1] Extend `HOOK_EVENTS` in `backend/src/services/claude-code-hooks-injector.ts`: add `{ event: 'PreToolUse', matcher: '' }` and `{ event: 'PostToolUse', matcher: '' }` entries so Claude Code sends all tool events to Argus
- [ ] T009 [US1] Add `handlePreToolApproval(sessionId, existing, payload, now)` protected method to `backend/src/services/base-cli-detector.ts`: if `existing` is null, return; call `buildToolApprovalChoice(payload.tool_name, payload.tool_input ?? {})`; set `pendingChoices`, broadcast `session.pending_choice`, emit on `pendingChoiceEvents`
- [ ] T010 [US1] Add `handlePostToolApproval(sessionId, existing, now)` protected method to `backend/src/services/base-cli-detector.ts`: if `existing` is null, return; delete from `pendingChoices`, broadcast `session.pending_choice.resolved`, emit on `pendingChoiceEvents`
- [ ] T011 [US1] Wire new methods in `handleHookPayload` in `backend/src/services/base-cli-detector.ts`: after the existing `ask_user` guards (lines 617–622), add branch — if `hook_event_name === 'PreToolUse'` AND `tool_name !== this.askUserToolName`, call `handlePreToolApproval`; if `hook_event_name === 'PostToolUse'` AND `tool_name !== this.askUserToolName`, call `handlePostToolApproval`

---

## Phase 4 — User Story 2: Approval in Session Detail View (P2)

> US2 is served by the same backend events and existing frontend panel. No additional implementation required — verify test coverage confirms detail view works.

- [ ] T012 [P] [US2] Verify (manual or automated check): `PendingChoicePanel` renders in session detail view for `session.pending_choice` events regardless of question content. No code change expected; document finding in a code comment or test note.

---

## Phase 5 — Polish and Cross-Cutting

- [ ] T013 [P] Run full backend test suite (`npm run test --workspace=backend`) and confirm all tests pass including new ones
- [ ] T014 [P] Run backend lint fix (`npm run lint:fix --workspace=backend`) and confirm zero violations
- [ ] T015 [P] Run backend build (`npm run build --workspace=backend`) and confirm no TypeScript errors
- [ ] T016 Update `README.md` — add a note under the session monitoring section that bash/shell command approvals (and other tool approvals) in non-auto-approval mode are surfaced as interactive prompts on the session card

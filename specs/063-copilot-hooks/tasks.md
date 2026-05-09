# Tasks: Copilot CLI Hooks Integration

**Branch**: `063-copilot-hooks` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup — Shared Pending Choice Utility

**Goal**: Extract question-parsing logic into a shared utility so both `ClaudeCodeDetector` and `CopilotCliDetector` can call it (FR-011, SC-004).

**Independent test criteria**: `parsePendingChoicePayload()` is a pure function — tests run without any DB, FS, or network.

- [x] T001 [P] Write `backend/tests/unit/pending-choice-utils.test.ts` covering: multi-question Claude format (`{ questions: [{ question, options }] }`), flat `ask_user` format (`{ question, choices }`), empty questions array falls back to flat format, option objects with `label`+`description`, option strings only, `allQuestions` array always contains at least one item
- [x] T002 Implement `backend/src/services/pending-choice-utils.ts` exporting `parsePendingChoicePayload(toolInput: Record<string, unknown>): { question: string; choices: string[]; allQuestions: PendingChoiceItem[] }` — pure function, no side effects (deps: T001)

---

## Phase 2: Foundational — Refactor ClaudeCodeDetector (CRITICAL GATE)

**Goal**: Replace the inlined question-parsing block in `ClaudeCodeDetector.handlePreAskQuestion()` with a call to the shared utility. No behavioral change.

**Independent test criteria**: All existing `ClaudeCodeDetector` tests in `backend/tests/unit/claude-code-detector-hook.test.ts` pass without modification.

- [x] T003 Refactor `ClaudeCodeDetector.handlePreAskQuestion()` in `backend/src/services/claude-code-detector.ts` to call `parsePendingChoicePayload(payload.tool_input ?? {})` from `pending-choice-utils.ts` instead of the inline block; remove the now-unused inline logic (deps: T002)
- [x] T004 Run `npm run test --workspace=backend -- --reporter=verbose --testPathPattern="claude-code-detector-hook"` to confirm zero regressions from T003 (deps: T003)

---

## Phase 3: User Story 3 — Hook Injection

**Goal**: `CopilotHooksInjector` writes `hooks.json` entries per repository, handles idempotency, and never throws (FR-001–FR-004, FR-012–FR-014, SC-003, SC-005).

**Independent test criteria**: Register two repositories and inject; verify `hooks.json` exists at `<repo>/.github/hooks/hooks.json` with both `bash` and `powershell` fields for all four events, and that non-Argus entries are untouched.

- [x] T005 [US3] Write `backend/tests/unit/copilot-hooks-injector.test.ts` covering: inject creates `hooks.json` with `version:1` and all four events (`sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`), each entry has `type:"command"`, `bash`, and `powershell` fields; inject preserves existing non-Argus entries; inject is idempotent (running twice on same repo produces identical file); inject heals stale port (existing Argus entry with old port is removed and replaced); remove deletes only Argus entries and leaves non-Argus entries; remove deletes `hooks.json` if it becomes empty; `injectForAll()` calls `injectForRepo()` for every repo returned by `getRepositories()`; injection failure (unwritable dir) logs `warn` with repo path and reason and returns without throwing
- [x] T006 [US3] Implement `backend/src/services/copilot-hooks-injector.ts` with `class CopilotHooksInjector` and methods `injectForRepo(repoPath: string): void`, `removeForRepo(repoPath: string): void`, `injectForAll(): void`; use `createTaggedLogger('[CopilotHooksInjector]', '\x1b[33m')` (yellow); read port from `loadConfig().port`; identify Argus entries by `/hooks/copilot` in `bash` or `powershell` field; always write both fields; wrap all I/O in try/catch that logs warn and returns (deps: T005)

---

## Phase 4: User Stories 1 & 2 — CopilotCliDetector Hook Handler

**Goal**: `CopilotCliDetector.handleHookPayload()` processes normalized payloads for session lifecycle and pending choices (FR-006–FR-010, SC-001, SC-002).

**Independent test criteria**: Call `handleHookPayload()` with a `sessionStart` payload for a known repo; verify a `copilot-cli` session row is upserted in the DB within the same process tick.

- [x] T007 [US1, US2] Write `backend/tests/unit/copilot-hook-handler.test.ts` covering: `sessionStart` for unknown session creates provisional session (`status:'active'`, `pid:null`, `type:'copilot-cli'`); `sessionStart` for existing session updates `lastActivityAt` without creating duplicate; `sessionEnd` marks session `status:'ended'`; `preToolUse` with `toolName:'ask_user'` broadcasts `session.pending_choice` via `broadcast()` and emits on `pendingChoiceEvents`; `postToolUse` with `toolName:'ask_user'` broadcasts `session.pending_choice.resolved`; `preToolUse` with other toolName updates `lastActivityAt` only, no pending choice; payload with unknown `cwd` is silently discarded (no upsert, 0 DB writes); payload without `sessionId` but with known `cwd` creates provisional session using generated UUID (deps: T002, T004)
- [x] T008 [US1, US2] Add `handleHookPayload(payload: NormalizedHookPayload): Promise<void>` method to `CopilotCliDetector` in `backend/src/services/copilot-cli-detector.ts`; import `NormalizedHookPayload` type from `hooks.ts` or define inline; handle `SessionStart` (upsert provisional session, call `this.jsonlWatcher.watchFile()`), `SessionEnd` (call `updateSessionStatus` + `closeWatcher`, broadcast `session.ended`), `PreToolUse/ask_user` (call `parsePendingChoicePayload`, store + broadcast + emit), `PostToolUse/ask_user` (broadcast resolved + emit); log warn and return if `cwd` matches no registered repo (deps: T002, T007)

---

## Phase 5: User Stories 1 & 2 — HTTP Endpoint

**Goal**: `POST /hooks/copilot?event={name}` receives, validates, normalizes, and dispatches Copilot payloads to `CopilotCliDetector` (FR-005, FR-006, contracts/api.md).

**Independent test criteria**: POST to `/hooks/copilot?event=sessionStart` with a valid UUID `sessionId` returns `{ ok: true }` with status 200.

- [x] T009 [US1, US2] Add `describe('POST /hooks/copilot', ...)` block to `backend/tests/contract/hooks.test.ts` covering: 400 `INVALID_HOOK_EVENT` for missing `event` param; 400 `INVALID_HOOK_EVENT` for unrecognized event value; 400 `INVALID_SESSION_ID` for invalid `sessionId` (non-UUID) when `cwd` is absent; 413 for body exceeding 64 KB; 200 `{ ok: true }` for valid `sessionStart` with UUID `sessionId`; 200 `{ ok: true }` for valid `preToolUse` with `toolName:'ask_user'` and JSON-encoded `toolArgs`; 200 for payload whose `cwd` matches no registered repo (silent discard) (deps: T008)
- [x] T010 [US1, US2] Implement `POST /hooks/copilot` in `backend/src/api/routes/hooks.ts`: add `setCopilotDetector()` function; validate `event` query param against allowlist `['sessionStart','sessionEnd','preToolUse','postToolUse']`; validate `sessionId` as UUID v4 (return 400 if absent and `cwd` maps to no repo); normalize payload to `NormalizedHookPayload` (`hook_event_name` from `?event` PascalCase, `session_id` from `sessionId`, `tool_name` from `toolName`, `tool_input` from `JSON.parse(toolArgs)`, `tool_result` direct copy); call `_copilotDetector.handleHookPayload(normalized)` if set; bodyLimit 64 KB; return `{ ok: true }` (deps: T008, T009)

---

## Phase 6: Wiring

**Goal**: Connect `CopilotHooksInjector` and the Copilot hook endpoint to the application lifecycle (server startup, repo add/delete).

**Independent test criteria**: Start the server, add a repository, verify `.github/hooks/hooks.json` is created; delete the repository, verify Argus entries are removed.

- [x] T011 Add `CopilotHooksInjector` to `backend/src/services/session-monitor.ts`: import and instantiate as `private readonly hooksInjector = new CopilotHooksInjector()`; call `this.hooksInjector.injectForAll()` in `start()` immediately after `this.claudeDetector.injectHooks()`; add `getCopilotCliDetector(): CopilotCliDetector` getter (mirrors existing `getClaudeCodeDetector()`) (deps: T006)
- [x] T012 Wire `setCopilotDetector()` in `backend/src/server.ts` `startServer()`: call `monitor.getCopilotCliDetector()` and pass to `setCopilotDetector()` alongside the existing Claude wiring; import `setCopilotDetector` from `hooks.ts` (deps: T010, T011)
- [x] T013 [P] Wire `CopilotHooksInjector` in `backend/src/api/routes/repositories.ts`: import and call `new CopilotHooksInjector().injectForRepo(repoPath)` after the existing `ClaudeCodeDetector().injectHooks()` call in the POST handler; call `new CopilotHooksInjector().removeForRepo(existing.path)` in the DELETE handler before or after the Claude removal (deps: T006)

---

## Final Phase: Polish

**Goal**: Documentation, full test run, and build verification (§XI, SC-003, SC-006).

- [x] T014 [P] Update `docs/README-CONTRIBUTORS.md` to document Copilot hooks support: add a section explaining `hooks.json` location (`<repo>/.github/hooks/hooks.json`), supported events (`sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`), how Argus entries are identified, and the polling fallback behavior (FR-015)
- [x] T015 Run `npm run test --workspace=backend` and confirm all tests pass; fix any failing tests before proceeding (deps: T012, T013)
- [x] T016 Run `npm run build --workspace=frontend` and `npm run build --workspace=backend` and confirm no build errors (deps: T015)

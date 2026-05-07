# Tasks: Todo List Filter

**Input**: Design documents from `/specs/068-todo-filter/`
**Prerequisites**: plan.md, spec.md, research.md

---

## Phase 1: Foundational — Write Failing Tests (Test-First Gate)

**Purpose**: Establish the full test suite for all new behaviors before any implementation. All tests in this phase MUST fail before Phase 2 begins.

**⚠️ CRITICAL**: Do not begin Phase 2 until every test added here is confirmed failing.

- [ ] T001 [US1] Add failing tests for live filter to `frontend/src/components/TodoPanel/TodoPanel.test.tsx`:
  - Typing "first" in add-row shows only "First task" (case-insensitive substring match)
  - Typing "DONE" in add-row shows only "Done task"
  - Clearing the add-row restores all items
  - Whitespace-only input ("   ") is treated as empty (all items shown)
  - Typing "xyz" (no match) shows "No todos match your filter." message
  - Typing "[" (regex-special char) causes no error
  - Blurring the add-row with text does NOT call `createTodo.mutate`
  - Blurring the add-row with text leaves the value in the input
  - Pressing Enter while filter is active calls `createTodo.mutate` and clears the input
- [ ] T002 [US2] Add failing tests for filter + show-completed composition to `frontend/src/components/TodoPanel/TodoPanel.test.tsx`:
  - "show completed" off + filter "task" shows only undone matching items
  - "show completed" on + filter "task" shows both done and undone matching items

**Checkpoint**: Run `npm run test --workspace=frontend -- TodoPanel` and confirm all new tests fail (red). No existing tests may be broken by test additions alone.

---

## Phase 2: User Story 1 — Live Filter on Add-Todo Input (Priority: P1)

**Goal**: Typing in the add-todo input filters the todo list in real time. Enter still adds; blur leaves the text.

**Independent Test**: Open the Todo panel with multiple todos, type a keyword, verify only matching items remain. Clear the input; verify all items return.

- [ ] T003 [US1] In `frontend/src/components/TodoPanel/TodoPanel.tsx`: add `filterText` state (`useState('')`); remove `addRowId`, `resetAddRow`, `shouldFocusAdd`, and the related `useEffect` that focused after key change
- [ ] T004 [US1] In `frontend/src/components/TodoPanel/TodoPanel.tsx`: change the add-todo `<input>` from `defaultValue=""` / `key={addRowId}` to `value={filterText}` / `onChange={(e) => setFilterText(e.target.value)}`; remove the `key` prop
- [ ] T005 [US1] In `frontend/src/components/TodoPanel/TodoPanel.tsx`: update `handleBlur` so it does nothing for draft rows (remove the `createTodo.mutate` call inside the `isDraft(id)` branch — just `return` early for drafts)
- [ ] T006 [US1] In `frontend/src/components/TodoPanel/TodoPanel.tsx`: update `handleKeyDown` Enter branch for draft rows — replace `resetAddRow()` with `setFilterText('')` followed by `addRowRef.current?.focus()` on success; also remove `savingIds` ref and its usage since blur no longer competes with Enter for the draft row
- [ ] T007 [US1] In `frontend/src/components/TodoPanel/TodoPanel.tsx`: extend the `reversedTodos` `useMemo` to apply the text filter as a second `.filter()` pass after the `showDone` filter, using `filterText.trim().toLowerCase()` as the needle (empty needle = no filtering; plain `includes` match)
- [ ] T008 [US1] In `frontend/src/components/TodoPanel/TodoPanel.tsx`: add the empty-filter state message — when `!isLoading && !isError && reversedTodos.length === 0 && filterText.trim() !== ''`, render `<p>No todos match your filter.</p>` in the list area

**Checkpoint**: Run `npm run test --workspace=frontend -- TodoPanel`. All Phase 1 US1 tests must now pass (green). Existing tests must continue to pass.

---

## Phase 3: User Story 2 — Filter Composes with Show-Completed Toggle (Priority: P2)

**Goal**: The text filter and the show-completed toggle apply simultaneously. No code change required if Phase 2 is implemented correctly (filter is added after the showDone pass in the same memo), but tests from T002 must pass.

**Independent Test**: Toggle "show completed" off, type a filter that matches both done and undone items, verify only undone matching items appear.

- [ ] T009 [US2] Verify `reversedTodos` memo in `frontend/src/components/TodoPanel/TodoPanel.tsx` applies filters in order: `showDone` first, then `filterText` — confirm the memo is correct and no separate change is needed
- [ ] T010 [US2] Run `npm run test --workspace=frontend -- TodoPanel` and confirm all Phase 1 US2 tests (T002) now pass without any additional code changes

**Checkpoint**: All T002 tests green. Existing toggle tests remain green.

---

## Phase 4: Polish and Cross-Cutting Concerns

**Purpose**: Lint, format, build, README, and final verification.

- [ ] T011 [P] Run `npm run lint:fix --workspace=frontend` and fix any violations in `TodoPanel.tsx` or `TodoPanel.test.tsx`
- [ ] T012 [P] Run `npm run format --workspace=frontend` to apply Prettier formatting
- [ ] T013 Run `npm run build --workspace=frontend` and confirm the build succeeds with no errors
- [ ] T014 Update `README.md` to note that the add-todo input doubles as a live filter (§XI: README must reflect user-facing behavior changes)
- [ ] T015 Run the full test suite `npm run test --workspace=frontend` and confirm no regressions

**Checkpoint**: Build green, all tests green, README updated, lint clean.

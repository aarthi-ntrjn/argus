# Tasks: Engineering Documentation Cleanup

**Branch**: `015-docs-cleanup`  
**Input**: Design documents from `/specs/015-docs-cleanup/`  
**Scope**:
1. Rename `BUG-LEARNINGS.md` → `README-LEARNINGS.md` and update all references.
2. Rename `MANUAL-TESTS.md` → `README-MANUAL-TESTS.md` and update all references.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (independent files, no deps on incomplete tasks)
- **[US1]**: User Story 1 — Review and update existing docs (P1)

---

## Phase 1: Setup

- [ ] T001 Confirm branch `015-docs-cleanup` is checked out (`git status`)

---

## Phase 2: Foundational

- [ ] T002 Verify `BUG-LEARNINGS.md` exists at repo root `C:\source\github\artynuts\argus2\BUG-LEARNINGS.md`

---

## Phase 3: User Story 1 — Rename file and update all references

**Goal**: `BUG-LEARNINGS.md` is gone; `README-LEARNINGS.md` exists with identical content; no file in the repo refers to the old name.

**Independent Test**: `git ls-files | grep -i BUG-LEARNINGS` returns nothing; `README-LEARNINGS.md` exists; all references in `.claude/commands/bug.md` and `specs/015-docs-cleanup/plan.md` use the new name.

- [ ] T003 [US1] Rename `BUG-LEARNINGS.md` → `README-LEARNINGS.md` at repo root using `git mv BUG-LEARNINGS.md README-LEARNINGS.md`
- [ ] T004 [P] [US1] Update `.claude/commands/bug.md` — replace all 4 occurrences of `BUG-LEARNINGS.md` with `README-LEARNINGS.md` (lines 100, 102, 117, 147)
- [ ] T005 [P] [US1] Update `specs/015-docs-cleanup/plan.md` — replace `BUG-LEARNINGS.md` with `README-LEARNINGS.md` in the project structure listing

---

## Phase 5: User Story 1 — Rename MANUAL-TESTS.md and update all references

**Goal**: `MANUAL-TESTS.md` is gone; `README-MANUAL-TESTS.md` exists with identical content; no file in the repo refers to the old name.

**Independent Test**: `git ls-files | grep -i MANUAL-TESTS` returns only `README-MANUAL-TESTS.md`; reference in `specs/015-docs-cleanup/plan.md` uses the new name.

- [ ] T009 [US1] Rename `MANUAL-TESTS.md` → `README-MANUAL-TESTS.md` at repo root using `git mv MANUAL-TESTS.md README-MANUAL-TESTS.md`
- [ ] T010 [US1] Update `specs/015-docs-cleanup/plan.md` — replace `MANUAL-TESTS.md` with `README-MANUAL-TESTS.md` in the project structure listing

---

## Phase 6: Polish

- [ ] T011 Verify no remaining references to old names: run `grep -ri "BUG-LEARNINGS\|MANUAL-TESTS" .` from repo root — expect zero results
- [ ] T012 Commit all changes: `git add -A && git commit -m "docs(015): rename MANUAL-TESTS.md to README-MANUAL-TESTS.md and update all references"`
- [ ] T013 Push branch: `git push`

---

## Dependencies

```
T001 → T002 → T003 → T004 [P] ─┐
                      T005 [P] ─┴→ T006 → T007 → T008

T009 → T010 → T011 → T012 → T013
```

The two rename operations (T003–T008 and T009–T013) are independent and can be done in any order.
T004 and T005 are parallel to each other. T010 is sequential (only one reference file).

## Implementation Strategy

Complete each rename as a self-contained atomic operation. T001–T008 first (BUG-LEARNINGS), then T009–T013 (MANUAL-TESTS), or interleave — both rename sets are independent.


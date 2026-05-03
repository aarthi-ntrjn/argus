# Tasks: Code Coverage Reporting

**Input**: Design documents from `/specs/064-code-coverage/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing tooling and confirm no package installations are needed.

- [ ] T001 [P] Verify `@vitest/coverage-v8` is present in `backend/package.json` devDependencies
- [ ] T002 [P] Verify `@vitest/coverage-v8` is present in `frontend/package.json` devDependencies

**Checkpoint**: Both workspaces have coverage-v8 installed — no `npm install` required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared infrastructure is needed beyond the existing vitest setup. This phase is a no-op.

**⚠️ CRITICAL**: Phases 3-5 can proceed immediately after Phase 1.

---

## Phase 3: User Story 1 — Backend Coverage Report (Priority: P1) 🎯 MVP

**Goal**: `npm run test:coverage` in the backend workspace prints a console summary and generates an HTML report covering all `backend/src/` files including untested ones.

**Independent Test**: Run `npm run test:coverage --workspace=backend` from repo root. Confirm console table appears with per-file percentages. Open `backend/coverage/index.html` in a browser.

### Implementation for User Story 1

- [ ] T003 [US1] Add `all: true` to the `coverage` block in `backend/vitest.config.ts` so zero-coverage source files are included in the report
- [ ] T004 [US1] Run `npm run test:coverage --workspace=backend` and confirm it exits 0 and prints coverage table; fix any config issues found

**Checkpoint**: Backend coverage command works end-to-end. HTML report at `backend/coverage/index.html` is populated.

---

## Phase 4: User Story 2 — Frontend Unit Coverage Report (Priority: P2)

**Goal**: `npm run test:coverage` in the frontend workspace prints a console summary and generates an HTML report covering all `frontend/src/` files.

**Independent Test**: Run `npm run test:coverage --workspace=frontend` from repo root. Confirm console table appears and `frontend/coverage/index.html` is generated.

### Implementation for User Story 2

- [ ] T005 [US2] Add `coverage` block to `frontend/vitest.config.ts` with `provider: 'v8'`, `reporter: ['text', 'json', 'html']`, `include: ['src/**/*.ts', 'src/**/*.tsx']`, `exclude` for test/setup/d.ts files, and `all: true`
- [ ] T006 [US2] Add `"test:coverage": "vitest run --coverage"` script to `frontend/package.json`
- [ ] T007 [US2] Run `npm run test:coverage --workspace=frontend` and confirm it exits 0 and prints coverage table; fix any config issues found

**Checkpoint**: Frontend coverage command works end-to-end. HTML report at `frontend/coverage/index.html` is populated.

---

## Phase 5: User Story 3 — Single Root-Level Coverage Command (Priority: P3)

**Goal**: `npm run test:coverage` from the repo root runs backend then frontend coverage in sequence.

**Independent Test**: Run `npm run test:coverage` from repo root. Both workspace summaries print. Exit code is 0 when all tests pass.

### Implementation for User Story 3

- [ ] T008 [US3] Add `"test:coverage": "npm run test:coverage --workspace=backend && npm run test:coverage --workspace=frontend"` to root `package.json`
- [ ] T009 [US3] Run `npm run test:coverage` from repo root and confirm both summaries print in sequence

**Checkpoint**: Root-level coverage command runs both workspaces end-to-end.

---

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Documentation update and final validation.

- [ ] T010 [P] Update `docs/README-CONTRIBUTORS.md` to document the three coverage commands (`npm run test:coverage --workspace=backend`, `npm run test:coverage --workspace=frontend`, `npm run test:coverage`) with a brief explanation of where HTML reports are written
- [ ] T011 Verify `coverage/` directories are in `.gitignore` for both workspaces; add entries if missing
- [ ] T012 Run `npm run test:coverage` from repo root one final time to confirm full green run and all tasks complete

---

## Dependencies & Execution Order

- **Phase 1**: No dependencies — verify packages
- **Phase 3**: Depends on Phase 1 (T001) — backend config fix
- **Phase 4**: Depends on Phase 1 (T002) — frontend config add
- **Phase 5**: Depends on Phase 3 (T004) and Phase 4 (T007) — root script needs both working
- **Phase 6**: Depends on Phase 5 (T009) — final validation after all commands work

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003/T004 (Phase 3) and T005/T006/T007 (Phase 4) can run in parallel (different workspaces, different files)
- T010 and T011 can run in parallel (different files)

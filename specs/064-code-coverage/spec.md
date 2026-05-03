# Feature Specification: Code Coverage Reporting

**Feature Branch**: `064-code-coverage`
**Created**: 2026-05-02
**Status**: Draft
**Input**: User description: "work on generating code coverage numbers for the different tests"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend Coverage Report (Priority: P1)

A developer wants to see how much of the backend source code is covered by the existing tests (unit, contract, and integration). They run a single command and get a clear breakdown by file showing line, statement, branch, and function coverage percentages. Any source files with zero coverage also appear in the report so blind spots are visible.

**Why this priority**: The backend is the most complex part of the codebase and already has the coverage tool installed but no verified working setup. Getting backend numbers first provides the highest immediate value and unblocks identifying untested areas.

**Independent Test**: Run `npm run test:coverage` in the backend workspace. A coverage summary table prints to the console and an HTML report is generated. All source files under `backend/src/` appear in the report, including files with 0% coverage.

**Acceptance Scenarios**:

1. **Given** the developer is in the repo root, **When** they run the backend coverage command, **Then** a coverage summary table is printed showing per-file and totals for statements, branches, functions, and lines.
2. **Given** a source file exists under `backend/src/` but has no tests, **When** coverage runs, **Then** that file still appears in the report with 0% coverage rather than being omitted.
3. **Given** coverage has completed, **When** the developer opens the HTML report, **Then** they can browse each source file and see which lines are covered or uncovered.

---

### User Story 2 - Frontend Unit Coverage Report (Priority: P2)

A developer wants to see how much of the frontend source code is covered by the frontend unit tests. They run a single command and get the same style of per-file breakdown as the backend report.

**Why this priority**: Frontend unit tests exist but the frontend workspace has no coverage configuration. This is the natural next step after backend coverage is working, and it reveals which components and hooks lack test coverage.

**Independent Test**: Run `npm run test:coverage` in the frontend workspace. A coverage summary table prints to the console covering files under `frontend/src/`.

**Acceptance Scenarios**:

1. **Given** the developer is in the repo root, **When** they run the frontend unit coverage command, **Then** a coverage summary table is printed for frontend source files.
2. **Given** a frontend component exists but is not tested, **When** coverage runs, **Then** that component still appears in the report with 0% coverage.
3. **Given** coverage has completed, **When** the developer opens the HTML report, **Then** they can see coverage annotations for each frontend source file.

---

### User Story 3 - Single Root-Level Coverage Command (Priority: P3)

A developer wants to run one command at the repo root to get coverage numbers for all test suites (backend and frontend unit tests) in sequence, without having to navigate to each workspace.

**Why this priority**: Convenience for developers who want a full picture in one step, but the individual workspace commands already deliver the core value. This is an ergonomic improvement.

**Independent Test**: Run `npm run test:coverage` from the repo root. Both backend and frontend coverage runs execute in sequence and print their summaries.

**Acceptance Scenarios**:

1. **Given** the developer is at the repo root, **When** they run the root coverage command, **Then** backend coverage runs first, then frontend unit coverage runs, and both summaries are printed.
2. **Given** one workspace''s tests fail, **When** coverage runs at the root, **Then** the failure is reported clearly and the exit code is non-zero.

---

### Edge Cases

- Source files that are never imported by any test must still appear in the report with 0% coverage (not silently omitted).
- E2E tests (Playwright) do not produce standard line coverage and are out of scope for this feature.
- TypeScript source maps must be used so coverage line numbers point to `.ts` source lines, not compiled output.
- If coverage data cannot be generated (e.g., a build error), the command must exit with a non-zero code.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend workspace MUST have a working `test:coverage` script that runs all backend tests and produces a coverage report.
- **FR-002**: The frontend workspace MUST have a working `test:coverage` script that runs all frontend unit tests and produces a coverage report.
- **FR-003**: Coverage reports MUST include statement, branch, function, and line coverage percentages per source file.
- **FR-004**: Coverage reports MUST include all source files in the respective workspace, including files with 0% coverage.
- **FR-005**: Coverage reports MUST be produced in both console/text format (for developer reading) and HTML format (for browsable detail).
- **FR-006**: The repo root MUST have a `test:coverage` script that runs backend and frontend coverage in sequence.
- **FR-007**: The HTML coverage report MUST correctly map coverage data to TypeScript source lines, not compiled output lines.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can obtain backend test coverage numbers by running a single command in under 90 seconds.
- **SC-002**: A developer can obtain frontend unit test coverage numbers by running a single command in under 60 seconds.
- **SC-003**: A developer can obtain coverage for all workspaces with a single root-level command.
- **SC-004**: All source files in each workspace appear in the respective coverage report, including files with 0% coverage.
- **SC-005**: Coverage reports are browsable as HTML with per-line annotations after running the command.

## Assumptions

- E2E test coverage (Playwright) is out of scope. Only unit, contract, and integration tests are measured.
- Coverage threshold enforcement (failing the build when coverage drops below a minimum) is out of scope. This feature is for visibility only.
- The existing `@vitest/coverage-v8` package installed in both workspaces is sufficient. No new testing packages are needed.
- The `backend/vitest.config.ts` already has a `coverage` block configured; it may need minor adjustments (e.g., ensuring all-files reporting) but the infrastructure exists.
- The `frontend/vitest.config.ts` does not yet have a `coverage` block and will need one added.

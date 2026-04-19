# Tasks: GitHub Feedback Links

**Input**: Design documents from `/specs/046-github-feedback/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared config constant used by all feedback links.

- [ ] T001 Create `frontend/src/config/feedback.ts` — export `ARGUS_GITHUB_REPO_URL = 'https://github.com/aarthi-ntrjn/argus'` and two URL builder functions: `buildBugReportUrl()` and `buildFeatureRequestUrl()`, each returning a fully-formed GitHub `issues/new` URL with `title`, `body`, and `labels` query params pre-encoded

---

## Phase 2: User Story 1 — Report a Bug (Priority: P1) 🎯 MVP

**Goal**: "Report a Bug" appears in every page header; clicking it opens a pre-filled GitHub bug report issue form in a new tab.

**Independent Test**: Click "Report a Bug" in the Feedback dropdown on DashboardPage and verify a new tab opens to the correct GitHub issues/new URL with `labels=bug` and a non-empty bug report body template.

### Tests for User Story 1

> **Write these tests FIRST. Confirm they FAIL before writing implementation.**

- [ ] T002 [P] [US1] Write unit tests for `buildBugReportUrl()` and `buildFeatureRequestUrl()` in `frontend/src/config/feedback.test.ts` — verify correct base URL, encoded title, non-empty body, correct label query params
- [ ] T003 [P] [US1] Write unit tests for `FeedbackDropdown` in `frontend/src/components/FeedbackDropdown/FeedbackDropdown.test.tsx` — verify: dropdown button renders; clicking it opens/closes the menu; "Report a Bug" renders as an anchor with correct href and `target="_blank" rel="noopener noreferrer"`; Escape closes dropdown; outside click closes dropdown

### Implementation for User Story 1

- [ ] T004 [US1] Implement `FeedbackDropdown` component in `frontend/src/components/FeedbackDropdown/FeedbackDropdown.tsx` — follows `LaunchDropdown` pattern: Button trigger with ChevronDown, absolute dropdown panel, outside-click and Escape close handlers; "Report a Bug" item uses `buildBugReportUrl()` from `feedback.ts`, rendered as `<a target="_blank" rel="noopener noreferrer">`; must stay under 50 lines per §III (depends on T001, T003 failing)
- [ ] T005 [US1] Add `FeedbackDropdown` to `DashboardPage` header in `frontend/src/pages/DashboardPage.tsx` — insert between the settings icon button and the "Add Repository" button in the `flex items-center gap-2` header div

**Checkpoint**: FeedbackDropdown renders on DashboardPage; "Report a Bug" opens correct GitHub URL in new tab.

---

## Phase 3: User Story 2 — Request a Feature (Priority: P2)

**Goal**: "Request a Feature" appears in the Feedback dropdown on every page; clicking it opens a pre-filled GitHub feature request issue form in a new tab.

**Independent Test**: Click "Request a Feature" in the Feedback dropdown and verify a new tab opens with `labels=enhancement` and a non-empty feature request body template.

### Implementation for User Story 2

- [ ] T006 [US2] Add "Request a Feature" item to `FeedbackDropdown` in `frontend/src/components/FeedbackDropdown/FeedbackDropdown.tsx` — render as `<a target="_blank" rel="noopener noreferrer">` using `buildFeatureRequestUrl()` (T002 tests cover this path; verify they now pass)

**Checkpoint**: Both "Report a Bug" and "Request a Feature" items are present in the dropdown on DashboardPage.

---

## Phase 4: Polish and Cross-Cutting Concerns

**Purpose**: Wire FeedbackDropdown into SessionPage, update documentation, run final validation.

- [ ] T007 [P] Add `FeedbackDropdown` to `SessionPage` header in `frontend/src/pages/SessionPage.tsx` — insert alongside the back button row so the feedback menu is accessible on the session detail page
- [ ] T008 [P] Update `README.md` — add a brief note in the Features or Usage section documenting the Feedback dropdown (Report a Bug / Request a Feature links in the nav bar) per §XI
- [ ] T009 Run `npm run test --workspace=frontend` and confirm all new tests pass with no regressions
- [ ] T010 Run `npm run build --workspace=frontend` and confirm zero build errors

---

## Dependencies & Execution Order

- **T001**: No dependencies — start immediately
- **T002, T003**: Depend on T001 (need feedback.ts constants to reference in tests); run in parallel
- **T004**: Depends on T002, T003 being written (tests must FAIL first)
- **T005**: Depends on T004
- **T006**: Depends on T004 (adds to existing component)
- **T007, T008**: No cross-dependency; run in parallel after T005, T006
- **T009, T010**: Run after all implementation tasks

### Parallel Opportunities

- T002 and T003 can be written in parallel (different files)
- T007 and T008 can be done in parallel (different files)

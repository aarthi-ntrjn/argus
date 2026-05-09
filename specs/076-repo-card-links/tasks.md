---

description: "Task list for 076-repo-card-links"
---

# Tasks: Show Useful Repository Links on Repo Cards

**Input**: Design documents from `/specs/076-repo-card-links/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/repo-card-links.md

**Tests**: Constitution §IV requires test-first; tests are included.

**Organization**: Grouped by user story (P1 → P2 → P3) so each story can be implemented and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared mutation)
- **[Story]**: User story tag (US1..US5). Cross-cutting tasks have no `[Story]`.

---

## Phase 1: Setup (Shared Infrastructure)

No new dependencies, lint config, or build tooling are needed for this feature. Setup is a no-op; proceed directly to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the shared `parseGitHubRemote` helper and the type definitions every user story depends on. All five user-story phases below import from these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 [P] Extend `frontend/src/__tests__/repoUtils.test.ts` with failing tests for `parseGitHubRemote` (TC-01, TC-02, TC-03, TC-11). Run `npm run test --workspace=frontend -- repoUtils` and confirm they fail.
- [ ] T002 Add `ParsedGitHubRemote` type, `REPO_CARD_LINK_KINDS` const, `RepoCardLinkKind` type, and the `parseGitHubRemote(remoteUrl)` helper to `frontend/src/utils/repoUtils.ts`. Refactor existing `buildGitHubCompareUrl` to call `parseGitHubRemote` instead of inlining the parse. T001 tests MUST now pass and the existing compare-URL tests MUST still pass.

**Checkpoint**: Foundation ready. User stories can now begin in priority order.

---

## Phase 3: User Story 1 — Open PR list for current branch (Priority: P1) 🎯 MVP

**Goal**: Render a `GitPullRequest` icon on every repo card whose remote is GitHub and whose branch is known. Clicking it opens GitHub's filtered open-PR list for that branch in a new tab.

**Independent Test**: Mount a `RepoCard` with `{ remoteUrl: 'https://github.com/o/r', branch: 'feature/foo' }`. The PR icon renders. Click → `postTelemetryEvent` is called with `'repo_card_pr_opened'` and the link's `href` matches `https://github.com/o/r/pulls?q=is%3Apr+is%3Aopen+head%3Afeature%2Ffoo`. Mount with `branch: null` → icon does not render.

### Tests for User Story 1 ⚠️ Write first, see them fail

- [ ] T003 [P] [US1] Add unit tests TC-04 and TC-05 for `buildGitHubPrListUrl` in `frontend/src/__tests__/repoUtils.test.ts`. Confirm failing.
- [ ] T004 [P] [US1] Create `frontend/src/__tests__/RepoCard.test.tsx` with TC-15 (PR-icon-only slice): renders the `GitPullRequest` icon for a GitHub remote with branch set; click stops propagation; click calls `postTelemetryEvent('repo_card_pr_opened')`. Mock `postTelemetryEvent` from `services/api`. Confirm failing.

### Implementation for User Story 1

- [ ] T005 [US1] Implement `buildGitHubPrListUrl(remoteUrl, branch)` in `frontend/src/utils/repoUtils.ts` per data-model.md. T003 MUST now pass.
- [ ] T006 [US1] Render the PR indicator in `frontend/src/components/RepoCard/RepoCard.tsx` next to the existing `GitCompare` icon. Use `lucide-react`'s `GitPullRequest` at size 14. Wire the click handler to `postTelemetryEvent('repo_card_pr_opened')` and stop propagation. T004 MUST now pass. Run `npm run build --workspace=frontend` per CLAUDE.md.

**Checkpoint**: US1 standalone-shippable. Demo: dashboard shows PR icon on every repo card with a GitHub remote.

---

## Phase 4: User Story 2 — Browse commits on current branch (Priority: P2)

**Goal**: Render a `GitCommit` icon. Clicking it opens GitHub's commits view scoped to the current branch (or the default-branch view when on `master`/`main`).

**Independent Test**: Mount a `RepoCard` with `{ remoteUrl: 'https://github.com/o/r', branch: 'feature/foo' }`. Commits icon renders, `href` is `https://github.com/o/r/commits/feature%2Ffoo`. With `branch: 'master'`, `href` is `https://github.com/o/r/commits`.

### Tests for User Story 2 ⚠️

- [ ] T007 [P] [US2] Add unit tests TC-06 and TC-07 for `buildGitHubCommitsUrl` in `frontend/src/__tests__/repoUtils.test.ts`. Confirm failing.
- [ ] T008 [P] [US2] Add component test TC-16 (commits slice) in `frontend/src/__tests__/RepoCard.test.tsx`: commits icon renders, click emits `repo_card_commits_opened`, click does not bubble. Confirm failing.

### Implementation for User Story 2

- [ ] T009 [US2] Implement `buildGitHubCommitsUrl(remoteUrl, branch)` in `frontend/src/utils/repoUtils.ts`. T007 passes.
- [ ] T010 [US2] Render the commits indicator in `RepoCard.tsx`. Wire click → `postTelemetryEvent('repo_card_commits_opened')`. T008 passes. Rebuild frontend.

**Checkpoint**: US1 + US2 functional.

---

## Phase 5: User Story 3 — Open repo home from repo name (Priority: P2)

**Goal**: Wrap the repo-name `<h2>` in an `<a>` linking to the repo's GitHub home when the remote is GitHub. Otherwise render plain text (current behavior).

**Independent Test**: Mount with GitHub remote → repo name is an `<a>` whose `href` is `https://github.com/o/r`. Mount with non-GitHub remote → repo name remains plain text. Click on the link emits `repo_card_home_opened` and does not propagate to the card.

### Tests for User Story 3 ⚠️

- [ ] T011 [P] [US3] Add unit test TC-09 (oh wait — TC-10 covers home-on-non-GitHub returning null) plus a positive test: `buildGitHubHomeUrl('https://github.com/o/r')` returns `'https://github.com/o/r'`. Add to `repoUtils.test.ts`. Confirm failing.
- [ ] T012 [P] [US3] Component test in `RepoCard.test.tsx`: with GitHub remote, repo-name renders as `<a>` with correct href and emits `repo_card_home_opened` on click; with non-GitHub remote, repo-name is plain text (no `<a>`). Confirm failing.

### Implementation for User Story 3

- [ ] T013 [US3] Implement `buildGitHubHomeUrl(remoteUrl)` in `repoUtils.ts`. T011 passes.
- [ ] T014 [US3] In `RepoCard.tsx`, conditionally wrap the `<h2>` content in `<a>` when `parseGitHubRemote(remoteUrl)` is not null. Preserve existing styling; add `hover:underline`. Wire click → `postTelemetryEvent('repo_card_home_opened')`. T012 passes. Rebuild frontend.

**Checkpoint**: US1 + US2 + US3 functional.

---

## Phase 6: User Story 4 — Actions on current branch (Priority: P3)

**Goal**: Render a `PlayCircle` icon. Clicking opens GitHub Actions filtered to the current branch.

### Tests for User Story 4 ⚠️

- [ ] T015 [P] [US4] Add unit test TC-08 for `buildGitHubActionsUrl` in `repoUtils.test.ts`. Confirm failing.
- [ ] T016 [P] [US4] Component test: actions icon renders for GitHub remote with branch set, hidden otherwise; click emits `repo_card_actions_opened`. Confirm failing.

### Implementation for User Story 4

- [ ] T017 [US4] Implement `buildGitHubActionsUrl(remoteUrl, branch)` in `repoUtils.ts`. T015 passes.
- [ ] T018 [US4] Render actions indicator in `RepoCard.tsx`. Wire click → `postTelemetryEvent('repo_card_actions_opened')`. T016 passes. Rebuild frontend.

**Checkpoint**: US1..US4 functional.

---

## Phase 7: User Story 5 — Issues list (Priority: P3)

**Goal**: Render a `CircleDot` icon (repo-scoped, no branch dependency). Clicking opens the GitHub issues list for the repo.

### Tests for User Story 5 ⚠️

- [ ] T019 [P] [US5] Add unit test TC-09 (corrected: `buildGitHubIssuesUrl` returns `.../issues` for GitHub remote, `null` otherwise) in `repoUtils.test.ts`. Confirm failing.
- [ ] T020 [P] [US5] Component test: issues icon renders for GitHub remote even when `branch` is null; click emits `repo_card_issues_opened`. Confirm failing.

### Implementation for User Story 5

- [ ] T021 [US5] Implement `buildGitHubIssuesUrl(remoteUrl)` in `repoUtils.ts`. T019 passes.
- [ ] T022 [US5] Render issues indicator in `RepoCard.tsx`. Wire click → `postTelemetryEvent('repo_card_issues_opened')`. T020 passes. Rebuild frontend.

**Checkpoint**: All user stories functional.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T023 [P] Add component test TC-13 (non-GitHub remote → no new icons, repo-name plain text) and TC-14 (`branch: null` → only `issues` and home-link render) to `RepoCard.test.tsx`. These exercise the visibility-gating logic of all five indicators together.
- [ ] T024 [P] Add Playwright e2e `frontend/tests/e2e/sc-076-repo-card-links.spec.ts` covering the happy path: dashboard with one GitHub-remote repo on a feature branch, all five new indicators visible, each link has correct `href` and `target="_blank"`.
- [ ] T025 Update `README.md` per Constitution §XI: brief mention of the repo-card link indicators (PR, commits, actions, issues, home) under the "Dashboard" section. Keep to two sentences.
- [ ] T026 Run full frontend lint+format: `npm run lint:fix --workspace=frontend && npm run format --workspace=frontend`. Confirm clean.
- [ ] T027 Run full frontend test suite: `npm run test --workspace=frontend`. Confirm green.
- [ ] T028 Run frontend build: `npm run build --workspace=frontend`. Confirm green.

---

## Dependencies & Execution Order

### Phase order

- Phase 1 (Setup): no-op
- Phase 2 (Foundational): T001 → T002. Blocks all user stories.
- Phase 3 (US1, P1): T003, T004 in parallel → T005 → T006. **Stop here for MVP** if needed.
- Phase 4 (US2, P2): T007, T008 in parallel → T009 → T010
- Phase 5 (US3, P2): T011, T012 in parallel → T013 → T014
- Phase 6 (US4, P3): T015, T016 in parallel → T017 → T018
- Phase 7 (US5, P3): T019, T020 in parallel → T021 → T022
- Phase 8 (Polish): T023, T024 in parallel → T025 → T026 → T027 → T028

### Test-first gates

- For every user-story phase, the `[P]` test tasks MUST be authored and observed failing before the matching implementation task runs (Constitution §IV).

### Parallel opportunities

- Within each user-story phase, the two test tasks are `[P]` (one in `repoUtils.test.ts`, one in `RepoCard.test.tsx` — different files).
- Across user-story phases, T003+T004, T007+T008, T011+T012, T015+T016, T019+T020 could in principle run in parallel if multiple developers implement different stories simultaneously, BUT all of them touch `repoUtils.test.ts` and all implementation tasks touch `RepoCard.tsx`. So in single-developer execution, run user-story phases serially in priority order.

---

## Implementation Strategy

### MVP cut

Phase 1 → Phase 2 → Phase 3 (US1 only). Ship if needed; everything else is additive.

### Incremental delivery

After each user-story phase, the dashboard works with one more indicator. No phase regresses earlier ones.

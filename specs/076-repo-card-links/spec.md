# Feature Specification: Show Useful Repository Links on Repo Cards

**Feature Branch**: `076-repo-card-links`
**Created**: 2026-05-09
**Status**: Clarified
**Input**: User description: "i want to see what all links for the repository should be show in the repo card. things or interest are the list of commits, list of pull requests. what else is relevant"

## Clarifications

### Session 2026-05-09

- Q: How should Argus discover whether the current branch has an open PR? → A: Frontend-only. No PR-detection in Argus. The pull-request indicator always renders (when a GitHub remote and branch are known) and links to GitHub's filtered open-PR list (`/pulls?q=is:pr+is:open+head:<branch>`). GitHub itself handles all three cases: 0 PRs (offers a "New pull request" button), 1 PR (visible in the list, one click to open), N PRs (filtered list).
- Q: Should the branch chip itself be clickable? → A: Yes. The branch chip on each repo card MUST link to the branch's tree view on GitHub (`/tree/<branch>`) when the remote is GitHub. Same telemetry pattern as the other indicators (`repo_card_branch_opened`).

## Overview

Each repo card on the Argus dashboard already surfaces the current branch and a "compare" link. The user wants to expand the set of GitHub-hosted links shown on each repo card so that, while monitoring sessions, they can jump directly to the most useful views of the underlying repository without leaving Argus.

This spec defines which repository links are relevant, how they should appear, and how they behave when the underlying repository is not hosted on GitHub.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jump to the open pull request for the current branch (Priority: P1)

While watching a session work on a feature branch, the user wants to glance at the repo card and click straight through to GitHub's open-PR list filtered to that branch. This is the single most valuable link because it answers "is my change up for review yet, and what is its current state?" without needing to re-derive the branch name and craft a URL.

**Why this priority**: This is the user's primary daily action when supervising agentic coding sessions. A previous attempt to add this link was reverted (see commit `e27f2590`); reintroducing it correctly is the core value of this feature.

**Independent Test**: Given a repo card on a GitHub remote with a known branch, clicking the pull-request indicator opens GitHub's open-PR list filtered to that branch in a new tab. Given a non-GitHub remote, no pull-request indicator is shown.

**Acceptance Scenarios**:

1. **Given** a repo card whose branch is `feature/foo`, **When** the user clicks the pull-request indicator, **Then** `https://github.com/<owner>/<repo>/pulls?q=is%3Apr+is%3Aopen+head%3Afeature%2Ffoo` opens in a new browser tab.
2. **Given** a repo card whose branch has one or more open PRs, **When** the user lands on the filtered list, **Then** those PRs are visible there (rendered by GitHub itself, not by Argus).
3. **Given** a repo card whose branch has no open PRs, **When** the user lands on the filtered list, **Then** GitHub's empty-state with the "New pull request" button is shown (Argus does not pre-filter this case out).
4. **Given** a repo whose remote URL is not GitHub, **When** the card renders, **Then** no pull-request indicator is shown.

---

### User Story 2 - Browse recent commits on the current branch (Priority: P2)

The user wants to see what has actually been committed by the active session(s) on the current branch. From the repo card they should be able to open GitHub's commits view, scoped to the current branch, in one click.

**Why this priority**: Useful for verifying that an autonomous session has produced the expected commits and reviewing their messages, but the user typically reaches for this only after they have already noticed something interesting in the session output.

**Independent Test**: Given a repo card on a non-default branch, clicking the commits indicator opens GitHub's commits view filtered to that branch. On the default branch (`master` or `main`), it opens the default commits view.

**Acceptance Scenarios**:

1. **Given** a repo card whose branch is `feature/foo`, **When** the user clicks the commits indicator, **Then** GitHub's `/commits/feature/foo` page opens in a new tab.
2. **Given** a repo card whose branch is the repo's default branch, **When** the user clicks the commits indicator, **Then** GitHub's default commits page opens in a new tab.

---

### User Story 3 - Open the repository home page (Priority: P2)

The user wants a one-click way to jump to the repo's GitHub home page from the card, primarily as a fallback when none of the more specific links match what they need (browsing files, README, etc.).

**Why this priority**: Cheap to add and useful as an "escape hatch", but rarely the primary action.

**Independent Test**: Clicking the repo-name link on the card opens the repository's GitHub home in a new tab. For non-GitHub remotes, the repo name remains plain text.

**Acceptance Scenarios**:

1. **Given** a repo card with a GitHub remote, **When** the user clicks the repository name, **Then** the GitHub repo home page opens in a new tab.
2. **Given** a repo card with a non-GitHub remote (or no remote), **When** the user looks at the repository name, **Then** it is rendered as plain text with no link.

---

### User Story 4 - See CI / Actions status for the current branch (Priority: P3)

The user wants to see at a glance whether GitHub Actions on the current branch is passing or failing, and click through to the workflow runs for that branch.

**Why this priority**: Helpful for catching regressions but secondary to the PR and commit links. Many users will not have Actions configured.

**Independent Test**: Clicking the actions indicator opens GitHub's Actions view filtered to the current branch.

**Acceptance Scenarios**:

1. **Given** a repo card on branch `feature/foo`, **When** the user clicks the actions indicator, **Then** GitHub's Actions page filtered by that branch opens in a new tab.
2. **Given** a non-GitHub remote, **When** the card renders, **Then** the actions indicator is hidden.

---

### User Story 5 - Open the issues list (Priority: P3)

The user wants a quick path to the repository's open issues from the card, useful when triaging or referencing issue numbers from session output.

**Why this priority**: Convenient but rarely time-critical compared to PRs and commits.

**Independent Test**: Clicking the issues indicator opens the GitHub issues list for the repository.

**Acceptance Scenarios**:

1. **Given** a repo card with a GitHub remote, **When** the user clicks the issues indicator, **Then** the open-issues list for that repo opens in a new tab.

---

### Edge Cases

- The repository has no remote configured (local-only). All GitHub-derived indicators are hidden; the existing branch chip still renders.
- The remote URL points to a GitHub Enterprise host or a non-GitHub provider (GitLab, Bitbucket, Azure DevOps). For v1, only `github.com` (HTTPS or SSH form) is supported; non-GitHub remotes show no link indicators. This avoids generating broken URLs.
- The branch is detached HEAD or unknown. Branch-scoped indicators (PR for branch, commits for branch, actions for branch) are hidden; the repo-home link may still render.
- The branch name contains characters that need URL encoding (e.g. `/`, `#`). The system MUST URL-encode branch segments before building links.
- The user has many repo cards on screen. Adding link indicators MUST NOT measurably degrade dashboard render or scroll performance (see SC-004).
- The user clicks an indicator. Clicks on indicators MUST NOT trigger the repo-card-level click behavior (e.g. opening sessions). Each indicator's click handler stops propagation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each repo card MUST display a set of zero or more GitHub link indicators alongside the existing branch chip and "compare" indicator, in the metadata row directly under the repository name.
- **FR-002**: Each indicator MUST be a small icon (no text label by default) with a tooltip that describes the destination ("Open pull request on GitHub", "View commits on GitHub", etc.) and an `aria-label` matching the tooltip text for screen readers.
- **FR-003**: Each indicator MUST open its destination in a new browser tab (`target="_blank"` with `rel="noopener noreferrer"`) and MUST stop click-propagation so it does not trigger card-level interactions.
- **FR-004**: The system MUST recognize GitHub remote URLs in both HTTPS form (`https://github.com/<owner>/<repo>.git`) and SSH form (`git@github.com:<owner>/<repo>.git`), stripping any trailing `.git`.
- **FR-005**: For non-GitHub remotes (and for repos with no remote), the system MUST hide all GitHub-specific indicators rather than rendering broken or misleading links.
- **FR-006**: The "open pull request" indicator MUST link to GitHub's filtered open-PR list for the current branch (`/pulls?q=is:pr+is:open+head:<branch>`). The indicator is rendered whenever the repo has a recognized GitHub remote and a known branch; it is NOT conditional on whether an open PR actually exists. Argus MUST NOT call the GitHub API or shell out to `gh` to determine PR state.
- **FR-007**: The "view commits" indicator MUST link to GitHub's commits view scoped to the current branch (`/commits/<branch>`), or to the repo's default commits view when on the default branch (`master` or `main`).
- **FR-008**: The repository name MUST link to the repo home (`https://github.com/<owner>/<repo>`) when a GitHub remote is detected, and remain plain (non-link) text otherwise.
- **FR-009**: The "view actions" indicator MUST link to GitHub Actions filtered by the current branch (`/actions?query=branch:<branch>`).
- **FR-010**: The "view issues" indicator MUST link to the GitHub open-issues list (`/issues`).
- **FR-011**: All branch segments embedded in URLs MUST be URL-encoded.
- **FR-012**: When the current branch is unknown (e.g. detached HEAD), the system MUST hide all branch-scoped indicators (PR-for-branch, commits-for-branch, actions-for-branch) but MAY still render repo-scoped indicators (repo home, issues).
- **FR-013**: Each indicator click MUST emit a telemetry event identifying which link was clicked (consistent with the existing `repo_diff_opened` telemetry event), so we can later measure relative usage and prune unused links.
- **FR-014**: The set and order of indicators in the metadata row MUST be: branch chip (now clickable on GitHub remotes), compare (existing), open-PR, commits, actions, issues. This keeps the most-actionable indicator (PR) closest to the existing diff link the user already scans.
- **FR-015**: The branch chip MUST link to the branch tree view on GitHub (`/tree/<branch>`) when the remote is recognized as GitHub. On non-GitHub remotes (or when there is no remote), the branch chip MUST render as plain text (current behavior). Click MUST stop propagation and emit `repo_card_branch_opened`.

### Key Entities

- **RepoCardLink**: A single clickable indicator on the repo card. Attributes: kind (one of `pr`, `commits`, `actions`, `issues`, `home`, `compare`), destination URL, tooltip/aria-label text, visibility condition (requires GitHub remote, and for branch-scoped kinds also requires a known branch). Behavior: opens in new tab, stops propagation, emits a telemetry event keyed by kind.
- **RepositoryRemote**: The Git remote associated with a repository. Attributes: raw URL, derived host (e.g. `github.com`), derived `<owner>/<repo>` slug, whether the remote is recognized as GitHub. Used to gate which `RepoCardLink`s appear on a card.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 80% of users monitoring a session on a feature branch reach the open PR for that branch via the repo card (rather than via the GitHub URL bar or a separate browser tab) within one week of release. Measured via telemetry on the `repo_card_pr_opened` event compared to baseline manual navigation.
- **SC-002**: From noticing a session has committed work to landing on GitHub's commits view for that branch takes the user no more than two clicks: one on the repo card's commits indicator, one to scroll/select. Measured by user observation in usability checks.
- **SC-003**: Zero broken or misleading links are shown on repo cards. For every repo whose remote is not recognized as GitHub, no GitHub-style indicators appear. The PR indicator always lands on a valid GitHub page (a filtered-PR list, including the empty-state list when no open PR exists). Verified by automated UI tests covering each of the edge cases listed above.
- **SC-004**: Adding link indicators introduces no perceptible regression in dashboard render time. Repo card render time after this feature stays within 10% of the pre-feature baseline when 20 repo cards are displayed.
- **SC-005**: Each indicator's destination is correct in 100% of automated test cases covering: HTTPS remote, SSH remote, default branch, non-default branch, branch name needing URL-encoding, and non-GitHub remote.

## Assumptions

- The Argus user is the same person who has access to the GitHub repository in their browser (i.e. clicking a link to a private repo lands on a working GitHub page, not a 404). No GitHub authentication is added to Argus by this feature.
- Only `github.com` remotes are supported in v1. GitHub Enterprise, GitLab, Bitbucket, and Azure DevOps are explicitly out of scope and will be tracked as a follow-up if usage justifies it.
- The current branch and remote URL are already available on the repository data model used by the dashboard (existing `repo.branch` and `repo.remoteUrl` fields). No backend schema change is required.
- Every indicator (including the PR indicator) is a pure client-side URL construction. Argus never calls the GitHub API and never shells out to `gh`. GitHub itself handles the empty-list / one-PR / many-PRs cases on the destination page.
- Telemetry uses the existing `postTelemetryEvent` mechanism already used by the compare link.
- The links are decorative entry points, not data viewers. We intentionally do not embed PR or commit content inside the repo card; clicking always opens GitHub in a new tab.

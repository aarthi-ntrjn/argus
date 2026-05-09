# Feature Specification: Show Useful Repository Links on Repo Cards

**Feature Branch**: `076-repo-card-links`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "i want to see what all links for the repository should be show in the repo card. things or interest are the list of commits, list of pull requests. what else is relevant"

## Overview

Each repo card on the Argus dashboard already surfaces the current branch and a "compare" link. The user wants to expand the set of GitHub-hosted links shown on each repo card so that, while monitoring sessions, they can jump directly to the most useful views of the underlying repository without leaving Argus.

This spec defines which repository links are relevant, how they should appear, and how they behave when the underlying repository is not hosted on GitHub.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jump to the open pull request for the current branch (Priority: P1)

While watching a session work on a feature branch, the user wants to glance at the repo card and click straight through to any open pull request for that branch on GitHub. This is the single most valuable link because it answers "is my change up for review yet, and what is its current state?" without needing to re-derive the branch name and craft a URL.

**Why this priority**: This is the user's primary daily action when supervising agentic coding sessions. A previous attempt to add this link was reverted (see commit `e27f2590`); reintroducing it correctly is the core value of this feature.

**Independent Test**: Given a repo card whose current branch has an open PR, the user clicks the PR icon and lands on the PR conversation page in a new tab. Given a repo card whose current branch has no open PR, no broken link is shown.

**Acceptance Scenarios**:

1. **Given** a repo card whose branch has exactly one open PR on GitHub, **When** the user clicks the pull-request indicator, **Then** the GitHub PR page for that PR opens in a new browser tab.
2. **Given** a repo card whose branch has multiple open PRs, **When** the user clicks the pull-request indicator, **Then** GitHub's PR list filtered to that branch opens in a new tab.
3. **Given** a repo card whose branch has no open PRs, **When** the user looks at the card, **Then** the pull-request indicator is either hidden or visibly inactive (no broken-looking link).
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
- Open-PR information is not yet known when the card first renders (data still loading). The PR indicator MUST NOT show as "no PR" prematurely; it should be hidden until the PR data has loaded.
- The user has many repo cards on screen. Adding link indicators MUST NOT measurably degrade dashboard render or scroll performance (see SC-004).
- The user clicks an indicator. Clicks on indicators MUST NOT trigger the repo-card-level click behavior (e.g. opening sessions). Each indicator's click handler stops propagation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each repo card MUST display a set of zero or more GitHub link indicators alongside the existing branch chip and "compare" indicator, in the metadata row directly under the repository name.
- **FR-002**: Each indicator MUST be a small icon (no text label by default) with a tooltip that describes the destination ("Open pull request on GitHub", "View commits on GitHub", etc.) and an `aria-label` matching the tooltip text for screen readers.
- **FR-003**: Each indicator MUST open its destination in a new browser tab (`target="_blank"` with `rel="noopener noreferrer"`) and MUST stop click-propagation so it does not trigger card-level interactions.
- **FR-004**: The system MUST recognize GitHub remote URLs in both HTTPS form (`https://github.com/<owner>/<repo>.git`) and SSH form (`git@github.com:<owner>/<repo>.git`), stripping any trailing `.git`.
- **FR-005**: For non-GitHub remotes (and for repos with no remote), the system MUST hide all GitHub-specific indicators rather than rendering broken or misleading links.
- **FR-006**: The "open pull request" indicator MUST link to the open PR for the current branch when exactly one exists, and to GitHub's filtered PR list (`/pulls?q=is:pr+is:open+head:<branch>`) when more than one exists. It MUST be hidden when no open PR exists for the branch, or when PR data is still loading.
- **FR-007**: The "view commits" indicator MUST link to GitHub's commits view scoped to the current branch (`/commits/<branch>`), or to the repo's default commits view when on the default branch (`master` or `main`).
- **FR-008**: The repository name MUST link to the repo home (`https://github.com/<owner>/<repo>`) when a GitHub remote is detected, and remain plain (non-link) text otherwise.
- **FR-009**: The "view actions" indicator MUST link to GitHub Actions filtered by the current branch (`/actions?query=branch:<branch>`).
- **FR-010**: The "view issues" indicator MUST link to the GitHub open-issues list (`/issues`).
- **FR-011**: All branch segments embedded in URLs MUST be URL-encoded.
- **FR-012**: When the current branch is unknown (e.g. detached HEAD), the system MUST hide all branch-scoped indicators (PR-for-branch, commits-for-branch, actions-for-branch) but MAY still render repo-scoped indicators (repo home, issues).
- **FR-013**: Each indicator click MUST emit a telemetry event identifying which link was clicked (consistent with the existing `repo_diff_opened` telemetry event), so we can later measure relative usage and prune unused links.
- **FR-014**: The set and order of indicators in the metadata row MUST be: branch chip, compare (existing), open-PR, commits, actions, issues. This keeps the most-actionable indicator (PR) closest to the existing diff link the user already scans.

### Key Entities

- **RepoCardLink**: A single clickable indicator on the repo card. Attributes: kind (one of `pr`, `commits`, `actions`, `issues`, `home`, `compare`), destination URL, tooltip/aria-label text, visibility condition (e.g. requires GitHub remote, requires known branch, requires open-PR data loaded). Behavior: opens in new tab, stops propagation, emits a telemetry event keyed by kind.
- **RepositoryRemote**: The Git remote associated with a repository. Attributes: raw URL, derived host (e.g. `github.com`), derived `<owner>/<repo>` slug, whether the remote is recognized as GitHub. Used to gate which `RepoCardLink`s appear on a card.
- **BranchPullRequestInfo**: Per-branch pull-request state used to decide what the open-PR indicator does. Attributes: openPrCount (0, 1, or many), singlePrUrl (when count is 1), branchPrListUrl (when count is many), loaded flag (so indicator can be hidden until known).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 80% of users monitoring a session on a feature branch reach the open PR for that branch via the repo card (rather than via the GitHub URL bar or a separate browser tab) within one week of release. Measured via telemetry on the `repo_card_pr_opened` event compared to baseline manual navigation.
- **SC-002**: From noticing a session has committed work to landing on GitHub's commits view for that branch takes the user no more than two clicks: one on the repo card's commits indicator, one to scroll/select. Measured by user observation in usability checks.
- **SC-003**: Zero broken or misleading links are shown on repo cards. For every repo whose remote is not recognized as GitHub, no GitHub-style indicators appear; for every branch with no open PR, the PR indicator is absent. Verified by automated UI tests covering each of the five edge cases listed above.
- **SC-004**: Adding link indicators introduces no perceptible regression in dashboard render time. Repo card render time after this feature stays within 10% of the pre-feature baseline when 20 repo cards are displayed.
- **SC-005**: Each indicator's destination is correct in 100% of automated test cases covering: HTTPS remote, SSH remote, default branch, non-default branch, branch name needing URL-encoding, and non-GitHub remote.

## Assumptions

- The Argus user is the same person who has access to the GitHub repository in their browser (i.e. clicking a link to a private repo lands on a working GitHub page, not a 404). No GitHub authentication is added to Argus by this feature.
- Only `github.com` remotes are supported in v1. GitHub Enterprise, GitLab, Bitbucket, and Azure DevOps are explicitly out of scope and will be tracked as a follow-up if usage justifies it.
- The current branch and remote URL are already available on the repository data model used by the dashboard (existing `repo.branch` and `repo.remoteUrl` fields). No backend schema change is required for any indicator other than the open-PR indicator.
- Open-PR data for the current branch is the only piece of GitHub state Argus needs to fetch itself (to drive User Story 1's hide/show logic). All other indicators are pure client-side URL constructions and require no GitHub API call.
- Telemetry uses the existing `postTelemetryEvent` mechanism already used by the compare link.
- The links are decorative entry points, not data viewers. We intentionally do not embed PR or commit content inside the repo card; clicking always opens GitHub in a new tab.

# Feature Specification: Show Useful Repository Links on Repo Cards

**Feature Branch**: `076-repo-card-links`
**Created**: 2026-05-09
**Status**: Clarified
**Input**: User description: "i want to see what all links for the repository should be show in the repo card. things or interest are the list of commits, list of pull requests. what else is relevant"

## Clarifications

### Session 2026-05-09

- Q: How should Argus discover whether the current branch has an open PR? → A: Frontend-only. No PR-detection in Argus. The pull-request indicator always renders when a GitHub remote and branch are known. It links to GitHub's `/pull/new/<branch>` URL: when no PR exists for the branch, GitHub shows the "Open a pull request" form; when one already exists, GitHub shows that form with a banner pointing to the existing PR. Either way the user lands somewhere useful with no Argus-side detection logic.
- Q: Should the branch chip itself be clickable? → A: Yes. The branch chip on each repo card MUST link to the branch's tree view on GitHub (`/tree/<branch>`) when the remote is GitHub. Same telemetry pattern as the other indicators (`repo_card_branch_opened`).
- Q: Are the Actions, Issues, and Commits indicators worth keeping? → A: No, drop all three. Issues is off-mission for the session-monitoring use case (reachable via the repo-home link in two clicks). Actions is dead pixel space on repos without CI configured. Commits duplicates the existing Compare view, which already lists commits on its destination page in addition to showing the diff. The remaining set (PR, repo home, branch chip, plus the existing compare) covers the actual monitoring workflow without redundancy.

## Overview

Each repo card on the Argus dashboard already surfaces the current branch and a "compare" link. The user wants to expand the set of GitHub-hosted links shown on each repo card so that, while monitoring sessions, they can jump directly to the most useful views of the underlying repository without leaving Argus.

This spec defines which repository links are relevant, how they should appear, and how they behave when the underlying repository is not hosted on GitHub.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jump to the pull request for the current branch (Priority: P1)

While watching a session work on a feature branch, the user wants to glance at the repo card and click straight through to GitHub's PR surface for that branch. This is the single most valuable link because it answers "is my change up for review yet, and if not, can I open one in one more click?" without needing to re-derive the branch name and craft a URL.

**Why this priority**: This is the user's primary daily action when supervising agentic coding sessions. A previous attempt to add this link was reverted (see commit `e27f2590`); reintroducing it correctly is the core value of this feature.

**Independent Test**: Given a repo card on a GitHub remote with a known branch, clicking the pull-request indicator opens GitHub's `/pull/new/<branch>` page in a new tab. Given a non-GitHub remote, no pull-request indicator is shown.

**Acceptance Scenarios**:

1. **Given** a repo card whose branch is `feature/foo`, **When** the user clicks the pull-request indicator, **Then** `https://github.com/<owner>/<repo>/pull/new/feature%2Ffoo` opens in a new browser tab.
2. **Given** a repo card whose branch has no open PR, **When** the user lands on the destination, **Then** GitHub's "Open a pull request" form is shown so the user can open one immediately.
3. **Given** a repo card whose branch already has an open PR, **When** the user lands on the destination, **Then** GitHub shows the same form with a banner: "There's already a pull request for this branch: #N" linking to the existing PR.
4. **Given** a repo whose remote URL is not GitHub, **When** the card renders, **Then** no pull-request indicator is shown.

---

### User Story 3 - Open the repository home page (Priority: P2)

The user wants a one-click way to jump to the repo's GitHub home page from the card, primarily as a fallback when none of the more specific links match what they need (browsing files, README, etc.).

**Why this priority**: Cheap to add and useful as an "escape hatch", but rarely the primary action.

**Independent Test**: Clicking the repo-name link on the card opens the repository's GitHub home in a new tab. For non-GitHub remotes, the repo name remains plain text.

**Acceptance Scenarios**:

1. **Given** a repo card with a GitHub remote, **When** the user clicks the repository name, **Then** the GitHub repo home page opens in a new tab.
2. **Given** a repo card with a non-GitHub remote (or no remote), **When** the user looks at the repository name, **Then** it is rendered as plain text with no link.

---

### Edge Cases

- The repository has no remote configured (local-only). All GitHub-derived indicators are hidden; the existing branch chip still renders.
- The remote URL points to a GitHub Enterprise host or a non-GitHub provider (GitLab, Bitbucket, Azure DevOps). For v1, only `github.com` (HTTPS or SSH form) is supported; non-GitHub remotes show no link indicators. This avoids generating broken URLs.
- The branch is detached HEAD or unknown. Branch-scoped indicators (PR for branch, branch chip, compare) are hidden; the repo-home link may still render.
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
- **FR-006**: The "open pull request" indicator MUST link to GitHub's `/pull/new/<branch>` URL for the current branch. The indicator is rendered whenever the repo has a recognized GitHub remote and a known branch; it is NOT conditional on whether a PR actually exists. Argus MUST NOT call the GitHub API or shell out to `gh` to determine PR state.
- **FR-008**: The repository name MUST link to the repo home (`https://github.com/<owner>/<repo>`) when a GitHub remote is detected, and remain plain (non-link) text otherwise.
- **FR-011**: All branch segments embedded in URLs MUST be URL-encoded.
- **FR-012**: When the current branch is unknown (e.g. detached HEAD), the system MUST hide all branch-scoped indicators (PR-for-branch, branch chip, compare) but MAY still render repo-scoped indicators (repo home).
- **FR-013**: Each indicator click MUST emit a telemetry event identifying which link was clicked (consistent with the existing `repo_diff_opened` telemetry event), so we can later measure relative usage and prune unused links.
- **FR-014**: The set and order of indicators in the metadata row MUST be: branch chip (clickable on GitHub remotes), compare (existing), PR. The repo-name (also a link on GitHub remotes) sits in the header row above.
- **FR-015**: The branch chip MUST link to the branch tree view on GitHub (`/tree/<branch>`) when the remote is recognized as GitHub. On non-GitHub remotes (or when there is no remote), the branch chip MUST render as plain text (current behavior). Click MUST stop propagation and emit `repo_card_branch_opened`.

### Key Entities

- **RepoCardLink**: A single clickable indicator on the repo card. Attributes: kind (one of `pr`, `home`, `branch`, `compare`), destination URL, tooltip/aria-label text, visibility condition (requires GitHub remote, and for branch-scoped kinds also requires a known branch). Behavior: opens in new tab, stops propagation, emits a telemetry event keyed by kind.
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

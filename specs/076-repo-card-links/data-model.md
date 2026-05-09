# Data Model: Repo Card Links

This feature has no persisted data and no new API payloads. The "entities" below are TypeScript types used between `repoUtils.ts` and `RepoCard.tsx`. They live in frontend memory only.

## Existing types reused

```ts
// frontend/src/types.ts
interface Repository {
  // ...
  branch: string | null;
  remoteUrl?: string | null;
}
```

No changes to `Repository`. No backend schema changes.

## New types

### `ParsedGitHubRemote`

Output of the shared `parseGitHubRemote` helper.

```ts
interface ParsedGitHubRemote {
  owner: string;        // e.g. "aarthi-ntrjn"
  repo: string;         // e.g. "argus-private" (no trailing .git)
  baseUrl: string;      // e.g. "https://github.com/aarthi-ntrjn/argus-private"
}
```

Returned as `ParsedGitHubRemote | null`. `null` means: no remote, or the remote is not recognized as `github.com` (HTTPS or SSH form).

### `RepoCardLinkKind`

Discriminator for telemetry keys and (later, if needed) for any shared rendering logic.

```ts
type RepoCardLinkKind = 'pr' | 'commits' | 'actions' | 'issues' | 'home' | 'compare' | 'branch';
```

Defined as a `const` set per CLAUDE.md "no magic strings":

```ts
const REPO_CARD_LINK_KINDS = ['pr', 'commits', 'actions', 'issues', 'home', 'compare', 'branch'] as const;
type RepoCardLinkKind = typeof REPO_CARD_LINK_KINDS[number];
```

### Telemetry event names

```ts
const REPO_CARD_TELEMETRY_EVENTS: Record<Exclude<RepoCardLinkKind, 'compare'>, string> = {
  pr:       'repo_card_pr_opened',
  commits:  'repo_card_commits_opened',
  actions:  'repo_card_actions_opened',
  issues:   'repo_card_issues_opened',
  home:     'repo_card_home_opened',
  branch:   'repo_card_branch_opened',
};
// 'compare' continues to use the pre-existing 'repo_diff_opened' event,
// which remains hard-coded at its existing call site.
```

## URL builders (signatures)

All new builders are pure functions in `frontend/src/utils/repoUtils.ts`. Each returns a string URL on success or `null` when the inputs cannot produce a valid GitHub URL (no remote, non-GitHub remote, or for branch-scoped builders, a missing branch).

```ts
export function parseGitHubRemote(remoteUrl: string | null | undefined): ParsedGitHubRemote | null;
export function buildGitHubPrListUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null;
export function buildGitHubCommitsUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null;
export function buildGitHubActionsUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null;
export function buildGitHubIssuesUrl(remoteUrl: string | null | undefined): string | null;
export function buildGitHubHomeUrl(remoteUrl: string | null | undefined): string | null;
export function buildGitHubBranchUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null;
// existing:
export function buildGitHubCompareUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null;
```

## Validation rules

- `parseGitHubRemote` MUST accept both `https://github.com/<owner>/<repo>(.git)?` and `git@github.com:<owner>/<repo>(.git)?` forms; trailing `.git` is stripped.
- All branch values embedded in URLs MUST go through `encodeURIComponent` (FR-011).
- `buildGitHubCommitsUrl` MUST return the `/commits` path (no branch segment) when `branch` is `master` or `main`, mirroring the existing `buildGitHubCompareUrl` default-branch behavior.
- `buildGitHubIssuesUrl` and `buildGitHubHomeUrl` are repo-scoped and ignore branch entirely (FR-012 says repo-scoped indicators MAY render even with unknown branch).
- All other builders are branch-scoped and MUST return `null` when `branch` is null/empty (FR-012).

## State transitions

None. All builders are pure; nothing mutates.

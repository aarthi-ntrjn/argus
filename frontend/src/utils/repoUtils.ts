const DEFAULT_BRANCHES = new Set(['master', 'main']);

const GITHUB_HTTPS_PREFIX = 'https://github.com/';
const GITHUB_SSH_PREFIX = 'git@github.com:';

export const REPO_CARD_LINK_KINDS = ['pr', 'home', 'compare', 'branch'] as const;
export type RepoCardLinkKind = (typeof REPO_CARD_LINK_KINDS)[number];

export interface ParsedGitHubRemote {
  owner: string;
  repo: string;
  baseUrl: string;
}

export function parseGitHubRemote(remoteUrl: string | null | undefined): ParsedGitHubRemote | null {
  if (!remoteUrl) {
    return null;
  }

  let path: string | null = null;

  if (remoteUrl.startsWith(GITHUB_HTTPS_PREFIX)) {
    path = remoteUrl.slice(GITHUB_HTTPS_PREFIX.length);
  } else if (remoteUrl.startsWith(GITHUB_SSH_PREFIX)) {
    path = remoteUrl.slice(GITHUB_SSH_PREFIX.length);
  } else {
    return null;
  }

  path = path.replace(/\.git$/, '');
  const slash = path.indexOf('/');
  if (slash <= 0 || slash === path.length - 1) {
    return null;
  }

  const owner = path.slice(0, slash);
  const repo = path.slice(slash + 1);
  return {
    owner,
    repo,
    baseUrl: `${GITHUB_HTTPS_PREFIX}${owner}/${repo}`,
  };
}

export function buildGitHubCompareUrl(
  remoteUrl: string | null | undefined,
  branch: string | null | undefined,
): string | null {
  const parsed = parseGitHubRemote(remoteUrl);
  if (!parsed || !branch) {
    return null;
  }
  if (DEFAULT_BRANCHES.has(branch)) {
    return `${parsed.baseUrl}/compare`;
  }
  return `${parsed.baseUrl}/compare/master...${branch}`;
}

export function buildGitHubPrUrl(
  remoteUrl: string | null | undefined,
  branch: string | null | undefined,
): string | null {
  const parsed = parseGitHubRemote(remoteUrl);
  if (!parsed || !branch) {
    return null;
  }
  return `${parsed.baseUrl}/pull/new/${encodeURIComponent(branch)}`;
}

export function buildGitHubHomeUrl(remoteUrl: string | null | undefined): string | null {
  const parsed = parseGitHubRemote(remoteUrl);
  return parsed ? parsed.baseUrl : null;
}

export function buildGitHubBranchUrl(
  remoteUrl: string | null | undefined,
  branch: string | null | undefined,
): string | null {
  const parsed = parseGitHubRemote(remoteUrl);
  if (!parsed || !branch) {
    return null;
  }
  return `${parsed.baseUrl}/tree/${encodeURIComponent(branch)}`;
}

export const REPO_CARD_TELEMETRY_EVENTS: Record<Exclude<RepoCardLinkKind, 'compare'>, string> = {
  pr: 'repo_card_pr_opened',
  home: 'repo_card_home_opened',
  branch: 'repo_card_branch_opened',
};

import { describe, it, expect } from 'vitest';
import {
  buildGitHubActionsUrl,
  buildGitHubCommitsUrl,
  buildGitHubCompareUrl,
  buildGitHubHomeUrl,
  buildGitHubIssuesUrl,
  buildGitHubPrListUrl,
  parseGitHubRemote,
} from '../utils/repoUtils';

describe('parseGitHubRemote', () => {
  it('returns null when remoteUrl is null', () => {
    expect(parseGitHubRemote(null)).toBeNull();
  });

  it('returns null when remoteUrl is undefined', () => {
    expect(parseGitHubRemote(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseGitHubRemote('')).toBeNull();
  });

  it('parses HTTPS GitHub remote without .git suffix', () => {
    expect(parseGitHubRemote('https://github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
      baseUrl: 'https://github.com/owner/repo',
    });
  });

  it('parses HTTPS GitHub remote with .git suffix', () => {
    expect(parseGitHubRemote('https://github.com/owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
      baseUrl: 'https://github.com/owner/repo',
    });
  });

  it('parses SSH GitHub remote', () => {
    expect(parseGitHubRemote('git@github.com:owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
      baseUrl: 'https://github.com/owner/repo',
    });
  });

  it('returns null for GitLab remote', () => {
    expect(parseGitHubRemote('https://gitlab.com/owner/repo')).toBeNull();
  });

  it('returns null for GitHub Enterprise remote', () => {
    expect(parseGitHubRemote('https://github.example.com/owner/repo')).toBeNull();
  });
});

describe('buildGitHubCompareUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubCompareUrl(null, 'my-feature')).toBeNull();
  });

  it('returns null when branch is null', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubCompareUrl('https://gitlab.com/owner/repo', 'feature')).toBeNull();
  });

  it('builds compare URL for HTTPS remote on feature branch', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', 'my-feature')).toBe(
      'https://github.com/owner/repo/compare/master...my-feature',
    );
  });

  it('strips .git suffix from HTTPS remote', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo.git', 'feature')).toBe(
      'https://github.com/owner/repo/compare/master...feature',
    );
  });

  it('converts SSH remote to HTTPS and builds compare URL', () => {
    expect(buildGitHubCompareUrl('git@github.com:owner/repo.git', 'feature')).toBe(
      'https://github.com/owner/repo/compare/master...feature',
    );
  });

  it('returns base compare URL when on master branch', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', 'master')).toBe(
      'https://github.com/owner/repo/compare',
    );
  });

  it('returns base compare URL when on main branch', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', 'main')).toBe(
      'https://github.com/owner/repo/compare',
    );
  });
});

describe('buildGitHubPrListUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubPrListUrl(null, 'feature')).toBeNull();
  });

  it('returns null when branch is null', () => {
    expect(buildGitHubPrListUrl('https://github.com/owner/repo', null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubPrListUrl('https://gitlab.com/owner/repo', 'feature')).toBeNull();
  });

  it('builds filtered open-PR list URL for a feature branch with slash', () => {
    expect(buildGitHubPrListUrl('https://github.com/owner/repo', 'feature/foo')).toBe(
      'https://github.com/owner/repo/pulls?q=is%3Apr+is%3Aopen+head%3Afeature%2Ffoo',
    );
  });

  it('URL-encodes branch with space', () => {
    expect(buildGitHubPrListUrl('https://github.com/owner/repo', 'feat/foo bar')).toBe(
      'https://github.com/owner/repo/pulls?q=is%3Apr+is%3Aopen+head%3Afeat%2Ffoo+bar',
    );
  });

  it('works for SSH remote', () => {
    expect(buildGitHubPrListUrl('git@github.com:owner/repo.git', 'master')).toBe(
      'https://github.com/owner/repo/pulls?q=is%3Apr+is%3Aopen+head%3Amaster',
    );
  });
});

describe('buildGitHubCommitsUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubCommitsUrl(null, 'feature')).toBeNull();
  });

  it('returns null when branch is null', () => {
    expect(buildGitHubCommitsUrl('https://github.com/owner/repo', null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubCommitsUrl('https://gitlab.com/owner/repo', 'feature')).toBeNull();
  });

  it('returns base commits URL when on master branch', () => {
    expect(buildGitHubCommitsUrl('https://github.com/owner/repo', 'master')).toBe(
      'https://github.com/owner/repo/commits',
    );
  });

  it('returns base commits URL when on main branch', () => {
    expect(buildGitHubCommitsUrl('https://github.com/owner/repo', 'main')).toBe(
      'https://github.com/owner/repo/commits',
    );
  });

  it('builds branch-scoped commits URL with URL-encoded branch', () => {
    expect(buildGitHubCommitsUrl('https://github.com/owner/repo', 'feature/foo')).toBe(
      'https://github.com/owner/repo/commits/feature%2Ffoo',
    );
  });
});

describe('buildGitHubHomeUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubHomeUrl(null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubHomeUrl('https://gitlab.com/owner/repo')).toBeNull();
  });

  it('builds repo home URL for HTTPS remote', () => {
    expect(buildGitHubHomeUrl('https://github.com/owner/repo')).toBe(
      'https://github.com/owner/repo',
    );
  });

  it('strips .git suffix from HTTPS remote', () => {
    expect(buildGitHubHomeUrl('https://github.com/owner/repo.git')).toBe(
      'https://github.com/owner/repo',
    );
  });

  it('builds repo home URL for SSH remote', () => {
    expect(buildGitHubHomeUrl('git@github.com:owner/repo.git')).toBe(
      'https://github.com/owner/repo',
    );
  });
});

describe('buildGitHubActionsUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubActionsUrl(null, 'feature')).toBeNull();
  });

  it('returns null when branch is null', () => {
    expect(buildGitHubActionsUrl('https://github.com/owner/repo', null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubActionsUrl('https://gitlab.com/owner/repo', 'feature')).toBeNull();
  });

  it('builds branch-filtered Actions URL with URL-encoded branch', () => {
    expect(buildGitHubActionsUrl('https://github.com/owner/repo', 'feature/foo')).toBe(
      'https://github.com/owner/repo/actions?query=branch%3Afeature%2Ffoo',
    );
  });
});

describe('buildGitHubIssuesUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubIssuesUrl(null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubIssuesUrl('https://gitlab.com/owner/repo')).toBeNull();
  });

  it('builds issues URL for HTTPS remote', () => {
    expect(buildGitHubIssuesUrl('https://github.com/owner/repo')).toBe(
      'https://github.com/owner/repo/issues',
    );
  });

  it('works for SSH remote', () => {
    expect(buildGitHubIssuesUrl('git@github.com:owner/repo.git')).toBe(
      'https://github.com/owner/repo/issues',
    );
  });
});

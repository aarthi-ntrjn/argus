import { describe, it, expect } from 'vitest';
import {
  buildGitHubBranchUrl,
  buildGitHubCompareUrl,
  buildGitHubHomeUrl,
  buildGitHubPrUrl,
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

describe('buildGitHubPrUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubPrUrl(null, 'feature')).toBeNull();
  });

  it('returns null when branch is null', () => {
    expect(buildGitHubPrUrl('https://github.com/owner/repo', null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubPrUrl('https://gitlab.com/owner/repo', 'feature')).toBeNull();
  });

  it('builds new-or-existing-PR URL for a feature branch with slash', () => {
    expect(buildGitHubPrUrl('https://github.com/owner/repo', 'feature/foo')).toBe(
      'https://github.com/owner/repo/pull/new/feature%2Ffoo',
    );
  });

  it('URL-encodes branch with space', () => {
    expect(buildGitHubPrUrl('https://github.com/owner/repo', 'feat/foo bar')).toBe(
      'https://github.com/owner/repo/pull/new/feat%2Ffoo%20bar',
    );
  });

  it('works for SSH remote on default branch', () => {
    expect(buildGitHubPrUrl('git@github.com:owner/repo.git', 'master')).toBe(
      'https://github.com/owner/repo/pull/new/master',
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

describe('buildGitHubBranchUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubBranchUrl(null, 'feature/foo')).toBeNull();
  });

  it('returns null when branch is null', () => {
    expect(buildGitHubBranchUrl('https://github.com/owner/repo', null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubBranchUrl('https://gitlab.com/owner/repo', 'feature')).toBeNull();
  });

  it('builds tree URL for a feature branch with URL-encoded segments', () => {
    expect(buildGitHubBranchUrl('https://github.com/owner/repo', 'feature/foo')).toBe(
      'https://github.com/owner/repo/tree/feature%2Ffoo',
    );
  });

  it('builds tree URL for the default branch', () => {
    expect(buildGitHubBranchUrl('https://github.com/owner/repo', 'master')).toBe(
      'https://github.com/owner/repo/tree/master',
    );
  });

  it('works for SSH remote', () => {
    expect(buildGitHubBranchUrl('git@github.com:owner/repo.git', 'main')).toBe(
      'https://github.com/owner/repo/tree/main',
    );
  });
});

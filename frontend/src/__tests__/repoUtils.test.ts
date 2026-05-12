import { describe, it, expect } from 'vitest';
import {
  buildGitHubBranchUrl,
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

  it('builds compare URL for a feature branch with slash', () => {
    expect(buildGitHubPrUrl('https://github.com/owner/repo', 'feature/foo')).toBe(
      'https://github.com/owner/repo/compare/feature/foo',
    );
  });

  it('URL-encodes branch segment with space', () => {
    expect(buildGitHubPrUrl('https://github.com/owner/repo', 'feat/foo bar')).toBe(
      'https://github.com/owner/repo/compare/feat/foo%20bar',
    );
  });

  it('works for SSH remote on default branch', () => {
    expect(buildGitHubPrUrl('git@github.com:owner/repo.git', 'master')).toBe(
      'https://github.com/owner/repo/compare/master',
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

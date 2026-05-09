import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Repository } from '../types';

vi.mock('../services/api', () => ({
  postTelemetryEvent: vi.fn(),
}));

import RepoContextBar from '../components/RepoContextBar/RepoContextBar';
import * as api from '../services/api';

function makeRepo(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 'repo-1',
    path: '/some/path',
    name: 'argus',
    source: 'config',
    addedAt: new Date().toISOString(),
    lastScannedAt: new Date().toISOString(),
    branch: 'feature/foo',
    remoteUrl: 'https://github.com/owner/repo',
    ...overrides,
  };
}

describe('RepoContextBar link indicators', () => {
  beforeEach(() => {
    vi.mocked(api.postTelemetryEvent).mockClear();
  });

  describe('GitHub remote with feature branch', () => {
    it('renders repo name as a link to repo home', () => {
      render(<RepoContextBar repo={makeRepo()} />);
      const link = screen.getByRole('link', { name: 'argus' });
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo');
      expect(link).toHaveTextContent('argus');
    });

    it('renders branch chip as a link to the branch tree', () => {
      render(<RepoContextBar repo={makeRepo()} />);
      const link = screen.getByRole('link', { name: /branch feature\/foo on github/i });
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/tree/feature%2Ffoo');
    });

    it('renders pull-request indicator pointing at /pull/new/<branch>', () => {
      render(<RepoContextBar repo={makeRepo()} />);
      const link = screen.getByRole('link', { name: /open or view pull request on github/i });
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/pull/new/feature%2Ffoo');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('emits the correct telemetry event for each indicator click', () => {
      render(<RepoContextBar repo={makeRepo()} />);
      fireEvent.click(screen.getByRole('link', { name: 'argus' }));
      fireEvent.click(screen.getByRole('link', { name: /branch feature\/foo on github/i }));
      fireEvent.click(screen.getByRole('link', { name: /open or view pull request on github/i }));
      expect(api.postTelemetryEvent).toHaveBeenCalledWith('repo_card_home_opened');
      expect(api.postTelemetryEvent).toHaveBeenCalledWith('repo_card_branch_opened');
      expect(api.postTelemetryEvent).toHaveBeenCalledWith('repo_card_pr_opened');
    });
  });

  describe('non-GitHub remote', () => {
    it('hides all GitHub-specific indicators', () => {
      render(<RepoContextBar repo={makeRepo({ remoteUrl: 'https://gitlab.com/owner/repo' })} />);
      expect(screen.queryByRole('link', { name: /pull request on github/i })).toBeNull();
      expect(screen.queryByRole('link', { name: 'argus' })).toBeNull();
      expect(screen.queryByRole('link', { name: /branch .* on github/i })).toBeNull();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('argus');
    });
  });

  describe('GitHub remote with null branch', () => {
    it('hides branch-scoped indicators but shows repo-home link', () => {
      render(<RepoContextBar repo={makeRepo({ branch: null })} />);
      expect(screen.queryByRole('link', { name: /pull request on github/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /branch .* on github/i })).toBeNull();
      expect(screen.getByRole('link', { name: 'argus' })).toBeInTheDocument();
    });
  });
});

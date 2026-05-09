import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Repository } from '../types';
import type { RepoWithSessions } from '../components/RepoCard/RepoCard';

vi.mock('../services/api', () => ({
  postTelemetryEvent: vi.fn(),
}));

vi.mock('../components/LaunchDropdown/LaunchDropdown', () => ({
  default: () => <div data-testid="launch-dropdown" />,
}));

vi.mock('../components/SessionCard/SessionCard', () => ({
  default: () => <div data-testid="session-card" />,
}));

vi.mock('../components/PendingSessionCard/PendingSessionCard', () => ({
  default: () => <div data-testid="pending-session-card" />,
}));

import RepoCard from '../components/RepoCard/RepoCard';
import * as api from '../services/api';

function makeRepo(overrides: Partial<Repository> = {}): RepoWithSessions {
  return {
    id: 'repo-1',
    path: '/some/path',
    name: 'argus',
    source: 'config',
    addedAt: new Date().toISOString(),
    lastScannedAt: new Date().toISOString(),
    branch: 'feature/foo',
    remoteUrl: 'https://github.com/owner/repo',
    sessions: [],
    hasHiddenSessions: false,
    ...overrides,
  };
}

function renderCard(repo: RepoWithSessions) {
  return render(
    <RepoCard
      repo={repo}
      skipConfirm={false}
      selectedSessionId={null}
      isMobile={false}
      pendingLaunchers={[]}
      onRemoveById={vi.fn()}
      onSetRemoveConfirm={vi.fn()}
      onSelectSession={vi.fn()}
      onLaunchError={vi.fn()}
      onLaunchPending={vi.fn()}
    />,
  );
}

describe('RepoCard link indicators', () => {
  beforeEach(() => {
    vi.mocked(api.postTelemetryEvent).mockClear();
  });

  describe('GitHub remote with feature branch', () => {
    it('renders pull-request indicator pointing at /pull/new/<branch>', () => {
      renderCard(makeRepo());
      const link = screen.getByRole('link', { name: /open or view pull request on github/i });
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/pull/new/feature%2Ffoo');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders branch chip as a link to the branch tree', () => {
      renderCard(makeRepo());
      const link = screen.getByRole('link', { name: /branch feature\/foo on github/i });
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/tree/feature%2Ffoo');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveTextContent('feature/foo');
    });

    it('renders repo name as a link to repo home', () => {
      renderCard(makeRepo());
      const link = screen.getByRole('link', { name: /open repository on github/i });
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo');
      expect(link).toHaveTextContent('argus');
    });
  });

  describe('telemetry and propagation', () => {
    it('emits repo_card_pr_opened on PR-indicator click', () => {
      renderCard(makeRepo());
      fireEvent.click(screen.getByRole('link', { name: /open or view pull request on github/i }));
      expect(api.postTelemetryEvent).toHaveBeenCalledWith('repo_card_pr_opened');
    });

    it('emits repo_card_branch_opened on branch-chip link click', () => {
      renderCard(makeRepo());
      fireEvent.click(screen.getByRole('link', { name: /branch feature\/foo on github/i }));
      expect(api.postTelemetryEvent).toHaveBeenCalledWith('repo_card_branch_opened');
    });

    it('emits repo_card_home_opened on repo-name link click', () => {
      renderCard(makeRepo());
      fireEvent.click(screen.getByRole('link', { name: /open repository on github/i }));
      expect(api.postTelemetryEvent).toHaveBeenCalledWith('repo_card_home_opened');
    });

    it('stops click propagation so card-level handlers do not fire', () => {
      const cardClick = vi.fn();
      const { container } = render(
        <div onClick={cardClick}>
          <RepoCard
            repo={makeRepo()}
            skipConfirm={false}
            selectedSessionId={null}
            isMobile={false}
            pendingLaunchers={[]}
            onRemoveById={vi.fn()}
            onSetRemoveConfirm={vi.fn()}
            onSelectSession={vi.fn()}
            onLaunchError={vi.fn()}
            onLaunchPending={vi.fn()}
          />
        </div>,
      );
      fireEvent.click(screen.getByRole('link', { name: /open or view pull request on github/i }));
      expect(cardClick).not.toHaveBeenCalled();
      expect(container).toBeTruthy();
    });
  });

  describe('non-GitHub remote', () => {
    it('hides all GitHub-specific indicators', () => {
      renderCard(makeRepo({ remoteUrl: 'https://gitlab.com/owner/repo' }));
      expect(screen.queryByRole('link', { name: /pull request on github/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /open repository on github/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /branch .* on github/i })).toBeNull();
    });

    it('still shows the branch chip as plain text', () => {
      renderCard(makeRepo({ remoteUrl: 'https://gitlab.com/owner/repo' }));
      expect(screen.getByText(/feature\/foo/)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /feature\/foo/i })).toBeNull();
    });

    it('renders repo name as plain text', () => {
      renderCard(makeRepo({ remoteUrl: 'https://gitlab.com/owner/repo' }));
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('argus');
    });
  });

  describe('GitHub remote with null branch', () => {
    it('hides branch-scoped indicators but shows repo-home link', () => {
      renderCard(makeRepo({ branch: null }));
      expect(screen.queryByRole('link', { name: /pull request on github/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /branch .* on github/i })).toBeNull();
      expect(screen.getByRole('link', { name: /open repository on github/i })).toBeInTheDocument();
    });
  });

  describe('null remoteUrl', () => {
    it('renders no GitHub indicators and plain repo name', () => {
      renderCard(makeRepo({ remoteUrl: null }));
      expect(screen.queryByRole('link', { name: /github/i })).toBeNull();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('argus');
    });
  });
});

import type { Repository } from '../types';
import {
  buildGitHubBranchUrl,
  buildGitHubHomeUrl,
  buildGitHubPrUrl,
  REPO_CARD_TELEMETRY_EVENTS,
} from '../utils/repoUtils';
import { postTelemetryEvent } from '../services/api';
import { GitPullRequest } from 'lucide-react';

const BRANCH_CHIP_CLASS =
  'inline-flex items-center gap-1 text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded';

interface RepoNameLinkProps {
  repo: Pick<Repository, 'remoteUrl' | 'name'>;
}

export function RepoNameLink({ repo }: RepoNameLinkProps) {
  const homeUrl = buildGitHubHomeUrl(repo.remoteUrl);
  if (!homeUrl) {
    return <>{repo.name}</>;
  }
  return (
    <a
      href={homeUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open repository on GitHub"
      aria-label="Open repository on GitHub"
      className="hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        postTelemetryEvent(REPO_CARD_TELEMETRY_EVENTS.home);
      }}
    >
      {repo.name}
    </a>
  );
}

interface RepoBranchChipProps {
  repo: Pick<Repository, 'remoteUrl' | 'branch'>;
}

export function RepoBranchChip({ repo }: RepoBranchChipProps) {
  if (!repo.branch) {
    return null;
  }
  const branchUrl = buildGitHubBranchUrl(repo.remoteUrl, repo.branch);
  if (!branchUrl) {
    return <span className={BRANCH_CHIP_CLASS}>⎇ {repo.branch}</span>;
  }
  return (
    <a
      href={branchUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Branch ${repo.branch} on GitHub`}
      aria-label={`Branch ${repo.branch} on GitHub`}
      className={`${BRANCH_CHIP_CLASS} hover:bg-blue-100 hover:underline`}
      onClick={(e) => {
        e.stopPropagation();
        postTelemetryEvent(REPO_CARD_TELEMETRY_EVENTS.branch);
      }}
    >
      ⎇ {repo.branch}
    </a>
  );
}

interface RepoPrIndicatorProps {
  repo: Pick<Repository, 'remoteUrl' | 'branch'>;
}

export function RepoPrIndicator({ repo }: RepoPrIndicatorProps) {
  const prUrl = buildGitHubPrUrl(repo.remoteUrl, repo.branch);
  if (!prUrl) {
    return null;
  }
  return (
    <a
      href={prUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open or view pull request on GitHub"
      aria-label="Open or view pull request on GitHub"
      className="inline-flex items-center text-gray-400 hover:text-gray-700"
      onClick={(e) => {
        e.stopPropagation();
        postTelemetryEvent(REPO_CARD_TELEMETRY_EVENTS.pr);
      }}
    >
      <GitPullRequest size={14} aria-hidden="true" />
    </a>
  );
}

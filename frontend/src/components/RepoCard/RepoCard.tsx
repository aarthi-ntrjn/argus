import type { Repository, Session } from '../../types';
import type { PendingLauncher } from '../../hooks/usePendingLaunchers';
import {
  buildGitHubActionsUrl,
  buildGitHubBranchUrl,
  buildGitHubCommitsUrl,
  buildGitHubCompareUrl,
  buildGitHubHomeUrl,
  buildGitHubIssuesUrl,
  buildGitHubPrListUrl,
  REPO_CARD_TELEMETRY_EVENTS,
} from '../../utils/repoUtils';
import { postTelemetryEvent } from '../../services/api';
import { CircleDot, GitCommit, GitCompare, GitPullRequest, PlayCircle } from 'lucide-react';
import Badge from '../Badge';
import LaunchDropdown from '../LaunchDropdown/LaunchDropdown';
import SessionCard from '../SessionCard/SessionCard';
import PendingSessionCard from '../PendingSessionCard/PendingSessionCard';

export interface RepoWithSessions extends Repository {
  sessions: Session[];
  hasHiddenSessions: boolean;
}

interface RepoCardProps {
  repo: RepoWithSessions;
  skipConfirm: boolean;
  selectedSessionId: string | null;
  isMobile: boolean;
  pendingLaunchers: PendingLauncher[];
  onRemoveById: (id: string) => void;
  onSetRemoveConfirm: (id: string) => void;
  onSelectSession: (id: string) => void;
  onLaunchError: (msg: string) => void;
  onLaunchPending: (ptyLaunchId: string, tool: 'claude' | 'copilot') => void;
}

interface IndicatorIconProps {
  href: string | null;
  label: string;
  telemetryEvent: string;
  children: React.ReactNode;
}

function IndicatorIcon({ href, label, telemetryEvent, children }: IndicatorIconProps) {
  if (!href) {
    return null;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className="inline-flex items-center text-gray-400 hover:text-gray-700"
      onClick={(e) => {
        e.stopPropagation();
        postTelemetryEvent(telemetryEvent);
      }}
    >
      {children}
    </a>
  );
}

export default function RepoCard({
  repo,
  skipConfirm,
  selectedSessionId,
  isMobile,
  pendingLaunchers,
  onRemoveById,
  onSetRemoveConfirm,
  onSelectSession,
  onLaunchError,
  onLaunchPending,
}: RepoCardProps) {
  const homeUrl = buildGitHubHomeUrl(repo.remoteUrl);
  const compareUrl = buildGitHubCompareUrl(repo.remoteUrl, repo.branch);
  const prUrl = buildGitHubPrListUrl(repo.remoteUrl, repo.branch);
  const commitsUrl = buildGitHubCommitsUrl(repo.remoteUrl, repo.branch);
  const actionsUrl = buildGitHubActionsUrl(repo.remoteUrl, repo.branch);
  const issuesUrl = buildGitHubIssuesUrl(repo.remoteUrl);
  const branchUrl = buildGitHubBranchUrl(repo.remoteUrl, repo.branch);

  return (
    <div data-tour-id="dashboard-repo-card" className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">
            {homeUrl ? (
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
            ) : (
              repo.name
            )}
          </h2>
          <div className="flex items-center gap-2">
            <Badge>
              {repo.sessions.length} session{repo.sessions.length !== 1 ? 's' : ''}
            </Badge>
            <LaunchDropdown
              repoPath={repo.path}
              onLaunchError={onLaunchError}
              onLaunchPending={onLaunchPending}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (skipConfirm) {
                  onRemoveById(repo.id);
                } else {
                  onSetRemoveConfirm(repo.id);
                }
              }}
              aria-label={`Remove repository ${repo.name}`}
              title="Remove repository"
              className="icon-btn text-gray-500 hover:text-red-500"
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-xs text-gray-500 font-mono truncate max-w-full">{repo.path}</p>
          {repo.branch &&
            (branchUrl ? (
              <a
                href={branchUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Branch ${repo.branch} on GitHub`}
                aria-label={`Branch ${repo.branch} on GitHub`}
                className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  postTelemetryEvent(REPO_CARD_TELEMETRY_EVENTS.branch);
                }}
              >
                ⎇ {repo.branch}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                ⎇ {repo.branch}
              </span>
            ))}
          <IndicatorIcon
            href={compareUrl}
            label="View diff on GitHub"
            telemetryEvent="repo_diff_opened"
          >
            <GitCompare size={14} aria-hidden="true" />
          </IndicatorIcon>
          <IndicatorIcon
            href={prUrl}
            label="Pull requests on GitHub"
            telemetryEvent={REPO_CARD_TELEMETRY_EVENTS.pr}
          >
            <GitPullRequest size={14} aria-hidden="true" />
          </IndicatorIcon>
          <IndicatorIcon
            href={commitsUrl}
            label="Commits on GitHub"
            telemetryEvent={REPO_CARD_TELEMETRY_EVENTS.commits}
          >
            <GitCommit size={14} aria-hidden="true" />
          </IndicatorIcon>
          <IndicatorIcon
            href={actionsUrl}
            label="GitHub Actions for this branch"
            telemetryEvent={REPO_CARD_TELEMETRY_EVENTS.actions}
          >
            <PlayCircle size={14} aria-hidden="true" />
          </IndicatorIcon>
          <IndicatorIcon
            href={issuesUrl}
            label="Issues on GitHub"
            telemetryEvent={REPO_CARD_TELEMETRY_EVENTS.issues}
          >
            <CircleDot size={14} aria-hidden="true" />
          </IndicatorIcon>
        </div>
      </div>
      {repo.sessions.length === 0 && pendingLaunchers.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {repo.hasHiddenSessions ? 'No active sessions' : 'No sessions'}
        </p>
      ) : (
        <div data-tour-id="dashboard-session-card" className="space-y-2">
          {pendingLaunchers.map((pl) => (
            <PendingSessionCard key={pl.ptyLaunchId} tool={pl.tool} repoPath={pl.repoPath} />
          ))}
          {repo.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              selected={!isMobile && selectedSessionId === session.id}
              onSelect={onSelectSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}

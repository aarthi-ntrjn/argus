import type { Repository, Session } from '../../types';
import type { PendingLauncher } from '../../hooks/usePendingLaunchers';
import Badge from '../Badge';
import LaunchDropdown from '../LaunchDropdown/LaunchDropdown';
import SessionCard from '../SessionCard/SessionCard';
import PendingSessionCard from '../PendingSessionCard/PendingSessionCard';
import { RepoBranchChip, RepoNameLink, RepoPrIndicator } from '../RepoLinks';

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
  return (
    <div data-tour-id="dashboard-repo-card" className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">
            <RepoNameLink repo={repo} />
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
          <RepoBranchChip repo={repo} />
          <RepoPrIndicator repo={repo} />
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

import type { ToolCommand } from '../../types';
import { ClaudeIcon, CopilotIcon } from '../SessionTypeIcon/SessionTypeIcon';

interface Props {
  tool: ToolCommand;
  repoPath: string;
}

export default function PendingSessionCard({ tool }: Props) {
  const label = tool === 'claude' ? 'Claude' : 'Copilot';
  const icon =
    tool === 'claude' ? (
      <span className="text-orange-500">
        <ClaudeIcon size={13} />
      </span>
    ) : (
      <span className="text-purple-600">
        <CopilotIcon size={13} />
      </span>
    );

  return (
    <div
      aria-label={`Launching ${label} session`}
      className="interactive-card animate-fade-in p-4 border-gray-200 opacity-75 cursor-default select-none"
    >
      <div className="flex items-center gap-2">
        <span
          role="status"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
        />
        {icon}
        <span className="text-sm text-gray-500">Launching {label}…</span>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Settings, Bug, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSettings } from '../../types';
import { getHealth, applyUpdate } from '../../services/api';
import { buildBugReportUrl, buildFeatureRequestUrl, ARGUS_CHANGELOG_URL } from '../../config/feedback';
import { SectionHeading } from '../SectionHeading';
import { WebsiteIcon, GitHubIcon, NpmIcon } from '../BrandIcons';
import { ClaudeIcon, CopilotIcon } from '../SessionTypeIcon/SessionTypeIcon';
import { GeneralSettingsContent } from '../SettingsDialog/GeneralSettingsContent';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import Badge from '../Badge';
import { useUpdateStatus } from '../../hooks/useUpdateStatus';
import { useArgusSettings } from '../../hooks/useArgusSettings';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onOpenAllSettings?: () => void;
}

export function SettingsPanel({ settings, onToggle, onOpenAllSettings }: SettingsPanelProps) {
  const { data: healthData } = useQuery({ queryKey: ['health'], queryFn: getHealth, staleTime: Infinity });
  const updateStatus = useUpdateStatus();
  const { settings: argusSettings, patchSetting } = useArgusSettings();

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateBanner, setUpdateBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleUpdateNow() {
    setIsUpdating(true);
    setUpdateBanner(null);
    try {
      await applyUpdate();
      setUpdateBanner({ type: 'success', message: 'Update applied. Restart Argus to run the new version.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setUpdateBanner({ type: 'error', message: `Failed to apply update. ${msg || 'Make sure the Argus server is running and you have permission to install packages globally.'}` });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-5 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <SectionHeading className="mb-2">Settings</SectionHeading>
      <GeneralSettingsContent settings={settings} onToggle={onToggle} compact />

      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <SectionHeading>Supported CLIs</SectionHeading>
          <div className="flex items-center gap-2">
            <a
              href="https://docs.anthropic.com/en/docs/claude-code/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn text-orange-500 hover:text-orange-600"
              aria-label="Claude Code"
              title="Claude Code"
            >
              <ClaudeIcon size={14} />
            </a>
            <a
              href="https://github.com/features/copilot/cli/"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn text-purple-600 hover:text-purple-700"
              aria-label="GitHub Copilot CLI"
              title="GitHub Copilot CLI"
            >
              <CopilotIcon size={14} />
            </a>
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <SectionHeading className="shrink-0">
            About Argus{healthData?.version && (
              <a href={ARGUS_CHANGELOG_URL} target="_blank" rel="noopener noreferrer" className="ml-3 normal-case font-normal tabular-nums text-blue-600 hover:text-blue-700 hover:underline">v{healthData.version}</a>
            )}
          </SectionHeading>
          <div className="flex items-center gap-1">
            <a href="https://aarthi-ntrjn.github.io/argus" target="_blank" rel="noopener noreferrer" aria-label="Website" title="Website" className="icon-btn text-gray-400 hover:text-blue-600">
              <WebsiteIcon />
            </a>
            <a href="https://github.com/aarthi-ntrjn/argus" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" className="icon-btn text-gray-400 hover:text-blue-600">
              <GitHubIcon />
            </a>
            <a href="https://www.npmjs.com/package/argus-ai-hub" target="_blank" rel="noopener noreferrer" aria-label="npm" title="npm" className="icon-btn text-gray-400 hover:text-blue-600">
              <NpmIcon />
            </a>
          </div>
        </div>

        {updateStatus?.updateAvailable && updateStatus.latestVersion && (
          <div className="flex items-center gap-2 mb-2">
            <Badge colorClass="bg-yellow-100 text-yellow-800">
              Update available: v{updateStatus.latestVersion}
            </Badge>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleUpdateNow()}
              disabled={isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Update now'}
            </Button>
          </div>
        )}

        {updateBanner && (
          <div
            role="alert"
            className={`mb-2 px-3 py-2 rounded text-xs flex items-start justify-between gap-2 ${
              updateBanner.type === 'success'
                ? 'bg-blue-50 border border-blue-200 text-blue-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            <span className="leading-snug">{updateBanner.message}</span>
            <button
              onClick={() => setUpdateBanner(null)}
              aria-label="Dismiss error"
              className="icon-btn shrink-0 p-0 leading-none"
            >
              &times;
            </button>
          </div>
        )}

        <Checkbox
          label="Auto-update on exit"
          checked={argusSettings?.autoUpdate ?? true}
          onChange={(e) => void patchSetting({ autoUpdate: e.target.checked })}
        />
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3">
        <SectionHeading className="shrink-0">Feedback</SectionHeading>
        <div className="flex items-center gap-1">
          <a href={buildBugReportUrl()} target="_blank" rel="noopener noreferrer" aria-label="Report a bug" title="Report a bug" className="icon-btn text-gray-400 hover:text-blue-600">
            <Bug size={13} aria-hidden="true" />
          </a>
          <a href={buildFeatureRequestUrl()} target="_blank" rel="noopener noreferrer" aria-label="Request a feature" title="Request a feature" className="icon-btn text-gray-400 hover:text-blue-600">
            <Lightbulb size={13} aria-hidden="true" />
          </a>
        </div>
      </div>

      {onOpenAllSettings && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onOpenAllSettings}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Settings size={13} className="shrink-0" aria-hidden="true" />
            Advanced settings
          </button>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DashboardSettings } from '../../types';
import { getArgusSettings, patchArgusSettings } from '../../services/api';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onRestartTour?: () => void;
  onResetOnboarding?: () => void;
}

export function SettingsPanel({ settings, onToggle, onRestartTour, onResetOnboarding }: SettingsPanelProps) {
  const qc = useQueryClient();
  const { data: argusSettings } = useQuery({
    queryKey: ['argus-settings'],
    queryFn: getArgusSettings,
    staleTime: 30_000,
  });
  const { mutate: saveThreshold } = useMutation({
    mutationFn: (val: number) => patchArgusSettings({ idleSessionThresholdMinutes: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['argus-settings'] }),
  });
  const [thresholdInput, setThresholdInput] = useState<string>('');
  const currentThreshold = argusSettings?.idleSessionThresholdMinutes ?? 60;
  const displayThreshold = thresholdInput !== '' ? thresholdInput : String(currentThreshold);

  function handleThresholdBlur() {
    const val = parseInt(thresholdInput, 10);
    if (!Number.isNaN(val) && val >= 1) saveThreshold(val);
    setThresholdInput('');
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settings</p>
      <label className="flex items-center gap-3 cursor-pointer select-none py-1">
        <input
          type="checkbox"
          aria-label="Hide ended sessions"
          checked={settings.hideEndedSessions}
          onChange={e => onToggle('hideEndedSessions', e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-sm text-gray-700">Hide ended sessions</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none py-1">
        <input
          type="checkbox"
          aria-label="Hide repos with no active sessions"
          checked={settings.hideReposWithNoActiveSessions}
          onChange={e => onToggle('hideReposWithNoActiveSessions', e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-sm text-gray-700">Hide repos with no active sessions</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none py-1">
        <input
          type="checkbox"
          aria-label="Hide inactive sessions"
          checked={settings.hideInactiveSessions}
          onChange={e => onToggle('hideInactiveSessions', e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-sm text-gray-700">Hide inactive sessions (&gt;20 min)</span>
      </label>
      <div className="flex items-center justify-between py-1 gap-2">
        <span className="text-sm text-gray-700">Idle threshold (min)</span>
        <input
          type="number"
          aria-label="Idle session threshold in minutes"
          min={1}
          value={displayThreshold}
          onChange={e => setThresholdInput(e.target.value)}
          onBlur={handleThresholdBlur}
          className="w-16 text-sm border border-gray-300 rounded px-1.5 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {(onRestartTour || onResetOnboarding) && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1">
          {onRestartTour && (
            <button
              onClick={onRestartTour}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-sm px-2 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              Restart Tour
            </button>
          )}
          {onResetOnboarding && (
            <button
              onClick={onResetOnboarding}
              className="w-full text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-sm px-2 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              Reset Onboarding
            </button>
          )}
        </div>
      )}
    </div>
  );
}

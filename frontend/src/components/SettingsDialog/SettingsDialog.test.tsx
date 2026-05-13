import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SettingsDialog } from './SettingsDialog';
import type { DashboardSettings } from '../../types';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  getArgusSettings: vi.fn().mockResolvedValue({
    autoRegisterRepos: false,
    yoloMode: false,
    restingThresholdMinutes: 20,
    autoUpdate: true,
  } as any),
  patchArgusSettings: vi.fn().mockResolvedValue({
    autoRegisterRepos: false,
    yoloMode: false,
    restingThresholdMinutes: 20,
    autoUpdate: false,
  } as any),
  getTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
  patchTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
  getSlackSettings: vi.fn().mockRejectedValue(new Error('not configured')),
  getHealth: vi.fn().mockResolvedValue({ status: 'ok', version: '1.2.3', uptime: 0 }),
  rescanRemoteUrls: vi.fn().mockResolvedValue(undefined),
  getUpdateStatus: vi.fn().mockResolvedValue({
    currentVersion: '1.2.3',
    latestVersion: null,
    updateAvailable: false,
    lastChecked: null,
    updateInProgress: false,
  }),
  applyUpdate: vi.fn().mockResolvedValue({ started: true }),
}));

const defaultSettings: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
  outputDisplayMode: 'focused',
  hideTodoPanel: false,
};

function renderDialog(tab: 'general' | 'about' = 'about') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <SettingsDialog
          open={true}
          tab={tab}
          onTabChange={vi.fn()}
          onClose={vi.fn()}
          settings={defaultSettings}
          onToggle={vi.fn()}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('SettingsDialog — auto-update toggle (T020)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Auto-update on exit" checkbox on the About tab', async () => {
    renderDialog('about');
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /auto-update on exit/i })).toBeInTheDocument();
    });
  });

  it('checkbox is checked when autoUpdate is true (default)', async () => {
    renderDialog('about');
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /auto-update on exit/i })).toBeChecked();
    });
  });

  it('calls patchArgusSettings with autoUpdate: false when unchecked', async () => {
    renderDialog('about');
    const checkbox = await screen.findByRole('checkbox', { name: /auto-update on exit/i });
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(api.patchArgusSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoUpdate: false }),
      );
    });
  });
});

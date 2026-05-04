import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPanel } from './SettingsPanel';
import type { DashboardSettings } from '../../types';

vi.mock('../../services/api', () => ({
  getHealth: vi.fn().mockResolvedValue({ status: 'ok', version: '1.0.0', uptime: 10 }),
  getUpdateStatus: vi.fn().mockResolvedValue({
    currentVersion: '1.0.0',
    latestVersion: null,
    updateAvailable: false,
    lastChecked: null,
    updateInProgress: false,
  }),
  getArgusSettings: vi.fn().mockResolvedValue({
    port: 7411,
    watchDirectories: [],
    sessionRetentionHours: 24,
    outputRetentionMbPerSession: 10,
    autoRegisterRepos: false,
    yoloMode: false,
    restingThresholdMinutes: 20,
    telemetryEnabled: true,
    telemetryPromptSeen: true,
    autoUpdate: true,
  }),
  patchArgusSettings: vi.fn().mockResolvedValue({}),
  applyUpdate: vi.fn().mockResolvedValue({ started: true }),
  queryClient: { defaultOptions: { queries: { staleTime: 5000, retry: 0 } } },
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } });
}

const defaultSettings: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
  outputDisplayMode: 'focused',
  hideTodoPanel: false,
};

function renderPanel(overrides?: Partial<DashboardSettings>) {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <SettingsPanel settings={{ ...defaultSettings, ...overrides }} onToggle={() => {}} />
    </QueryClientProvider>
  );
}

describe('SettingsPanel — update UI (T017)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Update now" button and version notice when update is available', async () => {
    const { getUpdateStatus } = await import('../../services/api');
    vi.mocked(getUpdateStatus).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateAvailable: true,
      lastChecked: new Date().toISOString(),
      updateInProgress: false,
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/2\.0\.0/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /update now/i })).toBeInTheDocument();
  });

  it('does not show "Update now" button when no update is available', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /update now/i })).not.toBeInTheDocument();
    });
  });

  it('shows "Updating..." and disables button while update is in progress', async () => {
    const { getUpdateStatus, applyUpdate } = await import('../../services/api');
    vi.mocked(getUpdateStatus).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateAvailable: true,
      lastChecked: new Date().toISOString(),
      updateInProgress: false,
    });
    vi.mocked(applyUpdate).mockImplementation(() => new Promise(() => {}));

    renderPanel();

    const btn = await screen.findByRole('button', { name: /update now/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled();
    });
  });

  it('shows restart banner after successful update', async () => {
    const { getUpdateStatus, applyUpdate } = await import('../../services/api');
    vi.mocked(getUpdateStatus).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateAvailable: true,
      lastChecked: new Date().toISOString(),
      updateInProgress: false,
    });
    vi.mocked(applyUpdate).mockResolvedValue({ started: true });

    renderPanel();

    const btn = await screen.findByRole('button', { name: /update now/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/restart/i)).toBeInTheDocument();
    });
  });

  it('shows error banner when update fails', async () => {
    const { getUpdateStatus, applyUpdate } = await import('../../services/api');
    vi.mocked(getUpdateStatus).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateAvailable: true,
      lastChecked: new Date().toISOString(),
      updateInProgress: false,
    });
    vi.mocked(applyUpdate).mockRejectedValue(new Error('Update failed'));

    renderPanel();

    const btn = await screen.findByRole('button', { name: /update now/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to apply update/i)).toBeInTheDocument();
    });
  });
});

describe('SettingsPanel — auto-update toggle (T020)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Auto-update on exit" checkbox', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /auto-update on exit/i })).toBeInTheDocument();
    });
  });

  it('checkbox is checked when autoUpdate is true (default)', async () => {
    renderPanel();
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: /auto-update on exit/i });
      expect(checkbox).toBeChecked();
    });
  });

  it('calls patchArgusSettings with autoUpdate: false when unchecked', async () => {
    const { patchArgusSettings } = await import('../../services/api');

    renderPanel();
    const checkbox = await screen.findByRole('checkbox', { name: /auto-update on exit/i });
    // Checkbox component uses role="checkbox" with aria-checked; clicking it triggers onChange
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(patchArgusSettings).toHaveBeenCalledWith(expect.objectContaining({ autoUpdate: false }));
    });
  });
});

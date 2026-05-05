import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPanel } from './SettingsPanel';
import type { DashboardSettings } from '../../types';

vi.mock('../../services/api', () => ({
  getHealth: vi.fn().mockResolvedValue({ status: 'ok', version: '1.0.0', uptime: 10 }),
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
    </QueryClientProvider>,
  );
}

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
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(patchArgusSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoUpdate: false }),
      );
    });
  });
});

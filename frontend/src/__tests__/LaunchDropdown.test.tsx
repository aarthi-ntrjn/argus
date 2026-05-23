import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LaunchDropdown from '../components/LaunchDropdown/LaunchDropdown';

vi.mock('../services/api', () => ({
  getAvailableTools: vi.fn(),
  launchInTerminal: vi.fn(),
}));

import { getAvailableTools, launchInTerminal } from '../services/api';

const mockGetAvailableTools = vi.mocked(getAvailableTools);
const mockLaunchInTerminal = vi.mocked(launchInTerminal);

const TOOLS_WITH_CLAUDE = {
  claude: true,
  copilot: false,
  claudeCmd: 'claude',
  copilotCmd: null,
  terminalAvailable: true,
};

const NO_TOOLS = {
  claude: false,
  copilot: false,
  claudeCmd: null,
  copilotCmd: null,
  terminalAvailable: true,
};

const TOOLS_WITH_COPILOT = {
  claude: false,
  copilot: true,
  claudeCmd: null,
  copilotCmd: 'copilot',
  terminalAvailable: true,
};

function renderDropdown(onLaunchError = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onLaunchError,
    ...render(
      <QueryClientProvider client={qc}>
        <LaunchDropdown repoPath="/my/repo" onLaunchError={onLaunchError} />
      </QueryClientProvider>,
    ),
  };
}

describe('LaunchDropdown — error message translation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAvailableTools.mockResolvedValue(TOOLS_WITH_CLAUDE as any);
    mockLaunchInTerminal.mockResolvedValue({});
  });

  it('calls onLaunchError with server-unreachable message when fetch fails', async () => {
    mockLaunchInTerminal.mockRejectedValue(new Error('Failed to fetch'));
    const { onLaunchError } = renderDropdown();

    await userEvent.click(screen.getByRole('button', { name: 'Launch with Argus' }));
    await waitFor(() => screen.getByText('Launch Claude'));
    await userEvent.click(screen.getByText('Launch Claude'));

    await waitFor(() =>
      expect(onLaunchError).toHaveBeenCalledWith(
        'Failed to launch session. The Argus server is unreachable.',
      ),
    );
  });

  it('calls onLaunchError with server-unreachable message when error message is empty', async () => {
    mockLaunchInTerminal.mockRejectedValue(new Error(''));
    const { onLaunchError } = renderDropdown();

    await userEvent.click(screen.getByRole('button', { name: 'Launch with Argus' }));
    await waitFor(() => screen.getByText('Launch Claude'));
    await userEvent.click(screen.getByText('Launch Claude'));

    await waitFor(() =>
      expect(onLaunchError).toHaveBeenCalledWith(
        'Failed to launch session. The Argus server is unreachable.',
      ),
    );
  });

  it('calls onLaunchError with prefixed message for other server errors', async () => {
    mockLaunchInTerminal.mockRejectedValue(new Error('Terminal not found'));
    const { onLaunchError } = renderDropdown();

    await userEvent.click(screen.getByRole('button', { name: 'Launch with Argus' }));
    await waitFor(() => screen.getByText('Launch Claude'));
    await userEvent.click(screen.getByText('Launch Claude'));

    await waitFor(() =>
      expect(onLaunchError).toHaveBeenCalledWith('Failed to launch session: Terminal not found'),
    );
  });

  it('does not call onLaunchError when launch succeeds', async () => {
    mockLaunchInTerminal.mockResolvedValue({});
    const { onLaunchError } = renderDropdown();

    await userEvent.click(screen.getByRole('button', { name: 'Launch with Argus' }));
    await waitFor(() => screen.getByText('Launch Claude'));
    await userEvent.click(screen.getByText('Launch Claude'));

    await waitFor(() => expect(mockLaunchInTerminal).toHaveBeenCalled());
    expect(onLaunchError).not.toHaveBeenCalled();
  });
});

describe('LaunchDropdown — available tools refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechecks available tools when the menu opens so newly installed Copilot appears', async () => {
    mockGetAvailableTools
      .mockResolvedValueOnce(NO_TOOLS as any)
      .mockResolvedValueOnce(TOOLS_WITH_COPILOT as any);

    renderDropdown();

    await waitFor(() => expect(mockGetAvailableTools).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: 'Launch with Argus' }));

    await waitFor(() => expect(mockGetAvailableTools).toHaveBeenCalledTimes(2));
    await waitFor(() => screen.getByText('Launch Copilot'));
  });
});

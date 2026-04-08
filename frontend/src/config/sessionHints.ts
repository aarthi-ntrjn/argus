import type { ContextualHint } from '../types';

export const SESSION_HINTS: ContextualHint[] = [
  {
    id: 'session-status',
    label: 'This badge shows the current session status: running, resting, waiting, or ended. Status updates automatically in real time.',
    ariaLabel: 'Help: session status indicator',
    placement: 'bottom',
  },
  {
    id: 'session-prompt-bar',
    label: 'Use this bar to send prompts directly to a live (command mode) session. Press Enter to send, Escape to interrupt. Read-only (view mode) sessions cannot receive prompts.',
    ariaLabel: 'Help: session control and prompt bar',
    placement: 'top',
  },
  {
    id: 'session-output-stream',
    label: 'This panel streams the live output from the AI session as it runs. Messages, tool calls, and results appear here for both command mode and view mode sessions.',
    ariaLabel: 'Help: session output stream',
    placement: 'top',
  },
];

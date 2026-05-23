import type { TourStep } from '../types';

/** Tour 1 — shown on first load (no repos yet). */
export const FIRST_LOAD_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-header"]',
    title: '👋 Welcome!',
    content: "Argus helps you manage and control your team of CLI sessions. Let's go!",
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-add-repo"]',
    title: '📁 Add Repositories',
    content:
      'Add a folder of repositories and Argus will sniff out every AI session running inside them.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-todo"]',
    title: '📝 To Do or Not To Do',
    content: 'Track your wild ideas here.',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: 'body',
    title: "🎉 You're all set!",
    content: "You're officially an Argus pro. Your AI team awaits. Go build something awesome!",
    placement: 'center',
    disableBeacon: true,
  },
];

/** Tour 2 — shown when the first repository is added. */
export const REPO_CATCH_UP_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-repo-card"]',
    title: '🗂️ Your Repositories',
    content: 'Each card shows a repo and its active AI sessions, all updating live.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-launch"]',
    title: '🚀 Launch with Argus',
    content: 'You can control your AI sessions when launched from Argus.',
    placement: 'bottom',
    disableBeacon: true,
  },
];

/** Tour 3 — shown when the first session appears. */
export const SESSION_CATCH_UP_STEPS: TourStep[] = [
  {
    target: '[data-tour-id="dashboard-session-card"]',
    title: '🤖 AI Sessions',
    content: 'Monitor your AI sessions here. Sessions launched outside of Argus are read-only.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="dashboard-integrations"]',
    title: '🔔 Stream to Teams & Slack',
    content:
      'Configure Microsoft Teams and Slack to stream your CLI sessions directly to your channels. You can also command your CLIs from the channel.',
    placement: 'bottom',
    disableBeacon: true,
  },
];

/** Default steps with all sections (for backwards compat with tests). */
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  ...FIRST_LOAD_STEPS,
  ...REPO_CATCH_UP_STEPS,
  ...SESSION_CATCH_UP_STEPS,
];

/** @deprecated Use FIRST_LOAD_STEPS directly. Kept for backwards compat. */
export function buildDashboardTourSteps(_hasRepos: boolean): TourStep[] {
  return FIRST_LOAD_STEPS;
}

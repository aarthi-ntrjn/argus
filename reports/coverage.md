# Coverage Report

*Generated: May 6, 2026, 10:06 PM*

## Summary

| Suite | Files | Tests | Statements | Branches | Functions | Lines | Covers |
|-------|-------|-------|------------|----------|-----------|-------|--------|
| backend unit   | 207 | 🟢 532/532 | 🟡 64.79% | 🟡 74.30% | 🟡 71.08% | 🟡 64.79% | backend/src |
| frontend unit  | 130 | 🟢 367/367 | 🔴 37.46% | 🟡 78.08% | 🔴 49.29% | 🔴 37.46% | frontend/src |
| e2e mock       | 14 | 🟢 152/152 (2 skipped) | 🔴 54.46% | 🔴 48.78% | 🔴 48.30% | 🔴 54.71% | frontend/src |
| e2e real       | N/A | N/A | N/A | N/A | N/A | N/A | backend/src |

## Backend unit - per file

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `backend/scripts/check-actions.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/seed-test-thread.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/test-outbound.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/src/api/routes/fs.ts` | 🟡 76.81% | 🟡 79.16% | 🟢 100.00% | 🟡 76.81% |
| `backend/src/api/routes/health.ts` | 🟢 82.79% | 🔴 20.00% | 🔴 33.33% | 🟢 82.79% |
| `backend/src/api/routes/hooks.ts` | 🟢 84.34% | 🟡 76.31% | 🔴 50.00% | 🟢 84.34% |
| `backend/src/api/routes/launcher.ts` | 🔴 31.04% | 🔴 37.50% | 🟡 66.66% | 🔴 31.04% |
| `backend/src/api/routes/metrics.ts` | 🔴 58.97% | 🟢 100.00% | 🟢 100.00% | 🔴 58.97% |
| `backend/src/api/routes/repositories.ts` | 🔴 54.83% | 🔴 53.84% | 🔴 33.33% | 🔴 54.83% |
| `backend/src/api/routes/sessions.ts` | 🔴 55.12% | 🔴 58.06% | 🟡 66.66% | 🔴 55.12% |
| `backend/src/api/routes/settings.ts` | 🟡 76.11% | 🟢 88.88% | 🟢 100.00% | 🟡 76.11% |
| `backend/src/api/routes/teams-settings.ts` | 🟡 62.50% | 🟢 100.00% | 🟢 100.00% | 🟡 62.50% |
| `backend/src/api/routes/telemetry.ts` | 🟢 100.00% | 🟢 90.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/api/routes/test-utils.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/api/routes/todos.ts` | 🟢 89.28% | 🟢 83.33% | 🟢 100.00% | 🟢 89.28% |
| `backend/src/api/routes/tools.ts` | 🟡 74.10% | 🟡 69.56% | 🟢 100.00% | 🟡 74.10% |
| `backend/src/api/routes/update.ts` | 🔴 47.16% | 🟡 60.00% | 🔴 50.00% | 🔴 47.16% |
| `backend/src/api/ws/event-dispatcher.ts` | 🔴 33.33% | 🔴 50.00% | 🔴 25.00% | 🔴 33.33% |
| `backend/src/cli/argus-launch-client.ts` | 🟢 83.33% | 🟡 75.75% | 🟢 85.71% | 🟢 83.33% |
| `backend/src/cli/launch-command-resolver.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/cli/launch.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/config/config-loader.ts` | 🟢 96.29% | 🟢 83.33% | 🟢 100.00% | 🟢 96.29% |
| `backend/src/config/slack-config-loader.ts` | 🟡 68.88% | 🟢 100.00% | 🔴 50.00% | 🟡 68.88% |
| `backend/src/config/teams-config-loader.ts` | 🔴 57.50% | 🔴 40.00% | 🔴 50.00% | 🔴 57.50% |
| `backend/src/constants/slack-events.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/db/database.ts` | 🔴 56.93% | 🟡 69.41% | 🔴 55.26% | 🔴 56.93% |
| `backend/src/db/schema.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/integration/integration-manager.ts` | 🔴 18.72% | 🟢 100.00% | 🔴 11.11% | 🔴 18.72% |
| `backend/src/integration/integration-status.ts` | 🟡 78.57% | 🟡 75.00% | 🟢 100.00% | 🟡 78.57% |
| `backend/src/integration/slack/slack-listener.ts` | 🔴 48.76% | 🟢 85.71% | 🟡 63.63% | 🔴 48.76% |
| `backend/src/integration/slack/slack-notifier.ts` | 🟡 60.13% | 🟡 65.00% | 🟡 63.63% | 🟡 60.13% |
| `backend/src/integration/teams/teams-listener.ts` | 🔴 10.30% | 🟢 100.00% | 🔴 0.00% | 🔴 10.30% |
| `backend/src/integration/teams/teams-notifier.ts` | 🟡 78.66% | 🟡 63.01% | 🟡 75.00% | 🟡 78.66% |
| `backend/src/integration/teams/teams-sdk-adapter.ts` | 🔴 47.61% | 🟢 100.00% | 🟡 66.66% | 🔴 47.61% |
| `backend/src/models/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/server.ts` | 🟡 60.16% | 🔴 55.00% | 🟢 80.00% | 🟡 60.16% |
| `backend/src/services/base-cli-detector.ts` | 🟢 83.69% | 🟡 74.50% | 🟡 71.42% | 🟢 83.69% |
| `backend/src/services/claude-code-detector.ts` | 🟢 83.33% | 🟡 77.27% | 🟢 100.00% | 🟢 83.33% |
| `backend/src/services/claude-code-hooks-injector.ts` | 🟢 93.18% | 🟢 81.48% | 🟢 100.00% | 🟢 93.18% |
| `backend/src/services/claude-code-jsonl-parser.ts` | 🟢 86.95% | 🟡 69.56% | 🟢 100.00% | 🟢 86.95% |
| `backend/src/services/claude-code-jsonl-watcher.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/cli-detector.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/cli-hooks-injector.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/cli-manager.ts` | 🟡 71.83% | 🟢 100.00% | 🔴 56.25% | 🟡 71.83% |
| `backend/src/services/copilot-cli-detector.ts` | 🟢 84.39% | 🔴 37.83% | 🟢 100.00% | 🟢 84.39% |
| `backend/src/services/copilot-cli-hooks-injector.ts` | 🟢 83.67% | 🟡 72.41% | 🟢 87.50% | 🟢 83.67% |
| `backend/src/services/copilot-cli-jsonl-parser.ts` | 🟢 94.92% | 🟢 92.53% | 🟢 100.00% | 🟢 94.92% |
| `backend/src/services/copilot-cli-jsonl-watcher.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/jsonl-watcher-base.ts` | 🟢 96.40% | 🟢 88.37% | 🟢 100.00% | 🟢 96.40% |
| `backend/src/services/message-queue.ts` | 🟢 86.84% | 🟢 90.90% | 🟢 80.00% | 🟢 86.84% |
| `backend/src/services/output-store.ts` | 🟢 86.11% | 🟢 86.66% | 🟢 83.33% | 🟢 86.11% |
| `backend/src/services/pending-choice-events.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/pending-choice-utils.ts` | 🟢 100.00% | 🟢 93.33% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/pid-validator.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/process-utils.ts` | 🔴 55.28% | 🔴 41.17% | 🟡 72.72% | 🔴 55.28% |
| `backend/src/services/pruning-job.ts` | 🔴 16.66% | 🟢 100.00% | 🔴 0.00% | 🔴 16.66% |
| `backend/src/services/pty-registry.ts` | 🟡 65.36% | 🟢 92.30% | 🟡 66.66% | 🟡 65.36% |
| `backend/src/services/repository-scanner.ts` | 🔴 42.47% | 🟢 92.85% | 🔴 25.00% | 🔴 42.47% |
| `backend/src/services/session-controller.ts` | 🔴 52.03% | 🟡 71.42% | 🟡 71.42% | 🔴 52.03% |
| `backend/src/services/session-diff-tracker.ts` | 🟢 89.18% | 🟢 85.71% | 🟡 71.42% | 🟢 89.18% |
| `backend/src/services/session-monitor.ts` | 🟡 68.46% | 🟡 66.66% | 🟡 75.00% | 🟡 68.46% |
| `backend/src/services/session-pid-resolver.ts` | 🟢 87.14% | 🟡 70.37% | 🟢 100.00% | 🟢 87.14% |
| `backend/src/services/telemetry-service.ts` | 🟢 94.73% | 🟢 89.18% | 🟢 85.71% | 🟢 94.73% |
| `backend/src/services/update-service.ts` | 🟢 92.85% | 🟡 68.08% | 🟢 85.71% | 🟢 92.85% |
| `backend/src/services/watcher-session-helpers.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/utils/logger.ts` | 🟢 93.65% | 🟡 73.68% | 🟢 100.00% | 🟢 93.65% |
| `backend/src/utils/path-sandbox.ts` | 🟡 76.47% | 🔴 57.14% | 🟢 100.00% | 🟡 76.47% |
| `backend/start-test-server.mjs` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |

## Frontend unit - per file

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `frontend/eslint.config.mjs` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/postcss.config.js` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/App.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/ArgusLogo.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Badge.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/BrandIcons.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Button.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Checkbox.tsx` | 🟢 95.83% | 🟢 90.00% | 🟢 100.00% | 🟢 95.83% |
| `frontend/src/components/FolderInputDialog/FolderInputDialog.tsx` | 🔴 2.27% | 🟢 100.00% | 🔴 0.00% | 🔴 2.27% |
| `frontend/src/components/IntegrationButton/IntegrationButton.tsx` | 🔴 5.78% | 🟢 100.00% | 🔴 0.00% | 🔴 5.78% |
| `frontend/src/components/IntegrationStatusIcon.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx` | 🟢 97.46% | 🟢 84.61% | 🟢 100.00% | 🟢 97.46% |
| `frontend/src/components/LaunchDropdown/LaunchDropdown.tsx` | 🟡 60.20% | 🟡 69.44% | 🔴 53.84% | 🟡 60.20% |
| `frontend/src/components/MobileNav/MobileNav.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Onboarding/index.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/Onboarding/OnboardingTour.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/OutputPane/OutputPane.tsx` | 🟢 89.09% | 🟢 85.71% | 🟡 60.00% | 🟢 89.09% |
| `frontend/src/components/PendingChoicePanel/PendingChoicePanel.tsx` | 🔴 47.42% | 🔴 37.50% | 🔴 11.11% | 🔴 47.42% |
| `frontend/src/components/PendingSessionCard/PendingSessionCard.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/RemoveConfirmDialog.tsx` | 🔴 7.54% | 🟢 100.00% | 🔴 0.00% | 🔴 7.54% |
| `frontend/src/components/RepoCard/RepoCard.tsx` | 🔴 6.73% | 🟢 100.00% | 🔴 0.00% | 🔴 6.73% |
| `frontend/src/components/RepoContextBar/RepoContextBar.tsx` | 🔴 11.11% | 🟢 100.00% | 🔴 0.00% | 🔴 11.11% |
| `frontend/src/components/SectionHeading.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SessionCard/SessionCard.tsx` | 🟢 89.47% | 🟢 87.80% | 🔴 29.41% | 🟢 89.47% |
| `frontend/src/components/SessionDetail/SessionDetail.tsx` | 🟡 79.88% | 🟡 71.00% | 🔴 56.00% | 🟡 79.88% |
| `frontend/src/components/SessionDetail/sessionDetailUtils.ts` | 🟢 89.84% | 🟢 90.47% | 🟢 100.00% | 🟢 89.84% |
| `frontend/src/components/SessionMetaRow/SessionMetaRow.tsx` | 🟢 85.00% | 🟡 70.37% | 🟢 80.00% | 🟢 85.00% |
| `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx` | 🟢 91.04% | 🟡 75.00% | 🟢 83.33% | 🟢 91.04% |
| `frontend/src/components/SessionTypeIcon/SessionTypeIcon.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsDialog/DialogLinkItem.tsx` | 🔴 12.50% | 🟢 100.00% | 🔴 0.00% | 🔴 12.50% |
| `frontend/src/components/SettingsDialog/GeneralSettingsContent.tsx` | 🟢 92.68% | 🟢 88.37% | 🟢 80.00% | 🟢 92.68% |
| `frontend/src/components/SettingsDialog/IntegrationConfigContent.tsx` | 🟢 92.14% | 🟢 82.92% | 🟢 85.71% | 🟢 92.14% |
| `frontend/src/components/SettingsDialog/SettingsDialog.tsx` | 🔴 51.58% | 🔴 25.00% | 🔴 25.00% | 🔴 51.58% |
| `frontend/src/components/SettingsPanel/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsPanel/SettingsPanel.tsx` | 🟢 93.79% | 🟢 85.71% | 🟢 100.00% | 🟢 93.79% |
| `frontend/src/components/SetupPage/SetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/TelemetryBanner/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/TelemetryBanner/TelemetryBanner.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/TodoPanel/TodoPanel.tsx` | 🟢 84.98% | 🟢 90.36% | 🟡 78.26% | 🟢 84.98% |
| `frontend/src/components/ToggleIconButton.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/UpdateBadge/UpdateBadge.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/YoloWarningDialog/YoloWarningDialog.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/config/dashboardTourSteps.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `frontend/src/config/feedback.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useArgusSettings.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useIntegrationControl.ts` | 🟡 75.67% | 🟢 100.00% | 🔴 33.33% | 🟡 75.67% |
| `frontend/src/hooks/useIsMobile.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useKillSession.ts` | 🟢 87.34% | 🟡 77.77% | 🟢 100.00% | 🟢 87.34% |
| `frontend/src/hooks/useOnboarding.ts` | 🟢 87.30% | 🟢 100.00% | 🟢 100.00% | 🟢 87.30% |
| `frontend/src/hooks/usePendingLaunchers.ts` | 🟢 94.87% | 🟢 87.50% | 🟢 100.00% | 🟢 94.87% |
| `frontend/src/hooks/usePromptHistory.ts` | 🟢 97.36% | 🟢 95.12% | 🟢 83.33% | 🟢 97.36% |
| `frontend/src/hooks/useRepositoryManagement.ts` | 🟢 94.49% | 🟢 93.54% | 🟢 80.00% | 🟢 94.49% |
| `frontend/src/hooks/useSettings.ts` | 🟢 96.55% | 🟢 87.50% | 🟢 100.00% | 🟢 96.55% |
| `frontend/src/hooks/useSlackSettings.ts` | 🔴 57.14% | 🟢 100.00% | 🟢 100.00% | 🔴 57.14% |
| `frontend/src/hooks/useTeamsSettings.ts` | 🔴 58.06% | 🟢 100.00% | 🟢 100.00% | 🔴 58.06% |
| `frontend/src/hooks/useTodos.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useUpdateStatus.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/main.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/DashboardPage.tsx` | 🔴 55.35% | 🔴 55.07% | 🔴 10.00% | 🔴 55.35% |
| `frontend/src/pages/IntegrationsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/SessionPage.tsx` | 🟢 90.19% | 🟢 80.00% | 🔴 50.00% | 🟢 90.19% |
| `frontend/src/pages/SlackSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TeamsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TelemetryPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/services/api.ts` | 🔴 17.67% | 🟡 66.66% | 🔴 2.85% | 🔴 17.67% |
| `frontend/src/services/onboardingEvents.ts` | 🟢 100.00% | 🟢 100.00% | 🟡 75.00% | 🟢 100.00% |
| `frontend/src/services/onboardingStorage.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/services/socket.ts` | 🔴 9.14% | 🟢 100.00% | 🔴 11.11% | 🔴 9.14% |
| `frontend/src/types.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/utils/repoUtils.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/utils/sessionUtils.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/tailwind.config.js` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/fixtures.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/onboarding.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/global-setup.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/global-teardown.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/onboarding-real.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/sc-001-real-repo-overview.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/sc-001-real-session-card.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/sc-005-real-settings-filter.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/sc-020-real-send-prompt.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/session-detail-real.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/test-config.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/real-server/todo-panel-real.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-001-repo-overview.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-001-session-card.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-002-real-time-output.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-004-stop-session.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-005-settings-filter.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-006-session-ux.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-007-stream-model.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-020-send-prompt.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-026-resting-threshold.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-027-kill-session.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-028-ai-choice-alert.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/session-detail-page.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/todo-panel.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/setup.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/vite.config.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/vitest.config.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |

## E2e mock - per file

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `frontend/src/App.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/ArgusLogo.tsx` | 🟢 100.00% | 🔴 50.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Badge.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/BrandIcons.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Button.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Checkbox.tsx` | 🟢 90.00% | 🟢 83.33% | 🟢 100.00% | 🟢 90.00% |
| `frontend/src/components/FolderInputDialog/FolderInputDialog.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/IntegrationButton/IntegrationButton.tsx` | 🔴 2.77% | 🔴 0.00% | 🔴 0.00% | 🔴 3.03% |
| `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx` | 🟢 85.71% | 🔴 50.00% | 🟢 100.00% | 🟢 85.71% |
| `frontend/src/components/LaunchDropdown/LaunchDropdown.tsx` | 🔴 23.88% | 🔴 11.36% | 🔴 15.78% | 🔴 25.39% |
| `frontend/src/components/MobileNav/MobileNav.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/Onboarding/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Onboarding/OnboardingTour.tsx` | 🟡 68.18% | 🔴 42.85% | 🟢 100.00% | 🟡 68.18% |
| `frontend/src/components/OutputPane/OutputPane.tsx` | 🟢 80.00% | 🟡 71.42% | 🟡 75.00% | 🟡 79.16% |
| `frontend/src/components/PendingChoicePanel/PendingChoicePanel.tsx` | 🔴 28.84% | 🔴 39.47% | 🔴 20.00% | 🔴 28.84% |
| `frontend/src/components/PendingSessionCard/PendingSessionCard.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/RemoveConfirmDialog.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/RepoCard/RepoCard.tsx` | 🔴 20.00% | 🟢 81.25% | 🔴 40.00% | 🔴 20.00% |
| `frontend/src/components/RepoContextBar/RepoContextBar.tsx` | 🔴 50.00% | 🔴 50.00% | 🔴 50.00% | 🔴 50.00% |
| `frontend/src/components/SectionHeading.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SessionCard/SessionCard.tsx` | 🟡 68.18% | 🟢 90.56% | 🔴 45.00% | 🟡 70.73% |
| `frontend/src/components/SessionDetail/SessionDetail.tsx` | 🔴 47.12% | 🔴 29.49% | 🔴 33.33% | 🔴 47.56% |
| `frontend/src/components/SessionDetail/sessionDetailUtils.ts` | 🔴 47.29% | 🔴 37.28% | 🟡 62.50% | 🔴 46.57% |
| `frontend/src/components/SessionMetaRow/SessionMetaRow.tsx` | 🟢 100.00% | 🟢 94.73% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx` | 🟡 79.62% | 🟡 71.42% | 🟢 87.50% | 🟡 78.84% |
| `frontend/src/components/SessionTypeIcon/SessionTypeIcon.tsx` | 🟢 100.00% | 🟢 80.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsDialog/DialogLinkItem.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsDialog/GeneralSettingsContent.tsx` | 🟡 65.00% | 🟡 71.42% | 🔴 41.17% | 🟡 66.10% |
| `frontend/src/components/SettingsDialog/IntegrationConfigContent.tsx` | 🔴 3.12% | 🔴 0.00% | 🔴 0.00% | 🔴 3.33% |
| `frontend/src/components/SettingsDialog/SettingsDialog.tsx` | 🟢 89.47% | 🟡 77.27% | 🟢 87.50% | 🟢 88.88% |
| `frontend/src/components/SettingsPanel/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsPanel/SettingsPanel.tsx` | 🟡 75.00% | 🟢 100.00% | 🔴 50.00% | 🟡 75.00% |
| `frontend/src/components/SetupPage/SetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/TelemetryBanner/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/TelemetryBanner/TelemetryBanner.tsx` | 🔴 25.00% | 🟢 100.00% | 🔴 0.00% | 🔴 25.00% |
| `frontend/src/components/TodoPanel/TodoPanel.tsx` | 🟡 79.10% | 🟡 71.26% | 🟢 85.10% | 🟡 78.57% |
| `frontend/src/components/ToggleIconButton.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/YoloWarningDialog/YoloWarningDialog.tsx` | 🟡 66.66% | 🔴 50.00% | 🟢 100.00% | 🟡 66.66% |
| `frontend/src/config/dashboardTourSteps.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/config/feedback.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useArgusSettings.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useIntegrationControl.ts` | 🟡 64.28% | 🔴 50.00% | 🔴 33.33% | 🟡 64.28% |
| `frontend/src/hooks/useIsMobile.ts` | 🟢 90.90% | 🟢 100.00% | 🟢 80.00% | 🟢 100.00% |
| `frontend/src/hooks/useKillSession.ts` | 🔴 54.34% | 🔴 41.66% | 🟢 80.00% | 🔴 53.33% |
| `frontend/src/hooks/useOnboarding.ts` | 🔴 42.30% | 🟢 100.00% | 🔴 40.00% | 🔴 40.00% |
| `frontend/src/hooks/usePendingLaunchers.ts` | 🔴 30.00% | 🔴 0.00% | 🔴 28.57% | 🔴 26.31% |
| `frontend/src/hooks/usePromptHistory.ts` | 🔴 57.33% | 🔴 43.33% | 🟡 66.66% | 🔴 56.52% |
| `frontend/src/hooks/useRepositoryManagement.ts` | 🔴 23.61% | 🔴 0.00% | 🔴 11.76% | 🔴 24.61% |
| `frontend/src/hooks/useSettings.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useSlackSettings.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/hooks/useTeamsSettings.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/hooks/useTodos.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useUpdateStatus.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/main.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/pages/DashboardPage.tsx` | 🟡 68.36% | 🔴 58.86% | 🔴 55.93% | 🟡 67.66% |
| `frontend/src/pages/IntegrationsSetupPage.tsx` | 🔴 44.44% | 🔴 0.00% | 🔴 7.69% | 🔴 46.15% |
| `frontend/src/pages/SessionPage.tsx` | 🟢 83.33% | 🟢 94.11% | 🔴 57.14% | 🟢 87.50% |
| `frontend/src/pages/TelemetryPage.tsx` | 🔴 20.00% | 🟢 100.00% | 🔴 0.00% | 🔴 20.00% |
| `frontend/src/services/api.ts` | 🔴 53.84% | 🔴 54.16% | 🔴 50.00% | 🔴 53.84% |
| `frontend/src/services/onboardingEvents.ts` | 🟢 100.00% | 🟢 100.00% | 🔴 25.00% | 🟢 100.00% |
| `frontend/src/services/onboardingStorage.ts` | 🟢 89.47% | 🟡 75.00% | 🟢 100.00% | 🟢 89.47% |
| `frontend/src/services/socket.ts` | 🔴 42.15% | 🔴 24.32% | 🔴 24.32% | 🔴 42.70% |
| `frontend/src/types.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/utils/repoUtils.ts` | 🔴 21.42% | 🔴 16.66% | 🟢 100.00% | 🔴 21.42% |
| `frontend/src/utils/sessionUtils.ts` | 🟢 100.00% | 🟢 80.00% | 🟢 100.00% | 🟢 100.00% |

## E2e real - per file

*No coverage data available.*

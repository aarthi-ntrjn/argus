# Coverage Report

*Generated: May 24, 2026, 8:04 PM*

## Summary

| Suite | Files | Tests | Statements | Branches | Functions | Lines | Covers |
|-------|-------|-------|------------|----------|-----------|-------|--------|
| backend unit   | 210 | 🟢 561/561 | 🟡 63.95% | 🟡 74.73% | 🟡 71.79% | 🟡 63.95% | backend/src |
| frontend unit  | 151 | 🟢 435/435 | 🔴 41.30% | 🟡 78.42% | 🔴 51.72% | 🔴 41.30% | frontend/src |
| e2e mock       | N/A | N/A | N/A | N/A | N/A | N/A | frontend/src |
| e2e real       | N/A | N/A | N/A | N/A | N/A | N/A | backend/src |

## Backend unit - per file

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `backend/scripts/check-actions.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/seed-test-thread.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/test-outbound.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/src/api/routes/fs.ts` | 🟡 78.94% | 🟢 88.88% | 🟢 100.00% | 🟡 78.94% |
| `backend/src/api/routes/health.ts` | 🟢 81.72% | 🔴 20.00% | 🔴 33.33% | 🟢 81.72% |
| `backend/src/api/routes/hooks.ts` | 🟢 85.18% | 🟡 75.86% | 🔴 50.00% | 🟢 85.18% |
| `backend/src/api/routes/launcher.ts` | 🔴 31.04% | 🔴 37.50% | 🟡 66.66% | 🔴 31.04% |
| `backend/src/api/routes/metrics.ts` | 🔴 58.97% | 🟢 100.00% | 🟢 100.00% | 🔴 58.97% |
| `backend/src/api/routes/repositories.ts` | 🔴 52.75% | 🔴 54.54% | 🔴 33.33% | 🔴 52.75% |
| `backend/src/api/routes/sessions.ts` | 🔴 51.68% | 🔴 56.66% | 🔴 33.33% | 🔴 51.68% |
| `backend/src/api/routes/settings.ts` | 🟡 76.11% | 🟢 88.88% | 🟢 100.00% | 🟡 76.11% |
| `backend/src/api/routes/teams-settings.ts` | 🟡 62.50% | 🟢 100.00% | 🟢 100.00% | 🟡 62.50% |
| `backend/src/api/routes/telemetry.ts` | 🟢 100.00% | 🟢 90.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/api/routes/test-utils.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/api/routes/todos.ts` | 🟢 89.65% | 🟢 84.61% | 🟢 100.00% | 🟢 89.65% |
| `backend/src/api/routes/tools.ts` | 🟢 81.91% | 🟡 71.73% | 🟢 100.00% | 🟢 81.91% |
| `backend/src/api/routes/update.ts` | 🔴 47.16% | 🟡 60.00% | 🔴 50.00% | 🔴 47.16% |
| `backend/src/api/ws/event-dispatcher.ts` | 🔴 33.33% | 🔴 50.00% | 🔴 25.00% | 🔴 33.33% |
| `backend/src/cli/base-cli-detector.ts` | 🟡 77.16% | 🟡 72.26% | 🟡 70.96% | 🟡 77.16% |
| `backend/src/cli/claude-code/claude-code-detector.ts` | 🟢 83.33% | 🟡 77.27% | 🟢 100.00% | 🟢 83.33% |
| `backend/src/cli/claude-code/claude-code-hooks-injector.ts` | 🟢 93.33% | 🟢 81.48% | 🟢 100.00% | 🟢 93.33% |
| `backend/src/cli/claude-code/claude-code-jsonl-parser.ts` | 🟢 86.95% | 🟡 69.56% | 🟢 100.00% | 🟢 86.95% |
| `backend/src/cli/claude-code/claude-code-jsonl-watcher.ts` | 🟢 90.12% | 🟢 84.21% | 🟢 100.00% | 🟢 90.12% |
| `backend/src/cli/cli-detector.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/cli/cli-hooks-injector.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/cli/cli-manager.ts` | 🟡 71.83% | 🟢 100.00% | 🔴 56.25% | 🟡 71.83% |
| `backend/src/cli/copilot-cli/copilot-cli-detector.ts` | 🟡 74.01% | 🔴 39.47% | 🟢 100.00% | 🟡 74.01% |
| `backend/src/cli/copilot-cli/copilot-cli-hooks-injector.ts` | 🟢 85.71% | 🟡 76.66% | 🟢 87.50% | 🟢 85.71% |
| `backend/src/cli/copilot-cli/copilot-cli-jsonl-parser.ts` | 🟢 94.92% | 🟢 92.53% | 🟢 100.00% | 🟢 94.92% |
| `backend/src/cli/copilot-cli/copilot-cli-jsonl-watcher.ts` | 🟡 75.92% | 🟡 78.26% | 🟢 100.00% | 🟡 75.92% |
| `backend/src/cli/jsonl-watcher-base.ts` | 🟢 96.45% | 🟢 88.63% | 🟢 100.00% | 🟢 96.45% |
| `backend/src/cli/pending-choice-events.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/cli/pending-choice-utils.ts` | 🟢 93.50% | 🟢 90.74% | 🟢 83.33% | 🟢 93.50% |
| `backend/src/cli/session-monitor.ts` | 🟡 68.46% | 🟡 66.66% | 🟡 75.00% | 🟡 68.46% |
| `backend/src/cli/session-pid-resolver.ts` | 🟢 87.14% | 🟡 70.37% | 🟢 100.00% | 🟢 87.14% |
| `backend/src/cli/watcher-session-helpers.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/config/config-loader.ts` | 🟢 88.60% | 🟡 78.57% | 🟢 100.00% | 🟢 88.60% |
| `backend/src/config/slack-config-loader.ts` | 🟡 68.88% | 🟢 100.00% | 🔴 50.00% | 🟡 68.88% |
| `backend/src/config/teams-config-loader.ts` | 🔴 30.00% | 🟡 66.66% | 🔴 50.00% | 🔴 30.00% |
| `backend/src/constants/event-names.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/db/database.ts` | 🔴 56.93% | 🟡 70.93% | 🔴 55.26% | 🔴 56.93% |
| `backend/src/db/output-store.ts` | 🟢 86.11% | 🟢 86.66% | 🟢 83.33% | 🟢 86.11% |
| `backend/src/db/pruning-job.ts` | 🔴 16.66% | 🟢 100.00% | 🔴 0.00% | 🔴 16.66% |
| `backend/src/db/schema.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/integration/integration-manager.ts` | 🔴 18.72% | 🟢 100.00% | 🔴 11.11% | 🔴 18.72% |
| `backend/src/integration/integration-status.ts` | 🟡 78.57% | 🟡 75.00% | 🟢 100.00% | 🟡 78.57% |
| `backend/src/integration/session-diff-tracker.ts` | 🟢 89.18% | 🟢 85.71% | 🟡 71.42% | 🟢 89.18% |
| `backend/src/integration/slack/slack-listener.ts` | 🔴 48.76% | 🟢 85.71% | 🟡 63.63% | 🔴 48.76% |
| `backend/src/integration/slack/slack-notifier.ts` | 🟡 60.13% | 🟡 65.00% | 🟡 63.63% | 🟡 60.13% |
| `backend/src/integration/teams/teams-listener.ts` | 🔴 3.60% | 🔴 0.00% | 🔴 0.00% | 🔴 3.60% |
| `backend/src/integration/teams/teams-notifier.ts` | 🟡 78.66% | 🟡 63.51% | 🟡 76.19% | 🟡 78.66% |
| `backend/src/integration/teams/teams-sdk-adapter.ts` | 🔴 47.61% | 🟢 100.00% | 🟡 66.66% | 🔴 47.61% |
| `backend/src/launch-pty/argus-launch-client.ts` | 🟢 83.33% | 🟡 75.75% | 🟢 86.66% | 🟢 83.33% |
| `backend/src/launch-pty/launch-command-resolver.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/launch-pty/launch.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/launch-pty/pty-registry.ts` | 🟡 65.36% | 🟢 92.30% | 🟡 66.66% | 🟡 65.36% |
| `backend/src/models/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/server.ts` | 🟡 60.16% | 🔴 52.63% | 🟢 80.00% | 🟡 60.16% |
| `backend/src/services/repository-scanner.ts` | 🔴 45.57% | 🟢 85.18% | 🔴 22.22% | 🔴 45.57% |
| `backend/src/services/session-controller.ts` | 🔴 52.03% | 🟡 71.42% | 🟡 71.42% | 🔴 52.03% |
| `backend/src/services/telemetry-service.ts` | 🟢 92.10% | 🟢 84.37% | 🟢 85.71% | 🟢 92.10% |
| `backend/src/services/update-service.ts` | 🟢 92.85% | 🟡 68.08% | 🟢 85.71% | 🟢 92.85% |
| `backend/src/utils/logger.ts` | 🟢 93.65% | 🟡 73.68% | 🟢 100.00% | 🟢 93.65% |
| `backend/src/utils/message-queue.ts` | 🟢 86.84% | 🟢 90.90% | 🟢 80.00% | 🟢 86.84% |
| `backend/src/utils/path-sandbox.ts` | 🟢 88.23% | 🟢 85.71% | 🟢 100.00% | 🟢 88.23% |
| `backend/src/utils/pid-validator.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/utils/process-utils.ts` | 🔴 26.44% | 🔴 35.71% | 🔴 27.27% | 🔴 26.44% |
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
| `frontend/src/components/IntegrationButton/IntegrationButton.tsx` | 🔴 58.94% | 🔴 35.00% | 🔴 42.85% | 🔴 58.94% |
| `frontend/src/components/IntegrationStatusIcon.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx` | 🟢 97.46% | 🟢 84.61% | 🟢 100.00% | 🟢 97.46% |
| `frontend/src/components/LaunchDropdown/LaunchDropdown.tsx` | 🟢 81.61% | 🟡 76.74% | 🔴 50.00% | 🟢 81.61% |
| `frontend/src/components/MobileNav/MobileNav.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Onboarding/index.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/Onboarding/OnboardingTour.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/OutputPane/OutputPane.tsx` | 🟢 89.09% | 🟢 85.71% | 🟡 60.00% | 🟢 89.09% |
| `frontend/src/components/PendingChoicePanel/PendingChoicePanel.tsx` | 🔴 46.66% | 🔴 40.00% | 🔴 10.00% | 🔴 46.66% |
| `frontend/src/components/PendingSessionCard/PendingSessionCard.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/RemoveConfirmDialog.tsx` | 🔴 7.54% | 🟢 100.00% | 🔴 0.00% | 🔴 7.54% |
| `frontend/src/components/RepoCard/RepoCard.tsx` | 🟡 76.66% | 🔴 25.00% | 🔴 50.00% | 🟡 76.66% |
| `frontend/src/components/RepoContextBar/RepoContextBar.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/RepoLinks.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SectionHeading.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SessionCard/SessionCard.tsx` | 🟢 89.86% | 🟢 85.10% | 🔴 29.41% | 🟢 89.86% |
| `frontend/src/components/SessionDetail/SessionDetail.tsx` | 🟡 76.14% | 🟡 69.09% | 🔴 52.00% | 🟡 76.14% |
| `frontend/src/components/SessionDetail/sessionDetailUtils.ts` | 🟢 89.84% | 🟢 90.62% | 🟢 100.00% | 🟢 89.84% |
| `frontend/src/components/SessionMetaRow/SessionMetaRow.tsx` | 🟢 85.00% | 🟡 70.37% | 🟢 80.00% | 🟢 85.00% |
| `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx` | 🟢 91.04% | 🟡 75.00% | 🟢 83.33% | 🟢 91.04% |
| `frontend/src/components/SessionTypeIcon/SessionTypeIcon.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsDialog/DialogLinkItem.tsx` | 🟡 62.50% | 🔴 50.00% | 🟢 100.00% | 🟡 62.50% |
| `frontend/src/components/SettingsDialog/GeneralSettingsContent.tsx` | 🟢 92.68% | 🟢 88.37% | 🟢 80.00% | 🟢 92.68% |
| `frontend/src/components/SettingsDialog/IntegrationConfigContent.tsx` | 🟢 92.14% | 🟢 82.92% | 🟢 85.71% | 🟢 92.14% |
| `frontend/src/components/SettingsDialog/SettingsDialog.tsx` | 🟢 82.68% | 🟡 77.27% | 🔴 50.00% | 🟢 82.68% |
| `frontend/src/components/SettingsPanel/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsPanel/SettingsPanel.tsx` | 🟢 93.38% | 🟡 75.00% | 🟢 100.00% | 🟢 93.38% |
| `frontend/src/components/SetupPage/SetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/TelemetryBanner/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/TelemetryBanner/TelemetryBanner.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/TodoPanel/TodoPanel.tsx` | 🟢 91.81% | 🟢 94.68% | 🟢 100.00% | 🟢 91.81% |
| `frontend/src/components/ToggleIconButton.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/UpdateBadge/UpdateBadge.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/YoloWarningDialog/YoloWarningDialog.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/config/dashboardTourSteps.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `frontend/src/config/feedback.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useArgusSettings.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useIntegrationControl.ts` | 🟡 75.67% | 🟢 100.00% | 🔴 33.33% | 🟡 75.67% |
| `frontend/src/hooks/useIsMobile.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useKillSession.ts` | 🟢 87.34% | 🟡 77.77% | 🟢 100.00% | 🟢 87.34% |
| `frontend/src/hooks/useOnboarding.ts` | 🟡 78.66% | 🟢 100.00% | 🟢 100.00% | 🟡 78.66% |
| `frontend/src/hooks/usePendingLaunchers.ts` | 🟢 94.87% | 🟢 87.50% | 🟢 100.00% | 🟢 94.87% |
| `frontend/src/hooks/usePromptHistory.ts` | 🟢 97.36% | 🟢 95.12% | 🟢 83.33% | 🟢 97.36% |
| `frontend/src/hooks/useRepositoryManagement.ts` | 🟢 94.49% | 🟢 93.54% | 🟢 80.00% | 🟢 94.49% |
| `frontend/src/hooks/useSettings.ts` | 🟢 96.55% | 🟢 87.50% | 🟢 100.00% | 🟢 96.55% |
| `frontend/src/hooks/useSlackSettings.ts` | 🔴 57.14% | 🟢 100.00% | 🟢 100.00% | 🔴 57.14% |
| `frontend/src/hooks/useTeamsSettings.ts` | 🔴 58.06% | 🟢 100.00% | 🟢 100.00% | 🔴 58.06% |
| `frontend/src/hooks/useTodos.ts` | 🟢 91.66% | 🟢 93.75% | 🟢 93.33% | 🟢 91.66% |
| `frontend/src/hooks/useUpdateStatus.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/main.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/DashboardPage.tsx` | 🔴 56.28% | 🔴 52.63% | 🔴 9.37% | 🔴 56.28% |
| `frontend/src/pages/IntegrationsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/SessionPage.tsx` | 🟢 90.19% | 🟢 80.00% | 🔴 50.00% | 🟢 90.19% |
| `frontend/src/pages/SlackSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TeamsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TelemetryPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/services/api.ts` | 🔴 17.67% | 🟡 66.66% | 🔴 2.85% | 🔴 17.67% |
| `frontend/src/services/onboardingEvents.ts` | 🟢 100.00% | 🟢 100.00% | 🟡 75.00% | 🟢 100.00% |
| `frontend/src/services/onboardingStorage.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/services/socket.ts` | 🔴 8.92% | 🟢 100.00% | 🔴 11.11% | 🔴 8.92% |
| `frontend/src/types.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/utils/repoUtils.ts` | 🟢 96.49% | 🟢 95.65% | 🟢 100.00% | 🟢 96.49% |
| `frontend/src/utils/sessionUtils.ts` | 🟢 100.00% | 🟢 97.43% | 🟢 100.00% | 🟢 100.00% |
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
| `frontend/tests/e2e/sc-076-repo-card-links.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/sc-077-tool-call-count.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/session-detail-page.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/e2e/todo-panel.spec.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/tests/setup.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/vite.config.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/vitest.config.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |

## E2e mock - per file

*No coverage data available.*

## E2e real - per file

*No coverage data available.*

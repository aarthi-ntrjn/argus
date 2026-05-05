# Coverage Report

*Generated: May 4, 2026, 9:40 PM*

## Summary

| Suite | Files | Tests | Statements | Branches | Functions | Lines | Covers |
|-------|-------|-------|------------|----------|-----------|-------|--------|
| backend unit   | 179 | 🟢 476/476 | 🟡 60.19% | 🟡 74.34% | 🟡 69.97% | 🟡 60.19% | backend/src |
| frontend unit  | 124 | 🟢 353/353 | 🔴 36.60% | 🟡 77.94% | 🔴 49.85% | 🔴 36.60% | frontend/src |
| e2e mock       | 14 | 🟢 152/152 (2 skipped) | 🔴 54.97% | 🔴 49.12% | 🔴 48.92% | 🔴 55.31% | frontend/src |
| e2e real       | N/A | N/A | N/A | N/A | N/A | N/A | backend/src |

## Backend unit - per file

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `backend/scripts/check-actions.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/seed-test-thread.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/test-outbound.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/src/api/routes/fs.ts` | 🟡 76.81% | 🟡 79.16% | 🟢 100.00% | 🟡 76.81% |
| `backend/src/api/routes/health.ts` | 🟢 82.79% | 🔴 20.00% | 🔴 33.33% | 🟢 82.79% |
| `backend/src/api/routes/hooks.ts` | 🟢 87.80% | 🟢 90.90% | 🔴 50.00% | 🟢 87.80% |
| `backend/src/api/routes/integrations.ts` | 🔴 25.24% | 🟢 100.00% | 🔴 50.00% | 🔴 25.24% |
| `backend/src/api/routes/launcher.ts` | 🔴 5.90% | 🟢 100.00% | 🔴 33.33% | 🔴 5.90% |
| `backend/src/api/routes/metrics.ts` | 🔴 58.97% | 🟢 100.00% | 🟢 100.00% | 🔴 58.97% |
| `backend/src/api/routes/repositories.ts` | 🔴 50.42% | 🔴 58.33% | 🔴 50.00% | 🔴 50.42% |
| `backend/src/api/routes/sessions.ts` | 🔴 55.12% | 🔴 58.06% | 🟡 66.66% | 🔴 55.12% |
| `backend/src/api/routes/settings.ts` | 🟡 76.11% | 🟢 88.88% | 🟢 100.00% | 🟡 76.11% |
| `backend/src/api/routes/teams-settings.ts` | 🟡 62.50% | 🟢 100.00% | 🟢 100.00% | 🟡 62.50% |
| `backend/src/api/routes/telemetry.ts` | 🟢 100.00% | 🟢 90.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/api/routes/test-utils.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/api/routes/todos.ts` | 🟢 89.28% | 🟢 83.33% | 🟢 100.00% | 🟢 89.28% |
| `backend/src/api/routes/tools.ts` | 🔴 49.61% | 🟡 66.66% | 🟡 62.50% | 🔴 49.61% |
| `backend/src/api/routes/update.ts` | 🔴 47.16% | 🟡 60.00% | 🔴 50.00% | 🔴 47.16% |
| `backend/src/api/ws/event-dispatcher.ts` | 🔴 33.33% | 🔴 50.00% | 🔴 25.00% | 🔴 33.33% |
| `backend/src/cli/argus-launch-client.ts` | 🟢 83.33% | 🟡 75.75% | 🟢 85.71% | 🟢 83.33% |
| `backend/src/cli/launch-command-resolver.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/cli/launch.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/config/config-loader.ts` | 🟢 92.59% | 🟡 75.00% | 🟢 100.00% | 🟢 92.59% |
| `backend/src/config/slack-config-loader.ts` | 🟡 68.88% | 🟢 100.00% | 🔴 50.00% | 🟡 68.88% |
| `backend/src/config/teams-config-loader.ts` | 🔴 57.50% | 🔴 40.00% | 🔴 50.00% | 🔴 57.50% |
| `backend/src/constants/slack-events.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/db/database.ts` | 🔴 54.62% | 🟡 71.95% | 🔴 50.00% | 🔴 54.62% |
| `backend/src/db/schema.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/integration/slack/slack-listener.ts` | 🔴 48.76% | 🟢 85.71% | 🟡 63.63% | 🔴 48.76% |
| `backend/src/integration/slack/slack-notifier.ts` | 🔴 55.02% | 🟡 64.19% | 🟡 66.66% | 🔴 55.02% |
| `backend/src/integration/teams/teams-listener.ts` | 🔴 15.97% | 🟡 66.66% | 🔴 20.00% | 🔴 15.97% |
| `backend/src/integration/teams/teams-notifier.ts` | 🟢 80.35% | 🟡 67.08% | 🟢 83.33% | 🟢 80.35% |
| `backend/src/integration/teams/teams-sdk-adapter.ts` | 🔴 47.61% | 🟢 100.00% | 🟡 66.66% | 🔴 47.61% |
| `backend/src/models/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/server.ts` | 🔴 50.16% | 🔴 55.00% | 🟢 80.00% | 🔴 50.16% |
| `backend/src/services/claude-code-detector.ts` | 🟡 60.23% | 🟡 69.01% | 🔴 52.94% | 🟡 60.23% |
| `backend/src/services/claude-code-jsonl-parser.ts` | 🟢 86.95% | 🟡 69.56% | 🟢 100.00% | 🟢 86.95% |
| `backend/src/services/claude-jsonl-watcher.ts` | 🟢 96.15% | 🟢 94.11% | 🟢 85.71% | 🟢 96.15% |
| `backend/src/services/claude-session-registry.ts` | 🟢 100.00% | 🟢 81.25% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/copilot-cli-detector.ts` | 🟡 69.40% | 🟡 65.00% | 🟢 80.00% | 🟡 69.40% |
| `backend/src/services/copilot-cli-jsonl-parser.ts` | 🟢 94.92% | 🟢 92.53% | 🟢 100.00% | 🟢 94.92% |
| `backend/src/services/copilot-jsonl-watcher.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/integration-status.ts` | 🟡 78.57% | 🟡 75.00% | 🟢 100.00% | 🟡 78.57% |
| `backend/src/services/jsonl-watcher-base.ts` | 🟢 96.06% | 🟢 90.47% | 🟢 100.00% | 🟢 96.06% |
| `backend/src/services/message-queue.ts` | 🟢 86.84% | 🟢 90.90% | 🟢 80.00% | 🟢 86.84% |
| `backend/src/services/output-store.ts` | 🟢 86.11% | 🟢 86.66% | 🟢 83.33% | 🟢 86.11% |
| `backend/src/services/pending-choice-events.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/pid-validator.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/process-utils.ts` | 🔴 53.36% | 🔴 36.66% | 🟡 72.72% | 🔴 53.36% |
| `backend/src/services/pruning-job.ts` | 🔴 16.66% | 🟢 100.00% | 🔴 0.00% | 🔴 16.66% |
| `backend/src/services/pty-registry.ts` | 🟡 65.36% | 🟢 92.30% | 🟡 66.66% | 🟡 65.36% |
| `backend/src/services/repository-scanner.ts` | 🔴 42.47% | 🟢 92.85% | 🔴 25.00% | 🔴 42.47% |
| `backend/src/services/session-controller.ts` | 🔴 52.03% | 🟡 71.42% | 🟡 71.42% | 🔴 52.03% |
| `backend/src/services/session-diff-tracker.ts` | 🟢 93.75% | 🟢 84.21% | 🟢 100.00% | 🟢 93.75% |
| `backend/src/services/session-monitor.ts` | 🔴 54.29% | 🟡 69.56% | 🟡 68.75% | 🔴 54.29% |
| `backend/src/services/session-pid-resolver.ts` | 🟢 87.14% | 🟡 70.37% | 🟢 100.00% | 🟢 87.14% |
| `backend/src/services/telemetry-service.ts` | 🟢 94.73% | 🟢 88.23% | 🟢 85.71% | 🟢 94.73% |
| `backend/src/services/update-service.ts` | 🟢 92.61% | 🟡 65.90% | 🟢 84.61% | 🟢 92.61% |
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
| `frontend/src/components/LaunchDropdown/LaunchDropdown.tsx` | 🟡 60.41% | 🟡 71.42% | 🔴 53.84% | 🟡 60.41% |
| `frontend/src/components/MobileNav/MobileNav.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Onboarding/index.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/Onboarding/OnboardingTour.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/OutputPane/OutputPane.tsx` | 🟢 88.99% | 🟢 85.71% | 🟡 60.00% | 🟢 88.99% |
| `frontend/src/components/PendingChoicePanel/PendingChoicePanel.tsx` | 🔴 47.42% | 🔴 37.50% | 🔴 11.11% | 🔴 47.42% |
| `frontend/src/components/RemoveConfirmDialog.tsx` | 🔴 7.54% | 🟢 100.00% | 🔴 0.00% | 🔴 7.54% |
| `frontend/src/components/RepoCard/RepoCard.tsx` | 🔴 6.38% | 🟢 100.00% | 🔴 0.00% | 🔴 6.38% |
| `frontend/src/components/RepoContextBar/RepoContextBar.tsx` | 🔴 11.11% | 🟢 100.00% | 🔴 0.00% | 🔴 11.11% |
| `frontend/src/components/SectionHeading.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SessionCard/SessionCard.tsx` | 🟢 89.47% | 🟢 87.80% | 🔴 29.41% | 🟢 89.47% |
| `frontend/src/components/SessionDetail/SessionDetail.tsx` | 🟡 79.88% | 🟡 71.00% | 🔴 56.00% | 🟡 79.88% |
| `frontend/src/components/SessionDetail/sessionDetailUtils.ts` | 🟢 89.84% | 🟢 90.47% | 🟢 100.00% | 🟢 89.84% |
| `frontend/src/components/SessionMetaRow/SessionMetaRow.tsx` | 🟢 85.00% | 🟡 70.37% | 🟢 80.00% | 🟢 85.00% |
| `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx` | 🟢 90.97% | 🟡 75.00% | 🟢 83.33% | 🟢 90.97% |
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
| `frontend/src/hooks/useIntegrationControl.ts` | 🟡 75.00% | 🟢 100.00% | 🔴 33.33% | 🟡 75.00% |
| `frontend/src/hooks/useIsMobile.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useKillSession.ts` | 🟢 87.34% | 🟡 77.77% | 🟢 100.00% | 🟢 87.34% |
| `frontend/src/hooks/useOnboarding.ts` | 🟢 87.30% | 🟢 100.00% | 🟢 100.00% | 🟢 87.30% |
| `frontend/src/hooks/usePromptHistory.ts` | 🟢 97.36% | 🟢 95.12% | 🟢 83.33% | 🟢 97.36% |
| `frontend/src/hooks/useRepositoryManagement.ts` | 🟢 94.49% | 🟢 93.54% | 🟢 80.00% | 🟢 94.49% |
| `frontend/src/hooks/useSettings.ts` | 🟢 96.55% | 🟢 87.50% | 🟢 100.00% | 🟢 96.55% |
| `frontend/src/hooks/useSlackSettings.ts` | 🔴 57.14% | 🟢 100.00% | 🟢 100.00% | 🔴 57.14% |
| `frontend/src/hooks/useTeamsSettings.ts` | 🔴 58.06% | 🟢 100.00% | 🟢 100.00% | 🔴 58.06% |
| `frontend/src/hooks/useTodos.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useUpdateStatus.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/main.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/DashboardPage.tsx` | 🔴 55.34% | 🔴 53.73% | 🔴 10.00% | 🔴 55.34% |
| `frontend/src/pages/IntegrationsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/SessionPage.tsx` | 🟢 90.00% | 🟢 80.00% | 🔴 50.00% | 🟢 90.00% |
| `frontend/src/pages/SlackSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TeamsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TelemetryPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/services/api.ts` | 🔴 5.58% | 🟢 100.00% | 🔴 0.00% | 🔴 5.58% |
| `frontend/src/services/onboardingEvents.ts` | 🟢 100.00% | 🟢 100.00% | 🟡 75.00% | 🟢 100.00% |
| `frontend/src/services/onboardingStorage.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/services/socket.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
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
| `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx` | 🟢 85.71% | 🔴 56.25% | 🟢 100.00% | 🟢 85.71% |
| `frontend/src/components/LaunchDropdown/LaunchDropdown.tsx` | 🔴 24.61% | 🔴 11.90% | 🔴 15.78% | 🔴 26.22% |
| `frontend/src/components/MobileNav/MobileNav.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/Onboarding/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Onboarding/OnboardingTour.tsx` | 🟡 68.18% | 🔴 42.85% | 🟢 100.00% | 🟡 68.18% |
| `frontend/src/components/OutputPane/OutputPane.tsx` | 🟢 80.00% | 🟡 71.42% | 🟡 75.00% | 🟡 79.16% |
| `frontend/src/components/PendingChoicePanel/PendingChoicePanel.tsx` | 🔴 28.84% | 🔴 39.47% | 🔴 20.00% | 🔴 28.84% |
| `frontend/src/components/RemoveConfirmDialog.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/RepoCard/RepoCard.tsx` | 🔴 22.22% | 🟡 78.57% | 🔴 50.00% | 🔴 22.22% |
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
| `frontend/src/hooks/usePromptHistory.ts` | 🔴 57.33% | 🔴 43.33% | 🟡 66.66% | 🔴 56.52% |
| `frontend/src/hooks/useRepositoryManagement.ts` | 🔴 23.61% | 🔴 0.00% | 🔴 11.76% | 🔴 24.61% |
| `frontend/src/hooks/useSettings.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useSlackSettings.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/hooks/useTeamsSettings.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/hooks/useTodos.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useUpdateStatus.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/main.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/pages/DashboardPage.tsx` | 🟡 69.75% | 🔴 59.61% | 🔴 58.49% | 🟡 68.62% |
| `frontend/src/pages/IntegrationsSetupPage.tsx` | 🔴 44.44% | 🔴 0.00% | 🔴 7.69% | 🔴 46.15% |
| `frontend/src/pages/SessionPage.tsx` | 🟢 83.33% | 🟢 94.11% | 🔴 57.14% | 🟢 87.50% |
| `frontend/src/pages/TelemetryPage.tsx` | 🔴 20.00% | 🟢 100.00% | 🔴 0.00% | 🔴 20.00% |
| `frontend/src/services/api.ts` | 🔴 54.68% | 🔴 54.16% | 🔴 50.00% | 🔴 54.68% |
| `frontend/src/services/onboardingEvents.ts` | 🟢 100.00% | 🟢 100.00% | 🔴 25.00% | 🟢 100.00% |
| `frontend/src/services/onboardingStorage.ts` | 🟢 89.47% | 🟡 75.00% | 🟢 100.00% | 🟢 89.47% |
| `frontend/src/services/socket.ts` | 🔴 40.81% | 🔴 21.62% | 🔴 22.85% | 🔴 42.39% |
| `frontend/src/types.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/utils/repoUtils.ts` | 🔴 21.42% | 🔴 16.66% | 🟢 100.00% | 🔴 21.42% |
| `frontend/src/utils/sessionUtils.ts` | 🟢 100.00% | 🟢 80.00% | 🟢 100.00% | 🟢 100.00% |

## E2e real - per file

*No coverage data available.*

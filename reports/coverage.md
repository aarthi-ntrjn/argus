# Coverage Report

*Generated: May 4, 2026, 9:00 PM*

## Summary

| Suite | Files | Tests | Statements | Branches | Functions | Lines | Covers |
|-------|-------|-------|------------|----------|-----------|-------|--------|
| backend unit   | 179 | 🟢 476/476 | 🟡 63.08% | 🟡 74.83% | 🟡 69.97% | 🟡 63.08% | backend/src |
| frontend unit  | 124 | 🟢 353/353 | 🔴 34.75% | 🟡 78.25% | 🔴 50.00% | 🔴 34.75% | frontend/src |
| e2e mock       | 14 | 🟢 152/152 (2 skipped) | N/A | N/A | N/A | N/A | frontend/src |
| e2e real       | N/A | N/A | N/A | N/A | N/A | N/A | backend/src |

## Backend unit - per file

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `backend/scripts/check-actions.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/seed-test-thread.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/scripts/test-outbound.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `backend/src/api/routes/fs.ts` | 🟢 85.71% | 🟡 79.16% | 🟢 100.00% | 🟢 85.71% |
| `backend/src/api/routes/health.ts` | 🟢 86.30% | 🔴 20.00% | 🔴 33.33% | 🟢 86.30% |
| `backend/src/api/routes/hooks.ts` | 🟢 90.00% | 🟢 90.90% | 🔴 50.00% | 🟢 90.00% |
| `backend/src/api/routes/integrations.ts` | 🔴 29.03% | 🟢 100.00% | 🔴 50.00% | 🔴 29.03% |
| `backend/src/api/routes/launcher.ts` | 🔴 8.74% | 🟢 100.00% | 🔴 33.33% | 🔴 8.74% |
| `backend/src/api/routes/metrics.ts` | 🔴 57.14% | 🟢 100.00% | 🟢 100.00% | 🔴 57.14% |
| `backend/src/api/routes/repositories.ts` | 🔴 51.11% | 🔴 58.33% | 🔴 50.00% | 🔴 51.11% |
| `backend/src/api/routes/sessions.ts` | 🟡 61.43% | 🔴 58.06% | 🟡 66.66% | 🟡 61.43% |
| `backend/src/api/routes/settings.ts` | 🟢 80.00% | 🟢 88.88% | 🟢 100.00% | 🟢 80.00% |
| `backend/src/api/routes/teams-settings.ts` | 🟡 60.00% | 🟢 100.00% | 🟢 100.00% | 🟡 60.00% |
| `backend/src/api/routes/telemetry.ts` | 🟢 100.00% | 🟢 90.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/api/routes/test-utils.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/api/routes/todos.ts` | 🟢 87.50% | 🟢 83.33% | 🟢 100.00% | 🟢 87.50% |
| `backend/src/api/routes/tools.ts` | 🔴 50.80% | 🟡 66.66% | 🟡 62.50% | 🔴 50.80% |
| `backend/src/api/routes/update.ts` | 🔴 47.16% | 🟡 60.00% | 🔴 50.00% | 🔴 47.16% |
| `backend/src/api/ws/event-dispatcher.ts` | 🔴 33.33% | 🔴 50.00% | 🔴 25.00% | 🔴 33.33% |
| `backend/src/cli/argus-launch-client.ts` | 🟢 84.46% | 🟡 75.75% | 🟢 85.71% | 🟢 84.46% |
| `backend/src/cli/launch-command-resolver.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/cli/launch.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `backend/src/config/config-loader.ts` | 🟢 98.03% | 🟡 75.00% | 🟢 100.00% | 🟢 98.03% |
| `backend/src/config/slack-config-loader.ts` | 🟡 71.79% | 🟢 100.00% | 🔴 50.00% | 🟡 71.79% |
| `backend/src/config/teams-config-loader.ts` | 🟡 63.88% | 🔴 40.00% | 🔴 50.00% | 🟡 63.88% |
| `backend/src/constants/slack-events.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/db/database.ts` | 🟡 61.07% | 🟡 71.95% | 🔴 50.00% | 🟡 61.07% |
| `backend/src/db/schema.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/integration/slack/slack-listener.ts` | 🔴 58.65% | 🟢 85.71% | 🟡 63.63% | 🔴 58.65% |
| `backend/src/integration/slack/slack-notifier.ts` | 🔴 57.62% | 🟡 64.19% | 🟡 66.66% | 🔴 57.62% |
| `backend/src/integration/teams/teams-listener.ts` | 🔴 20.26% | 🟡 66.66% | 🔴 20.00% | 🔴 20.26% |
| `backend/src/integration/teams/teams-notifier.ts` | 🟢 81.78% | 🟡 67.08% | 🟢 83.33% | 🟢 81.78% |
| `backend/src/integration/teams/teams-sdk-adapter.ts` | 🔴 47.61% | 🟢 100.00% | 🟡 66.66% | 🔴 47.61% |
| `backend/src/models/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/server.ts` | 🟡 61.25% | 🔴 55.00% | 🟢 80.00% | 🟡 61.25% |
| `backend/src/services/claude-code-detector.ts` | 🟡 66.13% | 🟡 78.84% | 🔴 52.94% | 🟡 66.13% |
| `backend/src/services/claude-code-jsonl-parser.ts` | 🟢 90.32% | 🟡 69.56% | 🟢 100.00% | 🟢 90.32% |
| `backend/src/services/claude-jsonl-watcher.ts` | 🟢 94.64% | 🟢 94.11% | 🟢 85.71% | 🟢 94.64% |
| `backend/src/services/claude-session-registry.ts` | 🟢 100.00% | 🟢 81.25% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/copilot-cli-detector.ts` | 🟡 78.05% | 🟡 65.00% | 🟢 80.00% | 🟡 78.05% |
| `backend/src/services/copilot-cli-jsonl-parser.ts` | 🟢 96.42% | 🟢 92.53% | 🟢 100.00% | 🟢 96.42% |
| `backend/src/services/copilot-jsonl-watcher.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/integration-status.ts` | 🟡 76.19% | 🟡 75.00% | 🟢 100.00% | 🟡 76.19% |
| `backend/src/services/jsonl-watcher-base.ts` | 🟢 97.00% | 🟢 90.47% | 🟢 100.00% | 🟢 97.00% |
| `backend/src/services/message-queue.ts` | 🟢 86.11% | 🟢 90.90% | 🟢 80.00% | 🟢 86.11% |
| `backend/src/services/output-store.ts` | 🟢 86.66% | 🟢 86.66% | 🟢 83.33% | 🟢 86.66% |
| `backend/src/services/pending-choice-events.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/pid-validator.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/process-utils.ts` | 🔴 58.43% | 🔴 36.66% | 🟡 72.72% | 🔴 58.43% |
| `backend/src/services/pruning-job.ts` | 🔴 20.83% | 🟢 100.00% | 🔴 0.00% | 🔴 20.83% |
| `backend/src/services/pty-registry.ts` | 🟡 66.87% | 🟢 92.30% | 🟡 66.66% | 🟡 66.87% |
| `backend/src/services/repository-scanner.ts` | 🔴 41.41% | 🟢 92.85% | 🔴 25.00% | 🔴 41.41% |
| `backend/src/services/session-controller.ts` | 🟡 61.53% | 🟡 71.42% | 🟡 71.42% | 🟡 61.53% |
| `backend/src/services/session-diff-tracker.ts` | 🟢 100.00% | 🟢 84.21% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/session-monitor.ts` | 🔴 58.09% | 🟡 69.56% | 🟡 68.75% | 🔴 58.09% |
| `backend/src/services/session-pid-resolver.ts` | 🟢 100.00% | 🟡 70.37% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/services/telemetry-service.ts` | 🟢 93.81% | 🟢 88.23% | 🟢 85.71% | 🟢 93.81% |
| `backend/src/services/update-service.ts` | 🟢 91.47% | 🟡 65.90% | 🟢 84.61% | 🟢 91.47% |
| `backend/src/services/watcher-session-helpers.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/utils/logger.ts` | 🟢 100.00% | 🟡 73.68% | 🟢 100.00% | 🟢 100.00% |
| `backend/src/utils/path-sandbox.ts` | 🟡 76.47% | 🔴 57.14% | 🟢 100.00% | 🟡 76.47% |
| `backend/start-test-server.mjs` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |

## Frontend unit - per file

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `frontend/postcss.config.js` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/App.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/ArgusLogo.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Badge.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/BrandIcons.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Button.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Checkbox.tsx` | 🟢 100.00% | 🟢 90.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/FolderInputDialog/FolderInputDialog.tsx` | 🔴 4.00% | 🟢 100.00% | 🔴 0.00% | 🔴 4.00% |
| `frontend/src/components/IntegrationButton/IntegrationButton.tsx` | 🔴 9.09% | 🟢 100.00% | 🔴 0.00% | 🔴 9.09% |
| `frontend/src/components/IntegrationStatusIcon.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx` | 🟢 100.00% | 🟢 84.61% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/LaunchDropdown/LaunchDropdown.tsx` | 🟡 63.80% | 🟡 71.42% | 🔴 53.84% | 🟡 63.80% |
| `frontend/src/components/MobileNav/MobileNav.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/Onboarding/index.ts` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/Onboarding/OnboardingTour.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/OutputPane/OutputPane.tsx` | 🟢 92.95% | 🟢 85.71% | 🟡 60.00% | 🟢 92.95% |
| `frontend/src/components/PendingChoicePanel/PendingChoicePanel.tsx` | 🔴 52.11% | 🔴 43.75% | 🔴 11.11% | 🔴 52.11% |
| `frontend/src/components/RemoveConfirmDialog.tsx` | 🔴 8.69% | 🟢 100.00% | 🔴 0.00% | 🔴 8.69% |
| `frontend/src/components/RepoCard/RepoCard.tsx` | 🔴 8.10% | 🟢 100.00% | 🔴 0.00% | 🔴 8.10% |
| `frontend/src/components/RepoContextBar/RepoContextBar.tsx` | 🔴 11.11% | 🟢 100.00% | 🔴 0.00% | 🔴 11.11% |
| `frontend/src/components/SectionHeading.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SessionCard/SessionCard.tsx` | 🟢 100.00% | 🟢 90.24% | 🔴 29.41% | 🟢 100.00% |
| `frontend/src/components/SessionDetail/SessionDetail.tsx` | 🟢 83.13% | 🟡 71.00% | 🔴 56.00% | 🟢 83.13% |
| `frontend/src/components/SessionDetail/sessionDetailUtils.ts` | 🟢 91.34% | 🟢 90.47% | 🟢 100.00% | 🟢 91.34% |
| `frontend/src/components/SessionMetaRow/SessionMetaRow.tsx` | 🟢 92.59% | 🟡 70.37% | 🟢 80.00% | 🟢 92.59% |
| `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx` | 🟢 93.85% | 🟡 75.00% | 🟢 83.33% | 🟢 93.85% |
| `frontend/src/components/SessionTypeIcon/SessionTypeIcon.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsDialog/DialogLinkItem.tsx` | 🔴 12.50% | 🟢 100.00% | 🔴 0.00% | 🔴 12.50% |
| `frontend/src/components/SettingsDialog/GeneralSettingsContent.tsx` | 🟢 94.17% | 🟢 88.63% | 🟢 80.00% | 🟢 94.17% |
| `frontend/src/components/SettingsDialog/IntegrationConfigContent.tsx` | 🟢 93.12% | 🟢 82.92% | 🟢 85.71% | 🟢 93.12% |
| `frontend/src/components/SettingsDialog/SettingsDialog.tsx` | 🔴 51.16% | 🔴 25.00% | 🔴 25.00% | 🔴 51.16% |
| `frontend/src/components/SettingsPanel/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/SettingsPanel/SettingsPanel.tsx` | 🟢 90.90% | 🟢 85.71% | 🟢 100.00% | 🟢 90.90% |
| `frontend/src/components/SetupPage/SetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/components/TelemetryBanner/index.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/TelemetryBanner/TelemetryBanner.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/TodoPanel/TodoPanel.tsx` | 🟢 86.01% | 🟢 90.36% | 🟡 78.26% | 🟢 86.01% |
| `frontend/src/components/ToggleIconButton.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/UpdateBadge/UpdateBadge.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/components/YoloWarningDialog/YoloWarningDialog.tsx` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/config/dashboardTourSteps.ts` | 🔴 0.00% | 🟢 100.00% | 🟢 100.00% | 🔴 0.00% |
| `frontend/src/config/feedback.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useArgusSettings.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useIntegrationControl.ts` | 🟡 67.85% | 🟢 100.00% | 🔴 33.33% | 🟡 67.85% |
| `frontend/src/hooks/useIsMobile.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useKillSession.ts` | 🟢 89.33% | 🟡 76.47% | 🟢 100.00% | 🟢 89.33% |
| `frontend/src/hooks/useOnboarding.ts` | 🟢 87.30% | 🟢 100.00% | 🟢 100.00% | 🟢 87.30% |
| `frontend/src/hooks/usePromptHistory.ts` | 🟢 97.24% | 🟢 95.12% | 🟢 83.33% | 🟢 97.24% |
| `frontend/src/hooks/useRepositoryManagement.ts` | 🟢 96.00% | 🟢 93.54% | 🟢 80.00% | 🟢 96.00% |
| `frontend/src/hooks/useSettings.ts` | 🟢 100.00% | 🟢 87.50% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useSlackSettings.ts` | 🔴 53.84% | 🟢 100.00% | 🟢 100.00% | 🔴 53.84% |
| `frontend/src/hooks/useTeamsSettings.ts` | 🔴 53.84% | 🟢 100.00% | 🟢 100.00% | 🔴 53.84% |
| `frontend/src/hooks/useTodos.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/hooks/useUpdateStatus.ts` | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% | 🟢 100.00% |
| `frontend/src/main.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/DashboardPage.tsx` | 🔴 58.09% | 🔴 53.73% | 🔴 10.00% | 🔴 58.09% |
| `frontend/src/pages/IntegrationsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/SessionPage.tsx` | 🟢 91.01% | 🟢 80.00% | 🔴 50.00% | 🟢 91.01% |
| `frontend/src/pages/SlackSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TeamsSetupPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/pages/TelemetryPage.tsx` | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% | 🔴 0.00% |
| `frontend/src/services/api.ts` | 🔴 7.09% | 🟢 100.00% | 🔴 0.00% | 🔴 7.09% |
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

*No coverage data available.*

## E2e real - per file

*No coverage data available.*

import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('argus:onboarding', JSON.stringify({
      schemaVersion: 1, userId: null,
      dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
      sessionHints: { dismissed: [] },
    }));
  });
});

const REPO = {
  id: 'r-sc077',
  name: 'demo-project',
  path: 'C:\\projects\\demo-project',
  source: 'ui',
  addedAt: new Date().toISOString(),
  lastScannedAt: null,
};

const SESSION_TOOL_ONLY = {
  id: 'session-sc077-tool-only',
  repositoryId: 'r-sc077',
  type: 'claude-code',
  pid: null,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: 'Analyzing codebase',
  expiresAt: null,
  model: 'claude-opus-4-5',
  launchMode: 'detected',
};

const SESSION_TEXT_PLUS = {
  id: 'session-sc077-text-plus',
  repositoryId: 'r-sc077',
  type: 'copilot-cli',
  pid: 1234,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: 'Scaffolding endpoints',
  expiresAt: null,
  model: null,
  launchMode: null,
};

const TOOL_USE_ITEMS = [
  { id: 'o-t1', sessionId: SESSION_TOOL_ONLY.id, timestamp: new Date().toISOString(), type: 'tool_use', role: null, content: '', toolName: 'bash', toolCallId: 'tc-1', sequenceNumber: 1 },
  { id: 'o-t2', sessionId: SESSION_TOOL_ONLY.id, timestamp: new Date().toISOString(), type: 'tool_use', role: null, content: '', toolName: 'read_file', toolCallId: 'tc-2', sequenceNumber: 2 },
  { id: 'o-t3', sessionId: SESSION_TOOL_ONLY.id, timestamp: new Date().toISOString(), type: 'tool_use', role: null, content: '', toolName: 'write_file', toolCallId: 'tc-3', sequenceNumber: 3 },
];

const TEXT_PLUS_ITEMS = [
  { id: 'o-msg', sessionId: SESSION_TEXT_PLUS.id, timestamp: new Date().toISOString(), type: 'message', role: 'assistant', content: 'Starting analysis...', toolName: null, toolCallId: null, sequenceNumber: 1 },
  { id: 'o-tu1', sessionId: SESSION_TEXT_PLUS.id, timestamp: new Date().toISOString(), type: 'tool_use', role: null, content: '', toolName: 'grep', toolCallId: 'tc-a', sequenceNumber: 2 },
  { id: 'o-tu2', sessionId: SESSION_TEXT_PLUS.id, timestamp: new Date().toISOString(), type: 'tool_use', role: null, content: '', toolName: 'bash', toolCallId: 'tc-b', sequenceNumber: 3 },
];

type Page = import('@playwright/test').Page;

async function mockApis(page: Page, sessions: unknown[], outputMap: Record<string, unknown[]>) {
  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([REPO]) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(sessions) })
    ),
    ...(sessions as Array<{ id: string }>).map(s =>
      page.route(`**/api/v1/sessions/${s.id}/output**`, route =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            items: outputMap[s.id] ?? [],
            nextBefore: null,
            total: (outputMap[s.id] ?? []).length,
          }),
        })
      )
    ),
  ]);
}

// SC-001: Session card shows tool call count when only tool_use events present
test.describe('SC-077: Tool call count in session card preview', () => {

  test('preview shows tool count badge when only tool_use items and no assistant message', async ({ page }) => {
    await mockApis(page, [SESSION_TOOL_ONLY], { [SESSION_TOOL_ONLY.id]: TOOL_USE_ITEMS });
    await page.goto('/');
    await expect(page.getByText(/3 tools/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('preview shows assistant text with tool count badge when text-plus-count state', async ({ page }) => {
    await mockApis(page, [SESSION_TEXT_PLUS], { [SESSION_TEXT_PLUS.id]: TEXT_PLUS_ITEMS });
    await page.goto('/');
    await expect(page.getByText('Starting analysis...').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/2 tools/i).first()).toBeVisible({ timeout: 5000 });
  });

});

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

const REPOS = [
  { id: 'repo-1', name: 'my-project', path: 'C:\\projects\\my-project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
];

const SESSION = {
  id: 'session-think-001', repositoryId: 'repo-1', type: 'claude-code', pid: null,
  status: 'active', startedAt: new Date().toISOString(), endedAt: null,
  lastActivityAt: new Date().toISOString(), summary: 'Thinking session', expiresAt: null,
  model: 'claude-opus-4-5',
};

const SESSION_NO_THINK = {
  id: 'session-plain-002', repositoryId: 'repo-1', type: 'claude-code', pid: null,
  status: 'active', startedAt: new Date().toISOString(), endedAt: null,
  lastActivityAt: new Date().toISOString(), summary: 'Plain session', expiresAt: null,
  model: 'claude-haiku-4-5-20251001',
};

const THINKING_OUTPUT = [
  { id: 'o-1', sessionId: 'session-think-001', timestamp: new Date().toISOString(), type: 'thinking', content: 'Let me analyze the codebase carefully.', toolName: null, sequenceNumber: 1, role: null },
  { id: 'o-2', sessionId: 'session-think-001', timestamp: new Date().toISOString(), type: 'message', content: 'Here is my answer.', toolName: null, sequenceNumber: 2, role: 'assistant' },
  { id: 'o-3', sessionId: 'session-think-001', timestamp: new Date().toISOString(), type: 'tool_use', content: 'src/App.tsx', toolName: 'Read', sequenceNumber: 3, role: null },
];

const REDACTED_OUTPUT = [
  { id: 'r-1', sessionId: 'session-think-001', timestamp: new Date().toISOString(), type: 'thinking', content: '[redacted]', toolName: null, sequenceNumber: 1, role: null },
];

const PLAIN_OUTPUT = [
  { id: 'p-1', sessionId: 'session-plain-002', timestamp: new Date().toISOString(), type: 'message', content: 'Plain reply.', toolName: null, sequenceNumber: 1, role: 'assistant' },
];

async function mockThinkingApis(page: import('@playwright/test').Page, outputItems = THINKING_OUTPUT) {
  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([SESSION]) })
    ),
    page.route('**/api/v1/sessions/session-think-001/output**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: outputItems, nextBefore: null, total: outputItems.length }) })
    ),
    page.route('**/api/v1/sessions/session-think-001', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION) })
    ),
  ]);
}

test.describe('SC-074: Thinking Events in Output Stream and Preview', () => {

  // ─── Output pane — verbose mode ────────────────────────────────────────────

  test('output pane shows THINK badge for thinking items in verbose mode', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ outputDisplayMode: 'verbose' }));
    });
    await mockThinkingApis(page);
    await page.goto('/');
    await expect(page.getByText('Thinking session')).toBeVisible({ timeout: 5000 });
    await page.getByText('Thinking session').click();
    const outputPane = page.getByRole('region', { name: /session output/i });
    await expect(outputPane).toBeVisible({ timeout: 3000 });
    await expect(outputPane.getByText('THINK', { exact: true })).toBeVisible({ timeout: 2000 });
    await expect(outputPane.getByText('Let me analyze the codebase carefully.')).toBeVisible();
  });

  test('output pane shows (redacted) placeholder for redacted thinking in verbose mode', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ outputDisplayMode: 'verbose' }));
    });
    await mockThinkingApis(page, REDACTED_OUTPUT);
    await page.goto('/');
    await expect(page.getByText('Thinking session')).toBeVisible({ timeout: 5000 });
    await page.getByText('Thinking session').click();
    const outputPane = page.getByRole('region', { name: /session output/i });
    await expect(outputPane).toBeVisible({ timeout: 3000 });
    await expect(outputPane.getByText('THINK', { exact: true })).toBeVisible({ timeout: 2000 });
    await expect(outputPane.getByText('(redacted)')).toBeVisible();
  });

  // ─── Output pane — focused mode ────────────────────────────────────────────

  test('output pane shows thinking collapsed in focused mode with expand button', async ({ page }) => {
    await mockThinkingApis(page);
    await page.goto('/');
    await expect(page.getByText('Thinking session')).toBeVisible({ timeout: 5000 });
    await page.getByText('Thinking session').click();
    const outputPane = page.getByRole('region', { name: /session output/i });
    await expect(outputPane).toBeVisible({ timeout: 3000 });
    // Thinking badge visible but content hidden
    await expect(outputPane.getByText('THINK', { exact: true })).toBeVisible({ timeout: 2000 });
    await expect(outputPane.getByText('Let me analyze the codebase carefully.')).not.toBeVisible();
    await expect(outputPane.getByRole('button', { name: /expand thinking/i })).toBeVisible();
  });

  test('output pane reveals thinking content after clicking expand in focused mode', async ({ page }) => {
    await mockThinkingApis(page);
    await page.goto('/');
    await expect(page.getByText('Thinking session')).toBeVisible({ timeout: 5000 });
    await page.getByText('Thinking session').click();
    const outputPane = page.getByRole('region', { name: /session output/i });
    await expect(outputPane).toBeVisible({ timeout: 3000 });
    await outputPane.getByRole('button', { name: /expand thinking/i }).click();
    await expect(outputPane.getByText('Let me analyze the codebase carefully.')).toBeVisible();
  });

  // ─── Session card preview ───────────────────────────────────────────────────

  test('session card preview shows thinking content when thinking events present', async ({ page }) => {
    await mockThinkingApis(page);
    await page.goto('/');
    await expect(page.getByText('Thinking session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Let me analyze the codebase carefully.')).toBeVisible();
    // Message content should NOT be shown as preview
    await expect(page.getByText('Here is my answer.')).not.toBeVisible();
  });

  test('session card shows tool call count when tool_use events present', async ({ page }) => {
    await mockThinkingApis(page);
    await page.goto('/');
    await expect(page.getByText('Thinking session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/1 tool call/)).toBeVisible();
  });

  test('session card with no thinking or tools is visually unchanged (regression)', async ({ page }) => {
    await Promise.all([
      page.route('**/api/v1/repositories', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS) })
      ),
      page.route('**/api/v1/sessions**', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify([SESSION_NO_THINK]) })
      ),
      page.route('**/api/v1/sessions/session-plain-002/output**', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: PLAIN_OUTPUT, nextBefore: null, total: PLAIN_OUTPUT.length }) })
      ),
      page.route('**/api/v1/sessions/session-plain-002', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_NO_THINK) })
      ),
    ]);
    await page.goto('/');
    await expect(page.getByText('Plain session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Plain reply.')).toBeVisible();
    await expect(page.getByText(/tool call/)).not.toBeVisible();
  });

});

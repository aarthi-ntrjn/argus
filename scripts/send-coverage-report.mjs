#!/usr/bin/env node
/**
 * Reads the four coverage-summary.json files produced by test:coverage:all
 * and sends a formatted summary to Slack and/or Teams.
 *
 * Config is sourced from ~/.argus/slack.config and ~/.argus/teams.config
 * (same files used by the Argus backend) plus any env vars that override them.
 * The script exits cleanly and skips platforms that are not configured.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// ---------------------------------------------------------------------------
// Coverage data
// ---------------------------------------------------------------------------

const SUITES = [
  {
    name: 'Backend unit',
    coverageFile: 'backend/coverage/coverage-summary.json',
    resultsFile: 'backend/coverage/test-results.json',
    resultsFormat: 'vitest',
  },
  {
    name: 'Frontend unit',
    coverageFile: 'frontend/coverage/coverage-summary.json',
    resultsFile: 'frontend/coverage/test-results.json',
    resultsFormat: 'vitest',
  },
  {
    name: 'E2E mock',
    coverageFile: 'frontend/coverage-e2e/coverage-summary.json',
    resultsFile: 'frontend/coverage-e2e/test-results.json',
    resultsFormat: 'playwright',
  },
  {
    name: 'E2E real',
    coverageFile: 'backend/coverage-e2e/coverage-summary.json',
    resultsFile: 'backend/coverage-e2e/test-results.json',
    resultsFormat: 'playwright',
  },
];

function readJSON(relPath) {
  const abs = join(root, relPath);
  if (!existsSync(abs)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function parseResults(data, format) {
  if (!data) {
    return { tests: 'N/A', failed: 0 };
  }
  if (format === 'vitest') {
    const passed = data.numPassedTests ?? 0;
    const total = data.numTotalTests ?? 0;
    const failed = data.numFailedTests ?? 0;
    return { tests: `${passed}/${total}`, failed };
  }
  if (format === 'playwright') {
    const s = data.stats ?? {};
    const passed = s.expected ?? 0;
    const failed = s.unexpected ?? 0;
    const skipped = s.skipped ?? 0;
    const skipNote = skipped > 0 ? ` (${skipped} skipped)` : '';
    return { tests: `${passed}/${passed + failed}${skipNote}`, failed };
  }
  return { tests: 'N/A', failed: 0 };
}

function pct(val) {
  return typeof val === 'number' ? `${val.toFixed(1)}%` : 'N/A';
}

function statusEmoji(val) {
  if (typeof val !== 'number') {
    return '⬜';
  }
  if (val >= 80) {
    return '🟢';
  }
  if (val >= 60) {
    return '🟡';
  }
  return '🔴';
}

const loaded = SUITES.map((s) => ({
  suite: s,
  coverage: readJSON(s.coverageFile),
  results: parseResults(readJSON(s.resultsFile), s.resultsFormat),
}));

const hasAny = loaded.some(({ coverage }) => coverage !== null);
if (!hasAny) {
  console.log('No coverage data found — skipping notification.');
  process.exit(0);
}

const generated = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

// ---------------------------------------------------------------------------
// Config loading (mirrors the backend config loaders)
// ---------------------------------------------------------------------------

function loadSlackConfig() {
  const filePath = join(homedir(), '.argus', 'slack.config');
  let file = {};
  if (existsSync(filePath)) {
    try {
      file = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      /* unreadable */
    }
  }
  const botToken = process.env.SLACK_BOT_TOKEN ?? file.botToken ?? '';
  const channelId = process.env.SLACK_CHANNEL_ID ?? file.channelId ?? '';
  const enabled = file.enabled !== false;
  if (!botToken || !channelId || !enabled) {
    return null;
  }
  return { botToken, channelId };
}

function loadTeamsConfig() {
  const filePath = join(homedir(), '.argus', 'teams.config');
  let file = {};
  if (existsSync(filePath)) {
    try {
      file = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      /* unreadable */
    }
  }

  // Incoming webhook URL — simplest option, no OAuth needed.
  const webhookUrl = process.env.TEAMS_INCOMING_WEBHOOK_URL ?? file.incomingWebhookUrl ?? '';
  if (webhookUrl) {
    return { mode: 'webhook', webhookUrl };
  }

  // Graph API — requires ChannelMessage.Send app permission on the Azure AD app.
  const clientId = process.env.CLIENT_ID ?? file.clientId ?? '';
  const clientSecret = process.env.CLIENT_SECRET ?? file.clientSecret ?? '';
  const tenantId = process.env.TENANT_ID ?? file.tenantId ?? '';
  const teamId = process.env.TEAMS_TEAM_ID ?? file.teamId ?? '';
  const channelId = process.env.TEAMS_CHANNEL_ID ?? file.channelId ?? '';
  const enabled = (process.env.TEAMS_ENABLED ?? String(file.enabled ?? 'false')) === 'true';
  if (!clientId || !clientSecret || !tenantId || !teamId || !channelId || !enabled) {
    return null;
  }
  return { mode: 'graph', clientId, clientSecret, tenantId, teamId, channelId };
}

// ---------------------------------------------------------------------------
// Slack sender
// ---------------------------------------------------------------------------

async function sendSlack(config) {
  const { WebClient } = await import('@slack/web-api');
  const client = new WebClient(config.botToken);

  const blocks = buildSlackBlocks();
  const fallback = buildPlainText();
  try {
    await client.chat.postMessage({
      channel: config.channelId,
      text: fallback,
      blocks,
    });
    console.log('Coverage report posted to Slack.');
  } catch (err) {
    console.error('Failed to post coverage report to Slack:', err.message ?? err);
  }
}

function buildSlackBlocks() {
  const rows = loaded.map(({ suite, coverage, results }) => {
    if (!coverage) {
      return { type: 'mrkdwn', text: `*${suite.name}*: no data` };
    }
    const t = coverage.total;
    const lines = pct(t.lines?.pct);
    const stmts = pct(t.statements?.pct);
    const branches = pct(t.branches?.pct);
    const funcs = pct(t.functions?.pct);
    const icon = statusEmoji(t.lines?.pct);
    const testStatus = results.failed > 0 ? '🔴' : '🟢';
    return {
      type: 'mrkdwn',
      text: `${icon} *${suite.name}*\n${testStatus} Tests: ${results.tests} | Lines: ${lines} | Stmts: ${stmts} | Branches: ${branches} | Funcs: ${funcs}`,
    };
  });

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Coverage Report', emoji: false },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Generated: ${generated}` }],
    },
    { type: 'divider' },
    ...rows.map((field) => ({
      type: 'section',
      text: field,
    })),
  ];
}

function buildPlainText() {
  const lines = loaded
    .filter(({ coverage }) => coverage !== null)
    .map(({ suite, coverage, results }) => {
      const t = coverage.total;
      return `${suite.name}: Tests ${results.tests} | Lines ${pct(t.lines?.pct)} | Stmts ${pct(t.statements?.pct)} | Branches ${pct(t.branches?.pct)} | Funcs ${pct(t.functions?.pct)}`;
    });
  return `Coverage Report (${generated})\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Teams sender (Microsoft Graph API)
// ---------------------------------------------------------------------------

async function sendTeams(config) {
  if (config.mode === 'webhook') {
    await sendTeamsWebhook(config.webhookUrl);
  } else {
    await sendTeamsGraph(config);
  }
}

async function sendTeamsWebhook(webhookUrl) {
  const body = buildTeamsWebhookBody();
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Teams webhook failed (${res.status}): ${text}`);
      return;
    }
    console.log('Coverage report posted to Teams (webhook).');
  } catch (err) {
    console.error('Failed to post coverage report to Teams webhook:', err.message ?? err);
  }
}

async function sendTeamsGraph(config) {
  let ConfidentialClientApplication;
  try {
    ({ ConfidentialClientApplication } = await import('@azure/msal-node'));
  } catch {
    console.error('Teams send skipped: @azure/msal-node not available.');
    return;
  }

  const msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });

  let token;
  try {
    const result = await msalApp.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    token = result?.accessToken;
  } catch (err) {
    console.error('Teams send skipped: failed to acquire token:', err.message ?? err);
    return;
  }

  if (!token) {
    console.error('Teams send skipped: no access token returned.');
    return;
  }

  const body = buildTeamsGraphBody();
  const url = `https://graph.microsoft.com/v1.0/teams/${config.teamId}/channels/${config.channelId}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Teams send failed (${res.status}): ${text}`);
      return;
    }
    console.log('Coverage report posted to Teams.');
  } catch (err) {
    console.error('Failed to post coverage report to Teams:', err.message ?? err);
  }
}

function buildTeamsWebhookBody() {
  const facts = loaded
    .filter(({ coverage }) => coverage !== null)
    .map(({ suite, coverage, results }) => {
      const t = coverage.total;
      const icon = statusEmoji(t.lines?.pct);
      const testStatus = results.failed > 0 ? '🔴' : '🟢';
      return {
        name: `${icon} ${suite.name}`,
        value: `${testStatus} Tests: ${results.tests} | Lines: ${pct(t.lines?.pct)} | Stmts: ${pct(t.statements?.pct)} | Branches: ${pct(t.branches?.pct)} | Funcs: ${pct(t.functions?.pct)}`,
      };
    });

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '0076D7',
    summary: 'Coverage Report',
    sections: [
      {
        activityTitle: 'Coverage Report',
        activitySubtitle: `Generated: ${generated}`,
        facts,
      },
    ],
  };
}

function buildTeamsGraphBody() {
  const rows = loaded
    .map(({ suite, coverage, results }) => {
      if (!coverage) {
        return `<tr><td>${suite.name}</td><td>${results.tests}</td><td>N/A</td><td>N/A</td><td>N/A</td><td>N/A</td></tr>`;
      }
      const t = coverage.total;
      const statusIcon = statusEmoji(t.lines?.pct);
      const testStatus = results.failed > 0 ? '🔴' : '🟢';
      return `<tr><td>${statusIcon} ${suite.name}</td><td>${testStatus} ${results.tests}</td><td>${pct(t.statements?.pct)}</td><td>${pct(t.branches?.pct)}</td><td>${pct(t.functions?.pct)}</td><td>${pct(t.lines?.pct)}</td></tr>`;
    })
    .join('');

  const html = `<h2>Coverage Report</h2><p><em>Generated: ${generated}</em></p><table><tr><th>Suite</th><th>Tests</th><th>Statements</th><th>Branches</th><th>Functions</th><th>Lines</th></tr>${rows}</table>`;

  return {
    body: {
      contentType: 'html',
      content: html,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const slackConfig = loadSlackConfig();
const teamsConfig = loadTeamsConfig();

if (!slackConfig && !teamsConfig) {
  console.log(
    'No integrations configured (Slack or Teams). Skipping coverage notification.\n' +
      'Configure via ~/.argus/slack.config, ~/.argus/teams.config, or env vars.',
  );
  process.exit(0);
}

const tasks = [];
if (slackConfig) {
  tasks.push(sendSlack(slackConfig));
}
if (teamsConfig) {
  tasks.push(sendTeams(teamsConfig));
}
await Promise.all(tasks);

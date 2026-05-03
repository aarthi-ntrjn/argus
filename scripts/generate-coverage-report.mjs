#!/usr/bin/env node
/**
 * Reads the four coverage-summary.json files produced by the coverage scripts
 * and writes reports/coverage.md with a summary table plus a per-file breakdown
 * for each suite.
 *
 * Also reads test result JSON files (vitest JSON reporter / Playwright JSON
 * reporter) to include file count and pass/total in the summary table.
 * Missing files produce N/A values.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';

const root = resolve(import.meta.dirname, '..');
const today = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const SUITES = [
  {
    name: 'backend unit',
    covers: 'backend/src',
    coverageFile: 'backend/coverage/coverage-summary.json',
    resultsFile: 'backend/coverage/test-results.json',
    resultsFormat: 'vitest',
  },
  {
    name: 'frontend unit',
    covers: 'frontend/src',
    coverageFile: 'frontend/coverage/coverage-summary.json',
    resultsFile: 'frontend/coverage/test-results.json',
    resultsFormat: 'vitest',
  },
  {
    name: 'e2e mock',
    covers: 'frontend/src',
    coverageFile: 'frontend/coverage-e2e/coverage-summary.json',
    resultsFile: 'frontend/coverage-e2e/test-results.json',
    resultsFormat: 'playwright',
  },
  {
    name: 'e2e real',
    covers: 'backend/src',
    coverageFile: 'backend/coverage-e2e/coverage-summary.json',
    resultsFile: 'backend/coverage-e2e/test-results.json',
    resultsFormat: 'playwright',
  },
];

function pct(val) {
  return typeof val === 'number' ? `${val.toFixed(2)}%` : 'N/A';
}

function badge(val) {
  if (typeof val !== 'number') return '⬜';
  if (val >= 80) return '🟢';
  if (val >= 60) return '🟡';
  return '🔴';
}

function colorPct(val) {
  return typeof val === 'number' ? `${badge(val)} ${val.toFixed(2)}%` : 'N/A';
}

function colorTests(tests, failed) {
  if (tests === 'N/A') return 'N/A';
  const icon = failed === 0 ? '🟢' : '🔴';
  return `${icon} ${tests}`;
}

function readJSON(relPath) {
  const abs = resolve(root, relPath);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function parseResults(data, format) {
  if (!data) return { files: 'N/A', tests: 'N/A', failed: 0 };
  if (format === 'vitest') {
    const total = data.numTotalTests ?? 0;
    const passed = data.numPassedTests ?? 0;
    const failed = data.numFailedTests ?? 0;
    const files = data.numTotalTestSuites ?? 'N/A';
    return { files, tests: `${passed}/${total}`, failed };
  }
  if (format === 'playwright') {
    const s = data.stats ?? {};
    const passed = s.expected ?? 0;
    const failed = s.unexpected ?? 0;
    const skipped = s.skipped ?? 0;
    const run = passed + failed;
    const files = Array.isArray(data.suites) ? data.suites.length : 'N/A';
    const skipNote = skipped > 0 ? ` (${skipped} skipped)` : '';
    return { files, tests: `${passed}/${run}${skipNote}`, failed };
  }
  return { files: 'N/A', tests: 'N/A', failed: 0 };
}

function summaryRow(suite, coverage, results) {
  const { files, tests, failed } = results;
  if (!coverage) {
    return `| ${suite.name.padEnd(14)} | ${files} | ${colorTests(tests, failed)} | N/A | N/A | N/A | N/A | ${suite.covers} |`;
  }
  const t = coverage.total;
  return `| ${suite.name.padEnd(14)} | ${files} | ${colorTests(tests, failed)} | ${colorPct(t.statements?.pct)} | ${colorPct(t.branches?.pct)} | ${colorPct(t.functions?.pct)} | ${colorPct(t.lines?.pct)} | ${suite.covers} |`;
}

function perFileTable(data) {
  if (!data) return '*No coverage data available.*';

  const files = Object.entries(data)
    .filter(([key]) => key !== 'total')
    .map(([absPath, m]) => ({ rel: relative(root, absPath).replace(/\\/g, '/'), m }))
    .filter(({ rel }) => !rel.startsWith('..'))
    .sort((a, b) => a.rel.localeCompare(b.rel));

  if (files.length === 0) return '*No file-level data available.*';

  const rows = files.map(({ rel, m }) =>
    `| \`${rel}\` | ${colorPct(m.statements?.pct)} | ${colorPct(m.branches?.pct)} | ${colorPct(m.functions?.pct)} | ${colorPct(m.lines?.pct)} |`
  );

  return [
    '| File | Stmts | Branch | Funcs | Lines |',
    '|------|-------|--------|-------|-------|',
    ...rows,
  ].join('\n');
}

const loaded = SUITES.map(s => ({
  suite: s,
  coverage: readJSON(s.coverageFile),
  results: parseResults(readJSON(s.resultsFile), s.resultsFormat),
}));

const summaryTable = [
  '| Suite | Files | Tests | Statements | Branches | Functions | Lines | Covers |',
  '|-------|-------|-------|------------|----------|-----------|-------|--------|',
  ...loaded.map(({ suite, coverage, results }) => summaryRow(suite, coverage, results)),
].join('\n');

const perFileSections = loaded.map(({ suite, coverage }) => {
  const heading = suite.name.charAt(0).toUpperCase() + suite.name.slice(1);
  return `## ${heading} - per file\n\n${perFileTable(coverage)}`;
}).join('\n\n');

const report = `# Coverage Report

*Generated: ${today}*

## Summary

${summaryTable}

${perFileSections}
`;

writeFileSync(resolve(root, 'reports', 'coverage.md'), report);
console.log('Written reports/coverage.md');

#!/usr/bin/env node
/**
 * Reads the four coverage-summary.json files produced by the coverage scripts
 * and writes reports/coverage.md with a summary table and per-file tables for
 * each suite.
 *
 * Missing summary files (e.g. when a suite is skipped) produce N/A rows.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';

const root = resolve(import.meta.dirname, '..');
const today = new Date().toISOString().split('T')[0];

const SUITES = [
  { name: 'backend unit',  covers: 'backend/src',  file: 'backend/coverage/coverage-summary.json' },
  { name: 'frontend unit', covers: 'frontend/src',  file: 'frontend/coverage/coverage-summary.json' },
  { name: 'e2e mock',      covers: 'frontend/src',  file: 'frontend/coverage-e2e/coverage-summary.json' },
  { name: 'e2e real',      covers: 'backend/src',   file: 'backend/coverage-e2e/coverage-summary.json' },
];

function pct(val) {
  return typeof val === 'number' ? `${val.toFixed(2)}%` : 'N/A';
}

function readSummary(relPath) {
  const abs = resolve(root, relPath);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function summaryRow(suite, data) {
  if (!data) {
    return `| ${suite.name.padEnd(14)} | N/A | N/A | N/A | N/A | ${suite.covers} |`;
  }
  const t = data.total;
  return `| ${suite.name.padEnd(14)} | ${pct(t.statements?.pct)} | ${pct(t.branches?.pct)} | ${pct(t.functions?.pct)} | ${pct(t.lines?.pct)} | ${suite.covers} |`;
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
    `| \`${rel}\` | ${pct(m.statements?.pct)} | ${pct(m.branches?.pct)} | ${pct(m.functions?.pct)} | ${pct(m.lines?.pct)} |`
  );

  return [
    '| File | Stmts | Branch | Funcs | Lines |',
    '|------|-------|--------|-------|-------|',
    ...rows,
  ].join('\n');
}

const loaded = SUITES.map(s => ({ suite: s, data: readSummary(s.file) }));

const summaryTable = [
  '| Suite | Statements | Branches | Functions | Lines | Covers |',
  '|-------|------------|----------|-----------|-------|--------|',
  ...loaded.map(({ suite, data }) => summaryRow(suite, data)),
].join('\n');

const perFileSections = loaded.map(({ suite, data }) => {
  const heading = suite.name.charAt(0).toUpperCase() + suite.name.slice(1);
  return `## ${heading} — per file\n\n${perFileTable(data)}`;
}).join('\n\n');

const report = `# Coverage Report

*Generated: ${today}*

## Summary

${summaryTable}

${perFileSections}
`;

writeFileSync(resolve(root, 'reports', 'coverage.md'), report);
console.log('Written reports/coverage.md');

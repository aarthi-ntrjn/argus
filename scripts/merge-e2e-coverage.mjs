#!/usr/bin/env node
/**
 * Merges per-test istanbul coverage files from frontend/.nyc_output/ and
 * writes frontend/coverage-e2e/coverage-summary.json in the same format
 * vitest uses, so the /merge coverage report script can parse it uniformly.
 */

import coverageLib from 'istanbul-lib-coverage';
import reportLib from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import { readdirSync, mkdirSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

const { createCoverageMap } = coverageLib;
const { createContext } = reportLib;

const root = resolve(import.meta.dirname, '..');
const rawDir = join(root, 'frontend', '.nyc_output');
const outDir = join(root, 'frontend', 'coverage-e2e');

let files;
try {
  files = readdirSync(rawDir).filter(f => f.endsWith('.json'));
} catch {
  console.error(`No coverage files found in ${rawDir}. Was VITE_COVERAGE=true set during the build and test run?`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`No .json files found in ${rawDir}.`);
  process.exit(1);
}

const map = createCoverageMap({});
for (const file of files) {
  const content = JSON.parse(readFileSync(join(rawDir, file), 'utf8'));
  map.merge(content);
}

mkdirSync(outDir, { recursive: true });

const ctx = createContext({ dir: outDir, coverageMap: map });
const report = reports.create('json-summary', { file: 'coverage-summary.json' });
report.execute(ctx);

console.log(`Merged ${files.length} coverage file(s) into ${join(outDir, 'coverage-summary.json')}`);

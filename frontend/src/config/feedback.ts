export const ARGUS_GITHUB_REPO_URL = 'https://github.com/aarthi-ntrjn/argus';

const BUG_REPORT_BODY = `## Description

<!-- A clear and concise description of the bug. -->

## Steps to Reproduce

1. 
2. 
3. 

## Expected Behavior

<!-- What you expected to happen. -->

## Actual Behavior

<!-- What actually happened. -->
`;

const FEATURE_REQUEST_BODY = `## Problem Statement

<!-- Describe the problem you're trying to solve. -->

## Proposed Solution

<!-- Describe the solution you'd like. -->

## Alternatives Considered

<!-- Any alternative solutions or features you've considered. -->
`;

export function buildBugReportUrl(): string {
  const params = new URLSearchParams({
    title: 'Bug: ',
    body: BUG_REPORT_BODY,
    labels: 'bug',
  });
  return `${ARGUS_GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}

export function buildFeatureRequestUrl(): string {
  const params = new URLSearchParams({
    title: 'Feature: ',
    body: FEATURE_REQUEST_BODY,
    labels: 'enhancement',
  });
  return `${ARGUS_GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}

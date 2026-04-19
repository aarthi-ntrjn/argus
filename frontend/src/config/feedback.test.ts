import { describe, it, expect } from 'vitest';
import { ARGUS_GITHUB_REPO_URL, buildBugReportUrl, buildFeatureRequestUrl } from './feedback';

describe('feedback URL builders', () => {
  describe('buildBugReportUrl', () => {
    it('returns a URL starting with the Argus GitHub repo URL', () => {
      expect(buildBugReportUrl()).toMatch(/^https:\/\/github\.com\/aarthi-ntrjn\/argus\/issues\/new/);
    });

    it('includes the bug label', () => {
      const url = buildBugReportUrl();
      const params = new URL(url).searchParams;
      expect(params.get('labels')).toBe('bug');
    });

    it('pre-fills the title with "Bug: " prefix', () => {
      const url = buildBugReportUrl();
      const params = new URL(url).searchParams;
      expect(params.get('title')).toBe('Bug: ');
    });

    it('has a non-empty body template containing expected sections', () => {
      const url = buildBugReportUrl();
      const params = new URL(url).searchParams;
      const body = params.get('body') ?? '';
      expect(body.length).toBeGreaterThan(0);
      expect(body).toContain('Steps to Reproduce');
      expect(body).toContain('Expected Behavior');
      expect(body).toContain('Actual Behavior');
    });
  });

  describe('buildFeatureRequestUrl', () => {
    it('returns a URL starting with the Argus GitHub repo URL', () => {
      expect(buildFeatureRequestUrl()).toMatch(/^https:\/\/github\.com\/aarthi-ntrjn\/argus\/issues\/new/);
    });

    it('includes the enhancement label', () => {
      const url = buildFeatureRequestUrl();
      const params = new URL(url).searchParams;
      expect(params.get('labels')).toBe('enhancement');
    });

    it('pre-fills the title with "Feature: " prefix', () => {
      const url = buildFeatureRequestUrl();
      const params = new URL(url).searchParams;
      expect(params.get('title')).toBe('Feature: ');
    });

    it('has a non-empty body template containing expected sections', () => {
      const url = buildFeatureRequestUrl();
      const params = new URL(url).searchParams;
      const body = params.get('body') ?? '';
      expect(body.length).toBeGreaterThan(0);
      expect(body).toContain('Problem Statement');
      expect(body).toContain('Proposed Solution');
      expect(body).toContain('Alternatives Considered');
    });
  });

  describe('ARGUS_GITHUB_REPO_URL', () => {
    it('is the correct public repo URL', () => {
      expect(ARGUS_GITHUB_REPO_URL).toBe('https://github.com/aarthi-ntrjn/argus');
    });
  });
});

/**
 * Unit tests for pending-choice-utils.ts
 * Tests parsePendingChoicePayload() as a pure function.
 * These tests should FAIL until T002 (pending-choice-utils.ts) is implemented.
 */
import { describe, it, expect } from 'vitest';
import {
  parsePendingChoicePayload,
  buildToolApprovalChoice,
} from '../../src/cli/pending-choice-utils.js';

describe('parsePendingChoicePayload', () => {
  describe('multi-question Claude format ({ questions: [...] })', () => {
    it('parses a single question with string options', () => {
      const result = parsePendingChoicePayload({
        questions: [{ question: 'Which approach?', options: ['Option A', 'Option B'] }],
      });
      expect(result.question).toBe('Which approach?');
      expect(result.choices).toEqual(['Option A', 'Option B']);
      expect(result.allQuestions).toHaveLength(1);
      expect(result.allQuestions[0]).toMatchObject({ question: 'Which approach?', choices: ['Option A', 'Option B'] });
    });

    it('parses a single question with object options (label + description)', () => {
      const result = parsePendingChoicePayload({
        questions: [
          {
            question: 'Select a style',
            options: [
              { label: 'Compact', description: 'Minimal whitespace' },
              { label: 'Verbose', description: 'Full details' },
            ],
          },
        ],
      });
      expect(result.choices).toEqual(['Compact', 'Verbose']);
      expect(result.allQuestions[0].descriptions).toEqual(['Minimal whitespace', 'Full details']);
    });

    it('does not include descriptions when all options are plain strings', () => {
      const result = parsePendingChoicePayload({
        questions: [{ question: 'Q?', options: ['A', 'B', 'C'] }],
      });
      expect(result.allQuestions[0].descriptions).toBeUndefined();
    });

    it('parses object options with label only (no description)', () => {
      const result = parsePendingChoicePayload({
        questions: [{ question: 'Q?', options: [{ label: 'Yes' }, { label: 'No' }] }],
      });
      expect(result.choices).toEqual(['Yes', 'No']);
      expect(result.allQuestions[0].descriptions).toBeUndefined();
    });

    it('preserves header field when present', () => {
      const result = parsePendingChoicePayload({
        questions: [{ question: 'Q?', options: ['A'], header: 'Important Decision' }],
      });
      expect(result.allQuestions[0].header).toBe('Important Decision');
    });

    it('parses multiple questions and uses the first as the primary', () => {
      const result = parsePendingChoicePayload({
        questions: [
          { question: 'First question?', options: ['A', 'B'] },
          { question: 'Second question?', options: ['X', 'Y'] },
        ],
      });
      expect(result.question).toBe('First question?');
      expect(result.choices).toEqual(['A', 'B']);
      expect(result.allQuestions).toHaveLength(2);
    });
  });

  describe('flat ask_user format ({ question, choices })', () => {
    it('parses the flat format with string choices', () => {
      const result = parsePendingChoicePayload({
        question: 'Which approach do you prefer?',
        choices: ['Option A', 'Option B'],
      });
      expect(result.question).toBe('Which approach do you prefer?');
      expect(result.choices).toEqual(['Option A', 'Option B']);
    });

    it('allQuestions always has at least one item', () => {
      const result = parsePendingChoicePayload({
        question: 'Q?',
        choices: ['A'],
      });
      expect(result.allQuestions.length).toBeGreaterThanOrEqual(1);
      expect(result.allQuestions[0]).toMatchObject({ question: 'Q?', choices: ['A'] });
    });

    it('handles choices as object array with label field', () => {
      const result = parsePendingChoicePayload({
        question: 'Q?',
        choices: [{ label: 'Yes' }, { label: 'No' }],
      });
      expect(result.choices).toEqual(['Yes', 'No']);
    });

    it('filters out non-string, non-label choices', () => {
      const result = parsePendingChoicePayload({
        question: 'Q?',
        choices: ['A', null, 'B', 42, {}],
      });
      expect(result.choices).toEqual(['A', 'B']);
    });
  });

  describe('fallback behavior', () => {
    it('falls back to flat format when questions array is empty', () => {
      const result = parsePendingChoicePayload({
        questions: [],
        question: 'Fallback question?',
        choices: ['Yes', 'No'],
      });
      expect(result.question).toBe('Fallback question?');
      expect(result.choices).toEqual(['Yes', 'No']);
    });

    it('returns empty question and choices when input is completely empty', () => {
      const result = parsePendingChoicePayload({});
      expect(result.question).toBe('');
      expect(result.choices).toEqual([]);
      expect(result.allQuestions).toHaveLength(1);
    });

    it('returns empty question and choices when questions is not an array', () => {
      const result = parsePendingChoicePayload({ questions: 'not-an-array' });
      expect(result.question).toBe('');
      expect(result.allQuestions).toHaveLength(1);
    });
  });
});

describe('buildToolApprovalChoice', () => {
  it('builds question from tool name and command field', () => {
    const result = buildToolApprovalChoice('Bash', { command: 'rm -rf /' });
    expect(result.question).toBe('Bash: rm -rf /');
    expect(result.choices).toEqual(['Yes, run it', 'No, skip it']);
    expect(result.allQuestions).toHaveLength(1);
    expect(result.allQuestions[0].question).toBe('Bash: rm -rf /');
    expect(result.allQuestions[0].choices).toEqual(['Yes, run it', 'No, skip it']);
  });

  it('prefers command over other fields', () => {
    const result = buildToolApprovalChoice('Bash', {
      command: 'echo hello',
      file_path: '/some/file',
    });
    expect(result.question).toBe('Bash: echo hello');
  });

  it('falls back to file_path when no command present', () => {
    const result = buildToolApprovalChoice('Write', { file_path: '/src/index.ts' });
    expect(result.question).toBe('Write: /src/index.ts');
  });

  it('falls back to path when no command or file_path present', () => {
    const result = buildToolApprovalChoice('Read', { path: '/etc/hosts' });
    expect(result.question).toBe('Read: /etc/hosts');
  });

  it('falls back to first string value in tool_input when no known key present', () => {
    const result = buildToolApprovalChoice('Computer', { action: 'screenshot', duration: 5 });
    expect(result.question).toBe('Computer: screenshot');
  });

  it('uses tool name only when tool_input has no string values', () => {
    const result = buildToolApprovalChoice('Write', {});
    expect(result.question).toBe('Write');
    expect(result.choices).toEqual(['Yes, run it', 'No, skip it']);
  });

  it('uses tool name only when tool_input is empty object', () => {
    const result = buildToolApprovalChoice('Unknown', {});
    expect(result.question).toBe('Unknown');
  });
});

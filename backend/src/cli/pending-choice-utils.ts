import type { PendingChoiceItem } from '../models/index.js';

/**
 * Parses a tool_input payload from either detector (Claude Code or Copilot CLI)
 * into a normalized pending choice structure.
 *
 * Handles two input formats:
 * - Multi-question Claude Code format: { questions: [{ question, options, header? }] }
 * - Flat ask_user format: { question, choices }
 */
export function parsePendingChoicePayload(toolInput: Record<string, unknown>): {
  question: string;
  choices: string[];
  allQuestions: PendingChoiceItem[];
} {
  const rawQs = Array.isArray(toolInput.questions)
    ? (toolInput.questions as Record<string, unknown>[])
    : [];

  const allQuestions: PendingChoiceItem[] = rawQs.map((q) => {
    const qText = typeof q.question === 'string' ? q.question : '';
    const rawOpts: unknown[] = Array.isArray(q.options) ? q.options : [];
    const qChoices: string[] = [];
    const qDescriptions: string[] = [];

    for (const c of rawOpts) {
      if (typeof c === 'string') {
        qChoices.push(c);
        qDescriptions.push('');
      } else if (c && typeof c === 'object') {
        const obj = c as Record<string, unknown>;
        if (typeof obj.label === 'string') {
          qChoices.push(obj.label);
          qDescriptions.push(typeof obj.description === 'string' ? obj.description : '');
        }
      }
    }

    const hasDescriptions = qDescriptions.some((d) => d !== '');
    return {
      question: qText,
      choices: qChoices,
      ...(hasDescriptions ? { descriptions: qDescriptions } : {}),
      ...(typeof q.header === 'string' ? { header: q.header } : {}),
    };
  });

  // Fallback: flat format { question: string, choices: string[] } (e.g. ask_user / Copilot)
  if (allQuestions.length === 0) {
    const question = typeof toolInput.question === 'string' ? toolInput.question : '';
    const rawChoices: unknown[] = Array.isArray(toolInput.choices) ? toolInput.choices : [];
    const choices = rawChoices
      .map((c) => {
        if (typeof c === 'string') {
          return c;
        }
        if (
          c &&
          typeof c === 'object' &&
          typeof (c as Record<string, unknown>).label === 'string'
        ) {
          return (c as Record<string, unknown>).label as string;
        }
        return null;
      })
      .filter((c): c is string => c !== null);
    allQuestions.push({ question, choices });
  }

  const { question, choices } = allQuestions[0];
  return { question, choices, allQuestions };
}

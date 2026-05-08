import type { PendingChoiceItem } from '../models/index.js';

/**
 * Bash-tier tools (Claude Code): approval persists permanently per project directory and command.
 * Maps to Claude Code's "Yes, don't ask again for this project" option.
 */
const BASH_TIER_TOOLS = new Set([
  'Bash',
  'computer',
]);

/**
 * Edit-tier tools (Claude Code): approval persists only until the session ends.
 * Maps to Claude Code's "Yes, don't ask again for this session" option.
 */
const EDIT_TIER_TOOLS = new Set([
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEditCell',
  'str_replace_editor',
  'str_replace_based_edit_tool',
]);

/**
 * Copilot CLI tools: the interactive prompt always offers once/session/reject.
 * There is no permanent in-prompt option — permanent rules require --allow-tool flags.
 * Both shell-kind and write-kind tools show the same three choices.
 */
const COPILOT_TIER_TOOLS = new Set([
  'run_shell_command', // shell kind
  'bash',             // shell kind (alternate name per official docs)
  'shell',            // shell kind (alternate name)
  'edit',             // write kind (per official docs)
]);

const BASH_TIER_CHOICES = ['Yes', "Yes, don't ask again for this project", 'No'];
const EDIT_TIER_CHOICES = ['Yes', "Yes, don't ask again for this session", 'No'];
const COPILOT_TIER_CHOICES = ['Yes, allow once', 'Yes, allow for this session', 'No, reject'];

function getToolTierChoices(toolName: string): string[] {
  if (COPILOT_TIER_TOOLS.has(toolName)) {
    return COPILOT_TIER_CHOICES;
  }
  if (BASH_TIER_TOOLS.has(toolName)) {
    return BASH_TIER_CHOICES;
  }
  if (EDIT_TIER_TOOLS.has(toolName)) {
    return EDIT_TIER_CHOICES;
  }
  // Unknown tools default to session-scoped approval (safer than permanent).
  return EDIT_TIER_CHOICES;
}

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

/**
 * Builds a pending choice structure for a tool approval event (PreToolUse for
 * non-ask_user tools). The question is formatted as "<toolName>: <primaryInput>"
 * where primaryInput is extracted from tool_input using a priority order:
 * command > file_path > path > first string value. Falls back to toolName only.
 *
 * Choices are tier-aware:
 * - Bash-tier (Bash, computer): permanent per-project "don't ask again"
 * - Edit-tier (Edit, Write, etc.) and unknown: session-scoped "don't ask again"
 */
export function buildToolApprovalChoice(
  toolName: string,
  toolInput: Record<string, unknown>,
): {
  type: 'tool_approval';
  question: string;
  choices: string[];
  allQuestions: PendingChoiceItem[];
} {
  const primaryValue = extractPrimaryStringValue(toolInput);
  const question = primaryValue ? `${toolName}: ${primaryValue}` : toolName;
  const choices = getToolTierChoices(toolName);
  const allQuestions: PendingChoiceItem[] = [{ question, choices }];
  return { type: 'tool_approval', question, choices, allQuestions };
}

const PRIORITY_KEYS = ['command', 'file_path', 'path'] as const;

function extractPrimaryStringValue(toolInput: Record<string, unknown>): string | null {
  for (const key of PRIORITY_KEYS) {
    if (typeof toolInput[key] === 'string' && toolInput[key] !== '') {
      return toolInput[key] as string;
    }
  }
  for (const value of Object.values(toolInput)) {
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return null;
}

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createTaggedLogger } from '../utils/logger.js';
import { loadConfig } from '../config/config-loader.js';
import type { HooksInjector } from './hooks-injector.js';

const log = createTaggedLogger('[ClaudeCodeHooksInjector]', '\x1b[34m');

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_EVENTS: Array<{ event: string; matcher: string }> = [
  { event: 'SessionStart', matcher: '' },
  { event: 'SessionEnd', matcher: '' },
  { event: 'PreToolUse', matcher: 'AskUserQuestion' },
  { event: 'PostToolUse', matcher: 'AskUserQuestion' },
];

interface ClaudeSettings {
  hooks?: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>>;
  [key: string]: unknown;
}

function buildHookCommand(port: number): string {
  return `curl -sf -X POST http://127.0.0.1:${port}/hooks/claude -H "Content-Type: application/json" -d @- 2>/dev/null || true`;
}

function isArgusEntry(entry: { hooks?: Array<{ command?: string }> }): boolean {
  return entry.hooks?.some((h) => (h.command ?? '').includes('/hooks/claude')) ?? false;
}

/**
 * Ensures Argus hooks are registered in Claude Code's global settings file.
 *
 * Claude Code uses a single settings.json for all repos, so there is no per-repo
 * injection — every method ultimately touches the same file. On each inject, stale
 * Argus entries (from any previous port) are removed before the current ones are
 * written, keeping the file clean across server restarts and port changes.
 */
export class ClaudeCodeHooksInjector implements HooksInjector {
  /** Rewrites the global ~/.claude/settings.json with all required Argus hooks. */
  injectForAll(): void {
    try {
      const port = loadConfig().port;
      const hookCommand = buildHookCommand(port);

      mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
      let settings: ClaudeSettings = {};
      if (existsSync(CLAUDE_SETTINGS_PATH)) {
        settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
      }
      if (!settings.hooks) settings.hooks = {};

      // Remove malformed event keys (e.g. '[object Object]' from object-as-key coercion).
      for (const event of Object.keys(settings.hooks)) {
        if (!/^\w+$/.test(event)) {
          log.warn(`Removing malformed hook event key: "${event}"`);
          delete settings.hooks[event];
        }
      }

      // Remove all existing Argus entries (any port) before re-injecting fresh ones.
      for (const event of Object.keys(settings.hooks)) {
        settings.hooks[event] = settings.hooks[event].filter((entry) => !isArgusEntry(entry));
      }

      for (const { event, matcher } of HOOK_EVENTS) {
        if (!settings.hooks[event]) settings.hooks[event] = [];
        settings.hooks[event].push({ matcher, hooks: [{ type: 'command', command: hookCommand }] });
      }

      writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
      log.info(`Injected Claude Code hooks into settings.json (port ${port})`);
    } catch (err) {
      log.warn(`Failed to inject Claude Code hooks: ${String(err)}`);
    }
  }

  /** Claude Code uses a global settings file: equivalent to injectForAll. */
  injectForRepo(_repoPath: string): void {
    this.injectForAll();
  }

  /** Claude Code uses a global settings file: cannot remove hooks per repo. No-op. */
  removeForRepo(_repoPath: string): void {
    // intentional no-op: Claude Code hooks are global, not per-repository
  }

  /** Removes all Argus hooks from ~/.claude/settings.json. */
  removeAll(): void {
    try {
      if (!existsSync(CLAUDE_SETTINGS_PATH)) return;
      const settings: ClaudeSettings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
      if (!settings.hooks) return;
      let changed = false;
      for (const event of Object.keys(settings.hooks)) {
        const entries = settings.hooks[event];
        if (!entries) continue;
        const filtered = entries.filter((entry) => !isArgusEntry(entry));
        if (filtered.length !== entries.length) {
          settings.hooks[event] = filtered;
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
        log.info('Removed Claude Code hooks from settings.json');
      }
    } catch (err) {
      log.warn(`Failed to remove Claude Code hooks: ${String(err)}`);
    }
  }
}

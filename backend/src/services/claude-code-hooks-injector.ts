import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createTaggedLogger } from '../utils/logger.js';
import type { HooksInjector } from './hooks-injector.js';

const log = createTaggedLogger('[ClaudeCodeHooksInjector]', '\x1b[34m');

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = 'curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H "Content-Type: application/json" -d @- 2>/dev/null || true';
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

export class ClaudeCodeHooksInjector implements HooksInjector {
  /** Rewrites the global ~/.claude/settings.json with all required Argus hooks. */
  injectForAll(): void {
    try {
      mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
      let settings: ClaudeSettings = {};
      if (existsSync(CLAUDE_SETTINGS_PATH)) {
        settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
      }
      if (!settings.hooks) settings.hooks = {};
      let changed = false;

      // Remove Argus hook entries whose (event, matcher) pair is no longer in HOOK_EVENTS.
      // Also delete any malformed keys (e.g. '[object Object]' from object-as-key coercion).
      for (const event of Object.keys(settings.hooks)) {
        if (!/^\w+$/.test(event)) {
          delete settings.hooks[event];
          changed = true;
          continue;
        }
        const before = settings.hooks[event];
        const after = before.filter((entry) => {
          const isArgusEntry = entry.hooks?.some((h) => h.command === HOOK_COMMAND);
          if (!isArgusEntry) return true;
          return HOOK_EVENTS.some((he) => he.event === event && he.matcher === entry.matcher);
        });
        if (after.length !== before.length) {
          settings.hooks[event] = after;
          changed = true;
        }
      }

      for (const { event, matcher } of HOOK_EVENTS) {
        if (!this.hasHook(settings, event, matcher)) {
          if (!settings.hooks[event]) settings.hooks[event] = [];
          settings.hooks[event].push({ matcher, hooks: [{ type: 'command', command: HOOK_COMMAND }] });
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
        log.info('Injected Claude Code hooks into settings.json');
      }
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
      for (const { event } of HOOK_EVENTS) {
        const entries = settings.hooks[event];
        if (!entries) continue;
        const filtered = entries.filter(
          (entry) => !entry.hooks?.some((h) => h.command === HOOK_COMMAND)
        );
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

  private hasHook(settings: ClaudeSettings, event: string, matcher: string): boolean {
    const eventHooks = settings.hooks?.[event];
    if (!eventHooks) return false;
    return eventHooks.some((entry) =>
      entry.matcher === matcher && entry.hooks?.some((h) => h.command === HOOK_COMMAND)
    );
  }
}

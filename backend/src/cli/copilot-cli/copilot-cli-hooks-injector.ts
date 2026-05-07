import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { createTaggedLogger } from '../../utils/logger.js';
import { loadConfig } from '../../config/config-loader.js';
import { getRepositories } from '../../db/database.js';
import type { CliHooksInjector } from '../cli-hooks-injector.js';

const log = createTaggedLogger('[CopilotHooksInjector]', '\x1b[33m');

const EVENTS = ['sessionStart', 'sessionEnd', 'preToolUse', 'postToolUse'] as const;
type CopilotEvent = (typeof EVENTS)[number];

interface HookEntry {
  type: string;
  bash: string;
  powershell: string;
  [key: string]: unknown;
}

interface HooksJson {
  version: number;
  hooks: Partial<Record<string, HookEntry[]>>;
}

function hooksJsonPath(repoPath: string): string {
  return join(repoPath, '.github', 'hooks', 'hooks.json');
}

function isArgusEntry(entry: HookEntry): boolean {
  return (
    (entry.bash ?? '').includes('/hooks/copilot') ||
    (entry.powershell ?? '').includes('/hooks/copilot')
  );
}

function buildEntry(event: CopilotEvent, port: number): HookEntry {
  return {
    type: 'command',
    bash: `curl -sf -X POST 'http://127.0.0.1:${port}/hooks/copilot?event=${event}' -H "Content-Type: application/json" -d @- 2>/dev/null || true`,
    powershell: `$input | Invoke-RestMethod -Uri 'http://127.0.0.1:${port}/hooks/copilot?event=${event}' -Method POST -ContentType 'application/json' -ErrorAction SilentlyContinue`,
  };
}

function readHooksJson(filePath: string): HooksJson {
  if (!existsSync(filePath)) {
    return { version: 1, hooks: {} };
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as HooksJson;
  } catch {
    log.warn(`Could not parse ${filePath}, treating as empty`);
    return { version: 1, hooks: {} };
  }
}

/**
 * Ensures Argus hooks are registered in each repository's Copilot hooks file.
 *
 * Unlike Claude Code (which has a single global config), Copilot CLI reads hooks
 * from a per-repo file at .github/hooks/hooks.json. Injection must happen for every
 * registered repository individually. On each inject, stale Argus entries (from any
 * previous port) are stripped before the current ones are written, so the file stays
 * clean across server restarts and port changes. If a repo's hooks file becomes empty
 * after removal, the file is deleted entirely.
 */
export class CopilotHooksInjector implements CliHooksInjector {
  /** Writes Argus hook entries into the hooks.json for a single repository. */
  injectForRepo(repoPath: string): void {
    try {
      const port = loadConfig().port;
      const filePath = hooksJsonPath(repoPath);
      const data = readHooksJson(filePath);
      data.version = 1;
      if (!data.hooks) {
        data.hooks = {};
      }

      for (const event of EVENTS) {
        const existing: HookEntry[] = (data.hooks[event] ?? []) as HookEntry[];
        // Remove all stale Argus entries (any port)
        const filtered = existing.filter((e) => !isArgusEntry(e));
        // Append fresh Argus entry
        filtered.push(buildEntry(event, port));
        data.hooks[event] = filtered;
      }

      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      log.info(`Injected Copilot hooks into ${filePath}`);
    } catch (err) {
      log.warn(`Failed to inject Copilot hooks into ${repoPath}: ${String(err)}`);
    }
  }

  /** Removes Argus hook entries from the hooks.json for a single repository. Deletes the file if nothing else remains. */
  removeForRepo(repoPath: string): void {
    try {
      const filePath = hooksJsonPath(repoPath);
      if (!existsSync(filePath)) {
        return;
      }

      const data = readHooksJson(filePath);
      if (!data.hooks) {
        return;
      }

      for (const event of Object.keys(data.hooks)) {
        const entries = (data.hooks[event] ?? []) as HookEntry[];
        const filtered = entries.filter((e) => !isArgusEntry(e));
        data.hooks[event] = filtered;
      }

      const allEmpty = Object.values(data.hooks).every(
        (arr) => !arr || (arr as HookEntry[]).length === 0,
      );
      if (allEmpty) {
        unlinkSync(filePath);
        log.info(`Removed hooks.json (no remaining entries) from ${repoPath}`);
      } else {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        log.info(`Removed Argus entries from hooks.json in ${repoPath}`);
      }
    } catch (err) {
      log.warn(`Failed to remove Copilot hooks from ${repoPath}: ${String(err)}`);
    }
  }

  /** Injects hooks into every registered repository. Called on server startup. */
  injectForAll(): void {
    const repos = getRepositories();
    for (const repo of repos) {
      this.injectForRepo(repo.path);
    }
  }

  /** Removes Argus hooks from every registered repository. */
  removeAll(): void {
    const repos = getRepositories();
    for (const repo of repos) {
      this.removeForRepo(repo.path);
    }
  }
}

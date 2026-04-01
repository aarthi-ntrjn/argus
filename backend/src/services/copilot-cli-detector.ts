import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import psList from 'ps-list';
import { randomUUID } from 'crypto';
import { getSession, upsertSession, getRepositoryByPath } from '../db/database.js';
import type { Session } from '../models/index.js';

const DEFAULT_SESSION_DIR = join(homedir(), '.copilot', 'session-state');

interface WorkspaceYaml {
  id?: string;
  cwd?: string;
  summary?: string;
  created_at?: string;
  updated_at?: string;
}

export class CopilotCliDetector {
  constructor(private sessionStateDir: string = DEFAULT_SESSION_DIR) {}

  async scan(): Promise<Session[]> {
    if (!existsSync(this.sessionStateDir)) return [];

    const runningPids = await this.getRunningPids();
    const sessions: Session[] = [];

    try {
      const entries = readdirSync(this.sessionStateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const session = await this.processSessionDir(join(this.sessionStateDir, entry.name), runningPids);
        if (session) sessions.push(session);
      }
    } catch { /* ignore */ }

    return sessions;
  }

  private async getRunningPids(): Promise<Set<number>> {
    try {
      const processes = await psList();
      return new Set(processes.map((p) => p.pid));
    } catch {
      return new Set();
    }
  }

  private async processSessionDir(dirPath: string, runningPids: Set<number>): Promise<Session | null> {
    const workspaceFile = join(dirPath, 'workspace.yaml');
    if (!existsSync(workspaceFile)) return null;

    let workspace: WorkspaceYaml;
    try {
      workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
    } catch { return null; }

    const lockFile = this.findLockFile(dirPath);
    const pid = lockFile ? this.extractPid(lockFile) : null;
    const isRunning = pid !== null && runningPids.has(pid);

    const repo = workspace.cwd ? getRepositoryByPath(workspace.cwd) : null;
    if (!repo) return null;

    const sessionId = workspace.id ?? randomUUID();
    const status = isRunning ? 'active' : 'ended';

    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: 'copilot-cli',
      pid: pid,
      status,
      startedAt: workspace.created_at ?? new Date().toISOString(),
      endedAt: status === 'ended' ? (workspace.updated_at ?? new Date().toISOString()) : null,
      lastActivityAt: workspace.updated_at ?? new Date().toISOString(),
      summary: workspace.summary ?? null,
      expiresAt: null,
    };

    upsertSession(session);
    return session;
  }

  private findLockFile(dirPath: string): string | null {
    try {
      const files = readdirSync(dirPath);
      return files.find((f) => f.startsWith('inuse.') && f.endsWith('.lock')) ?? null;
    } catch { return null; }
  }

  private extractPid(lockFile: string): number | null {
    const match = lockFile.match(/inuse\.(\d+)\.lock/);
    return match ? parseInt(match[1], 10) : null;
  }

  getEventsFilePath(sessionDir: string): string {
    return join(this.sessionStateDir, sessionDir, 'events.jsonl');
  }
}
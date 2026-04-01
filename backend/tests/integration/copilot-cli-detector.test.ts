import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('CopilotCliDetector', () => {
  let testDir: string;
  let sessionDir: string;
  const testPid = 99999; // unlikely to exist

  beforeAll(() => {
    testDir = join(tmpdir(), `argus-test-${randomUUID()}`);
    sessionDir = join(testDir, 'test-session-1');
    mkdirSync(sessionDir, { recursive: true });

    // Create workspace.yaml
    writeFileSync(join(sessionDir, 'workspace.yaml'), `
id: test-session-1
cwd: C:\\source\\test-repo
summary: Test session
created_at: ${new Date().toISOString()}
updated_at: ${new Date().toISOString()}
`);

    // Create inuse lock file
    writeFileSync(join(sessionDir, `inuse.${testPid}.lock`), '');
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('detects session directory with lock file', async () => {
    const { CopilotCliDetector } = await import('../../src/services/copilot-cli-detector.js');
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const session = sessions.find((s) => s.id === 'test-session-1');
    expect(session).toBeDefined();
    expect(session?.pid).toBe(testPid);
  });

  it('marks session as ended when PID not running', async () => {
    const { CopilotCliDetector } = await import('../../src/services/copilot-cli-detector.js');
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === 'test-session-1');
    // PID 99999 should not be running, so status should be 'ended'
    expect(session?.status).toBe('ended');
  });
});
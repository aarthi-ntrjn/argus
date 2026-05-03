"""
One-time script: refactor ClaudeCodeDetector.scan() to:
- Use this.registry instance instead of new ClaudeSessionRegistry() per call
- Backfill PIDs from registry entries into existing sessions
- Detect disappeared registry files (unclean shutdown) and fire sessionEndedCallback
"""

import re

with open('backend/src/services/claude-code-detector.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# --- 1. Add setSessionEndedCallback + getRegistryEntries after setSessionCreatedCallback ---
old_cb = (
    '  setSessionCreatedCallback(cb: (session: Session) => void): void {\n'
    '    this.sessionCreatedCallback = cb;\n'
    '  }'
)
new_cb = (
    '  setSessionCreatedCallback(cb: (session: Session) => void): void {\n'
    '    this.sessionCreatedCallback = cb;\n'
    '  }\n'
    '\n'
    '  /** Wires the callback fired when a session ends due to a disappeared registry file. */\n'
    '  setSessionEndedCallback(cb: (session: Session) => void): void {\n'
    '    this.sessionEndedCallback = cb;\n'
    '  }\n'
    '\n'
    '  /** Returns raw registry entries for startup stale-session reconciliation only. */\n'
    '  getRegistryEntries(): ClaudeSessionRegistryEntry[] {\n'
    '    return this.registry.scanEntries();\n'
    '  }'
)
assert old_cb in content, "Could not find setSessionCreatedCallback block"
content = content.replace(old_cb, new_cb)
print('setSessionEndedCallback added')

# --- 2. Replace the entire scan() method ---
old_scan_pattern = re.compile(
    r'  async scan\(\): Promise<Session\[\]> \{.*?return \[\];\n  \}',
    re.DOTALL
)
new_scan = (
    '  async scan(): Promise<Session[]> {\n'
    '    const registryEntries = this.registry.scanEntries();\n'
    '    const currentPids = new Set<number>();\n'
    '    const now = new Date().toISOString();\n'
    '\n'
    '    for (const entry of registryEntries) {\n'
    '      // Guard 1: process is running (cheap signal-0 check)\n'
    '      // Guard 2: verify the process is actually the expected AI tool (catches recycled PIDs)\n'
    '      if (!isPidRunning(entry.pid)) continue;\n'
    '      if (!isExpectedProcess(entry.pid, \'claude-code\')) {\n'
    '        logger.info(`[ClaudeDetector] PID reuse detected: pid ${entry.pid} is running with wrong name, skipping (sessionId=${entry.sessionId})`);\n'
    '        continue;\n'
    '      }\n'
    '\n'
    '      currentPids.add(entry.pid);\n'
    '\n'
    '      const normalizedCwd = normalize(entry.cwd.trimEnd().replace(/[\\/\\\\]+$/, \'\'));\n'
    '      const repo = getRepositoryByPath(normalizedCwd);\n'
    '      if (!repo) { logger.warn(`[ClaudeDetector] no repo for cwd="${normalizedCwd}" sessionId=${entry.sessionId} — session ignored`); continue; }\n'
    '\n'
    '      // Backfill PID from registry if the session was created via hooks without a PID.\n'
    '      // Skip PTY-sourced PIDs — the PTY registry is more authoritative.\n'
    '      const existing = getSession(entry.sessionId);\n'
    '      if (existing && existing.pidSource !== \'pty_registry\') {\n'
    '        const pidChanged = existing.pid !== entry.pid || existing.pidSource !== \'session_registry\';\n'
    '        const yoloMode = existing.yoloMode !== null ? existing.yoloMode : detectYoloModeFromPids(entry.pid, null, \'claude-code\');\n'
    '        const yoloResolved = existing.yoloMode === null && yoloMode !== null;\n'
    '        if (pidChanged || yoloResolved) {\n'
    '          logger.info(`[ClaudeDetector] pid assigned sessionId=${entry.sessionId} pid=${entry.pid} (was ${existing.pid}) yoloMode=${yoloMode}`);\n'
    '          const updated = { ...existing, pid: entry.pid, pidSource: \'session_registry\' as const, yoloMode };\n'
    '          upsertSession(updated);\n'
    '          broadcast({ type: \'session.updated\', timestamp: now, data: updated });\n'
    '        }\n'
    '      }\n'
    '\n'
    '      await this.activateFoundSession(entry.sessionId, repo, entry.pid);\n'
    '    }\n'
    '\n'
    '    // Detect sessions whose registry file disappeared (unclean shutdown, SessionEnd hook not fired).\n'
    '    for (const oldPid of this.previousRegistryPids) {\n'
    '      if (currentPids.has(oldPid)) continue;\n'
    '      const activeSessions = getSessions({ status: \'active\', type: SessionTypes.CLAUDE_CODE });\n'
    '      for (const session of activeSessions) {\n'
    '        if (session.pid === oldPid && session.pidSource === \'session_registry\') {\n'
    '          logger.info(`[ClaudeDetector] session ended, registry file gone sessionId=${session.id} pid=${oldPid}`);\n'
    '          updateSessionStatus(session.id, \'ended\', now);\n'
    '          this.jsonlWatcher.closeWatcher(session.id);\n'
    '          this.sessionEndedCallback?.({ ...session, status: \'ended\', endedAt: now });\n'
    '        }\n'
    '      }\n'
    '    }\n'
    '    this.previousRegistryPids = currentPids;\n'
    '\n'
    '    return [];\n'
    '  }'
)

content, n = old_scan_pattern.subn(new_scan, content)
assert n == 1, f"Expected to replace 1 scan() method, replaced {n}"
print('scan() replaced')

with open('backend/src/services/claude-code-detector.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done writing file')

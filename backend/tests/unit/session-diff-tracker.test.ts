import { describe, it, expect, beforeEach } from 'vitest';
import { SessionDiffTracker } from '../../src/services/session-diff-tracker.js';
import type { Session } from '../../src/models/index.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: null,
    pid: 100,
    hostPid: null,
    pidSource: null,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
    reconciled: false,
    yoloMode: false,
    ...overrides,
  };
}

describe('SessionDiffTracker', () => {
  let tracker: SessionDiffTracker;

  beforeEach(() => {
    tracker = new SessionDiffTracker();
  });

  describe('isResting field', () => {
    it('detects resting transition (false -> true) when session.isResting is explicitly set', () => {
      const session = makeSession();
      tracker.seed(session);
      const changes = tracker.update({ ...session, isResting: true });
      expect(changes).not.toBeNull();
      expect(changes!.some((c) => c.field === 'isResting')).toBe(true);
      expect(changes!.find((c) => c.field === 'isResting')?.to).toBe('yes');
    });

    it('detects activity-resumed transition (true -> false)', () => {
      const session = makeSession();
      tracker.seed(session);
      tracker.update({ ...session, isResting: true });
      const changes = tracker.update({ ...session, isResting: false });
      expect(changes).not.toBeNull();
      expect(changes!.some((c) => c.field === 'isResting')).toBe(true);
      expect(changes!.find((c) => c.field === 'isResting')?.to).toBe('no');
    });

    it('does not report isResting change for DB sessions (isResting undefined)', () => {
      const session = makeSession();
      tracker.seed(session);
      tracker.update({ ...session, isResting: true });
      // Simulate a scan-based emit with a plain DB session (no isResting field)
      const dbSession = makeSession({ model: 'claude-opus-4-5' });
      const changes = tracker.update(dbSession);
      // model changed so there are changes, but isResting must not appear
      expect(changes).not.toBeNull();
      expect(changes!.some((c) => c.field === 'isResting')).toBe(false);
    });

    it('preserves baseline isResting when a DB session update carries other changes', () => {
      const session = makeSession();
      tracker.seed(session);
      // Session goes resting
      tracker.update({ ...session, isResting: true });
      // A scan-based update arrives with model change but no isResting
      const withModel = makeSession({ model: 'claude-opus-4-5' });
      tracker.update(withModel);
      // Now activity resumes explicitly
      const resumedChanges = tracker.update({ ...withModel, isResting: false });
      expect(resumedChanges).not.toBeNull();
      expect(resumedChanges!.some((c) => c.field === 'isResting')).toBe(true);
      expect(resumedChanges!.find((c) => c.field === 'isResting')?.from).toBe('yes');
      expect(resumedChanges!.find((c) => c.field === 'isResting')?.to).toBe('no');
    });

    it('returns empty array (no change) when resting state has not changed', () => {
      const session = makeSession();
      tracker.seed(session);
      tracker.update({ ...session, isResting: true });
      // Second resting emit with same state should produce no isResting change
      const changes = tracker.update({ ...session, isResting: true });
      expect(changes).toEqual([]);
    });
  });
});

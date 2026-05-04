import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const { spawn } = await import('child_process');
const { UpdateService } = await import('../../src/services/update-service.js');

function makeProcess(exitCode: number, delay = 0) {
  const proc = new EventEmitter() as NodeJS.EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  if (delay > 0) {
    setTimeout(() => proc.emit('close', exitCode), delay);
  } else {
    setTimeout(() => proc.emit('close', exitCode), 0);
  }
  return proc;
}

describe('UpdateService', () => {
  let service: InstanceType<typeof UpdateService>;

  beforeEach(() => {
    service = new UpdateService('1.0.0');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    service.stopSchedule();
  });

  describe('checkForUpdates()', () => {
    it('sets updateAvailable=true when registry version is newer', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '2.0.0' }),
      }));
      await service.checkForUpdates();
      expect(service.getStatus().updateAvailable).toBe(true);
      expect(service.getStatus().latestVersion).toBe('2.0.0');
    });

    it('sets updateAvailable=false when already on latest version', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.0.0' }),
      }));
      await service.checkForUpdates();
      expect(service.getStatus().updateAvailable).toBe(false);
    });

    it('sets updateAvailable=false when registry version is older', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '0.9.0' }),
      }));
      await service.checkForUpdates();
      expect(service.getStatus().updateAvailable).toBe(false);
    });

    it('silently catches network errors and leaves updateAvailable=false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
      await expect(service.checkForUpdates()).resolves.toBeUndefined();
      expect(service.getStatus().updateAvailable).toBe(false);
    });

    it('silently catches non-ok responses', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      await expect(service.checkForUpdates()).resolves.toBeUndefined();
      expect(service.getStatus().updateAvailable).toBe(false);
    });

    it('silently catches malformed JSON response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'data' }),
      }));
      await service.checkForUpdates();
      expect(service.getStatus().updateAvailable).toBe(false);
    });

    it('sets lastChecked timestamp after a successful check', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.0.0' }),
      }));
      await service.checkForUpdates();
      expect(service.getStatus().lastChecked).not.toBeNull();
      expect(new Date(service.getStatus().lastChecked!).getTime()).toBeGreaterThan(0);
    });
  });

  describe('hasUpdate()', () => {
    it('returns false before any check', () => {
      expect(service.hasUpdate()).toBe(false);
    });

    it('returns true after check finds newer version', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '9.9.9' }),
      }));
      await service.checkForUpdates();
      expect(service.hasUpdate()).toBe(true);
    });
  });

  describe('getStatus()', () => {
    it('returns all UpdateStatus fields with correct initial state', () => {
      const status = service.getStatus();
      expect(status).toMatchObject({
        currentVersion: '1.0.0',
        latestVersion: null,
        updateAvailable: false,
        lastChecked: null,
        updateInProgress: false,
      });
    });
  });

  describe('applyUpdate()', () => {
    it('resolves when npm install exits with code 0', async () => {
      vi.mocked(spawn).mockReturnValue(makeProcess(0) as ReturnType<typeof spawn>);
      await expect(service.applyUpdate()).resolves.toBeUndefined();
    });

    it('rejects when npm install exits with non-zero code', async () => {
      vi.mocked(spawn).mockReturnValue(makeProcess(1) as ReturnType<typeof spawn>);
      await expect(service.applyUpdate()).rejects.toThrow();
    });

    it('sets isUpdateInProgress=true during apply and false after', async () => {
      let capturedDuringApply = false;
      vi.mocked(spawn).mockImplementation(() => {
        const proc = makeProcess(0, 10);
        return proc as ReturnType<typeof spawn>;
      });
      const promise = service.applyUpdate();
      capturedDuringApply = service.isUpdateInProgress;
      await promise;
      expect(capturedDuringApply).toBe(true);
      expect(service.isUpdateInProgress).toBe(false);
    });

    it('resolves (does not reject) after 25-second timeout so exit can continue', async () => {
      vi.useFakeTimers();
      vi.mocked(spawn).mockReturnValue(makeProcess(0, 9999999) as ReturnType<typeof spawn>);
      const applyPromise = service.applyUpdate();
      vi.advanceTimersByTime(26000);
      await expect(applyPromise).resolves.toBeUndefined();
      vi.useRealTimers();
    });

    it('resets isUpdateInProgress to false after timeout', async () => {
      vi.useFakeTimers();
      vi.mocked(spawn).mockReturnValue(makeProcess(0, 9999999) as ReturnType<typeof spawn>);
      const applyPromise = service.applyUpdate();
      vi.advanceTimersByTime(26000);
      await applyPromise;
      expect(service.isUpdateInProgress).toBe(false);
      vi.useRealTimers();
    });
  });
});

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createTaggedLogger } from '../utils/logger.js';
import type { TelemetryService } from './telemetry-service.js';

const log = createTaggedLogger('[UpdateService]', '\x1b[33m');

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/argus-ai-hub/latest';
const DEFAULT_CHECK_INTERVAL_MS = 4 * 3600_000;
const APPLY_TIMEOUT_MS = 25_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: string | null;
  updateInProgress: boolean;
}

function readPackageVersion(): string {
  if (process.env.ARGUS_VERSION) return process.env.ARGUS_VERSION;
  try {
    const req = createRequire(import.meta.url);
    const pkg = req(join(__dirname, '..', '..', '..', 'package.json')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseVersion(v: string): [number, number, number] | null {
  const parts = v.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts as [number, number, number];
}

function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  if (!l || !c) return false;
  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}

export class UpdateService {
  private readonly currentVersion: string;
  private latestVersion: string | null = null;
  private updateAvailable = false;
  private lastChecked: string | null = null;
  private _updateInProgress = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private telemetry: TelemetryService | null = null;

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  setTelemetryService(telemetry: TelemetryService): void {
    this.telemetry = telemetry;
  }

  get isUpdateInProgress(): boolean {
    return this._updateInProgress;
  }

  getStatus(): UpdateStatus {
    return {
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      updateAvailable: this.updateAvailable,
      lastChecked: this.lastChecked,
      updateInProgress: this._updateInProgress,
    };
  }

  hasUpdate(): boolean {
    return this.updateAvailable;
  }

  async checkForUpdates(): Promise<void> {
    try {
      const res = await fetch(NPM_REGISTRY_URL, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const data = await res.json() as Record<string, unknown>;
      const latest = typeof data.version === 'string' ? data.version : null;
      if (!latest) return;
      const wasAvailable = this.updateAvailable;
      this.latestVersion = latest;
      this.updateAvailable = isNewer(latest, this.currentVersion);
      this.lastChecked = new Date().toISOString();
      if (this.updateAvailable) {
        log.info({ latestVersion: latest, currentVersion: this.currentVersion }, 'Update available');
        if (!wasAvailable) {
          this.telemetry?.sendEvent('update_available', { currentVersion: this.currentVersion, latestVersion: latest });
        }
      }
    } catch {
      // silent: network errors must not surface to the user (FR-009)
    }
  }

  scheduleChecks(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
    void this.checkForUpdates();
    this.intervalHandle = setInterval(() => void this.checkForUpdates(), intervalMs);
  }

  stopSchedule(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  applyUpdate(): Promise<void> {
    this._updateInProgress = true;
    log.info('Applying update...');

    return new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        log.warn('Update timed out after 25 seconds, continuing exit');
        this.telemetry?.sendEvent('update_failed', { currentVersion: this.currentVersion, latestVersion: this.latestVersion ?? 'unknown', exitCode: 'timeout' });
        this._updateInProgress = false;
        resolve();
      }, APPLY_TIMEOUT_MS);

      const customCmd = process.env.ARGUS_UPDATE_CMD;
      const [cmd, ...args] = customCmd
        ? customCmd.split(' ')
        : ['npm', 'install', '-g', 'argus-ai-hub@latest'];
      const proc = spawn(cmd, args, { shell: true });

      proc.stdout?.on('data', (chunk: Buffer) => log.info(chunk.toString().trim()));
      proc.stderr?.on('data', (chunk: Buffer) => log.warn(chunk.toString().trim()));

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this._updateInProgress = false;
        if (code === 0) {
          log.info('Update applied successfully');
          this.telemetry?.sendEvent('update_succeeded', { currentVersion: this.currentVersion, latestVersion: this.latestVersion ?? 'unknown' });
          resolve();
        } else {
          log.warn({ exitCode: code }, 'Update failed with non-zero exit code');
          this.telemetry?.sendEvent('update_failed', { currentVersion: this.currentVersion, latestVersion: this.latestVersion ?? 'unknown', exitCode: String(code ?? -1) });
          reject(new Error(`npm install exited with code ${code}`));
        }
      });
    });
  }
}

export const updateService = new UpdateService(readPackageVersion());

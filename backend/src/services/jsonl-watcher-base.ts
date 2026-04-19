import { existsSync } from 'fs';
import { open as fsOpen, stat as fsStat } from 'fs/promises';
import chokidar, { type FSWatcher } from 'chokidar';
import { OutputStore } from './output-store.js';
import { applyActivityUpdate, applyModelUpdate, applySummaryUpdate } from './watcher-session-helpers.js';
import type { SessionOutput } from '../models/index.js';

export const TAIL_BYTES = 16 * 1024;

/** Extracts the model name from any JSONL line, regardless of format. */
function parseModelFromLine(line: string): string | null {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    // Claude format: message.model on assistant entries
    const msg = obj.message as Record<string, unknown> | undefined;
    if (typeof msg?.model === 'string') return msg.model;
    // Copilot flat format: top-level model on assistant.message events
    if (typeof obj.model === 'string') return obj.model;
    // Copilot nested format: data.model on tool.execution_complete events
    const data = obj.data as Record<string, unknown> | undefined;
    if (typeof data?.model === 'string') return data.model;
    return null;
  } catch { return null; }
}

export abstract class JsonlWatcherBase {
  protected readonly watchers = new Map<string, FSWatcher>();
  protected readonly filePositions = new Map<string, number>();
  protected readonly sequenceCounters = new Map<string, number>();
  protected readonly outputStore = new OutputStore();

  protected abstract readonly tag: string;
  protected abstract parseLine(line: string, sessionId: string, seq: number): SessionOutput[];

  protected async attachWatcher(sessionId: string, filePath: string): Promise<void> {
    if (this.watchers.has(sessionId)) return;
    if (!existsSync(filePath)) return;

    let fileSize: number;
    try {
      ({ size: fileSize } = await fsStat(filePath));
    } catch { return; }
    this.filePositions.set(sessionId, Math.max(0, fileSize - TAIL_BYTES));
    this.sequenceCounters.set(sessionId, 0);
    await this.readNewLines(sessionId, filePath);

    const watcher = chokidar.watch(filePath, { persistent: false, usePolling: false });
    watcher.on('change', () => { this.readNewLines(sessionId, filePath).catch(() => {}); });
    this.watchers.set(sessionId, watcher);
  }

  protected async readNewLines(sessionId: string, filePath: string): Promise<void> {
    try {
      const { size: currentSize } = await fsStat(filePath);
      const lastPos = this.filePositions.get(sessionId) ?? 0;
      if (currentSize <= lastPos) return;

      const fh = await fsOpen(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - lastPos);
      await fh.read(buffer, 0, buffer.length, lastPos);
      await fh.close();
      this.filePositions.set(sessionId, currentSize);

      const lines = buffer.toString('utf-8').split('\n').filter(l => l.trim());
      let seq = this.sequenceCounters.get(sessionId) ?? 0;
      const outputs: SessionOutput[] = [];
      let detectedModel: string | null = null;

      for (const line of lines) {
        seq++;
        outputs.push(...this.parseLine(line, sessionId, seq));
        if (!detectedModel) detectedModel = parseModelFromLine(line);
      }

      this.sequenceCounters.set(sessionId, seq);
      if (outputs.length > 0) {
        this.outputStore.insertOutput(sessionId, outputs);
        applyActivityUpdate(sessionId);
      }
      if (detectedModel) applyModelUpdate(sessionId, detectedModel, this.tag);
      applySummaryUpdate(sessionId, outputs, this.tag);
    } catch { /* ignore */ }
  }

  stopWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close().catch(() => {});
    }
    this.watchers.clear();
    this.filePositions.clear();
    this.sequenceCounters.clear();
  }
}

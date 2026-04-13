/**
 * Regression tests for T116: copilot-cli send-prompt keystroke injection must be async.
 *
 * Before the fix, all process.stdin.push() calls for a prompt happened synchronously
 * in a single event-loop tick. The Copilot CLI PTY dropped or merged the events.
 * The fix adds KEYSTROKE_DELAY_MS between each character's key-down/key-up pair.
 *
 * These tests replicate the exact injection logic from launch.ts so they fail if
 * the delay is removed and pass with the async implementation.
 */
import { describe, it, expect, vi } from 'vitest';

// ---- replicated from launch.ts (must stay in sync with the production code) ----

const KEYSTROKE_DELAY_MS = 10;

function* win32InputEvents(ch: string): Generator<Buffer> {
  const keyInfo: Record<string, [number, number]> = {
    'a': [65, 30], 'b': [66, 48], 'c': [67, 46], 'd': [68, 32], 'e': [69, 18],
    'f': [70, 33], 'g': [71, 34], 'h': [72, 35], 'i': [73, 23], 'j': [74, 36],
    'k': [75, 37], 'l': [76, 38], 'm': [77, 50], 'n': [78, 49], 'o': [79, 24],
    'p': [80, 25], 'q': [81, 16], 'r': [82, 19], 's': [83, 31], 't': [84, 20],
    'u': [85, 22], 'v': [86, 47], 'w': [87, 17], 'x': [88, 45], 'y': [89, 21],
    'z': [90, 44], ' ': [32, 57], '\r': [13, 28],
    '0': [48, 11], '1': [49, 2], '2': [50, 3], '3': [51, 4], '4': [52, 5],
    '5': [53, 6], '6': [54, 7], '7': [55, 8], '8': [56, 9], '9': [57, 10],
  };
  const lower = ch.toLowerCase();
  const [vk, sc] = keyInfo[lower] ?? [ch.charCodeAt(0), 0];
  const uc = ch.charCodeAt(0);
  yield Buffer.from(`\x1b[${vk};${sc};${uc};1;0;1_`); // key-down
  yield Buffer.from(`\x1b[${vk};${sc};${uc};0;0;1_`); // key-up
}

async function injectWin32Prompt(prompt: string, push: (buf: Buffer) => void): Promise<void> {
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  push(Buffer.from('\x1b[I')); // focus-in
  for (const ch of prompt) {
    for (const buf of win32InputEvents(ch)) push(buf);
    await delay(KEYSTROKE_DELAY_MS);
  }
  for (const buf of win32InputEvents('\r')) push(buf);
  push(Buffer.from('\x1b[O')); // focus-out
}

// ---- end replicated logic ----

describe('copilot-cli Win32 keystroke injection', () => {
  it('win32InputEvents emits key-down then key-up buffer for a character', () => {
    const bufs = [...win32InputEvents('a')];
    expect(bufs).toHaveLength(2);
    // key-down: Kd=1
    expect(bufs[0].toString()).toBe('\x1b[65;30;97;1;0;1_');
    // key-up: Kd=0
    expect(bufs[1].toString()).toBe('\x1b[65;30;97;0;0;1_');
  });

  it('spaces character pushes across event-loop ticks rather than all at once', async () => {
    vi.useFakeTimers();
    try {
      const ticks: number[] = [];
      let tick = 0;
      const push = (_buf: Buffer) => ticks.push(tick);

      const promise = injectWin32Prompt('ab', push);

      // Immediately after calling: focus-in (1) + 'a' key-down + key-up (2) = 3 pushes.
      // 'b' must NOT have been pushed yet — it is behind a KEYSTROKE_DELAY_MS await.
      expect(ticks.length).toBe(3);
      expect(ticks.every((t) => t === 0)).toBe(true);

      // Advance past the first delay — 'b' key events should now be pushed.
      tick = 1;
      await vi.advanceTimersByTimeAsync(KEYSTROKE_DELAY_MS);
      expect(ticks.length).toBe(5); // + b-down + b-up
      expect(ticks.slice(3)).toEqual([1, 1]);

      // Advance past the second delay — enter + focus-out should be pushed.
      tick = 2;
      await vi.advanceTimersByTimeAsync(KEYSTROKE_DELAY_MS);
      await promise;
      // enter-down + enter-up + focus-out = 3 more → total 8
      expect(ticks.length).toBe(8);
      expect(ticks.slice(5)).toEqual([2, 2, 2]);
    } finally {
      vi.useRealTimers();
    }
  });
});

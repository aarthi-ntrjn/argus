import { describe, it, expect } from 'vitest';
import { resolveLaunchCommand } from '../src/cli/launch-command-resolver.js';

describe('resolveLaunchCommand', () => {
  it('resolves "claude" to claude-code session type', () => {
    const result = resolveLaunchCommand(['claude']);
    expect(result).toEqual({ sessionType: 'claude-code', cmd: 'claude', cmdArgs: [] });
  });

  it('resolves "claude" with extra args', () => {
    const result = resolveLaunchCommand(['claude', '--dangerously-skip-permissions']);
    expect(result).toEqual({
      sessionType: 'claude-code',
      cmd: 'claude',
      cmdArgs: ['--dangerously-skip-permissions'],
    });
  });

  it('resolves "copilot" (standalone CLI) to copilot-cli session type', () => {
    const result = resolveLaunchCommand(['copilot']);
    expect(result).toEqual({ sessionType: 'copilot-cli', cmd: 'copilot', cmdArgs: [] });
  });

  it('resolves "copilot" with extra args', () => {
    const result = resolveLaunchCommand(['copilot', '--some-flag']);
    expect(result).toEqual({ sessionType: 'copilot-cli', cmd: 'copilot', cmdArgs: ['--some-flag'] });
  });

  it('defaults to claude-code for unknown commands', () => {
    const result = resolveLaunchCommand(['mycli', '--some-flag']);
    expect(result).toEqual({ sessionType: 'claude-code', cmd: 'mycli', cmdArgs: ['--some-flag'] });
  });

  it('throws for empty args', () => {
    expect(() => resolveLaunchCommand([])).toThrow(/no command/i);
  });
});

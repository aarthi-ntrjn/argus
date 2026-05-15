import { describe, it, expect } from 'vitest';
import { resolveLaunchCommand } from '../src/launch-pty/launch-command-resolver.js';

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

  it('resolves "gh copilot" to copilot-cli session type', () => {
    const result = resolveLaunchCommand(['gh', 'copilot']);
    expect(result).toEqual({ sessionType: 'copilot-cli', cmd: 'gh', cmdArgs: ['copilot'] });
  });

  it('resolves "gh copilot" with extra args', () => {
    const result = resolveLaunchCommand(['gh', 'copilot', '--allow-all']);
    expect(result).toEqual({
      sessionType: 'copilot-cli',
      cmd: 'gh',
      cmdArgs: ['copilot', '--allow-all'],
    });
  });

  it('resolves an absolute copilot path to copilot-cli session type', () => {
    const result = resolveLaunchCommand(['/home/ubuntu/.local/bin/copilot', '--allow-all']);
    expect(result).toEqual({
      sessionType: 'copilot-cli',
      cmd: '/home/ubuntu/.local/bin/copilot',
      cmdArgs: ['--allow-all'],
    });
  });

  it('defaults to claude-code for unknown commands', () => {
    const result = resolveLaunchCommand(['mycli', '--some-flag']);
    expect(result).toEqual({ sessionType: 'claude-code', cmd: 'mycli', cmdArgs: ['--some-flag'] });
  });

  it('throws for empty args', () => {
    expect(() => resolveLaunchCommand([])).toThrow(/no command/i);
  });
});

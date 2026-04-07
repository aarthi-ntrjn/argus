import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgusLaunchClient } from '../src/cli/argus-launch-client.js';

// Mock ws so tests don't open real connections.
// send() accepts an optional callback (called when data is flushed).
// once() + close() simulate the close handshake.
const { MockWebSocket } = vi.hoisted(() => {
  const ctor = vi.fn().mockImplementation(() => {
    const listeners = new Map<string, Function>();
    return {
      on: vi.fn(),
      once: vi.fn((event: string, cb: Function) => { listeners.set(event, cb); }),
      send: vi.fn((_data: string, cb?: () => void) => { if (cb) cb(); }),
      close: vi.fn(function (this: { _listeners: Map<string, Function> }) {
        // Simulate async close: fire the 'close' listener on next tick
        const closeCb = listeners.get('close');
        if (closeCb) setTimeout(closeCb, 0);
      }),
      readyState: 1,
      _listeners: listeners,
    };
  });
  (ctor as unknown as { OPEN: number }).OPEN = 1;
  return { MockWebSocket: ctor };
});

vi.mock('ws', () => ({
  default: MockWebSocket,
  WebSocket: MockWebSocket,
}));

describe('ArgusLaunchClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends register message on open', async () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;

    const openHandler = mockWs.on.mock.calls.find((c: string[]) => c[0] === 'open')?.[1];
    expect(openHandler).toBeDefined();

    const registerInfo = { sessionId: 'abc-123', pid: 5555, sessionType: 'claude-code' as const, cwd: '/tmp' };
    client.setRegisterInfo(registerInfo);
    openHandler();

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'register', ...registerInfo })
    );
  });

  it('invokes onSendPrompt callback when send_prompt message arrives', () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;

    const onPrompt = vi.fn();
    client.onSendPrompt(onPrompt);

    const messageHandler = mockWs.on.mock.calls.find((c: string[]) => c[0] === 'message')?.[1];
    expect(messageHandler).toBeDefined();

    messageHandler(Buffer.from(JSON.stringify({ type: 'send_prompt', actionId: 'action-1', prompt: 'do something' })));
    expect(onPrompt).toHaveBeenCalledWith('action-1', 'do something');
  });

  it('sends prompt_delivered after successful delivery', () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 1;

    client.ackDelivered('action-99');
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'prompt_delivered', actionId: 'action-99' })
    );
  });

  it('sends prompt_failed with error message', () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 1;

    client.ackFailed('action-88', 'PTY closed');
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'prompt_failed', actionId: 'action-88', error: 'PTY closed' })
    );
  });

  it('sends session_ended and waits for WS close before resolving', async () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 1;

    const promise = client.notifySessionEnded('sess-1', 0);
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'session_ended', sessionId: 'sess-1', exitCode: 0 }),
      expect.any(Function)
    );
    expect(mockWs.close).toHaveBeenCalled();

    // Promise resolves after the close event fires (async via setTimeout)
    await promise;
  });

  it('notifySessionEnded resolves immediately if WS is not open', async () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 3; // CLOSED

    await client.notifySessionEnded('sess-2', 1);
    expect(mockWs.send).not.toHaveBeenCalled();
    expect(mockWs.close).not.toHaveBeenCalled();
  });
});

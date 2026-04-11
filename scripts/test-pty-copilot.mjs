// test-pty-copilot.mjs — standalone PTY test for copilot input injection
// Run from repo root: node scripts/test-pty-copilot.mjs
import { spawn } from 'node-pty';

const pty = spawn('powershell.exe', ['-NoProfile', '-Command', 'copilot'], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
  env: process.env,
});

let outputLog = '';

pty.onData((data) => {
  process.stdout.write(data);
  outputLog += data;
});

pty.onExit(({ exitCode }) => {
  // process.stderr.write(`\n[test] PTY exited with code ${exitCode}\n`);
  process.exit(exitCode ?? 0);
});

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function toHex(str) {
  return Buffer.from(str, 'binary').toString('hex').match(/../g).join(' ');
}

async function run() {
  // process.stderr.write('[test] Waiting 5s for copilot to show its input prompt...\n');
  await sleep(5000);

  // Snapshot what copilot has rendered so far
  // process.stderr.write(`[test] Output so far (hex):\n${toHex(outputLog)}\n\n`);

  // Test 1: single character — does anything echo?
  // process.stderr.write('[test] Writing single char "a" — watch for echo...\n');
  outputLog = '';
  pty.write('a');
  await sleep(1000);
  // process.stderr.write(`[test] Output after "a" (hex): ${toHex(outputLog)}\n`);

  // Test 2: character-by-character with 50ms delays
  const PROMPT = 'list files';
  // process.stderr.write(`\n[test] Writing "${PROMPT}" char-by-char with 50ms delays...\n`);
  outputLog = '';
  for (const ch of PROMPT) {
    pty.write(ch);
    await sleep(50);
  }
  await sleep(500);
  // process.stderr.write(`[test] Output after typing (hex): ${toHex(outputLog)}\n`);

  // Test 3: send Enter
  // process.stderr.write('[test] Sending \\r (Enter)...\n');
  outputLog = '';
  pty.write('\r');
  await sleep(5000);
  // process.stderr.write(`[test] Output after Enter (hex): ${toHex(outputLog)}\n`);

  pty.kill();
}

run().catch(err => {
  // process.stderr.write(`[test] Error: ${err}\n`);
  pty.kill();
});

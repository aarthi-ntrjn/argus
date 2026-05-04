/**
 * One-time script to remove test repos that leaked into ~/.argus/argus.db
 * and restore todos from the April 26 backup.
 *
 * Run with: node scripts/fix-polluted-db.mjs
 */
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const liveDbPath = process.env.ARGUS_DB_PATH ?? join(homedir(), '.argus', 'argus.db');
const backupDbPath = join(homedir(), '.argus', 'backups', '20260426-185918-argus.db');

const TEST_REPO_IDS = [
  '8e0cab72-4f49-4952-8f83-c929567fa43f',
  'interrupt-test-repo',
  'interrupt-test-repo-2',
  'pid-val-repo-1',
  'pid-val-repo-2',
  'pid-val-repo-3',
  'pid-val-repo-4',
  'hook-conflict-repo',
  'hook-match-repo',
];

const live = new Database(liveDbPath);
live.pragma('foreign_keys = ON');

console.log('=== Cleaning test repos from live DB ===');
let removed = 0;
for (const id of TEST_REPO_IDS) {
  const repo = live.prepare('SELECT id, path FROM repositories WHERE id = ?').get(id);
  if (!repo) {
    console.log(`  SKIP  ${id} (not found)`);
    continue;
  }
  live.prepare('DELETE FROM control_actions WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  live.prepare('DELETE FROM session_output  WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  live.prepare('DELETE FROM teams_threads   WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  live.prepare('DELETE FROM slack_threads   WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  live.prepare('DELETE FROM sessions    WHERE repository_id = ?').run(id);
  live.prepare('DELETE FROM repositories WHERE id = ?').run(id);
  console.log(`  REMOVED  ${id}  (${repo.path})`);
  removed++;
}
console.log(`Removed ${removed} test repos.\n`);

console.log('=== Restoring todos from backup ===');
let backup;
try {
  backup = new Database(backupDbPath, { readonly: true });
} catch (e) {
  console.warn(`Could not open backup at ${backupDbPath}: ${e.message}`);
  console.warn('Skipping todo restore.');
  live.close();
  process.exit(0);
}

const backupTodos = backup.prepare('SELECT id, user_id, text, done, created_at, updated_at FROM todos').all();
console.log(`Backup has ${backupTodos.length} todos.`);

const liveTodos = live.prepare('SELECT id FROM todos').all().map(r => r.id);
console.log(`Live DB currently has ${liveTodos.length} todos.`);

let restored = 0;
for (const todo of backupTodos) {
  if (liveTodos.includes(todo.id)) {
    console.log(`  SKIP  "${todo.text}" (already exists)`);
    continue;
  }
  live.prepare('INSERT INTO todos (id, user_id, text, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    todo.id, todo.user_id, todo.text, todo.done, todo.created_at, todo.updated_at
  );
  console.log(`  RESTORED  "${todo.text}"`);
  restored++;
}
console.log(`Restored ${restored} todos.\n`);

const finalTodos = live.prepare('SELECT text, done FROM todos ORDER BY created_at').all();
console.log('=== Final todos in live DB ===');
for (const t of finalTodos) {
  console.log(`  [${t.done ? 'x' : ' '}] ${t.text}`);
}

backup.close();
live.close();
console.log('\nDone.');

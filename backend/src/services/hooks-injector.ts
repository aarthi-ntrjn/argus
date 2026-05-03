/**
 * Common interface for hooks injectors.
 *
 * Claude Code writes one global file (~/.claude/settings.json), so per-repo
 * operations either map to a global rewrite (injectForRepo) or are no-ops
 * (removeForRepo). Copilot writes a per-repo file, so all operations are
 * strictly scoped to the given repository path.
 *
 * The asymmetry is intentional and visible here by design.
 */
export interface HooksInjector {
  /** Write/refresh hooks for all registered repositories. */
  injectForAll(): void;
  /**
   * Write/refresh hooks for a single repository.
   * Claude Code: equivalent to injectForAll (global file).
   * Copilot: scoped to <repoPath>/.github/hooks/hooks.json.
   */
  injectForRepo(repoPath: string): void;
  /**
   * Remove Argus hooks for a single repository.
   * Claude Code: no-op (global file cannot be scoped per repo; use removeAll).
   * Copilot: removes Argus entries from <repoPath>/.github/hooks/hooks.json.
   */
  removeForRepo(repoPath: string): void;
  /** Remove all Argus hooks across all repositories. */
  removeAll(): void;
}

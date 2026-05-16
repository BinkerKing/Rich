import type { ChildProcess } from "node:child_process";

/**
 * Process-wide registry of live AI child processes (Codex spawns).
 * On shutdown we iterate and signal them so the OS doesn't get a zombie cluster.
 */
class ChildRegistry {
  private live = new Set<ChildProcess>();

  register(child: ChildProcess): () => void {
    this.live.add(child);
    const cleanup = () => this.live.delete(child);
    child.once("exit", cleanup);
    return cleanup;
  }

  size(): number { return this.live.size; }

  /** Send SIGTERM to everything, give them 1s to exit, then SIGKILL stragglers. */
  async terminateAll(graceMs = 1000): Promise<void> {
    if (this.live.size === 0) return;
    for (const c of this.live) c.kill("SIGTERM");
    const deadline = Date.now() + graceMs;
    while (this.live.size > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50));
    }
    for (const c of this.live) c.kill("SIGKILL");
  }
}

export const childRegistry = new ChildRegistry();

/**
 * Install one-time signal handlers that drain the registry before exit.
 * Idempotent: safe to call multiple times (only first registers).
 */
let installed = false;
export function installShutdownHandlers(opts: { onShutdown?: () => Promise<void> | void } = {}): void {
  if (installed) return;
  installed = true;
  const handle = async (sig: NodeJS.Signals) => {
    process.stderr.write(`\n[ke] received ${sig}, draining ${childRegistry.size()} child processes…\n`);
    try { await opts.onShutdown?.(); } catch { /* swallow */ }
    await childRegistry.terminateAll(1000);
    process.exit(0);
  };
  process.once("SIGINT", () => void handle("SIGINT"));
  process.once("SIGTERM", () => void handle("SIGTERM"));
}

/**
 * Per-key serialization. Two `run(k, ...)` calls with the same key execute
 * sequentially; different keys run in parallel. Prevents concurrent AI
 * operations on the same element from clobbering each other's writes.
 */
export class KeyedLock {
  private chains = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    // Swallow upstream errors so one failure doesn't poison the queue,
    // but propagate this task's own result/error.
    const next = prev.then(() => fn(), () => fn());
    this.chains.set(key, next.catch(() => undefined));
    return next;
  }
}

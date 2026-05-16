/**
 * Per-key serialization. Two `run(k, ...)` calls with the same key execute
 * sequentially; different keys run in parallel. Prevents concurrent AI
 * operations on the same element from clobbering each other's writes.
 *
 * Memory: the chain entry for a key is deleted once the queue drains, so the
 * map never grows beyond the number of keys *currently* in flight.
 */
export class KeyedLock {
  private chains = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    // Swallow upstream errors so one failure doesn't poison the queue,
    // but propagate this task's own result/error.
    const next = prev.then(() => fn(), () => fn());
    const slot = next.catch(() => undefined);
    this.chains.set(key, slot);
    try {
      return await next;
    } finally {
      // If no further callers queued behind us, drop the entry.
      // Comparing object identity is safe because each call creates a fresh
      // `.catch()` promise; if anyone called .run() after us, chains.get(key)
      // now points at a different promise.
      if (this.chains.get(key) === slot) {
        this.chains.delete(key);
      }
    }
  }

  /** Number of keys with at least one task currently queued. For health checks. */
  size(): number { return this.chains.size; }
}

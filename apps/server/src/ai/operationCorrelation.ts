import { randomUUID } from "node:crypto";

export interface OperationCorrelationRegistryOptions {
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Server-issued, short-lived capability linking one agent turn to its op log. */
export class OperationCorrelationRegistry {
  private readonly operations = new Map<string, string>();
  private readonly expirationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly ttlMs: number;

  constructor(options: OperationCorrelationRegistryOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  issue(operationId: string): string {
    const token = `mcp-${randomUUID()}`;
    this.operations.set(token, operationId);
    const timer = setTimeout(() => this.release(token), this.ttlMs);
    timer.unref?.();
    this.expirationTimers.set(token, timer);
    return token;
  }

  resolve(token: string): string | undefined {
    return this.operations.get(token);
  }

  release(token: string): void {
    this.operations.delete(token);
    const timer = this.expirationTimers.get(token);
    if (timer) clearTimeout(timer);
    this.expirationTimers.delete(token);
  }
}

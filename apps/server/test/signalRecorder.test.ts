import { describe, it, expect } from "vitest";
import { recordSignal } from "../src/ai/signalRecorder.js";
import type { Signal } from "@ke/domain";
import type { SignalsRepo, SignalsQuery } from "../src/repos/SignalsRepo.js";

class InMemoryRepo implements SignalsRepo {
  store: Signal[] = [];
  async append(s: Signal): Promise<void> { this.store.push(s); }
  async list(q: SignalsQuery = {}): Promise<Signal[]> {
    let all = this.store.slice();
    if (q.elementId) all = all.filter(s => s.elementId === q.elementId);
    if (q.since) all = all.filter(s => s.ts >= q.since!);
    return all;
  }
  async count(): Promise<number> { return this.store.length; }
}

const base = (overrides: Partial<Signal> = {}): Signal => ({
  ts: overrides.ts ?? new Date().toISOString(),
  type: overrides.type ?? "op.completed",
  manual: overrides.manual ?? "knowledge",
  ...overrides,
});

describe("recordSignal", () => {
  it("appends the primary signal", async () => {
    const repo = new InMemoryRepo();
    await recordSignal(repo, base({ elementId: "x", op: "refine" }));
    expect(repo.store).toHaveLength(1);
    expect(repo.store[0].type).toBe("op.completed");
  });

  it("does not derive secondary when no elementId", async () => {
    const repo = new InMemoryRepo();
    await recordSignal(repo, base({ op: "generate-tree" }));
    expect(repo.store).toHaveLength(1);
  });

  it("derives user.repeated_op on 2nd op for same element", async () => {
    const repo = new InMemoryRepo();
    await recordSignal(repo, base({ elementId: "x", op: "refine" }));
    await recordSignal(repo, base({ elementId: "x", op: "refine" }));
    const types = repo.store.map(s => s.type);
    expect(types).toContain("user.repeated_op");
    expect(types.filter(t => t === "user.repeated_op")).toHaveLength(1);
  });

  it("derives user.frustrated on 3rd op for same element", async () => {
    const repo = new InMemoryRepo();
    await recordSignal(repo, base({ elementId: "x", op: "refine" }));
    await recordSignal(repo, base({ elementId: "x", op: "refine" }));
    await recordSignal(repo, base({ elementId: "x", op: "refine" }));
    const types = repo.store.map(s => s.type);
    expect(types).toContain("user.frustrated");
  });

  it("does not escalate when ops are on different elements", async () => {
    const repo = new InMemoryRepo();
    await recordSignal(repo, base({ elementId: "a", op: "refine" }));
    await recordSignal(repo, base({ elementId: "b", op: "refine" }));
    await recordSignal(repo, base({ elementId: "c", op: "refine" }));
    expect(repo.store.map(s => s.type).filter(t => t.startsWith("user."))).toHaveLength(0);
  });

  it("respects the 30-minute window (out-of-window ops not counted)", async () => {
    const repo = new InMemoryRepo();
    const longAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await recordSignal(repo, base({ ts: longAgo, elementId: "x", op: "refine" }));
    await recordSignal(repo, base({ elementId: "x", op: "refine" }));
    expect(repo.store.map(s => s.type).filter(t => t.startsWith("user."))).toHaveLength(0);
  });
});

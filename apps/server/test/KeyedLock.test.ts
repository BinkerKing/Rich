import { describe, it, expect } from "vitest";
import { KeyedLock } from "../src/lib/KeyedLock.js";

describe("KeyedLock", () => {
  it("serializes calls for the same key", async () => {
    const lock = new KeyedLock();
    const order: string[] = [];
    const a = lock.run("k", async () => {
      order.push("a-start");
      await new Promise(r => setTimeout(r, 20));
      order.push("a-end");
    });
    const b = lock.run("k", async () => {
      order.push("b-start");
    });
    await Promise.all([a, b]);
    expect(order).toEqual(["a-start", "a-end", "b-start"]);
  });

  it("runs different keys in parallel", async () => {
    const lock = new KeyedLock();
    const order: string[] = [];
    const a = lock.run("k1", async () => {
      order.push("k1-start");
      await new Promise(r => setTimeout(r, 30));
      order.push("k1-end");
    });
    const b = lock.run("k2", async () => {
      order.push("k2-start");
      await new Promise(r => setTimeout(r, 10));
      order.push("k2-end");
    });
    await Promise.all([a, b]);
    expect(order).toEqual(["k1-start", "k2-start", "k2-end", "k1-end"]);
  });

  it("returns the task result", async () => {
    const lock = new KeyedLock();
    const result = await lock.run("k", async () => 42);
    expect(result).toBe(42);
  });

  it("propagates task error to caller", async () => {
    const lock = new KeyedLock();
    await expect(lock.run("k", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });

  it("does not poison queue on error", async () => {
    const lock = new KeyedLock();
    const a = lock.run("k", async () => { throw new Error("a fails"); }).catch(() => "caught");
    const b = lock.run("k", async () => "b ok");
    expect(await a).toBe("caught");
    expect(await b).toBe("b ok");
  });

  it("releases chain entry after draining (no memory leak)", async () => {
    const lock = new KeyedLock();
    await lock.run("k1", async () => 1);
    await lock.run("k2", async () => 2);
    await lock.run("k3", async () => 3);
    expect(lock.size()).toBe(0);
  });

  it("retains chain entry while operation is in flight", async () => {
    const lock = new KeyedLock();
    let release: () => void;
    const blocker = new Promise<void>((r) => { release = r; });
    const inFlight = lock.run("k", async () => { await blocker; });
    // Allow the microtask to register the slot.
    await new Promise(r => setTimeout(r, 0));
    expect(lock.size()).toBe(1);
    release!();
    await inFlight;
    expect(lock.size()).toBe(0);
  });
});

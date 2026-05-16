import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Element, Relation } from "@ke/domain";
import { JsonElementsRepo } from "../src/repos/JsonElementsRepo.js";
import { CachedElementsRepo } from "../src/repos/CachedElementsRepo.js";
import { JsonRelationsRepo } from "../src/repos/JsonRelationsRepo.js";
import { CachedRelationsRepo } from "../src/repos/CachedRelationsRepo.js";
import type { ElementsRepo } from "../src/repos/ElementsRepo.js";
import type { RelationsRepo } from "../src/repos/RelationsRepo.js";

const elFactory = (id: string): Element => ({
  id, type: "concept", title: id, content: {},
  metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
});
const relFactory = (id: string, from: string, to: string): Relation => ({
  id, from, to, kind: "child", createdAt: "",
});

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ke-cache-")); });

describe("CachedElementsRepo", () => {
  it("delegates list/get/put to underlying", async () => {
    const inner = new JsonElementsRepo(dir);
    const cached = new CachedElementsRepo(inner);
    await cached.put(elFactory("a"));
    await cached.put(elFactory("b"));
    expect((await cached.list()).map(e => e.id).sort()).toEqual(["a", "b"]);
    expect((await cached.get("a"))?.id).toBe("a");
    expect(await cached.get("missing")).toBeNull();
  });

  it("serves reads from cache after first load (counted)", async () => {
    // Spy: count how many times underlying.list() is called.
    let listCalls = 0;
    const inner: ElementsRepo = {
      list: async () => { listCalls++; return [elFactory("a")]; },
      get: async (id) => id === "a" ? elFactory("a") : null,
      put: async () => {},
    };
    const cached = new CachedElementsRepo(inner);
    await cached.list();
    await cached.list();
    await cached.get("a");
    await cached.get("a");
    expect(listCalls).toBe(1); // only first call hits underlying
  });

  it("invalidate forces reload", async () => {
    let listCalls = 0;
    const inner: ElementsRepo = {
      list: async () => { listCalls++; return []; },
      get: async () => null, put: async () => {},
    };
    const cached = new CachedElementsRepo(inner);
    await cached.list();
    cached.invalidate();
    await cached.list();
    expect(listCalls).toBe(2);
  });

  it("put updates cache without reload", async () => {
    let listCalls = 0;
    const inner: ElementsRepo = {
      list: async () => { listCalls++; return [elFactory("a")]; },
      get: async () => null,
      put: async () => {},
    };
    const cached = new CachedElementsRepo(inner);
    await cached.list();
    await cached.put(elFactory("b"));
    expect((await cached.list()).map(e => e.id).sort()).toEqual(["a", "b"]);
    expect(listCalls).toBe(1);
  });
});

describe("CachedRelationsRepo", () => {
  it("byFrom/byTo use indexes", async () => {
    const inner = new JsonRelationsRepo(dir);
    const cached = new CachedRelationsRepo(inner);
    await cached.append([
      relFactory("r1", "a", "b"),
      relFactory("r2", "a", "c"),
      relFactory("r3", "x", "b"),
    ]);
    expect((await cached.byFrom("a")).map(r => r.id).sort()).toEqual(["r1", "r2"]);
    expect((await cached.byTo("b")).map(r => r.id).sort()).toEqual(["r1", "r3"]);
  });

  it("serves repeated byFrom from index, not underlying.list", async () => {
    let listCalls = 0;
    const inner: RelationsRepo = {
      list: async () => { listCalls++; return [relFactory("r1", "a", "b")]; },
      byFrom: async () => { throw new Error("unused"); },
      byTo: async () => { throw new Error("unused"); },
      append: async () => {},
    };
    const cached = new CachedRelationsRepo(inner);
    await cached.byFrom("a");
    await cached.byFrom("a");
    expect(listCalls).toBe(1);
  });

  it("append updates indexes incrementally", async () => {
    const inner = new JsonRelationsRepo(dir);
    const cached = new CachedRelationsRepo(inner);
    await cached.append([relFactory("r1", "a", "b")]);
    await cached.append([relFactory("r2", "a", "c")]);
    expect((await cached.byFrom("a")).map(r => r.id).sort()).toEqual(["r1", "r2"]);
  });

  it("empty append is a no-op", async () => {
    let appendCalls = 0;
    const inner: RelationsRepo = {
      list: async () => [], byFrom: async () => [], byTo: async () => [],
      append: async () => { appendCalls++; },
    };
    const cached = new CachedRelationsRepo(inner);
    await cached.append([]);
    expect(appendCalls).toBe(0);
  });
});

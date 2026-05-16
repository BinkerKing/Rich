import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonRelationsRepo } from "../src/repos/JsonRelationsRepo.js";
import type { Relation } from "@ke/domain";

let dir: string;
const rel = (id: string, from: string, to: string): Relation => ({
  id, from, to, kind: "child", createdAt: "",
});

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ke-rel-")); });

describe("JsonRelationsRepo", () => {
  it("returns empty when file missing", async () => {
    const r = new JsonRelationsRepo(dir);
    expect(await r.list()).toEqual([]);
  });

  it("appends and lists relations", async () => {
    const r = new JsonRelationsRepo(dir);
    await r.append([rel("r1", "a", "b"), rel("r2", "a", "c")]);
    const all = await r.list();
    expect(all.map(x => x.id).sort()).toEqual(["r1", "r2"]);
  });

  it("byFrom filters correctly", async () => {
    const r = new JsonRelationsRepo(dir);
    await r.append([rel("r1", "a", "b"), rel("r2", "x", "y"), rel("r3", "a", "c")]);
    const fromA = await r.byFrom("a");
    expect(fromA.map(x => x.id).sort()).toEqual(["r1", "r3"]);
  });

  it("byTo filters correctly", async () => {
    const r = new JsonRelationsRepo(dir);
    await r.append([rel("r1", "a", "b"), rel("r2", "x", "b")]);
    const toB = await r.byTo("b");
    expect(toB.map(x => x.id).sort()).toEqual(["r1", "r2"]);
  });

  it("appends are additive (not overwriting)", async () => {
    const r = new JsonRelationsRepo(dir);
    await r.append([rel("r1", "a", "b")]);
    await r.append([rel("r2", "c", "d")]);
    const all = await r.list();
    expect(all.length).toBe(2);
  });
});

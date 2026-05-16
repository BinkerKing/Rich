import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonSignalsRepo } from "../src/repos/JsonSignalsRepo.js";
import type { Signal } from "@ke/domain";

let dir: string;
const sig = (overrides: Partial<Signal> = {}): Signal => ({
  ts: overrides.ts ?? "2026-05-16T08:00:00Z",
  type: overrides.type ?? "op.completed",
  manual: overrides.manual ?? "knowledge",
  ...overrides,
});

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ke-sig-")); });

describe("JsonSignalsRepo", () => {
  it("returns empty when no file", async () => {
    const r = new JsonSignalsRepo(dir);
    expect(await r.list()).toEqual([]);
    expect(await r.count()).toBe(0);
  });

  it("appends and lists", async () => {
    const r = new JsonSignalsRepo(dir);
    await r.append(sig({ elementId: "e1" }));
    await r.append(sig({ elementId: "e2", type: "user.reverted" }));
    const all = await r.list();
    expect(all).toHaveLength(2);
    expect(await r.count()).toBe(2);
  });

  it("filters by manual", async () => {
    const r = new JsonSignalsRepo(dir);
    await r.append(sig({ manual: "knowledge" }));
    await r.append(sig({ manual: "codex" }));
    const k = await r.list({ manual: "knowledge" });
    expect(k).toHaveLength(1);
    expect(k[0].manual).toBe("knowledge");
  });

  it("filters by type", async () => {
    const r = new JsonSignalsRepo(dir);
    await r.append(sig({ type: "op.completed" }));
    await r.append(sig({ type: "user.reverted" }));
    expect(await r.list({ type: "user.reverted" })).toHaveLength(1);
  });

  it("filters by elementId", async () => {
    const r = new JsonSignalsRepo(dir);
    await r.append(sig({ elementId: "a" }));
    await r.append(sig({ elementId: "b" }));
    expect(await r.list({ elementId: "a" })).toHaveLength(1);
  });

  it("filters by since (inclusive)", async () => {
    const r = new JsonSignalsRepo(dir);
    await r.append(sig({ ts: "2026-01-01T00:00:00Z" }));
    await r.append(sig({ ts: "2026-06-01T00:00:00Z" }));
    expect(await r.list({ since: "2026-05-01T00:00:00Z" })).toHaveLength(1);
  });

  it("applies limit to most-recent N", async () => {
    const r = new JsonSignalsRepo(dir);
    for (let i = 0; i < 5; i++) {
      await r.append(sig({ ts: `2026-05-16T08:0${i}:00Z`, data: { i } }));
    }
    const last3 = await r.list({ limit: 3 });
    expect(last3).toHaveLength(3);
    expect((last3[0].data as { i: number }).i).toBe(2);
  });
});

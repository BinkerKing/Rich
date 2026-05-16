import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonPathsRepo } from "../src/repos/JsonPathsRepo.js";
import type { LearningPath } from "@ke/domain";

let dir: string;
const path = (id: string, center: string): LearningPath => ({
  id, centerElementId: center, kind: "quick", label: "Q", color: "gold",
  steps: [center], generatedBy: "ai", createdAt: "",
});

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ke-paths-")); });

describe("JsonPathsRepo", () => {
  it("returns empty when missing", async () => {
    const r = new JsonPathsRepo(dir);
    expect(await r.byCenter("nope")).toEqual([]);
  });

  it("stores and retrieves paths by center", async () => {
    const r = new JsonPathsRepo(dir);
    await r.putForCenter("c1", [path("p1", "c1"), path("p2", "c1")]);
    const got = await r.byCenter("c1");
    expect(got.map(x => x.id).sort()).toEqual(["p1", "p2"]);
  });

  it("lists all centers that have stored paths", async () => {
    const r = new JsonPathsRepo(dir);
    await r.putForCenter("c1", [path("p1", "c1")]);
    await r.putForCenter("c2", [path("p2", "c2")]);
    expect((await r.listAllCenters()).sort()).toEqual(["c1", "c2"]);
  });

  it("putForCenter overwrites existing", async () => {
    const r = new JsonPathsRepo(dir);
    await r.putForCenter("c1", [path("old", "c1")]);
    await r.putForCenter("c1", [path("new", "c1")]);
    const got = await r.byCenter("c1");
    expect(got.map(x => x.id)).toEqual(["new"]);
  });

  it("appendForCenter merges by id (later wins, no dup)", async () => {
    const r = new JsonPathsRepo(dir);
    await r.putForCenter("c1", [path("p1", "c1"), path("p2", "c1")]);
    await r.appendForCenter("c1", [path("p2", "c1"), path("p3", "c1")]);
    const got = await r.byCenter("c1");
    expect(got.map(x => x.id).sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("appendForCenter on empty initial state", async () => {
    const r = new JsonPathsRepo(dir);
    await r.appendForCenter("c1", [path("p1", "c1")]);
    const got = await r.byCenter("c1");
    expect(got.map(x => x.id)).toEqual(["p1"]);
  });

  it("rejects schema-invalid path", async () => {
    const r = new JsonPathsRepo(dir);
    const bad = { ...path("p1", "c1"), steps: [] };
    await expect(r.putForCenter("c1", [bad])).rejects.toThrow(/rejected/);
  });
});

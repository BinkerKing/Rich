import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonElementsRepo } from "../src/repos/JsonElementsRepo.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ke-test-"));
  mkdirSync(join(dir, "elements"), { recursive: true });
  writeFileSync(join(dir, "elements", "a.json"), JSON.stringify({
    id: "a", type: "concept", title: "A", content: {},
    metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
  }));
  writeFileSync(join(dir, "elements", "b.json"), JSON.stringify({
    id: "b", type: "concept", title: "B", content: {},
    metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
  }));
});

describe("JsonElementsRepo", () => {
  it("lists all elements", async () => {
    const repo = new JsonElementsRepo(dir);
    const all = await repo.list();
    expect(all.map(e => e.id).sort()).toEqual(["a", "b"]);
  });

  it("gets element by id", async () => {
    const repo = new JsonElementsRepo(dir);
    const e = await repo.get("a");
    expect(e?.title).toBe("A");
  });

  it("returns null for missing id", async () => {
    const repo = new JsonElementsRepo(dir);
    expect(await repo.get("nope")).toBeNull();
  });
});

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

  it("put rejects schema-invalid element", async () => {
    const repo = new JsonElementsRepo(dir);
    const bad = {
      id: "", type: "concept", title: "X", content: {},
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    } as unknown as Parameters<typeof repo.put>[0];
    await expect(repo.put(bad)).rejects.toThrow(/rejected/);
  });

  it("put writes atomically (no .tmp- file left behind)", async () => {
    const repo = new JsonElementsRepo(dir);
    await repo.put({
      id: "atom", type: "concept", title: "A", content: {},
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    });
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(join(dir, "elements"));
    expect(files.some(f => f.startsWith("atom.json.tmp-"))).toBe(false);
    expect(files).toContain("atom.json");
  });
});

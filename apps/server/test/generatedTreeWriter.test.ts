import { describe, expect, it } from "vitest";
import type { GeneratedTree } from "../src/ai/knowledge/generatedTreeValidator.js";
import { writeGeneratedTree } from "../src/ai/knowledge/generatedTreeWriter.js";

const now = "2026-09-01T00:00:00.000Z";
const tree: GeneratedTree = {
  rootId: "root",
  elements: [{
    id: "root", type: "topic", title: "Root", content: {},
    metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 2 },
  }],
  relations: [],
  paths: [
    { id: "path.a", centerElementId: "root", kind: "quick", label: "A", color: "gold", steps: ["root"], generatedBy: "ai", createdAt: now },
    { id: "path.b", centerElementId: "root", kind: "deep", label: "B", color: "blue", steps: ["root"], generatedBy: "ai", createdAt: now },
  ],
};

describe("writeGeneratedTree", () => {
  it("stamps elements and groups paths before delegating to repositories", async () => {
    const writes: string[] = [];
    const writtenElements: typeof tree.elements = [];
    const writtenPaths: unknown[] = [];
    await writeGeneratedTree({
      elements: { put: async (element) => { writes.push("element"); writtenElements.push(element); } } as never,
      relations: { append: async () => { writes.push("relations"); } } as never,
      paths: { putForCenter: async (centerId, paths) => { writes.push(`paths:${centerId}`); writtenPaths.push(paths); } } as never,
    }, tree, "codex");

    expect(writes).toEqual(["element", "relations", "paths:root"]);
    expect(writtenElements[0].metadata).toMatchObject({ generatedBy: "ai", aiModel: "codex" });
    expect(writtenPaths).toEqual([tree.paths]);
  });
});

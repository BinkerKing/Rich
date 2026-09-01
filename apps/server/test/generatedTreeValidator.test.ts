import { describe, expect, it } from "vitest";
import { validateGeneratedTree } from "../src/ai/knowledge/generatedTreeValidator.js";

function validTree() {
  const now = "2026-09-01T00:00:00.000Z";
  return {
    rootId: "attention",
    elements: [
      {
        id: "attention",
        type: "topic",
        title: "注意力",
        content: {
          intro: "注意力是认知资源分配机制。",
          learningGoals: ["理解基本概念"],
          coreModules: [{ id: "attention.focus", title: "聚焦", description: "选择信息" }],
          recommendedPaths: ["quick"],
        },
        metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 2 },
      },
      {
        id: "attention.focus",
        type: "concept",
        title: "聚焦",
        content: { oneSentence: "选择目标信息。", coreExplain: "过滤无关刺激。", whyMatters: "减少认知负担。" },
        metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 2 },
      },
    ],
    relations: [{ id: "rel.focus", from: "attention", to: "attention.focus", kind: "child", createdAt: now }],
    paths: [{
      id: "path.quick", centerElementId: "attention", kind: "quick", label: "快速入门", color: "gold",
      steps: ["attention", "attention.focus"], generatedBy: "ai", createdAt: now,
    }],
  };
}

describe("validateGeneratedTree", () => {
  it("accepts a complete typed tree", () => {
    expect(validateGeneratedTree(validTree()).rootId).toBe("attention");
  });

  it("rejects duplicate element ids", () => {
    const tree = validTree();
    tree.elements.push({ ...tree.elements[1] });
    expect(() => validateGeneratedTree(tree)).toThrow("duplicate element id");
  });

  it("rejects a root that is not an element", () => {
    const tree = validTree();
    tree.rootId = "missing";
    expect(() => validateGeneratedTree(tree)).toThrow("rootId");
  });

  it("rejects relations whose endpoints are absent", () => {
    const tree = validTree();
    tree.relations[0].to = "missing";
    expect(() => validateGeneratedTree(tree)).toThrow("relation rel.focus");
  });

  it("rejects paths outside the generated tree", () => {
    const tree = validTree();
    tree.paths[0].steps = ["attention", "missing"];
    expect(() => validateGeneratedTree(tree)).toThrow("path path.quick");
  });

  it("rejects a concept with invalid typed content", () => {
    const tree = validTree();
    tree.elements[1].content = {};
    expect(() => validateGeneratedTree(tree)).toThrow("content");
  });
});

import { describe, it, expect } from "vitest";
import {
  ElementSchema, ConceptContentSchema, TopicContentSchema,
  RelationSchema, LearningPathSchema,
  parseElementStrict,
} from "../src/index.js";

describe("ElementSchema", () => {
  it("accepts minimal element", () => {
    const ok = ElementSchema.safeParse({
      id: "a", type: "concept", title: "A",
      content: {},
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects empty id", () => {
    const bad = ElementSchema.safeParse({
      id: "", type: "concept", title: "A",
      content: {},
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const bad = ElementSchema.safeParse({
      id: "a", type: "nonsense", title: "A",
      content: {},
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects out-of-range richness", () => {
    const bad = ElementSchema.safeParse({
      id: "a", type: "concept", title: "A",
      content: {},
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 9 },
    });
    expect(bad.success).toBe(false);
  });
});

describe("ConceptContentSchema", () => {
  it("requires oneSentence, coreExplain, whyMatters", () => {
    expect(ConceptContentSchema.safeParse({ oneSentence: "x", coreExplain: "y", whyMatters: "z" }).success).toBe(true);
    expect(ConceptContentSchema.safeParse({ oneSentence: "x" }).success).toBe(false);
  });

  it("accepts optional mechanisms with label+description", () => {
    const ok = ConceptContentSchema.safeParse({
      oneSentence: "x", coreExplain: "y", whyMatters: "z",
      mechanisms: [{ label: "a" }, { label: "b", description: "d" }],
    });
    expect(ok.success).toBe(true);
  });
});

describe("TopicContentSchema", () => {
  it("requires intro, learningGoals, coreModules, recommendedPaths", () => {
    expect(TopicContentSchema.safeParse({
      intro: "i", learningGoals: ["a"], coreModules: [{ id: "x", title: "X", description: "d" }],
      recommendedPaths: ["p1"],
    }).success).toBe(true);
    expect(TopicContentSchema.safeParse({ intro: "i" }).success).toBe(false);
  });
});

describe("RelationSchema", () => {
  it("accepts valid relation", () => {
    expect(RelationSchema.safeParse({
      id: "r1", from: "a", to: "b", kind: "child", createdAt: "",
    }).success).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(RelationSchema.safeParse({
      id: "r1", from: "a", to: "b", kind: "nope", createdAt: "",
    }).success).toBe(false);
  });

  it("rejects strength out of range", () => {
    expect(RelationSchema.safeParse({
      id: "r1", from: "a", to: "b", kind: "related", strength: 150, createdAt: "",
    }).success).toBe(false);
  });
});

describe("LearningPathSchema", () => {
  it("accepts valid path", () => {
    expect(LearningPathSchema.safeParse({
      id: "p1", centerElementId: "a", kind: "quick", label: "Q",
      color: "gold", steps: ["a"], generatedBy: "ai", createdAt: "",
    }).success).toBe(true);
  });

  it("rejects empty steps", () => {
    expect(LearningPathSchema.safeParse({
      id: "p1", centerElementId: "a", kind: "quick", label: "Q",
      color: "gold", steps: [], generatedBy: "ai", createdAt: "",
    }).success).toBe(false);
  });
});

describe("parseElementStrict", () => {
  it("enforces concept content shape when type=concept", () => {
    expect(() => parseElementStrict({
      id: "a", type: "concept", title: "A",
      content: { oneSentence: "x", coreExplain: "y", whyMatters: "z" },
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    })).not.toThrow();

    expect(() => parseElementStrict({
      id: "a", type: "concept", title: "A",
      content: { oneSentence: "x" }, // missing fields
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    })).toThrow();
  });

  it("falls through when type has no per-type schema", () => {
    expect(() => parseElementStrict({
      id: "a", type: "summary", title: "A",
      content: { anything: "goes" },
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    })).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";
import { generateTreeFor } from "../src/ai/knowledge/operations.js";

class TreeAdapter implements AIAdapter {
  readonly name = "claude-code" as const;

  async available() { return true; }

  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    const now = "2026-09-01T00:00:00.000Z";
    yield {
      type: "done",
      fullText: JSON.stringify({
        rootId: "tree",
        elements: [{
          id: "tree", type: "topic", title: "树",
          content: { intro: "", learningGoals: [], coreModules: [], recommendedPaths: [] },
          metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 2 },
        }],
        relations: [],
        paths: [],
      }),
    };
  }
}

describe("knowledge generateTreeFor", () => {
  it("returns a validated tree from the knowledge-domain operation", async () => {
    const events: unknown[] = [];
    for await (const event of generateTreeFor(new TreeAdapter(), { topic: "树" })) events.push(event);
    expect(events).toEqual([expect.objectContaining({ type: "done", result: expect.objectContaining({ rootId: "tree" }) })]);
  });
});

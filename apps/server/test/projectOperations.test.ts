import { describe, expect, it } from "vitest";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";
import { runDecomposePlan, runGuidedPractice } from "../src/ai/project/operations.js";

describe("project runDecomposePlan", () => {
  it("returns a structured plan from the project-domain operation", async () => {
    class PlanAdapter implements AIAdapter {
      readonly name = "claude-code" as const;
      async available() { return true; }
      async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
        yield {
          type: "done",
          fullText: JSON.stringify({
            plan: { title: "学习计划", detail: "", start: "2026-09-01", end: "2026-09-02", scopes: ["day"] },
            goals: [], tasks: [], reasoning: "从最小行动开始。",
          }),
        };
      }
    }
    const events: unknown[] = [];
    for await (const event of runDecomposePlan(new PlanAdapter(), { intent: "学习", today: "2026-09-01" })) events.push(event);
    expect(events).toEqual([expect.objectContaining({ type: "done", result: expect.objectContaining({ plan: expect.objectContaining({ title: "学习计划" }) }) })]);
  });
});

describe("project runGuidedPractice", () => {
  it("normalizes a project-practice clarification reply", async () => {
    class PracticeAdapter implements AIAdapter {
      readonly name = "claude-code" as const;
      async available() { return true; }
      async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
        yield { type: "done", fullText: JSON.stringify({ reply: "先明确用户。", draftPatch: { projectName: "Rich" }, nextStage: "clarify", confidence: 0.6, openQuestions: [] }) };
      }
    }
    const events: unknown[] = [];
    for await (const event of runGuidedPractice(new PracticeAdapter(), { stage: "goal", userInput: "做一个产品", draft: {}, messages: [] })) events.push(event);
    expect(events).toEqual([expect.objectContaining({ type: "done", result: expect.objectContaining({ nextStage: "scenario", confidence: "medium" }) })]);
  });
});

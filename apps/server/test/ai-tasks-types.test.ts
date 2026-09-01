import { describe, expect, it } from "vitest";
import { parseAiTaskRequest } from "../src/ai-tasks/types.js";

describe("AI deliverable task contract", () => {
  it("normalizes a Hermes task with its immutable context snapshot", () => {
    const task = parseAiTaskRequest({
      projectId: "project-1",
      deliverableId: "deliverable-1",
      executor: "hermes",
      instructions: "Create the report.",
      acceptanceCriteria: ["A .docx file exists."],
      contextSnapshot: {
        version: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
        deliverable: { folderPath: "07-交付/report", requirementHtml: "<p>Approved</p>" },
        records: [],
        files: [],
      },
    });

    expect(task.executor).toBe("hermes");
    expect(task.contextSnapshot.deliverable.folderPath).toBe("07-交付/report");
  });

  it("rejects a task without an explicit executor", () => {
    expect(() => parseAiTaskRequest({ projectId: "project-1", deliverableId: "deliverable-1", instructions: "Create it." }))
      .toThrow(/executor/i);
  });
});

import { describe, expect, it, vi } from "vitest";
import { HermesTaskExecutor } from "../src/ai-tasks/HermesTaskExecutor.js";

describe("HermesTaskExecutor", () => {
  it("sends a task-scoped MCP prompt without a local folder path", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "accepted" } }] }), { status: 200 }));
    const executor = new HermesTaskExecutor({ baseUrl: "http://hermes.test", fetcher });
    await executor.execute({ id: "task-1", status: "running", type: "deliverable-ai-task", title: "Report", resultRefs: [], createdAt: "", updatedAt: "", request: {
      projectId: "project-1", deliverableId: "deliverable-1", executor: "hermes", instructions: "Create report", acceptanceCriteria: [],
      contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [], files: [] },
    } });

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toContain("rich_task_context_get");
    expect(body.messages[0].content).toContain("rich_deliverable_history_get");
    expect(body.messages[0].content).toContain("task-1");
    expect(body.messages[0].content).not.toContain("07-交付");
  });
});

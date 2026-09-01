import { describe, expect, it, vi } from "vitest";
import { HermesTaskExecutor } from "../src/ai-tasks/HermesTaskExecutor.js";

describe("HermesTaskExecutor", () => {
  it("sends a task-scoped MCP prompt without a local folder path", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "accepted" } }] }), { status: 200 }));
    const executor = new HermesTaskExecutor({ baseUrl: "http://hermes.test", fetcher });
    await executor.execute({ id: "task-1", status: "running", request: {}, type: "deliverable-ai-task", title: "Report", resultRefs: [], createdAt: "", updatedAt: "" });

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toContain("rich_task_context_get");
    expect(body.messages[0].content).toContain("task-1");
    expect(body.messages[0].content).not.toContain("07-交付");
  });
});

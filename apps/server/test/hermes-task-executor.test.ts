import { describe, expect, it, vi } from "vitest";
import { HermesTaskExecutor } from "../src/ai-tasks/HermesTaskExecutor.js";
import { ScenarioRegistry } from "../src/agent-scenarios/ScenarioRegistry.js";

describe("HermesTaskExecutor", () => {
  it("sends Hermes a readable frozen task brief with its material inputs", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "accepted" } }] }), { status: 200 }));
    const executor = new HermesTaskExecutor({ baseUrl: "http://hermes.test", fetcher });
    await executor.execute({ id: "task-1", status: "running", type: "deliverable-ai-task", title: "Report", resultRefs: [], createdAt: "", updatedAt: "", request: {
      projectId: "project-1", deliverableId: "deliverable-1", executor: "hermes", instructions: "<p>逐项核对报表范围</p>", acceptanceCriteria: [],
      contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [{ id: "r1", kind: "information", text: "代码导航：/workspace/CODE_NAVIGATION.md", createdAt: "2026-09-01T00:00:00.000Z" }], files: [{ relativePath: "07-交付/report/baseline.xlsx", fileName: "baseline.xlsx", size: 10, type: "material", note: "自动化报表清单" }] },
    } });

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toContain("rich_task_context_get");
    expect(body.messages[0].content).toContain("rich_deliverable_history_get");
    expect(body.messages[0].content).toContain("task-1");
    expect(body.messages[0].content).toContain("逐项核对报表范围");
    expect(body.messages[0].content).toContain("/workspace/CODE_NAVIGATION.md");
    expect(body.messages[0].content).toContain("baseline.xlsx");
    expect(body.messages[0].content).toContain("Do not conclude that evidence is missing before reading every relevant frozen material");
  });

  it("uses only tools declared by the persisted scenario", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const scenarios = new ScenarioRegistry([{
      id: "restricted",
      taskType: "restricted-task",
      toolManifest: ["rich_task_context_get"],
      parseInput: value => value as never,
      title: () => "Restricted",
    }]);
    const executor = new HermesTaskExecutor({ baseUrl: "http://hermes.test", fetcher }, scenarios);
    await executor.execute({ id: "task-1", status: "running", type: "restricted-task", title: "Restricted", resultRefs: [], createdAt: "", updatedAt: "", request: {
      scenario: "restricted", projectId: "project-1", deliverableId: "deliverable-1", executor: "hermes", instructions: "Analyse", acceptanceCriteria: [],
      contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [], files: [] },
    } });

    const prompt = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).messages[0].content;
    expect(prompt).toContain("rich_task_context_get");
    expect(prompt).not.toContain("rich_deliverable_history_get");
  });
});

import { describe, expect, it, vi } from "vitest";
import { MulticaTaskExecutor } from "../src/ai-tasks/MulticaTaskExecutor.js";

describe("MulticaTaskExecutor", () => {
  it("delegates the frozen Rich task and returns the external issue id", async () => {
    const delegate = vi.fn(async () => ({ externalTaskId: "issue-1", progressSummary: "queued" }));
    const executor = new MulticaTaskExecutor({ backend: "multica-cli", delegate, getStatus: vi.fn(), cancel: vi.fn() }, async () => true);
    const result = await executor.execute({ id: "task-1", status: "running", type: "deliverable-ai-task", title: "Report", resultRefs: [], createdAt: "", updatedAt: "", request: {
      projectId: "project-1", deliverableId: "deliverable-1", executor: "multica", instructions: "Create report", acceptanceCriteria: ["docx"],
      contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [], files: [] },
    } });
    expect(delegate).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1", contextRefs: [expect.objectContaining({ id: "task-1" })] }));
    expect(delegate.mock.calls[0]?.[0].instructions).toContain("rich_task_context_get");
    expect(delegate.mock.calls[0]?.[0].instructions).toContain("rich_deliverable_history_get");
    expect(delegate.mock.calls[0]?.[0].instructions).toContain("rich_task_report_result");
    expect(result.externalTaskId).toBe("issue-1");
  });
});

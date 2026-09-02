import { describe, expect, it } from "vitest";
import { DeliverableCodexContextService } from "../src/deliverable-codex/DeliverableCodexContextService.js";

const snapshot = {
  version: 1,
  createdAt: "2026-09-02T00:00:00.000Z",
  deliverable: { folderPath: "07-交付/验收报告", requirementHtml: "<p>核对字段映射</p>" },
  records: [{ id: "r1", kind: "requirement", text: "风险等级必须映射", createdAt: "2026-09-02T00:00:00.000Z" }],
  files: [{ relativePath: "07-交付/验收报告/source.xlsx", fileName: "source.xlsx", size: 128, type: "material" as const }],
  history: [],
};

describe("DeliverableCodexContextService", () => {
  it("builds a task-mode context with the explicit-only writeback contract", async () => {
    const service = new DeliverableCodexContextService({
      createSnapshot: async () => snapshot,
    });

    const context = await service.build({ projectId: "project-1", deliverableId: "deliverable-1", mode: "task" });

    expect(context.scopeKey).toBe("deliverable:project-1:deliverable-1");
    expect(context.initialContext).toContain("07-交付/验收报告");
    expect(context.initialContext).toContain("风险等级必须映射");
    expect(context.systemInstruction).toContain("only when the user explicitly asks");
    expect(context.allowedMcpTools).toContain("rich_task_report_result");
    expect(context.contextVersion).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps free and bug modes read-only with different operating instructions", async () => {
    const service = new DeliverableCodexContextService({ createSnapshot: async () => snapshot });

    const free = await service.build({ projectId: "project-1", deliverableId: "deliverable-1", mode: "free" });
    const bug = await service.build({ projectId: "project-1", deliverableId: "deliverable-1", mode: "bug" });

    expect(free.allowedMcpTools).not.toContain("rich_task_report_result");
    expect(bug.allowedMcpTools).not.toContain("rich_task_report_result");
    expect(free.systemInstruction).toContain("Do not write");
    expect(bug.systemInstruction).toContain("reproduction");
  });
});

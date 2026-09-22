import { describe, expect, it } from "vitest";
import { appendDeliverableCodexOperationRecord, describeDeliverableCodexOperation } from "../src/deliverable-codex/DeliverableCodexOperationLog.js";

describe("DeliverableCodexOperationLog", () => {
  it("uses a readable summary for each completed MCP write", () => {
    expect(describeDeliverableCodexOperation("rich_deliverable_requirement_update")).toBe("更新需求说明");
    expect(describeDeliverableCodexOperation("rich_deliverable_file_write")).toBe("写入交付物文件");
  });

  it("adds a Codex record after a successful deliverable operation", async () => {
    let content: Record<string, unknown> = { recordType: "deliverable", records: [] };
    const appended = await appendDeliverableCodexOperationRecord({
      projects: {
        async listAllModuleItems() { return [{ id: "deliverable-1", content }]; },
        async updateModuleItem(_projectId, _deliverableId, patch) { content = patch.content!; return { id: "deliverable-1", content }; },
      } as never,
      projectId: "project-1",
      deliverableId: "deliverable-1",
      summary: "更新需求说明",
      attachment: { fileName: "需求说明.md", relativePath: "07-交付/Mapping/需求说明.md", size: 128 },
    });

    expect(appended).toBe(true);
    expect(content.records).toEqual([expect.objectContaining({
      kind: "status", author: "Codex", text: expect.stringContaining("已产出附件：需求说明.md（128 B）"), informationType: "information", attachments: [{ fileName: "需求说明.md", relativePath: "07-交付/Mapping/需求说明.md", size: 128 }],
    })]);
  });

  it("does not append a record when the target deliverable no longer exists", async () => {
    const appended = await appendDeliverableCodexOperationRecord({
      projects: { async listAllModuleItems() { return []; }, async updateModuleItem() { return null; } } as never,
      projectId: "project-1",
      deliverableId: "missing",
      summary: "更新需求说明",
    });

    expect(appended).toBe(false);
  });
});

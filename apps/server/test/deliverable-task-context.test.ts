import { describe, expect, it } from "vitest";
import { DeliverableTaskContextService } from "../src/ai-tasks/DeliverableTaskContextService.js";

describe("DeliverableTaskContextService", () => {
  it("freezes requirements, records, and files for the selected deliverable", async () => {
    const service = new DeliverableTaskContextService({
      listAllModuleItems: async () => [{
        id: "deliverable-1", projectId: "project-1", moduleKey: "deliverables", title: "验收报告", sortOrder: 0,
        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
        content: {
          recordType: "deliverable", folderPath: "07-交付/验收报告", descriptionHtml: "<p>Use approved template</p>",
          records: [{ id: "record-1", kind: "requirement", text: "Use the approved template", createdAt: "2026-09-01T00:00:00.000Z" }],
          fileMeta: [{ relativePath: "07-交付/验收报告/source.xlsx", type: "material", version: "" }],
        },
      }] as never,
    }, async () => [{ fileName: "source.xlsx", relativePath: "07-交付/验收报告/source.xlsx", size: 128 }]);

    const snapshot = await service.createSnapshot("project-1", "deliverable-1");

    expect(snapshot.deliverable.requirementHtml).toContain("approved template");
    expect(snapshot.records.map(record => record.text)).toEqual(["Use the approved template"]);
    expect(snapshot.files).toEqual([expect.objectContaining({ relativePath: "07-交付/验收报告/source.xlsx", type: "material" })]);
  });
});

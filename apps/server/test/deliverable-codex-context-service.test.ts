import { resolve } from "node:path";
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

const elements = { get: async () => ({ type: "project", content: { localFolder: process.cwd() } }) };

describe("DeliverableCodexContextService", () => {
  it("uses the Rich source directory for general Codex work instead of the packaged app process directory", async () => {
    const service = new DeliverableCodexContextService({ createSnapshot: async () => snapshot }, elements as never, undefined, "/workspace/Rich");

    const context = await service.build({ projectId: "__general__", deliverableId: "__general__", mode: "free" });

    expect(context.workspaceRoot).toBe("/workspace/Rich");
  });

  it("builds a task-mode context with the explicit-only writeback contract", async () => {
    const service = new DeliverableCodexContextService({ createSnapshot: async () => snapshot }, elements as never);

    const context = await service.build({ projectId: "project-1", deliverableId: "deliverable-1", mode: "task" });

    expect(context.scopeKey).toBe("deliverable:project-1:deliverable-1");
    expect(context.initialContext).toContain("07-交付/验收报告");
    expect(context.initialContext).toContain(`Deliverable folder: ${resolve(process.cwd(), "07-交付/验收报告")}`);
    expect(context.initialContext).toContain("风险等级必须映射");
    expect(context.systemInstruction).toContain("only when the user explicitly asks");
    expect(context.allowedMcpTools).toEqual(expect.arrayContaining([
      "rich_deliverable_get",
      "rich_deliverable_record_create",
      "rich_deliverable_requirement_update",
      "rich_project_file_read",
      "rich_deliverable_file_write",
      "rich_deliverable_file_copy",
    ]));
    expect(context.initialContext).toContain("Frozen delivery inputs");
    expect(context.initialContext).not.toContain("Requested outcome");
    expect(context.contextVersion).toMatch(/^[a-f0-9]{64}$/);
  });

  it("lets free mode write an explicitly requested deliverable result through Rich MCP", async () => {
    const service = new DeliverableCodexContextService({ createSnapshot: async () => snapshot }, elements as never);

    const free = await service.build({ projectId: "project-1", deliverableId: "deliverable-1", mode: "free" });
    const bug = await service.build({ projectId: "project-1", deliverableId: "deliverable-1", mode: "bug" });

    expect(free.allowedMcpTools).toEqual(expect.arrayContaining([
      "rich_deliverable_record_create",
      "rich_deliverable_record_update",
      "rich_deliverable_requirement_update",
      "rich_deliverable_file_write",
      "rich_deliverable_file_copy",
    ]));
    expect(bug.allowedMcpTools).not.toContain("rich_deliverable_record_create");
    expect(free.systemInstruction).toContain("MUST use the Rich MCP tools");
    expect(free.systemInstruction).toContain("Do not merely paste the requested deliverable content into chat");
    expect(free.systemInstruction).toContain("file attached");
    expect(bug.systemInstruction).toContain("reproduction");
  });

  it("hands the complete mindmap tree and node details to Codex before conversation", async () => {
    const mindmapElements = [
      { id: "root", type: "topic", title: "SAFE 代码分析", subtitle: "根主题", tags: ["SAFE"], content: { mindmapDetails: "分析范围与目标" }, metadata: { updatedAt: "2026-09-25T00:00:00.000Z" } },
      { id: "child", type: "concept", title: "源系统", subtitle: "输入", tags: [], content: { mindmapDetails: "监管报送原始数据" }, metadata: { updatedAt: "2026-09-25T00:01:00.000Z" } },
    ];
    const service = new DeliverableCodexContextService(
      { createSnapshot: async () => snapshot },
      { get: async (id: string) => mindmapElements.find(element => element.id === id) ?? null, list: async () => mindmapElements } as never,
      undefined,
      undefined,
      undefined,
      { list: async () => [{ id: "root-child", from: "root", to: "child", kind: "child", createdAt: "2026-09-25T00:00:00.000Z" }] } as never,
    );

    const context = await service.build({ projectId: "__general__", deliverableId: "root", resourceType: "mindmap", mode: "free" });

    expect(context.initialContext).toContain("思维导图完整快照");
    expect(context.initialContext).toContain("SAFE 代码分析");
    expect(context.initialContext).toContain("源系统");
    expect(context.initialContext).toContain("监管报送原始数据");
    expect(context.allowedMcpTools).toContain("rich_mindmap_manage");
  });

  it("hands a persisted DeepMindMap to its dedicated MCP session", async () => {
    const service = new DeliverableCodexContextService(
      { createSnapshot: async () => snapshot },
      elements as never,
      undefined,
      undefined,
      undefined,
      undefined,
      { get: async () => ({ id: "deep-1", title: "SAFE 分析", map: { root: { data: { uid: "root", text: "SAFE 分析", details: "待整理资料" }, children: [] } }, createdAt: "2026-09-25T00:00:00.000Z", updatedAt: "2026-09-25T00:01:00.000Z" }) } as never,
    );

    const context = await service.build({ projectId: "__general__", deliverableId: "deep-1", resourceType: "deepmindmap", mode: "free" });

    expect(context.scopeKey).toBe("deepmindmap:__general__:deep-1");
    expect(context.initialContext).toContain("DeepMindMap 完整快照");
    expect(context.initialContext).toContain("梳理该思维导图的需求和资料信息");
    expect(context.initialContext).toContain("待整理资料");
    expect(context.systemInstruction).toContain("rich_deep_mindmap_manage");
    expect(context.allowedMcpTools).toEqual(["rich_deep_mindmap_manage"]);
  });
});

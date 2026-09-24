import { describe, expect, it } from "vitest";
import { DeliverableCodexContextService } from "./DeliverableCodexContextService.js";

describe("DeliverableCodexContextService flowchart context", () => {
  it("uses an isolated scope and directs Codex to read the graph through MCP", async () => {
    const service = new DeliverableCodexContextService(
      { createSnapshot: async () => { throw new Error("deliverable snapshot must not be read"); } },
      { get: async () => ({ id: "project-1", type: "project", title: "示例项目", content: {}, metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", generatedBy: "user" as const, richness: 1 as const } }) },
      { listModuleItems: async () => [{
        id: "flowchart-1", projectId: "project-1", moduleKey: "flowcharts", title: "订单处理", sortOrder: 0,
        content: { graph: { status: "active", nodes: [{ id: "start", data: { label: "接收订单", kind: "step" } }, { id: "check", data: { label: "库存校验", kind: "decision" } }], edges: [{ source: "start", target: "check", label: "提交" }] } },
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      }] },
    );

    const context = await service.build({ projectId: "project-1", deliverableId: "flowchart-1", resourceType: "flowchart", mode: "free" });

    expect(context.scopeKey).toBe("flowchart:project-1:flowchart-1");
    expect(context.initialContext).toContain("订单处理");
    expect(context.initialContext).not.toContain("接收订单");
    expect(context.initialContext).not.toContain("库存校验");
    expect(context.initialContext).toContain("rich_flowchart_manage(action: get)");
    expect(context.allowedMcpTools).toContain("rich_flowchart_manage");
    expect(context.systemInstruction).toContain("rich_flowchart_manage");
  });

  it("accepts a standalone flowchart that is bound in the project", async () => {
    const service = new DeliverableCodexContextService(
      { createSnapshot: async () => { throw new Error("deliverable snapshot must not be read"); } },
      { get: async () => ({ id: "project-1", type: "project", title: "示例项目", content: { flowchartIds: ["standalone-flowchart"] }, metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", generatedBy: "user" as const, richness: 1 as const } }) },
      { listModuleItems: async () => [] },
      undefined,
      { get: async () => ({ id: "standalone-flowchart", title: "旧版流程图", graph: { status: "active", nodes: [{ id: "start", data: { label: "开始", kind: "step" } }], edges: [] }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }) },
    );

    const context = await service.build({ projectId: "project-1", deliverableId: "standalone-flowchart", resourceType: "flowchart", mode: "free" });

    expect(context.scopeKey).toBe("flowchart:project-1:standalone-flowchart");
    expect(context.initialContext).toContain("旧版流程图");
    expect(context.initialContext).not.toContain("开始");
  });
});

describe("DeliverableCodexContextService report context", () => {
  it("binds the report center to a project-scoped report MCP", async () => {
    const service = new DeliverableCodexContextService(
      { createSnapshot: async () => { throw new Error("deliverable snapshot must not be read"); } },
      { get: async () => ({ id: "project-1", type: "project", title: "示例项目", content: {}, metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", generatedBy: "user" as const, richness: 1 as const } }) },
    );

    const context = await service.build({ projectId: "project-1", deliverableId: "report-center", resourceType: "report", mode: "free" });

    expect(context.scopeKey).toBe("report:project-1:report-center");
    expect(context.initialContext).toContain("示例项目");
    expect(context.initialContext).toContain("rich_report_manage");
    expect(context.allowedMcpTools).toEqual(["rich_report_manage"]);
  });
});

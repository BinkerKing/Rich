import { describe, expect, it } from "vitest";
import type { AutomationPlanDetail } from "../src/modules/project-automation/contracts.js";

describe("project automation preflight", () => {
  it("collects and merges runtime parameters while preserving table-level errors", async () => {
    const module = await import("../src/modules/project-automation/application/automationService.js") as unknown as {
      inspectAutomationPlan?: (
        plan: AutomationPlanDetail,
        inspectItem: (item: AutomationPlanDetail["groups"][number]["items"][number]) => Promise<unknown>,
      ) => Promise<{
        ready: boolean;
        parameters: Array<{ name: string; types: string[]; tableIds: string[] }>;
        items: Array<{ tableId: string; ready: boolean; error?: string }>;
      }>;
    };
    expect(module.inspectAutomationPlan).toBeTypeOf("function");
    if (!module.inspectAutomationPlan) return;

    const result = await module.inspectAutomationPlan(plan(), async item => {
      if (item.tableId === "table-error") throw new Error("Mapping 无法解析");
      return {
        ready: true,
        runtimeParamNames: ["businessDate"],
        runtimeParamTypes: { businessDate: item.tableId === "table-a" ? "DATE" : "TEXT" },
        message: "检查完成",
      };
    });

    expect(result.ready).toBe(false);
    expect(result.parameters).toEqual([{
      name: "businessDate",
      types: ["DATE", "TEXT"],
      tableIds: ["table-a", "table-b"],
    }]);
    expect(result.items).toContainEqual(expect.objectContaining({ tableId: "table-error", ready: false, error: "Mapping 无法解析" }));
  });
});

function plan(): AutomationPlanDetail {
  const now = "2026-08-25T00:00:00.000Z";
  return {
    id: "plan-a", projectId: "project-a", name: "每日取数", sortOrder: 0, createdAt: now, updatedAt: now,
    groups: [{
      id: "group-a", projectId: "project-a", planId: "plan-a", name: "贴源层", sortOrder: 0, createdAt: now, updatedAt: now,
      items: ["table-a", "table-b", "table-error"].map((tableId, sortOrder) => ({
        id: `item-${tableId}`, projectId: "project-a", planId: "plan-a", groupId: "group-a", tableId,
        tableName: tableId, sortOrder,
      })),
    }],
  };
}

import { describe, expect, it } from "vitest";
import {
  AUTOMATION_STEPS,
  runAutomationItems,
  type AutomationRunItem,
} from "../src/modules/project-automation/application/runner.js";

function item(id: string, groupOrder: number, itemOrder: number): AutomationRunItem {
  return {
    id,
    tableId: `table-${id}`,
    tableName: `table_${id}`,
    groupId: `group-${groupOrder}`,
    groupName: `分组 ${groupOrder}`,
    groupOrder,
    itemOrder,
    status: "pending",
    steps: AUTOMATION_STEPS.map(step => ({ step, status: "pending" })),
  };
}

describe("project automation runner", () => {
  it("executes groups, tables and table steps in strict serial order", async () => {
    const calls: string[] = [];
    const items = [item("b", 2, 0), item("a2", 1, 2), item("a1", 1, 1)];

    const result = await runAutomationItems(items, async (runItem, step) => {
      calls.push(`${runItem.id}:${step}`);
      return step === "extract" ? { affectedRows: runItem.id === "a1" ? 12 : 4 } : {};
    });

    expect(calls).toEqual([
      "a1:validate_sql", "a1:sync_table", "a1:prepare_extraction", "a1:extract",
      "a2:validate_sql", "a2:sync_table", "a2:prepare_extraction", "a2:extract",
      "b:validate_sql", "b:sync_table", "b:prepare_extraction", "b:extract",
    ]);
    expect(result.status).toBe("success");
    expect(result.items.map(runItem => runItem.affectedRows)).toEqual([12, 4, 4]);
  });

  it("pauses immediately on the failing table and leaves later work pending", async () => {
    const calls: string[] = [];
    const result = await runAutomationItems(
      [item("a", 1, 1), item("b", 1, 2), item("c", 2, 1)],
      async (runItem, step) => {
        calls.push(`${runItem.id}:${step}`);
        if (runItem.id === "b" && step === "prepare_extraction") throw new Error("SQL 参数缺失");
        return {};
      },
    );

    expect(result.status).toBe("paused");
    expect(result.error).toBe("SQL 参数缺失");
    expect(result.items[0]?.status).toBe("success");
    expect(result.items[1]).toMatchObject({ status: "error", failedStep: "prepare_extraction", error: "SQL 参数缺失" });
    expect(result.items[2]?.status).toBe("pending");
    expect(calls).not.toContain("c:validate_sql");
  });

  it("resumes at the failed step without repeating successful work", async () => {
    const failed = item("a", 1, 1);
    failed.status = "error";
    failed.failedStep = "prepare_extraction";
    failed.error = "old error";
    failed.steps[0] = { step: "validate_sql", status: "success" };
    failed.steps[1] = { step: "sync_table", status: "success" };
    failed.steps[2] = { step: "prepare_extraction", status: "error", error: "old error" };
    const calls: string[] = [];

    const result = await runAutomationItems([failed, item("b", 1, 2)], async (runItem, step) => {
      calls.push(`${runItem.id}:${step}`);
      return step === "extract" ? { affectedRows: 9 } : {};
    });

    expect(calls).toEqual([
      "a:prepare_extraction", "a:extract",
      "b:validate_sql", "b:sync_table", "b:prepare_extraction", "b:extract",
    ]);
    expect(result.status).toBe("success");
    expect(result.items[0]).toMatchObject({ status: "success", affectedRows: 9, error: undefined, failedStep: undefined });
  });

  it("records a failed table and continues later tables when skipErrors is enabled", async () => {
    const calls: string[] = [];
    const result = await runAutomationItems([item("a", 1, 1), item("b", 1, 2)], async (runItem, step) => {
      calls.push(`${runItem.id}:${step}`);
      if (runItem.id === "a" && step === "extract") throw new Error("目标表不可写");
      return {};
    }, undefined, { runtimeParams: { skipErrors: true } });

    expect(result.status).toBe("success");
    expect(result.items[0]).toMatchObject({ status: "error", error: "目标表不可写" });
    expect(result.items[1]?.status).toBe("success");
    expect(calls).toContain("b:extract");
  });
});

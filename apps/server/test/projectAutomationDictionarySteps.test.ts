import { describe, expect, it, vi } from "vitest";
import { createDictionaryAutomationStepExecutor } from "../src/modules/project-automation/application/dictionaryStepExecutor.js";
import type { AutomationRunItem } from "../src/modules/project-automation/application/runner.js";

const runItem: AutomationRunItem = {
  id: "run-item-a", tableId: "table-a", tableName: "dwd_customer",
  groupId: "group-a", groupName: "中间层", groupOrder: 1, itemOrder: 1,
  status: "pending", steps: [],
};

describe("dictionary automation step executor", () => {
  it("maps the four automation steps to the existing dictionary application services", async () => {
    const target = { system: {}, table: {}, fields: [] };
    const dependencies = {
      loadTarget: vi.fn(async () => target),
      validateSql: vi.fn(async () => ({ ok: true })),
      syncTable: vi.fn(async () => ({ ok: true })),
      prepareExtraction: vi.fn(async () => ({ ok: true, ready: true })),
      extract: vi.fn(async () => ({ ok: true, affectedRows: 27 })),
    };
    const execute = createDictionaryAutomationStepExecutor("project-a", {} as never, dependencies as never);

    await execute(runItem, "validate_sql");
    await execute(runItem, "sync_table");
    await execute(runItem, "prepare_extraction");
    const result = await execute(runItem, "extract");

    expect(dependencies.loadTarget).toHaveBeenCalledTimes(4);
    expect(dependencies.validateSql).toHaveBeenCalledOnce();
    expect(dependencies.syncTable).toHaveBeenCalledOnce();
    expect(dependencies.prepareExtraction).toHaveBeenCalledOnce();
    expect(dependencies.extract).toHaveBeenCalledOnce();
    expect(result.affectedRows).toBe(27);
  });

  it("turns SQL validation details into a pausing error", async () => {
    const execute = createDictionaryAutomationStepExecutor("project-a", {} as never, {
      loadTarget: async () => ({ system: {}, table: {}, fields: [] }),
      validateSql: async () => ({ ok: false, message: "发现 SQL 错误", caliber: { status: "invalid", error: "列不存在" }, fields: [] }),
      syncTable: async () => ({ ok: true }),
      prepareExtraction: async () => ({ ok: true, ready: true }),
      extract: async () => ({ ok: true }),
    } as never);

    await expect(execute(runItem, "validate_sql")).rejects.toThrow("发现 SQL 错误：列不存在");
  });
});

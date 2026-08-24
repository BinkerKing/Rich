import { describe, expect, it } from "vitest";
import {
  buildDictionaryExtractionScenarioVariants,
  formatDictionaryExtractionScenarioSqlComment,
} from "../src/modules/project-dictionary/sql-engine/scenarioPlanner.js";
import type { ProjectDictionaryFieldDetail, ProjectDictionaryTable } from "../src/repos/ProjectManagementRepo.js";

const table = {
  id: "target",
  tableName: "target_table",
  caliber: "场景2：补录\n口径：{\"from\":\"source_b\"}\n备注：补录数据\n场景1：主流程\n口径：{\"from\":\"source_a\"}",
} as ProjectDictionaryTable;

const field = {
  id: "field-1",
  fieldName: "amount",
  acquireLogic: "场景1：主流程\n逻辑：source_a.amount\n场景2：补录\n逻辑：source_b.amount",
} as ProjectDictionaryFieldDetail;

describe("project dictionary scenario planner", () => {
  it("builds and orders independent extraction variants", () => {
    const variants = buildDictionaryExtractionScenarioVariants(table, [field]);
    expect(variants.map(item => item.title)).toEqual(["场景1 主流程", "场景2 补录"]);
    expect(variants[0]?.table.caliber).toContain("source_a");
    expect(variants[1]?.fields[0]?.acquireLogic).toBe("source_b.amount");
  });

  it("formats scenario comments with remarks", () => {
    const variants = buildDictionaryExtractionScenarioVariants(table, [field]);
    expect(formatDictionaryExtractionScenarioSqlComment(variants[1], 1)).toBe("-- 场景2 补录\n-- 备注：补录数据");
  });
});

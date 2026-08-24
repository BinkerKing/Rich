import { describe, expect, it } from "vitest";
import {
  completeSafeIntermediateScenarioMappings,
  standardSafeIntermediateLogic,
} from "../src/modules/project-dictionary/safe/intermediateMapping.js";

describe("SAFE intermediate mapping", () => {
  it("keeps confirmed direct, date, and runtime mapping semantics structured", () => {
    expect(standardSafeIntermediateLogic({
      logic: "直取",
      sql: "TransactionTab.accountId",
      sourceRefs: ["TransactionTab.accountId"],
    })).toEqual({ op: "direct", source: "TransactionTab.accountId" });
    expect(standardSafeIntermediateLogic({
      logic: "日期转换",
      sql: "to_date(TransactionTab.tradeDate, 'YYYYMMDD')",
      sourceRefs: ["TransactionTab.tradeDate"],
    })).toEqual({ op: "date_parse", source: "TransactionTab.tradeDate", from: "YYYYMMDD" });
    expect(standardSafeIntermediateLogic({ logic: "依赖运行环境", sql: "无法直接 SQL 化", sourceRefs: [] }))
      .toEqual({ op: "runtime_context", name: "依赖运行环境" });
  });

  it("fills an unassigned generated primary key and inherits a prior scenario SQL", () => {
    const result = completeSafeIntermediateScenarioMappings([
      {
        tableName: "BopTransaction",
        scenario: "新增",
        condition: "",
        targetField: "ACOD",
        targetCn: "账号",
        sourceRefs: ["TransactionTab.accountId"],
        logic: "直取",
        sql: "TransactionTab.accountId",
        evidence: "evidence",
        remark: "",
        order: 1,
      },
      {
        tableName: "BopTransaction",
        scenario: "变更",
        condition: "",
        targetField: "ACOD",
        targetCn: "账号",
        sourceRefs: [],
        logic: "同上",
        sql: "同上",
        evidence: "evidence",
        remark: "",
        order: 2,
      },
    ], [
      { tableName: "BopTransaction", fieldName: "ID", fieldCn: "主键", primaryKey: true, description: "", evidence: "", remark: "", order: 1 },
      { tableName: "BopTransaction", fieldName: "ACOD", fieldCn: "账号", primaryKey: false, description: "", evidence: "", remark: "", order: 2 },
    ]);

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenario: "新增", targetField: "ID", sql: "数据库/ORM生成" }),
      expect.objectContaining({ scenario: "变更", targetField: "ACOD", sql: "TransactionTab.accountId", sourceRefs: ["TransactionTab.accountId"] }),
    ]));
  });
});

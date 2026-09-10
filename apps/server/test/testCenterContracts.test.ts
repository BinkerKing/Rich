import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { PROJECT_MANAGEMENT_MODULES, TEST_CASE_STATUSES, TEST_RUN_STATUSES } from "../src/repos/ProjectManagementRepo.js";

describe("测试中心领域契约", () => {
  it("将测试中心作为项目管理的独立模块", () => {
    expect(PROJECT_MANAGEMENT_MODULES).toContainEqual({ key: "testing", label: "测试中心" });
  });

  it("统一数据校验和功能测试的用例状态", () => {
    expect(TEST_CASE_STATUSES).toEqual(["draft", "ready", "testing", "passed", "failed", "blocked", "retest"]);
  });

  it("将每次执行作为独立历史记录", () => {
    expect(TEST_RUN_STATUSES).toEqual(["testing", "passed", "failed", "blocked", "retest"]);
  });

  it("为用例和追加式执行记录提供独立存储", () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    expect(tables.map(table => table.name)).toEqual(expect.arrayContaining(["pm_test_cases", "pm_test_runs"]));
    db.close();
  });
});

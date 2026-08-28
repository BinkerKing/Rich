import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeProjectHealthRecord } from "./projectHealthRecord.js";

test("健康检查记录保留 AI 给出的紧急级别和修复信息", () => {
  const record = normalizeProjectHealthRecord({
    severity: "critical",
    category: "architecture",
    status: "fixing",
    evidence: "核心流程集中在单个 1800 行文件。",
    repairPlan: "拆分领域服务并补充边界测试。",
    repairResult: "已拆出认证模块。",
  });
  assert.equal(record.severity, "critical");
  assert.equal(record.status, "fixing");
  assert.equal(record.repairPlan, "拆分领域服务并补充边界测试。");
  assert.equal(record.repairResult, "已拆出认证模块。");
});

test("不完整的 AI 写入记录使用安全默认值", () => {
  const record = normalizeProjectHealthRecord({});
  assert.equal(record.severity, "medium");
  assert.equal(record.category, "architecture");
  assert.equal(record.status, "open");
});

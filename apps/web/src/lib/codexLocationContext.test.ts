import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCodexLocationContext } from "./codexLocationContext.ts";

test("location context records the full page and deliverable business path", () => {
  assert.deepEqual(formatCodexLocationContext({
    page: ["项目管理", "交付物"],
    project: { id: "project-001", title: "数据治理项目" },
    business: { kind: "交付物", id: "deliverable-007", title: "监管报送方案" },
  }), [
    "页面定位：项目管理 / 交付物",
    "业务定位：项目：数据治理项目（项目编号：project-001） / 交付物：监管报送方案（交付物编号：deliverable-007）",
  ].join("\n"));
});

test("location context keeps a task business type fully named", () => {
  assert.match(formatCodexLocationContext({
    page: ["项目管理", "任务"],
    project: { id: "project-001", title: "数据治理项目" },
    business: { kind: "任务", id: "task-008", title: "核对字段映射" },
  }), /业务定位：项目：数据治理项目（项目编号：project-001） \/ 任务：核对字段映射（任务编号：task-008）/);
});

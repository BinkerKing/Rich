import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBoardStatus } from "./TodoBoardModel.js";

test("将既有三列任务映射到新看板状态", () => {
  assert.equal(normalizeBoardStatus({ status: "todo" }), "todo");
  assert.equal(normalizeBoardStatus({ status: "doing" }), "doing");
  assert.equal(normalizeBoardStatus({ status: "done" }), "done");
});

test("保留待规划和审核中的新看板状态", () => {
  assert.equal(normalizeBoardStatus({ status: "planned" }), "planned");
  assert.equal(normalizeBoardStatus({ status: "review" }), "review");
});

test("缺失或未知状态归入待办", () => {
  assert.equal(normalizeBoardStatus({}), "todo");
  assert.equal(normalizeBoardStatus({ status: "unknown" }), "todo");
});

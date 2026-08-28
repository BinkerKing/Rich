import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMulticaStatuses, groupMulticaIssues, planMulticaDrop } from "./TodoBoardModel.js";

test("按 Multica 标准顺序构建状态并保留实际出现的未知状态", () => {
  const statuses = buildMulticaStatuses([
    { id: "in_progress", name: "进行中", position: 2 },
  ], [
    { id: "a", title: "A", status: "waiting_external" },
  ]);
  assert.deepEqual(statuses.slice(0, 5).map(status => status.id), ["backlog", "todo", "in_progress", "in_review", "done"]);
  assert.equal(statuses.at(-1)?.id, "waiting_external");
});

test("按状态和 position 分组任务", () => {
  const groups = groupMulticaIssues([
    { id: "b", title: "B", status: "todo", position: 20 },
    { id: "a", title: "A", status: "todo", position: 10 },
  ]);
  assert.deepEqual(groups.get("todo")?.map(issue => issue.id), ["a", "b"]);
});

test("跨列拖动改变状态后保留落点顺序，同列拖动只生成相对排序", () => {
  assert.deepEqual(planMulticaDrop({ issueId: "a", fromStatus: "todo", toStatus: "in_progress", beforeId: "b" }), [
    { kind: "status", issueId: "a", status: "in_progress" },
    { kind: "reorder", issueId: "a", beforeId: "b" },
  ]);
  assert.deepEqual(planMulticaDrop({ issueId: "a", fromStatus: "todo", toStatus: "todo", afterId: "b" }), [
    { kind: "reorder", issueId: "a", afterId: "b" },
  ]);
  assert.deepEqual(planMulticaDrop({ issueId: "a", fromStatus: "todo", toStatus: "todo", edge: "bottom" }), [
    { kind: "reorder", issueId: "a", edge: "bottom" },
  ]);
});

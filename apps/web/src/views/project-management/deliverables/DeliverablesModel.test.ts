import assert from "node:assert/strict";
import { test } from "node:test";
import { addDeliverableRecord, addDeliverableVersion, deliverableFolderPath, linkedDeliverableContent, normalizeDeliverableContent, orderDeliverableRecords, updateDeliverableFileMeta } from "./DeliverablesModel.js";

test("交付物内容缺失时使用最新保留策略和空集合", () => {
  const content = normalizeDeliverableContent({});

  assert.equal(content.versionPolicy, "latest");
  assert.deepEqual(content.records, []);
  assert.deepEqual(content.versions, []);
});

test("交付物要求记录按时间正序显示", () => {
  const content = addDeliverableRecord(normalizeDeliverableContent({
    records: [{ id: "old", kind: "requirement", text: "旧要求", createdAt: "2026-08-01T09:00:00.000Z" }],
  }), { id: "new", kind: "change", text: "新修改", createdAt: "2026-08-02T09:00:00.000Z" });

  assert.deepEqual(content.records.map(record => record.id), ["old", "new"]);
});

test("AI 任务结果紧跟在其父任务后显示", () => {
  const content = normalizeDeliverableContent({
    records: [
      {
        id: "result",
        kind: "ai_task_result",
        text: "发现两项遗漏",
        createdAt: "2026-09-02T10:02:00.000Z",
        parentRecordId: "task",
        aiTaskResult: {
          taskId: "task-1",
          status: "needs_human",
          executor: "hermes",
          completedAt: "2026-09-02T10:02:00.000Z",
          report: { fileName: "完整报告.md", relativePath: "07-交付/report/AI任务结果/完整报告.md", size: 24 },
          evidence: [{ fileName: "source.xlsx", relativePath: "07-交付/report/source.xlsx", size: 12 }],
        },
      },
      {
        id: "note",
        kind: "information",
        text: "补充材料",
        createdAt: "2026-09-02T10:01:00.000Z",
      },
      {
        id: "task",
        kind: "ai_task",
        text: "核对交付物",
        createdAt: "2026-09-02T10:00:00.000Z",
        aiTask: { id: "task-1", status: "succeeded", executor: "hermes" },
      },
    ],
  });

  assert.deepEqual(orderDeliverableRecords(content.records).map(record => record.id), ["task", "result", "note"]);
  assert.equal(content.records.find(record => record.id === "result")?.aiTaskResult?.report?.fileName, "完整报告.md");
});

test("只保留最新策略以同名文件替换既有版本", () => {
  const content = addDeliverableVersion(normalizeDeliverableContent({
    versionPolicy: "latest",
    versions: [{ id: "v1", fileName: "验收报告.pdf", relativePath: "07-交付/UAT/验收报告.pdf", size: 1, createdAt: "2026-08-01T09:00:00.000Z" }],
  }), { id: "v2", fileName: "验收报告.pdf", relativePath: "07-交付/UAT/验收报告.pdf", size: 2, createdAt: "2026-08-02T09:00:00.000Z" });

  assert.deepEqual(content.versions.map(version => version.id), ["v2"]);
});

test("版本控制策略保留同名文件的历史版本", () => {
  const content = addDeliverableVersion(normalizeDeliverableContent({
    versionPolicy: "versioned",
    versions: [{ id: "v1", fileName: "验收报告.pdf", relativePath: "07-交付/UAT/v1/验收报告.pdf", size: 1, createdAt: "2026-08-01T09:00:00.000Z" }],
  }), { id: "v2", fileName: "验收报告.pdf", relativePath: "07-交付/UAT/v2/验收报告.pdf", size: 2, createdAt: "2026-08-02T09:00:00.000Z" });

  assert.deepEqual(content.versions.map(version => version.id), ["v2", "v1"]);
});

test("文件类型和版本号可独立保存", () => {
  const content = updateDeliverableFileMeta(normalizeDeliverableContent({}), "07-交付/UAT/过程材料.xlsx", { type: "intermediate", version: "0.3" });

  assert.deepEqual(content.fileMeta, [{ relativePath: "07-交付/UAT/过程材料.xlsx", type: "intermediate", version: "0.3" }]);
});

test("文件备注可独立保存", () => {
  const content = normalizeDeliverableContent({
    fileMeta: [{ relativePath: "07-交付/UAT/过程材料.xlsx", type: "material", version: "", note: "等待业务确认" }],
  });

  assert.deepEqual(content.fileMeta, [{ relativePath: "07-交付/UAT/过程材料.xlsx", type: "material", version: "", note: "等待业务确认" }]);
});

test("任务交付物活动生成带稳定关联键的独立交付物记录", () => {
  const content = linkedDeliverableContent("task-1", { id: "activity-1", text: "UAT 验收报告", createdAt: "2026-08-30T10:00:00.000Z" }, deliverableFolderPath("1.2", "联调测试", 3, "UAT 验收报告"));

  assert.equal(content.linkedActivityKey, "task-1:activity-1");
  assert.equal(content.folderPath, "07-交付/1.2-联调测试/03-UAT 验收报告");
});

test("交付物目录由任务编号名称和交付物编号名称组成", () => {
  assert.equal(deliverableFolderPath("2.1", "需求/分析", 1, "验收:报告"), "07-交付/2.1-需求-分析/01-验收-报告");
});

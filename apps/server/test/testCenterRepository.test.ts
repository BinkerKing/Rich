import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { TestCenterSqliteRepo } from "../src/test-center/TestCenterSqliteRepo.js";

describe("TestCenterSqliteRepo", () => {
  it("保存测试任务的说明、数据、链接和应用版本", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const task = await repo.createTask({ projectId: "p1", title: "登录回归", objective: "" });

    const updated = await repo.updateTaskDetails({ projectId: "p1", id: task.id, objective: "验证登录主流程", testData: "测试账号：qa@example.test", testLinks: "https://qa.example.test/login", appVersion: "v1.8.0" });

    expect(updated).toMatchObject({ id: task.id, objective: "验证登录主流程", testData: "测试账号：qa@example.test", testLinks: "https://qa.example.test/login", appVersion: "v1.8.0" });
    expect(await repo.listTasks("p1")).toMatchObject([{ id: task.id, appVersion: "v1.8.0" }]);
    db.close();
  });

  it("以树形分组保存排序，删除分组时提升其内容", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const firstTask = await repo.createTask({ projectId: "p1", title: "任务一", objective: "" });
    const secondTask = await repo.createTask({ projectId: "p1", title: "任务二", objective: "" });
    const source = await repo.createGroup({ projectId: "p1", taskId: firstTask.id, title: "源表" });
    const detail = await repo.createGroup({ projectId: "p1", taskId: firstTask.id, parentGroupId: source.id, title: "明细" });
    const testCase = await repo.createCase({ projectId: "p1", taskId: firstTask.id, groupId: detail.id, code: "TC-tree", title: "表比对", objective: "", type: "data", priority: "high", scenario: "" });

    await repo.moveTask({ projectId: "p1", taskId: secondTask.id, beforeTaskId: firstTask.id });
    await repo.moveGroup({ projectId: "p1", groupId: detail.id, parentGroupId: null, beforeGroupId: source.id });
    await repo.moveCase({ projectId: "p1", caseId: testCase.id, groupId: source.id });
    await repo.deleteGroup({ projectId: "p1", groupId: source.id });

    expect((await repo.listTasks("p1")).map(task => task.id)).toEqual([secondTask.id, firstTask.id]);
    expect(await repo.listGroups("p1")).toEqual([]);
    expect(await repo.listCases("p1")).toEqual([]);
    db.close();
  });

  it("保留同一用例的失败与复测两次执行历史", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const testCase = await repo.createCase({ projectId: "p1", code: "TC-001", title: "金额汇总", objective: "验证汇总", type: "data", priority: "high" });
    const failed = await repo.startRun({ projectId: "p1", caseId: testCase.id });
    await repo.finishRun({ projectId: "p1", runId: failed.id, status: "failed", actualResult: "差异 0.01" });
    const retest = await repo.startRun({ projectId: "p1", caseId: testCase.id });
    await repo.finishRun({ projectId: "p1", runId: retest.id, status: "passed", actualResult: "差异为 0" });

    expect(await repo.listRuns("p1", testCase.id)).toMatchObject([
      { id: retest.id, status: "passed", actualResult: "差异为 0" },
      { id: failed.id, status: "failed", actualResult: "差异 0.01" },
    ]);
    expect(await repo.listCases("p1")).toMatchObject([{ id: testCase.id, status: "passed" }]);
    db.close();
  });

  it("将证据、问题和讨论追溯到指定执行记录", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const testCase = await repo.createCase({ projectId: "p1", code: "TC-002", title: "登录校验", objective: "验证错误密码", type: "functional", priority: "high" });
    const run = await repo.startRun({ projectId: "p1", caseId: testCase.id });

    const evidence = await repo.addEvidence({ projectId: "p1", runId: run.id, title: "失败截图", kind: "image", location: "https://example.test/failure.png" });
    const issue = await repo.createIssue({ projectId: "p1", caseId: testCase.id, runId: run.id, title: "错误密码仍可登录", description: "鉴权未生效", externalRef: "JIRA-101" });
    await repo.addIssueDiscussion({ projectId: "p1", issueId: issue.id, content: "已交给登录模块修复" });

    expect(await repo.listEvidence("p1", run.id)).toMatchObject([{ id: evidence.id, title: "失败截图", location: "https://example.test/failure.png" }]);
    expect(await repo.listIssues("p1")).toMatchObject([{ id: issue.id, caseId: testCase.id, runId: run.id, externalRef: "JIRA-101" }]);
    expect(await repo.listIssueDiscussions("p1", issue.id)).toMatchObject([{ content: "已交给登录模块修复" }]);
    db.close();
  });

  it("从测试任务的用例步骤生成独立的执行步骤快照", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const task = await repo.createTask({ projectId: "p1", title: "登录回归", objective: "验证登录主流程" });
    const testCase = await repo.createCase({ projectId: "p1", taskId: task.id, code: "TC-003", title: "错误密码", objective: "验证错误提示", type: "functional", priority: "medium" });
    const step = await repo.addCaseStep({ projectId: "p1", caseId: testCase.id, stepOrder: 1, instruction: "输入错误密码", expectedResult: "提示登录失败" });

    const run = await repo.startRun({ projectId: "p1", caseId: testCase.id });
    const runSteps = await repo.listRunSteps("p1", run.id);

    expect(await repo.listTasks("p1")).toMatchObject([{ id: task.id, title: "登录回归" }]);
    expect(await repo.listCaseSteps("p1", testCase.id)).toMatchObject([{ id: step.id, expectedResult: "提示登录失败" }]);
    expect(runSteps).toMatchObject([{ caseStepId: step.id, stepOrder: 1, status: "pending", instruction: "输入错误密码", expectedResult: "提示登录失败" }]);
    db.close();
  });

  it("记录步骤结果，并从已修复问题发起源用例的复测", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const testCase = await repo.createCase({ projectId: "p1", code: "TC-004", title: "账户冻结", objective: "验证冻结提示", type: "functional", priority: "high" });
    await repo.addCaseStep({ projectId: "p1", caseId: testCase.id, stepOrder: 1, instruction: "冻结账户登录", expectedResult: "拒绝登录" });
    const failedRun = await repo.startRun({ projectId: "p1", caseId: testCase.id });
    const [runStep] = await repo.listRunSteps("p1", failedRun.id);
    await repo.finishRunStep({ projectId: "p1", runStepId: runStep.id, status: "failed", actualResult: "仍然可登录" });
    const issue = await repo.createIssue({ projectId: "p1", caseId: testCase.id, runId: failedRun.id, title: "冻结未生效", description: "权限检查遗漏" });
    await repo.updateIssue({ projectId: "p1", issueId: issue.id, status: "fixed" });

    const retest = await repo.startRetestFromIssue({ projectId: "p1", issueId: issue.id });

    expect(await repo.listRunSteps("p1", failedRun.id)).toMatchObject([{ id: runStep.id, status: "failed", actualResult: "仍然可登录" }]);
    expect(retest).toMatchObject({ caseId: testCase.id, status: "testing" });
    expect(await repo.listIssues("p1")).toMatchObject([{ id: issue.id, status: "retest" }]);
    db.close();
  });

  it("保存问题的自定义表格字段和项目列设置", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const testCase = await repo.createCase({ projectId: "p1", code: "TC-GRID", title: "表格问题", objective: "", type: "functional", priority: "medium" });
    const issue = await repo.createIssue({ projectId: "p1", caseId: testCase.id, title: "支持影响范围", description: "", customFields: { custom_scope: "登录模块" } });
    const columns = [{ key: "title", name: "问题", width: 280, frozen: true }, { key: "custom_scope", name: "影响范围", width: 160 }];

    await repo.updateIssue({ projectId: "p1", issueId: issue.id, customFields: { custom_scope: "账户模块" } });
    await repo.saveGridSettings("p1", "issues", columns);

    expect(await repo.listIssues("p1")).toMatchObject([{ id: issue.id, customFields: { custom_scope: "账户模块" } }]);
    expect(await repo.getGridSettings("p1", "issues")).toEqual({ columns });
    db.close();
  });

  it("从用例和问题实时汇总测试报告", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const passedCase = await repo.createCase({ projectId: "p1", code: "TC-005", title: "成功场景", objective: "验证成功", type: "functional", priority: "medium" });
    const failedCase = await repo.createCase({ projectId: "p1", code: "TC-006", title: "失败场景", objective: "验证失败", type: "data", priority: "high" });
    const passedRun = await repo.startRun({ projectId: "p1", caseId: passedCase.id });
    const failedRun = await repo.startRun({ projectId: "p1", caseId: failedCase.id });
    await repo.finishRun({ projectId: "p1", runId: passedRun.id, status: "passed", actualResult: "正确" });
    await repo.finishRun({ projectId: "p1", runId: failedRun.id, status: "failed", actualResult: "差异" });
    await repo.createIssue({ projectId: "p1", caseId: failedCase.id, runId: failedRun.id, title: "数据差异", description: "待修复" });

    expect(await repo.getReport("p1")).toEqual(expect.objectContaining({ totalCases: 2, passedCases: 1, failedCases: 1, openIssues: 1, passRate: 50 }));
    db.close();
  });

  it("拒绝将其他执行的步骤作为证据关联目标", async () => {
    const db = new Database(":memory:");
    db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const repo = new TestCenterSqliteRepo(db);
    const first = await repo.createCase({ projectId: "p1", code: "TC-007", title: "用例一", objective: "", type: "functional", priority: "low" });
    const second = await repo.createCase({ projectId: "p1", code: "TC-008", title: "用例二", objective: "", type: "functional", priority: "low" });
    await repo.addCaseStep({ projectId: "p1", caseId: second.id, stepOrder: 1, instruction: "步骤", expectedResult: "结果" });
    const firstRun = await repo.startRun({ projectId: "p1", caseId: first.id });
    const secondRun = await repo.startRun({ projectId: "p1", caseId: second.id });
    const [secondStep] = await repo.listRunSteps("p1", secondRun.id);

    await expect(repo.addEvidence({ projectId: "p1", runId: firstRun.id, runStepId: secondStep.id, title: "错误关联", kind: "image", location: "https://example.test/x.png" })).rejects.toThrow("test run step not found for run");
    db.close();
  });
});

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { testCenterRoutes } from "../src/routes/testCenter.js";
import { TestCenterSqliteRepo } from "../src/test-center/TestCenterSqliteRepo.js";

describe("test center routes", () => {
  it("creates a case and retains its failed execution through HTTP", async () => {
    const db = new Database(":memory:"); db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const app = testCenterRoutes(new TestCenterSqliteRepo(db));
    const created = await app.request("http://local/p1/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "TC-1", title: "金额", objective: "校验金额", type: "data", priority: "high" }) });
    expect(created.status).toBe(201); const testCase = await created.json() as { id: string };
    const started = await app.request(`http://local/p1/cases/${testCase.id}/runs`, { method: "POST" }); const run = await started.json() as { id: string };
    const finished = await app.request(`http://local/p1/runs/${run.id}/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "failed", actualResult: "差异" }) });
    expect(finished.status).toBe(200);
    const runs = await (await app.request(`http://local/p1/cases/${testCase.id}/runs`)).json() as Array<{ status: string; actualResult: string }>;
    expect(runs).toEqual([expect.objectContaining({ status: "failed", actualResult: "差异" })]);
    const projectRuns = await (await app.request("http://local/p1/runs")).json() as Array<{ id: string }>;
    expect(projectRuns).toEqual([expect.objectContaining({ id: run.id })]);
    const report = await app.request("http://local/p1/report");
    expect(report.status).toBe(200);
    expect(await report.json()).toEqual(expect.objectContaining({ totalCases: 1, failedCases: 1, passRate: 0 }));
    db.close();
  });

  it("records execution evidence and its linked issue through HTTP", async () => {
    const db = new Database(":memory:"); db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const app = testCenterRoutes(new TestCenterSqliteRepo(db));
    const created = await app.request("http://local/p1/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "TC-2", title: "登录", objective: "校验登录", type: "functional", priority: "high" }) });
    const testCase = await created.json() as { id: string };
    const run = await (await app.request(`http://local/p1/cases/${testCase.id}/runs`, { method: "POST" })).json() as { id: string };

    const evidence = await app.request(`http://local/p1/runs/${run.id}/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "浏览器截图", kind: "image", location: "https://example.test/login.png" }) });
    const issue = await app.request("http://local/p1/issues", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: testCase.id, runId: run.id, title: "密码错误仍登录", description: "鉴权问题", externalRef: "BUG-23" }) });
    expect(evidence.status).toBe(201); expect(issue.status).toBe(201);
    const issueBody = await issue.json() as { id: string };
    const fixed = await app.request(`http://local/p1/issues/${issueBody.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "fixed" }) });
    const retest = await app.request(`http://local/p1/issues/${issueBody.id}/retest`, { method: "POST" });
    expect(fixed.status).toBe(200); expect(retest.status).toBe(201);

    const issues = await (await app.request("http://local/p1/issues")).json() as Array<{ externalRef: string }>;
    const evidences = await (await app.request(`http://local/p1/runs/${run.id}/evidence`)).json() as Array<{ title: string }>;
    expect(issues).toEqual([expect.objectContaining({ externalRef: "BUG-23", status: "retest" })]);
    expect(evidences).toEqual([expect.objectContaining({ title: "浏览器截图" })]);
    db.close();
  });

  it("creates task and case steps, then writes a run-step result through HTTP", async () => {
    const db = new Database(":memory:"); db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const app = testCenterRoutes(new TestCenterSqliteRepo(db));
    const task = await app.request("http://local/p1/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "登录回归", objective: "验证登录" }) });
    const taskBody = await task.json() as { id: string };
    const created = await app.request("http://local/p1/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: taskBody.id, code: "TC-3", title: "冻结", objective: "验证冻结", type: "functional", priority: "high" }) });
    const testCase = await created.json() as { id: string };
    const step = await app.request(`http://local/p1/cases/${testCase.id}/steps`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stepOrder: 1, instruction: "冻结账户登录", expectedResult: "拒绝登录" }) });
    const run = await (await app.request(`http://local/p1/cases/${testCase.id}/runs`, { method: "POST" })).json() as { id: string };
    const steps = await (await app.request(`http://local/p1/runs/${run.id}/steps`)).json() as Array<{ id: string; status: string }>;
    const finished = await app.request(`http://local/p1/run-steps/${steps[0].id}/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "passed", actualResult: "已拒绝登录" }) });

    expect(task.status).toBe(201); expect(step.status).toBe(201); expect(steps).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(await finished.json()).toEqual(expect.objectContaining({ status: "passed", actualResult: "已拒绝登录" }));
    db.close();
  });

  it("returns a clear validation error for a cross-project case reference", async () => {
    const db = new Database(":memory:"); db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const app = testCenterRoutes(new TestCenterSqliteRepo(db));
    const created = await app.request("http://local/p1/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "TC-4", title: "项目隔离", objective: "验证隔离", type: "data", priority: "medium" }) });
    const testCase = await created.json() as { id: string };
    const response = await app.request(`http://local/p2/cases/${testCase.id}/runs`, { method: "POST" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "test case not found" });
    db.close();
  });

  it("covers task through failed run, evidence, issue, retest, and derived report", async () => {
    const db = new Database(":memory:"); db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const app = testCenterRoutes(new TestCenterSqliteRepo(db));
    const json = async (path: string, method = "GET", body?: unknown) => {
      const response = await app.request(`http://local/p1${path}`, body === undefined ? { method } : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      expect(response.status).toBeLessThan(300);
      return response.json() as Promise<Record<string, string>>;
    };
    const task = await json("/tasks", "POST", { title: "发布回归", objective: "覆盖登录" });
    const testCase = await json("/cases", "POST", { taskId: task.id, code: "TC-E2E", title: "登录失败", objective: "错误密码拒绝", type: "functional", priority: "critical" });
    await json(`/cases/${testCase.id}/steps`, "POST", { stepOrder: 1, instruction: "输入错误密码", expectedResult: "拒绝登录" });
    const failedRun = await json(`/cases/${testCase.id}/runs`, "POST");
    const [runStep] = await (await app.request(`http://local/p1/runs/${failedRun.id}/steps`)).json() as Array<{ id: string }>;
    await json(`/run-steps/${runStep.id}/finish`, "POST", { status: "failed", actualResult: "仍可登录" });
    await json(`/runs/${failedRun.id}/finish`, "POST", { status: "failed", actualResult: "鉴权失效" });
    await json(`/runs/${failedRun.id}/evidence`, "POST", { title: "失败截图", kind: "image", location: "https://example.test/login-fail.png" });
    const issue = await json("/issues", "POST", { caseId: testCase.id, runId: failedRun.id, title: "鉴权失效", description: "错误密码被接受", externalRef: "BUG-100" });
    await json(`/issues/${issue.id}/discussions`, "POST", { content: "修复后复测" });
    await json(`/issues/${issue.id}`, "PATCH", { status: "fixed" });
    const retest = await json(`/issues/${issue.id}/retest`, "POST");
    await json(`/runs/${retest.id}/finish`, "POST", { status: "passed", actualResult: "已拒绝登录" });
    const report = await json("/report") as unknown as { totalCases: number; passedCases: number; failedCases: number; retestIssues: number; passRate: number };

    expect(report).toMatchObject({ totalCases: 1, passedCases: 1, failedCases: 0, retestIssues: 1, passRate: 100 });
    expect(await (await app.request("http://local/p1/runs")).json()).toHaveLength(2);
    db.close();
  });
});

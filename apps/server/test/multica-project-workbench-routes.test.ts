import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { RichMcpError } from "../src/mcp-v2/registry/errors.js";
import { multicaProjectWorkbenchRoutes } from "../src/routes/multicaProjectWorkbench.js";

function makeApp(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const workbench = new Proxy({
    getBoard: async (projectId: string) => ({ project: { id: "mp-1", title: "VTB" }, statuses: [], issues: [], syncedAt: "now", projectId }),
    getTeam: async () => ({ squad: { id: "squad-1", name: "VTB" }, agents: [], resources: [] }),
    getIssue: async (_projectId: string, issueId: string) => ({ issue: { id: issueId, title: "Task", status: "todo", project_id: "mp-1" }, children: [], syncedAt: "now" }),
    setStatus: async (...args: unknown[]) => { calls.push({ method: "setStatus", args }); return { ok: true }; },
    addComment: async (...args: unknown[]) => { calls.push({ method: "addComment", args }); return { ok: true }; },
    ...overrides,
  }, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return async (...args: unknown[]) => { calls.push({ method: String(property), args }); return []; };
    },
  });
  const teams = {
    planTeam: async (request: Record<string, unknown>) => ({ id: "plan-1", richProjectId: request.richProjectId, request, definition: {}, status: "pending", createdAt: "now" }),
    getPlan: async (id: string) => ({ id, richProjectId: "vtb-二代safe", status: "pending" }),
    applyPlan: async () => ({ richProjectId: "vtb-二代safe", projectId: "mp-1", defaultSquadId: "squad-1" }),
    getBinding: async () => null,
  };
  const delegation = {
    backend: "multica-cli",
    delegate: async () => ({ externalTaskId: "issue-1", status: "queued" }),
    getStatus: async () => ({ status: "running" }),
    cancel: async () => undefined,
  };
  const tasks = {
    create: async (input: Record<string, unknown>) => ({ id: "task-1", status: "queued", resultRefs: [], ...input }),
    get: async (id: string) => ({ id, status: "queued", externalTaskId: "issue-1", request: { projectId: "vtb-二代safe" } }),
    list: async () => [],
    sync: async (id: string) => ({ id, status: "running", externalTaskId: "issue-1" }),
  };
  const app = new Hono();
  app.route("/api/project-management", multicaProjectWorkbenchRoutes({ workbench: workbench as never, teams: teams as never, delegation: delegation as never, tasks: tasks as never }));
  return { app, calls };
}

describe("Multica project workbench routes", () => {
  it("serves project-scoped board data without caching", async () => {
    const { app } = makeApp();
    const response = await app.request("/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/board");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ project: { id: "mp-1" } });
  });

  it("maps dependency and ownership failures to stable API errors", async () => {
    const unavailable = makeApp({ getBoard: async () => { throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "Multica offline", { retryable: true }); } }).app;
    const unavailableResponse = await unavailable.request("/api/project-management/vtb/multica/board");
    expect(unavailableResponse.status).toBe(503);
    await expect(unavailableResponse.json()).resolves.toEqual({ error: { code: "DEPENDENCY_UNAVAILABLE", message: "Multica offline", retryable: true } });

    const missing = makeApp({ getIssue: async () => { throw new RichMcpError("NOT_FOUND", "foreign issue"); } }).app;
    expect((await missing.request("/api/project-management/vtb/multica/issues/other")).status).toBe(404);
  });

  it("validates and forwards controlled mutations", async () => {
    const { app, calls } = makeApp();
    const response = await app.request("/api/project-management/vtb/multica/issues/issue-1/status", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "in_review" }),
    });
    expect(response.status).toBe(200);
    expect(calls).toContainEqual({ method: "setStatus", args: ["vtb", "issue-1", "in_review"] });

    const invalid = await app.request("/api/project-management/vtb/multica/issues/issue-1/status", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(invalid.status).toBe(400);
  });

  it("plans, applies and delegates through the shared Multica services", async () => {
    const { app } = makeApp();
    const plan = await app.request("/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/team/plan", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ richProjectName: "VTB", goal: "分析", capabilities: [{ key: "pm", description: "PM", proposedName: "沈砚", role: "project-manager" }] }),
    });
    expect(plan.status).toBe(201);
    await expect(plan.json()).resolves.toMatchObject({ id: "plan-1", richProjectId: "vtb-二代safe" });

    const apply = await app.request("/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/team/apply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: "plan-1", confirmed: true }),
    });
    expect(apply.status).toBe(200);

    const delegated = await app.request("/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/work/delegate", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "熟悉项目", instructions: "只读分析", acceptanceCriteria: [], requiredCapabilities: [], contextRefs: [] }),
    });
    expect(delegated.status).toBe(201);
    await expect(delegated.json()).resolves.toMatchObject({ id: "task-1", externalTaskId: "issue-1" });
  });
});

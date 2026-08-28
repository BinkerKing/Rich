import { Hono, type Context } from "hono";
import { z } from "zod";
import type { WorkDelegationPort, WorkDelegationRequest } from "../mcp-v2/delegation/WorkDelegationPort.js";
import type { MulticaTeamPlanRequest } from "../mcp-v2/delegation/multica/MulticaBindingRepo.js";
import type { MulticaProjectWorkbenchService } from "../mcp-v2/delegation/multica/MulticaProjectWorkbenchService.js";
import { RichMcpError } from "../mcp-v2/registry/errors.js";
import type { ExecutionTeamAdministrationPort } from "../mcp-v2/scenarios/manageExecutionTeam.js";
import type { PersistentTaskService } from "../mcp-v2/tasks/persistentTaskService.js";

export interface MulticaProjectWorkbenchRouteDeps {
  workbench: MulticaProjectWorkbenchService;
  teams: ExecutionTeamAdministrationPort;
  delegation: WorkDelegationPort;
  tasks: PersistentTaskService;
}

const capabilitySchema = z.object({
  key: z.string().trim().min(1), description: z.string().trim().min(1), proposedName: z.string().trim().min(1), role: z.string().trim().min(1),
  preferredAgentName: z.string().trim().min(1).optional(), runtimeProvider: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(), instructions: z.string().optional(),
});
const teamPlanSchema = z.object({
  richProjectName: z.string().trim().min(1), goal: z.string().trim().min(1), projectDescription: z.string().optional(),
  workingDirectory: z.string().optional(), squadName: z.string().optional(), leaderCapabilityKey: z.string().optional(),
  executionMode: z.enum(["in_place", "worktree"]).optional(),
  richMcp: z.object({ name: z.string().trim().min(1), url: z.string().url() }).optional(),
  capabilities: z.array(capabilitySchema).min(1),
});
const delegationSchema = z.object({
  title: z.string().trim().min(1), instructions: z.string().trim().min(1),
  acceptanceCriteria: z.array(z.string()).default([]), requiredCapabilities: z.array(z.string()).default([]),
  workingDirectory: z.string().optional(),
  contextRefs: z.array(z.object({ type: z.string().min(1), id: z.string().min(1), label: z.string().optional() })).default([]),
});
const createIssueSchema = z.object({
  title: z.string().trim().min(1), description: z.string().optional(), status: z.string().optional(), priority: z.string().optional(),
  assigneeId: z.string().optional(), parentId: z.string().optional(), stage: z.number().int().positive().optional(),
  startDate: z.string().optional(), dueDate: z.string().optional(), attachmentPaths: z.array(z.string()).optional(),
});
const updateIssueSchema = z.object({
  title: z.string().optional(), description: z.string().optional(), priority: z.string().optional(),
  parentId: z.string().nullable().optional(), stage: z.number().int().positive().optional(),
  startDate: z.string().nullable().optional(), dueDate: z.string().nullable().optional(),
});
const reorderSchema = z.object({ beforeId: z.string().optional(), afterId: z.string().optional(), edge: z.enum(["top", "bottom"]).optional() });

export function multicaProjectWorkbenchRoutes(deps: MulticaProjectWorkbenchRouteDeps): Hono {
  const routes = new Hono();
  routes.onError((error, c) => errorResponse(c, error));
  routes.use("/:projectId/multica/*", async (c, next) => {
    c.header("cache-control", "no-store");
    await next();
  });

  routes.get("/:projectId/multica/board", async c => c.json(await deps.workbench.getBoard(c.req.param("projectId"))));
  routes.get("/:projectId/multica/team", async c => c.json(await deps.workbench.getTeam(c.req.param("projectId"))));
  routes.get("/:projectId/multica/issues/:issueId", async c => c.json(await deps.workbench.getIssue(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/timeline", async c => c.json(await deps.workbench.getTimeline(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/comments", async c => c.json(await deps.workbench.getComments(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/runs", async c => c.json(await deps.workbench.getRuns(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/runs/:runId/messages", async c => {
    const sinceValue = c.req.query("since");
    const since = sinceValue === undefined ? undefined : Number(sinceValue);
    if (since !== undefined && !Number.isInteger(since)) throw new RichMcpError("VALIDATION_ERROR", "since must be an integer.");
    return c.json(await deps.workbench.getRunMessages(project(c), issue(c), c.req.param("runId"), since));
  });
  routes.get("/:projectId/multica/issues/:issueId/pull-requests", async c => c.json(await deps.workbench.getPullRequests(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/usage", async c => c.json(await deps.workbench.getUsage(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/metadata", async c => c.json(await deps.workbench.getMetadata(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/properties", async c => c.json(await deps.workbench.getProperties(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/labels", async c => c.json(await deps.workbench.getLabels(project(c), issue(c))));
  routes.get("/:projectId/multica/issues/:issueId/subscribers", async c => c.json(await deps.workbench.getSubscribers(project(c), issue(c))));

  routes.post("/:projectId/multica/issues", async c => c.json(await deps.workbench.createIssue(project(c), createIssueSchema.parse(await json(c))), 201));
  routes.patch("/:projectId/multica/issues/:issueId", async c => c.json(await deps.workbench.updateIssue(project(c), issue(c), updateIssueSchema.parse(await json(c)))));
  routes.post("/:projectId/multica/issues/:issueId/status", async c => {
    const body = z.object({ status: z.string().trim().min(1) }).parse(await json(c));
    return c.json(await deps.workbench.setStatus(project(c), issue(c), body.status));
  });
  routes.post("/:projectId/multica/issues/:issueId/reorder", async c => c.json(await deps.workbench.reorderIssue(project(c), issue(c), reorderSchema.parse(await json(c)))));
  routes.post("/:projectId/multica/issues/:issueId/assign", async c => {
    const body = z.object({ assigneeId: z.string().min(1).nullable() }).parse(await json(c));
    return c.json(await deps.workbench.assignIssue(project(c), issue(c), body.assigneeId));
  });
  routes.post("/:projectId/multica/issues/:issueId/comments", async c => {
    const body = z.object({ content: z.string().min(1), parentId: z.string().optional(), attachmentPaths: z.array(z.string()).optional() }).parse(await json(c));
    return c.json(await deps.workbench.addComment(project(c), issue(c), body.content, body.parentId, body.attachmentPaths), 201);
  });
  routes.post("/:projectId/multica/issues/:issueId/comments/:commentId/resolve", async c => {
    const body = z.object({ resolved: z.boolean() }).parse(await json(c));
    return c.json(await deps.workbench.resolveComment(project(c), issue(c), c.req.param("commentId"), body.resolved));
  });
  routes.post("/:projectId/multica/issues/:issueId/rerun", async c => c.json(await deps.workbench.rerunIssue(project(c), issue(c))));
  routes.post("/:projectId/multica/issues/:issueId/runs/:runId/cancel", async c => c.json(await deps.workbench.cancelRun(project(c), issue(c), c.req.param("runId"))));
  routes.post("/:projectId/multica/issues/:issueId/labels/:labelId", async c => {
    const body = z.object({ attached: z.boolean() }).parse(await json(c));
    return c.json(await deps.workbench.setLabel(project(c), issue(c), c.req.param("labelId"), body.attached));
  });
  routes.put("/:projectId/multica/issues/:issueId/properties/:property", async c => {
    const body = z.object({ value: z.string().nullable() }).parse(await json(c));
    return c.json(await deps.workbench.setProperty(project(c), issue(c), c.req.param("property"), body.value));
  });
  routes.put("/:projectId/multica/issues/:issueId/metadata/:key", async c => {
    const body = z.object({ value: z.union([z.string(), z.number(), z.boolean()]).optional() }).parse(await json(c));
    return c.json(await deps.workbench.setMetadata(project(c), issue(c), c.req.param("key"), body.value));
  });
  routes.post("/:projectId/multica/issues/:issueId/subscribers/:actorId", async c => {
    const body = z.object({ subscribed: z.boolean() }).parse(await json(c));
    return c.json(await deps.workbench.setSubscriber(project(c), issue(c), c.req.param("actorId"), body.subscribed));
  });

  routes.post("/:projectId/multica/team/plan", async c => {
    const parsed = teamPlanSchema.parse(await json(c));
    const request: MulticaTeamPlanRequest = { ...parsed, richProjectId: project(c) };
    return c.json(await deps.teams.planTeam(request), 201);
  });
  routes.post("/:projectId/multica/team/apply", async c => {
    const body = z.object({ planId: z.string().min(1), confirmed: z.literal(true) }).parse(await json(c));
    const plan = await deps.teams.getPlan(body.planId);
    if (!plan || plan.richProjectId !== project(c)) throw new RichMcpError("NOT_FOUND", `Execution team plan ${body.planId} was not found for this project.`);
    return c.json(await deps.teams.applyPlan(body.planId));
  });
  routes.post("/:projectId/multica/work/delegate", async c => {
    const input = delegationSchema.parse(await json(c));
    const request: WorkDelegationRequest = { ...input, projectId: project(c) };
    const receipt = await deps.delegation.delegate(request);
    const task = await deps.tasks.create({
      type: "agent", title: input.title, request, backend: deps.delegation.backend, externalTaskId: receipt.externalTaskId,
    });
    return c.json({ ...task, progressSummary: receipt.progressSummary ?? task.progressSummary }, 201);
  });
  routes.get("/:projectId/multica/work/:taskId", async c => {
    const task = await deps.tasks.get(c.req.param("taskId"));
    assertTaskProject(task.request, project(c));
    return c.json(task);
  });
  routes.post("/:projectId/multica/sync", async c => {
    const tasks = await deps.tasks.list({ limit: 200 });
    const owned = tasks.filter(task => requestProjectId(task.request) === project(c));
    const synced = await Promise.all(owned.map(task => deps.tasks.sync(task.id)));
    return c.json({ tasks: synced, syncedAt: new Date().toISOString() });
  });

  return routes;
}

function project(c: Context): string { return c.req.param("projectId") ?? ""; }
function issue(c: Context): string { return c.req.param("issueId") ?? ""; }

async function json(c: Context): Promise<unknown> {
  try { return await c.req.json(); }
  catch { throw new RichMcpError("VALIDATION_ERROR", "A valid JSON body is required."); }
}

function assertTaskProject(request: unknown, projectId: string): void {
  if (requestProjectId(request) !== projectId) throw new RichMcpError("NOT_FOUND", "Work task was not found for this project.");
}

function requestProjectId(request: unknown): string | undefined {
  return request && typeof request === "object" && typeof (request as Record<string, unknown>).projectId === "string"
    ? (request as Record<string, string>).projectId
    : undefined;
}

function errorResponse(c: Context, error: unknown): Response {
  if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid request.", retryable: false } }, 400);
  if (error instanceof RichMcpError) {
    const body = { error: { code: error.code, message: error.message, retryable: error.retryable } };
    if (error.code === "NOT_FOUND") return c.json(body, 404);
    if (error.code === "CONFLICT") return c.json(body, 409);
    if (error.code === "VALIDATION_ERROR") return c.json(body, 400);
    if (error.code === "DEPENDENCY_UNAVAILABLE") return c.json(body, 503);
    return c.json(body, 502);
  }
  return c.json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error", retryable: false } }, 500);
}

import { RichMcpError } from "../../registry/errors.js";
import type { MulticaBindingRepo, MulticaProjectBinding } from "./MulticaBindingRepo.js";
import {
  multicaActorSchema,
  multicaAttachmentSchema,
  multicaBoardSnapshotSchema,
  multicaCommentSchema,
  multicaIssueDetailSnapshotSchema,
  multicaLabelSchema,
  multicaPullRequestSchema,
  multicaRunMessageSchema,
  multicaRunSchema,
  multicaTeamSnapshotSchema,
  multicaTimelineEntrySchema,
  multicaUsageSchema,
  multicaWorkbenchIssueSchema,
  multicaWorkbenchProjectSchema,
  type MulticaBoardSnapshot,
  type MulticaComment,
  type MulticaIssueDetailSnapshot,
  type MulticaPullRequest,
  type MulticaRun,
  type MulticaRunMessage,
  type MulticaStatus,
  type MulticaTeamSnapshot,
  type MulticaTimelineEntry,
  type MulticaUsage,
  type MulticaWorkbenchIssue,
} from "./MulticaProjectWorkbenchSchemas.js";
import type { MulticaCommandPort } from "./types.js";

interface WorkbenchOptions {
  now?: () => string;
}

const STATUS_CATALOG = [
  { id: "backlog", name: "待规划", category: "backlog", color: "#8b94a7", position: 0 },
  { id: "todo", name: "待办", category: "unstarted", color: "#6ea8fe", position: 1 },
  { id: "in_progress", name: "进行中", category: "started", color: "#f5a524", position: 2 },
  { id: "in_review", name: "审核中", category: "started", color: "#55c2a3", position: 3 },
  { id: "done", name: "已完成", category: "completed", color: "#4387ff", position: 4 },
  { id: "blocked", name: "已阻塞", category: "canceled", color: "#e25555", position: 5 },
  { id: "cancelled", name: "已取消", category: "canceled", color: "#697386", position: 6 },
] as const;

export class MulticaProjectWorkbenchService {
  private readonly now: () => string;

  constructor(
    private readonly commands: MulticaCommandPort,
    private readonly bindings: MulticaBindingRepo,
    options: WorkbenchOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async getBoard(projectId: string): Promise<MulticaBoardSnapshot> {
    const binding = await this.binding(projectId);
    const [projectValue, issuesValue] = await Promise.all([
      this.commands.runJson(["project", "get", binding.projectId, "--output", "json"]),
      this.commands.runJson(["issue", "list", "--project", binding.projectId, "--limit", "500", "--output", "json"]),
    ]);
    const project = multicaWorkbenchProjectSchema.parse(extractObject(projectValue, ["project", "data"]));
    const issues = extractArray(issuesValue, ["issues", "data", "items"])
      .map(item => multicaWorkbenchIssueSchema.parse(item))
      .filter(issue => issue.project_id === binding.projectId);
    const statuses: MulticaStatus[] = STATUS_CATALOG.map(status => ({ ...status }));
    for (const issue of issues) {
      if (!statuses.some(status => status.id === issue.status)) {
        statuses.push({ id: issue.status, name: issue.status, category: "unknown", color: "#8b94a7", position: statuses.length });
      }
    }
    return multicaBoardSnapshotSchema.parse({ project, statuses, issues, syncedAt: this.now() });
  }

  async getTeam(projectId: string): Promise<MulticaTeamSnapshot> {
    const binding = await this.binding(projectId);
    const [projectValue, squadValue, resourcesValue] = await Promise.all([
      this.commands.runJson(["project", "get", binding.projectId, "--output", "json"]),
      this.commands.runJson(["squad", "get", binding.defaultSquadId, "--output", "json"]),
      this.commands.runJson(["project", "resource", "list", binding.projectId, "--output", "json"]),
    ]);
    const agents = await Promise.all(binding.agents.map(async configured => {
      const agentValue = await this.commands.runJson(["agent", "get", configured.agentId, "--output", "json"]);
      const agent = extractObject(agentValue, ["agent", "data"]);
      const runtimeId = text(agent.runtime_id);
      const [mcpValue, runtimeValue] = await Promise.all([
        this.commands.runJson(["agent", "mcp", "list", configured.agentId, "--output", "json"]),
        runtimeId ? this.commands.runJson(["runtime", "get", runtimeId, "--output", "json"]) : Promise.resolve(null),
      ]);
      const runtime = runtimeValue ? extractObject(runtimeValue, ["runtime", "data"]) : {};
      return {
        ...agent,
        role: configured.role,
        runtime_name: text(runtime.name),
        runtime_provider: text(runtime.provider),
        mcp_servers: extractArray(mcpValue, ["servers", "mcp_servers", "data", "items"]),
      };
    }));
    return multicaTeamSnapshotSchema.parse({
      project: extractObject(projectValue, ["project", "data"]),
      squad: extractObject(squadValue, ["squad", "data"]),
      agents,
      resources: extractArray(resourcesValue, ["resources", "data", "items"]).map(normalizeResource),
    });
  }

  async getIssue(projectId: string, issueId: string): Promise<MulticaIssueDetailSnapshot> {
    const issue = await this.ownedIssue(projectId, issueId);
    const childrenValue = await this.commands.runJson(["issue", "children", issueId, "--output", "json"]);
    const children = collectIssueLike(childrenValue).map(item => multicaWorkbenchIssueSchema.parse(item));
    const attachments = (Array.isArray(issue.attachments) ? issue.attachments : []).map(item => multicaAttachmentSchema.parse(item));
    return multicaIssueDetailSnapshotSchema.parse({ issue, children, attachments, syncedAt: this.now() });
  }

  async getTimeline(projectId: string, issueId: string): Promise<MulticaTimelineEntry[]> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "timeline", issueId, "--output", "json"]);
    return extractArray(value, ["timeline", "entries", "data", "items"]).map(normalizeTimeline).map(item => multicaTimelineEntrySchema.parse(item));
  }

  async getComments(projectId: string, issueId: string): Promise<MulticaComment[]> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "comment", "list", issueId, "--output", "json"]);
    return extractArray(value, ["comments", "data", "items"]).map(item => multicaCommentSchema.parse(item));
  }

  async getRuns(projectId: string, issueId: string): Promise<MulticaRun[]> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "runs", issueId, "--output", "json"]);
    return extractArray(value, ["runs", "tasks", "data", "items"]).map(item => multicaRunSchema.parse(item));
  }

  async getRunMessages(projectId: string, issueId: string, runId: string, since?: number): Promise<MulticaRunMessage[]> {
    await this.ownedIssue(projectId, issueId);
    const args = ["issue", "run-messages", runId, "--issue", issueId, "--output", "json"];
    if (since !== undefined) args.push("--since", String(since));
    const value = await this.commands.runJson(args);
    return extractArray(value, ["messages", "data", "items"]).map(item => multicaRunMessageSchema.parse(item));
  }

  async getPullRequests(projectId: string, issueId: string): Promise<MulticaPullRequest[]> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "pull-requests", issueId, "--output", "json"]);
    return extractArray(value, ["pull_requests", "pullRequests", "data", "items"]).map(item => multicaPullRequestSchema.parse(item));
  }

  async getUsage(projectId: string, issueId: string): Promise<MulticaUsage> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "usage", issueId, "--output", "json"]);
    return multicaUsageSchema.parse(extractObject(value, ["usage", "data"]));
  }

  async getMetadata(projectId: string, issueId: string): Promise<Record<string, unknown>> {
    await this.ownedIssue(projectId, issueId);
    return extractObject(await this.commands.runJson(["issue", "metadata", "list", issueId, "--output", "json"]), ["metadata", "data"]);
  }

  async getProperties(projectId: string, issueId: string): Promise<Array<Record<string, unknown>>> {
    await this.ownedIssue(projectId, issueId);
    return extractArray(await this.commands.runJson(["issue", "property", "list", issueId, "--output", "json"]), ["properties", "data", "items"]);
  }

  async getLabels(projectId: string, issueId: string) {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "label", "list", issueId, "--output", "json"]);
    return extractArray(value, ["labels", "data", "items"]).map(item => multicaLabelSchema.parse(item));
  }

  async getSubscribers(projectId: string, issueId: string) {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "subscriber", "list", issueId, "--output", "json"]);
    return extractArray(value, ["subscribers", "data", "items"]).map(item => multicaActorSchema.parse(item));
  }

  private async binding(projectId: string): Promise<MulticaProjectBinding> {
    const binding = await this.bindings.getBinding(projectId);
    if (!binding) throw new RichMcpError("CONFLICT", `Rich project ${projectId} is not connected to Multica.`);
    return binding;
  }

  private async ownedIssue(projectId: string, issueId: string): Promise<MulticaWorkbenchIssue> {
    const binding = await this.binding(projectId);
    const value = await this.commands.runJson(["issue", "get", issueId, "--output", "json"]);
    const raw = extractObject(value, ["issue", "data"]);
    if (!raw.id) throw new RichMcpError("NOT_FOUND", `Issue ${issueId} was not found.`);
    const issue = multicaWorkbenchIssueSchema.parse(raw);
    if (issue.project_id !== binding.projectId) throw new RichMcpError("NOT_FOUND", `Issue ${issueId} is not in this Rich project.`);
    return issue;
  }
}

function extractArray(value: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of keys) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested.filter(isRecord);
    if (isRecord(nested)) {
      const result = extractArray(nested, keys);
      if (result.length) return result;
    }
  }
  return [];
}

function extractObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!isRecord(value)) return {};
  for (const key of keys) if (isRecord(value[key])) return extractObject(value[key], keys);
  return value;
}

function collectIssueLike(value: unknown): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!isRecord(node)) return;
    if (typeof node.id === "string" && typeof node.title === "string" && typeof node.status === "string") output.push(node);
    else Object.values(node).forEach(visit);
  };
  visit(value);
  return output;
}

function normalizeTimeline(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, id: value.id ?? value.activity_id ?? value.comment_id, type: value.type ?? value.action ?? value.kind ?? "activity" };
}

function normalizeResource(value: Record<string, unknown>): Record<string, unknown> {
  const ref = isRecord(value.resource_ref) ? value.resource_ref : {};
  return {
    ...ref,
    ...value,
    type: value.type ?? ref.type,
    local_path: value.local_path ?? ref.local_path,
    execution_mode: value.execution_mode ?? ref.execution_mode,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

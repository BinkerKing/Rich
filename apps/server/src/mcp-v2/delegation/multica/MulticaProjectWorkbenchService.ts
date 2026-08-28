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

export interface CreateMulticaIssueInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  parentId?: string;
  stage?: number;
  startDate?: string;
  dueDate?: string;
  attachmentPaths?: string[];
}

export interface UpdateMulticaIssueInput {
  title?: string;
  description?: string;
  priority?: string;
  parentId?: string | null;
  stage?: number;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface ReorderMulticaIssueInput {
  beforeId?: string;
  afterId?: string;
  edge?: "top" | "bottom";
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
    const [projectValue, issueRecords] = await Promise.all([
      this.commands.runJson(["project", "get", binding.projectId, "--output", "json"]),
      this.listProjectIssues(binding.projectId),
    ]);
    const project = multicaWorkbenchProjectSchema.parse(extractObject(projectValue, ["project", "data"]));
    const issues = issueRecords
      .map(item => multicaWorkbenchIssueSchema.parse(normalizeIssue(item)))
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
    const children = collectIssueLike(childrenValue).map(item => multicaWorkbenchIssueSchema.parse(normalizeIssue(item)));
    const attachments = (Array.isArray(issue.attachments) ? issue.attachments : []).map(item => multicaAttachmentSchema.parse(item));
    return multicaIssueDetailSnapshotSchema.parse({ issue, children, attachments, syncedAt: this.now() });
  }

  async getTimeline(projectId: string, issueId: string): Promise<MulticaTimelineEntry[]> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "timeline", issueId, "--activity-only", "--output", "json"]);
    return extractArray(value, ["timeline", "entries", "data", "items"]).map(normalizeTimeline).map(item => multicaTimelineEntrySchema.parse(item));
  }

  async getComments(projectId: string, issueId: string): Promise<MulticaComment[]> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "comment", "list", issueId, "--output", "json"]);
    return extractArray(value, ["comments", "data", "items"]).map(normalizeComment).map(item => multicaCommentSchema.parse(item));
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
    return extractArray(value, ["messages", "data", "items"]).map(normalizeRunMessage).map(item => multicaRunMessageSchema.parse(item));
  }

  async getPullRequests(projectId: string, issueId: string): Promise<MulticaPullRequest[]> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "pull-requests", issueId, "--output", "json"]);
    return extractArray(value, ["pull_requests", "pullRequests", "data", "items"]).map(item => multicaPullRequestSchema.parse(item));
  }

  async getUsage(projectId: string, issueId: string): Promise<MulticaUsage> {
    await this.ownedIssue(projectId, issueId);
    const value = await this.commands.runJson(["issue", "usage", issueId, "--output", "json"]);
    return multicaUsageSchema.parse(normalizeUsage(extractObject(value, ["usage", "data"])));
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
    return extractArray(value, ["subscribers", "data", "items"]).map(normalizeSubscriber).map(item => multicaActorSchema.parse(item));
  }

  async createIssue(projectId: string, input: CreateMulticaIssueInput): Promise<MulticaWorkbenchIssue> {
    const binding = await this.binding(projectId);
    if (!input.title.trim()) throw new RichMcpError("VALIDATION_ERROR", "Issue title is required.");
    const args = ["issue", "create", "--title", input.title, "--project", binding.projectId];
    pushValue(args, "--status", input.status);
    pushValue(args, "--priority", input.priority);
    pushValue(args, "--assignee-id", input.assigneeId);
    pushValue(args, "--parent", input.parentId);
    if (input.stage !== undefined) args.push("--stage", String(input.stage));
    pushValue(args, "--start-date", input.startDate);
    pushValue(args, "--due-date", input.dueDate);
    for (const path of input.attachmentPaths ?? []) args.push("--attachment", path);
    if (input.description !== undefined) args.push("--description-stdin");
    args.push("--output", "json");
    const value = await this.commands.runJson(args, input.description !== undefined ? { stdin: input.description } : undefined);
    return multicaWorkbenchIssueSchema.parse(normalizeIssue(extractObject(value, ["issue", "data"])));
  }

  async updateIssue(projectId: string, issueId: string, input: UpdateMulticaIssueInput): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    const args = ["issue", "update", issueId];
    pushValue(args, "--title", input.title);
    pushValue(args, "--priority", input.priority);
    if (input.parentId !== undefined) args.push("--parent", input.parentId ?? "");
    if (input.stage !== undefined) args.push("--stage", String(input.stage));
    if (input.startDate !== undefined) args.push("--start-date", input.startDate ?? "");
    if (input.dueDate !== undefined) args.push("--due-date", input.dueDate ?? "");
    if (input.description !== undefined) args.push("--description-stdin");
    args.push("--output", "json");
    return this.commands.runJson(args, input.description !== undefined ? { stdin: input.description } : undefined);
  }

  async setStatus(projectId: string, issueId: string, status: string): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(["issue", "status", issueId, status, "--output", "json"]);
  }

  async reorderIssue(projectId: string, issueId: string, input: ReorderMulticaIssueInput): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    const targets = [input.beforeId, input.afterId, input.edge].filter(Boolean);
    if (targets.length !== 1) throw new RichMcpError("VALIDATION_ERROR", "Reorder requires exactly one target.");
    const args = ["issue", "reorder", issueId];
    if (input.beforeId) args.push("--before", input.beforeId);
    if (input.afterId) args.push("--after", input.afterId);
    if (input.edge) args.push(`--${input.edge}`);
    args.push("--output", "json");
    return this.commands.runJson(args);
  }

  async assignIssue(projectId: string, issueId: string, assigneeId: string | null): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(assigneeId
      ? ["issue", "assign", issueId, "--to-id", assigneeId, "--output", "json"]
      : ["issue", "assign", issueId, "--unassign", "--output", "json"]);
  }

  async addComment(projectId: string, issueId: string, content: string, parentId?: string, attachmentPaths: string[] = []): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    const args = ["issue", "comment", "add", issueId];
    pushValue(args, "--parent", parentId);
    for (const path of attachmentPaths) args.push("--attachment", path);
    args.push("--content-stdin", "--output", "json");
    return this.commands.runJson(args, { stdin: content });
  }

  async resolveComment(projectId: string, issueId: string, commentId: string, resolved: boolean): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(["issue", "comment", resolved ? "resolve" : "unresolve", commentId, "--output", "json"]);
  }

  async rerunIssue(projectId: string, issueId: string): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(["issue", "rerun", issueId, "--output", "json"]);
  }

  async cancelRun(projectId: string, issueId: string, runId: string): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(["issue", "cancel-task", runId, "--issue", issueId, "--output", "json"]);
  }

  async setLabel(projectId: string, issueId: string, labelId: string, attached: boolean): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(["issue", "label", attached ? "add" : "remove", issueId, labelId, "--output", "json"]);
  }

  async setProperty(projectId: string, issueId: string, property: string, value: string | null): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(value === null
      ? ["issue", "property", "unset", issueId, "--name", property, "--output", "json"]
      : ["issue", "property", "set", issueId, "--name", property, "--value", value, "--output", "json"]);
  }

  async setMetadata(projectId: string, issueId: string, key: string, value: string | number | boolean | undefined): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    if (value === undefined) return this.commands.runJson(["issue", "metadata", "delete", issueId, "--key", key, "--output", "json"]);
    const valueType = typeof value === "boolean" ? "bool" : typeof value;
    return this.commands.runJson([
      "issue", "metadata", "set", issueId, "--key", key, "--value", String(value), "--type", valueType, "--output", "json",
    ]);
  }

  async setSubscriber(projectId: string, issueId: string, actorId: string, subscribed: boolean): Promise<unknown> {
    await this.ownedIssue(projectId, issueId);
    return this.commands.runJson(["issue", "subscriber", subscribed ? "add" : "remove", issueId, "--user-id", actorId, "--output", "json"]);
  }

  private async binding(projectId: string): Promise<MulticaProjectBinding> {
    const binding = await this.bindings.getBinding(projectId);
    if (!binding) throw new RichMcpError("CONFLICT", `Rich project ${projectId} is not connected to Multica.`);
    return binding;
  }

  private async listProjectIssues(multicaProjectId: string): Promise<Array<Record<string, unknown>>> {
    const issues: Array<Record<string, unknown>> = [];
    const limit = 200;
    let offset = 0;
    for (;;) {
      const value = await this.commands.runJson([
        "issue", "list", "--project", multicaProjectId, "--limit", String(limit), "--offset", String(offset), "--output", "json",
      ]);
      const page = extractArray(value, ["issues", "data", "items"]);
      issues.push(...page);
      if (!isRecord(value) || value.has_more !== true || page.length === 0) break;
      offset += page.length;
    }
    return issues;
  }

  private async ownedIssue(projectId: string, issueId: string): Promise<MulticaWorkbenchIssue> {
    const binding = await this.binding(projectId);
    const value = await this.commands.runJson(["issue", "get", issueId, "--output", "json"]);
    const raw = extractObject(value, ["issue", "data"]);
    if (!raw.id) throw new RichMcpError("NOT_FOUND", `Issue ${issueId} was not found.`);
    const issue = multicaWorkbenchIssueSchema.parse(normalizeIssue(raw));
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
  return {
    ...value,
    id: value.id ?? value.activity_id ?? value.comment_id,
    type: value.type === "activity" && value.action ? value.action : value.type ?? value.action ?? value.kind ?? "activity",
    data: value.data ?? value.details,
  };
}

function normalizeResource(value: Record<string, unknown>): Record<string, unknown> {
  const ref = isRecord(value.resource_ref) ? value.resource_ref : {};
  return {
    ...ref,
    ...value,
    type: value.type ?? value.resource_type ?? ref.type,
    local_path: value.local_path ?? ref.local_path,
    execution_mode: value.execution_mode ?? ref.execution_mode,
  };
}

function normalizeIssue(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    parent_id: value.parent_id ?? value.parent_issue_id,
    attachments: Array.isArray(value.attachments) ? value.attachments.filter(isRecord).map(normalizeAttachment) : value.attachments,
  };
}

function normalizeAttachment(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    name: value.name ?? value.filename,
    size: value.size ?? value.size_bytes,
    url: value.url ?? value.download_url ?? value.markdown_url,
  };
}

function normalizeComment(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, body: value.body ?? value.content, resolved: value.resolved ?? Boolean(value.resolved_at) };
}

function normalizeRunMessage(value: Record<string, unknown>): Record<string, unknown> {
  const runId = value.run_id ?? value.task_id;
  const sequence = value.sequence ?? value.seq;
  return {
    ...value,
    id: value.id ?? (typeof runId === "string" && typeof sequence === "number" ? `${runId}:${sequence}` : undefined),
    run_id: runId,
    sequence,
  };
}

function normalizeUsage(value: Record<string, unknown>): Record<string, unknown> {
  const inputTokens = number(value.input_tokens) ?? number(value.total_input_tokens);
  const outputTokens = number(value.output_tokens) ?? number(value.total_output_tokens);
  return {
    ...value,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: number(value.total_tokens) ?? ((inputTokens ?? 0) + (outputTokens ?? 0)),
  };
}

function normalizeSubscriber(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, id: value.id ?? value.user_id, type: value.type ?? value.user_type };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pushValue(args: string[], flag: string, value: string | undefined): void {
  if (value !== undefined) args.push(flag, value);
}

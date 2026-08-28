import { describe, expect, it } from "vitest";
import {
  multicaBoardSnapshotSchema,
  multicaIssueDetailSnapshotSchema,
} from "../src/mcp-v2/delegation/multica/MulticaProjectWorkbenchSchemas.js";
import { MulticaProjectWorkbenchService } from "../src/mcp-v2/delegation/multica/MulticaProjectWorkbenchService.js";
import type { MulticaBindingRepo, MulticaProjectBinding, MulticaTeamPlan } from "../src/mcp-v2/delegation/multica/MulticaBindingRepo.js";
import type { MulticaCommandPort } from "../src/mcp-v2/delegation/multica/types.js";

describe("Multica project workbench schemas", () => {
  it("parses a complete board snapshot without discarding Multica fields", () => {
    const result = multicaBoardSnapshotSchema.parse({
      project: { id: "mp-1", title: "【VTB】二代SAFE", status: "planned", upstream: "kept" },
      team: {
        squad: { id: "squad-1", name: "VTB SAFE 研析小队", leader_id: "agent-pm" },
        agents: [{ id: "agent-pm", name: "沈砚", model: "gpt-5.6-terra", role: "project-manager" }],
        resources: [{ id: "resource-1", type: "local_directory", local_path: "/tmp/vtb", execution_mode: "in_place" }],
      },
      statuses: [{ id: "in_progress", name: "进行中", category: "started", color: "#f5a524", position: 2 }],
      issues: [{
        id: "issue-1",
        identifier: "VTB-1",
        title: "熟悉项目",
        status: "in_progress",
        project_id: "mp-1",
        priority: "high",
        position: 10,
        labels: [{ id: "label-1", name: "analysis" }],
        custom_multica_field: "kept",
      }],
      syncedAt: "2026-08-28T06:00:00.000Z",
    });

    expect(result.issues[0]).toMatchObject({
      id: "issue-1",
      identifier: "VTB-1",
      priority: "high",
      custom_multica_field: "kept",
    });
    expect(result.project).toMatchObject({ upstream: "kept" });
  });

  it("parses issue detail resources including attachments and execution data", () => {
    const result = multicaIssueDetailSnapshotSchema.parse({
      issue: { id: "issue-1", title: "熟悉项目", status: "todo", project_id: "mp-1" },
      children: [{ id: "child-1", title: "目录分析", status: "todo", project_id: "mp-1", parent_id: "issue-1" }],
      attachments: [{ id: "attachment-1", name: "analysis.md", size: 321, content_type: "text/markdown" }],
      comments: [{ id: "comment-1", body: "开始分析", created_at: "2026-08-28T06:01:00.000Z" }],
      timeline: [{ id: "event-1", type: "status_changed", created_at: "2026-08-28T06:02:00.000Z" }],
      runs: [{ id: "run-1", status: "running", created_at: "2026-08-28T06:03:00.000Z" }],
      runMessages: [{ id: "message-1", run_id: "run-1", sequence: 1, role: "assistant", content: "working" }],
      pullRequests: [{ id: "pr-1", title: "No code changes", state: "open" }],
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
      metadata: { scope: "analysis-only" },
      properties: [{ id: "property-1", name: "Risk", value: "low" }],
      subscribers: [{ id: "agent-pm", name: "沈砚" }],
      syncedAt: "2026-08-28T06:04:00.000Z",
    });

    expect(result.attachments[0]).toMatchObject({ id: "attachment-1", name: "analysis.md" });
    expect(result.runMessages[0]).toMatchObject({ run_id: "run-1", sequence: 1 });
    expect(result.usage).toMatchObject({ total_tokens: 120 });
  });

  it("rejects issues without the identifiers required by Rich", () => {
    expect(() => multicaBoardSnapshotSchema.parse({
      project: { id: "mp-1", title: "VTB" },
      statuses: [],
      issues: [{ id: "issue-1", status: "todo" }],
      syncedAt: "2026-08-28T06:00:00.000Z",
    })).toThrow();
  });
});

class WorkbenchBindings implements MulticaBindingRepo {
  binding: MulticaProjectBinding = {
    richProjectId: "vtb-二代safe",
    richProjectName: "【VTB】二代SAFE",
    projectId: "multica-vtb",
    projectTitle: "【VTB】二代SAFE",
    defaultSquadId: "squad-vtb",
    defaultSquadName: "VTB SAFE 研析小队",
    leader: { agentId: "agent-pm", name: "沈砚", capabilities: ["project-management"], role: "project-manager" },
    executionMode: "in_place",
    richMcp: { serverId: "mcp-rich", name: "rich", url: "http://127.0.0.1:31515/mcp", agentId: "agent-pm" },
    agents: [
      { agentId: "agent-pm", name: "沈砚", capabilities: ["project-management"], role: "project-manager" },
      { agentId: "agent-ba", name: "苏澄", capabilities: ["business-analysis"], role: "business-analyst" },
    ],
    createdAt: "2026-08-28T06:00:00.000Z",
    updatedAt: "2026-08-28T06:00:00.000Z",
  };
  getBinding(id: string) { return id === this.binding.richProjectId ? structuredClone(this.binding) : null; }
  saveBinding(binding: MulticaProjectBinding) { this.binding = structuredClone(binding); }
  createPlan(_plan: MulticaTeamPlan) { /* not used */ }
  getPlan(_id: string) { return null; }
  markPlanApplied(_id: string, binding: MulticaProjectBinding) { this.binding = structuredClone(binding); }
}

class WorkbenchCommands implements MulticaCommandPort {
  calls: Array<{ args: string[]; stdin?: string }> = [];
  issues = [
    { id: "vtb-1", identifier: "VTB-1", title: "熟悉项目", status: "in_progress", project_id: "multica-vtb", parent_issue_id: "parent-1", priority: "high", position: 1, attachments: [{ id: "attachment-real", filename: "evidence.png", size_bytes: 2048, content_type: "image/png", download_url: "/download/evidence" }] },
    { id: "other-1", identifier: "OTHER-1", title: "其他项目", status: "todo", project_id: "other-project", position: 2 },
  ];

  async runJson<T>(args: string[], options?: { stdin?: string }): Promise<T> {
    this.calls.push({ args: [...args], stdin: options?.stdin });
    const command = args.slice(0, 3).join(" ");
    if (args[0] === "project" && args[1] === "get") return { id: "multica-vtb", title: "【VTB】二代SAFE", status: "planned" } as T;
    if (args[0] === "project" && args[1] === "resource" && args[2] === "list") return [{ id: "resource-1", type: "local_directory", local_path: "/tmp/vtb", execution_mode: "in_place" }] as T;
    if (args[0] === "issue" && args[1] === "list") return structuredClone(this.issues) as T;
    if (args[0] === "issue" && args[1] === "get") return structuredClone(this.issues.find(issue => issue.id === args[2])) as T;
    if (args[0] === "squad" && args[1] === "get") return { id: "squad-vtb", name: "VTB SAFE 研析小队", leader_id: "agent-pm" } as T;
    if (args[0] === "agent" && args[1] === "get") return { id: args[2], name: args[2] === "agent-pm" ? "沈砚" : "苏澄", runtime_id: "runtime-codex", model: "gpt-5.6-terra" } as T;
    if (args[0] === "agent" && args[1] === "mcp" && args[2] === "list") return args[3] === "agent-pm" ? [{ id: "mcp-rich", name: "rich" }] as T : [] as T;
    if (args[0] === "runtime" && args[1] === "get") return { id: "runtime-codex", name: "Codex (Mac)", provider: "codex", status: "online" } as T;
    if (command === "issue comment list") return [{ id: "comment-1", body: "开始", created_at: "2026-08-28T06:01:00.000Z" }] as T;
    if (args[0] === "issue" && args[1] === "children") return { stages: [{ issues: [{ id: "child-1", title: "目录分析", status: "todo", project_id: "multica-vtb" }] }] } as T;
    if (args[0] === "issue" && args[1] === "timeline") return [{ id: "event-1", type: "status_changed", created_at: "2026-08-28T06:02:00.000Z" }] as T;
    if (args[0] === "issue" && args[1] === "runs") return [{ id: "run-1", status: "running" }] as T;
    if (args[0] === "issue" && args[1] === "run-messages") return [{ task_id: "run-1", seq: 1, type: "text", content: "working" }] as T;
    if (args[0] === "issue" && args[1] === "pull-requests") return [{ id: "pr-1", title: "Analysis", state: "open" }] as T;
    if (args[0] === "issue" && args[1] === "usage") return { total_input_tokens: 100, total_output_tokens: 20, cost_usd_ticks: 8 } as T;
    if (command === "issue metadata list") return { scope: "analysis" } as T;
    if (command === "issue property list") return [{ id: "property-1", name: "Risk", value: "low" }] as T;
    if (command === "issue label list") return [{ id: "label-1", name: "analysis" }] as T;
    if (command === "issue subscriber list") return [{ user_id: "agent-pm", user_type: "agent", name: "沈砚" }] as T;
    if (args[0] === "issue" && args[1] === "create") {
      const issue = { id: "vtb-new", title: flag(args, "--title"), status: flag(args, "--status") || "backlog", project_id: flag(args, "--project") };
      this.issues.push(issue as (typeof this.issues)[number]);
      return structuredClone(issue) as T;
    }
    if (args[0] === "issue" && ["update", "status", "reorder", "assign", "rerun", "cancel-task"].includes(args[1])) return { ok: true, id: args[2] } as T;
    if (args[0] === "issue" && ["comment", "label", "property", "metadata", "subscriber"].includes(args[1])) return { ok: true } as T;
    throw new Error(`Unexpected command: ${args.join(" ")}`);
  }
}

describe("MulticaProjectWorkbenchService reads", () => {
  it("projects only Issues owned by the Rich-bound Multica Project", async () => {
    const service = new MulticaProjectWorkbenchService(new WorkbenchCommands(), new WorkbenchBindings(), { now: () => "2026-08-28T06:05:00.000Z" });

    await expect(service.getBoard("vtb-二代safe")).resolves.toMatchObject({
      project: { id: "multica-vtb" },
      issues: [{ id: "vtb-1", project_id: "multica-vtb" }],
      statuses: expect.arrayContaining([expect.objectContaining({ id: "in_progress" })]),
      syncedAt: "2026-08-28T06:05:00.000Z",
    });
  });

  it("rejects detail reads for an Issue outside the bound Project", async () => {
    const service = new MulticaProjectWorkbenchService(new WorkbenchCommands(), new WorkbenchBindings());
    await expect(service.getIssue("vtb-二代safe", "other-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("loads team and every supported lazy Issue resource", async () => {
    const service = new MulticaProjectWorkbenchService(new WorkbenchCommands(), new WorkbenchBindings(), { now: () => "2026-08-28T06:05:00.000Z" });

    await expect(service.getTeam("vtb-二代safe")).resolves.toMatchObject({
      squad: { id: "squad-vtb", leader_id: "agent-pm" },
      agents: expect.arrayContaining([expect.objectContaining({ id: "agent-pm", model: "gpt-5.6-terra", role: "project-manager" })]),
      resources: [expect.objectContaining({ execution_mode: "in_place" })],
    });
    await expect(service.getIssue("vtb-二代safe", "vtb-1")).resolves.toMatchObject({
      issue: { id: "vtb-1", parent_id: "parent-1" },
      children: [{ id: "child-1" }],
      attachments: [{ id: "attachment-real", name: "evidence.png", size: 2048, url: "/download/evidence" }],
    });
    await expect(service.getTimeline("vtb-二代safe", "vtb-1")).resolves.toEqual([expect.objectContaining({ id: "event-1" })]);
    await expect(service.getComments("vtb-二代safe", "vtb-1")).resolves.toEqual([expect.objectContaining({ id: "comment-1" })]);
    await expect(service.getRuns("vtb-二代safe", "vtb-1")).resolves.toEqual([expect.objectContaining({ id: "run-1" })]);
    await expect(service.getRunMessages("vtb-二代safe", "vtb-1", "run-1", 0)).resolves.toEqual([
      expect.objectContaining({ id: "run-1:1", run_id: "run-1", sequence: 1 }),
    ]);
    await expect(service.getPullRequests("vtb-二代safe", "vtb-1")).resolves.toEqual([expect.objectContaining({ id: "pr-1" })]);
    await expect(service.getUsage("vtb-二代safe", "vtb-1")).resolves.toMatchObject({ input_tokens: 100, output_tokens: 20, total_tokens: 120, cost_usd_ticks: 8 });
    await expect(service.getMetadata("vtb-二代safe", "vtb-1")).resolves.toEqual({ scope: "analysis" });
    await expect(service.getProperties("vtb-二代safe", "vtb-1")).resolves.toEqual([expect.objectContaining({ id: "property-1" })]);
    await expect(service.getLabels("vtb-二代safe", "vtb-1")).resolves.toEqual([expect.objectContaining({ id: "label-1" })]);
    await expect(service.getSubscribers("vtb-二代safe", "vtb-1")).resolves.toEqual([
      expect.objectContaining({ id: "agent-pm", type: "agent" }),
    ]);
  });
});

describe("MulticaProjectWorkbenchService mutations", () => {
  it("creates Issues only inside the bound Multica Project and sends long text through stdin", async () => {
    const commands = new WorkbenchCommands();
    const service = new MulticaProjectWorkbenchService(commands, new WorkbenchBindings());

    await service.createIssue("vtb-二代safe", {
      title: "分析项目规范",
      description: "多行\n说明",
      status: "backlog",
      priority: "high",
      assigneeId: "squad-vtb",
      attachmentPaths: ["/tmp/brief.md"],
    });

    expect(commands.calls.at(-1)).toEqual({
      args: ["issue", "create", "--title", "分析项目规范", "--project", "multica-vtb", "--status", "backlog", "--priority", "high", "--assignee-id", "squad-vtb", "--attachment", "/tmp/brief.md", "--description-stdin", "--output", "json"],
      stdin: "多行\n说明",
    });
  });

  it("guards and maps every Issue mutation to its narrow Multica CLI command", async () => {
    const commands = new WorkbenchCommands();
    const service = new MulticaProjectWorkbenchService(commands, new WorkbenchBindings());

    await service.updateIssue("vtb-二代safe", "vtb-1", { title: "新标题", description: "多行\n说明", dueDate: "2026-09-01" });
    expect(commands.calls.at(-1)).toEqual({
      args: ["issue", "update", "vtb-1", "--title", "新标题", "--due-date", "2026-09-01", "--description-stdin", "--output", "json"],
      stdin: "多行\n说明",
    });
    await service.setStatus("vtb-二代safe", "vtb-1", "in_review");
    await service.reorderIssue("vtb-二代safe", "vtb-1", { beforeId: "vtb-2" });
    await service.assignIssue("vtb-二代safe", "vtb-1", "agent-pm");
    await service.addComment("vtb-二代safe", "vtb-1", "请复核\n目录", "comment-parent", ["/tmp/evidence.md"]);
    await service.resolveComment("vtb-二代safe", "vtb-1", "comment-1", true);
    await service.resolveComment("vtb-二代safe", "vtb-1", "comment-1", false);
    await service.rerunIssue("vtb-二代safe", "vtb-1");
    await service.cancelRun("vtb-二代safe", "vtb-1", "run-1");
    await service.setLabel("vtb-二代safe", "vtb-1", "label-1", true);
    await service.setLabel("vtb-二代safe", "vtb-1", "label-1", false);
    await service.setProperty("vtb-二代safe", "vtb-1", "Risk", "low");
    await service.setProperty("vtb-二代safe", "vtb-1", "Risk", null);
    await service.setMetadata("vtb-二代safe", "vtb-1", "scope", "analysis");
    await service.setMetadata("vtb-二代safe", "vtb-1", "read_only", true);
    await service.setMetadata("vtb-二代safe", "vtb-1", "scope", undefined);
    await service.setSubscriber("vtb-二代safe", "vtb-1", "agent-pm", true);
    await service.setSubscriber("vtb-二代safe", "vtb-1", "agent-pm", false);

    const mutations = commands.calls.filter(call => call.args[0] === "issue" && call.args[1] !== "get").map(call => call.args);
    expect(mutations).toEqual([
      ["issue", "update", "vtb-1", "--title", "新标题", "--due-date", "2026-09-01", "--description-stdin", "--output", "json"],
      ["issue", "status", "vtb-1", "in_review", "--output", "json"],
      ["issue", "reorder", "vtb-1", "--before", "vtb-2", "--output", "json"],
      ["issue", "assign", "vtb-1", "--to-id", "agent-pm", "--output", "json"],
      ["issue", "comment", "add", "vtb-1", "--parent", "comment-parent", "--attachment", "/tmp/evidence.md", "--content-stdin", "--output", "json"],
      ["issue", "comment", "resolve", "comment-1", "--output", "json"],
      ["issue", "comment", "unresolve", "comment-1", "--output", "json"],
      ["issue", "rerun", "vtb-1", "--output", "json"],
      ["issue", "cancel-task", "run-1", "--issue", "vtb-1", "--output", "json"],
      ["issue", "label", "add", "vtb-1", "label-1", "--output", "json"],
      ["issue", "label", "remove", "vtb-1", "label-1", "--output", "json"],
      ["issue", "property", "set", "vtb-1", "--name", "Risk", "--value", "low", "--output", "json"],
      ["issue", "property", "unset", "vtb-1", "--name", "Risk", "--output", "json"],
      ["issue", "metadata", "set", "vtb-1", "--key", "scope", "--value", "analysis", "--type", "string", "--output", "json"],
      ["issue", "metadata", "set", "vtb-1", "--key", "read_only", "--value", "true", "--type", "bool", "--output", "json"],
      ["issue", "metadata", "delete", "vtb-1", "--key", "scope", "--output", "json"],
      ["issue", "subscriber", "add", "vtb-1", "--user-id", "agent-pm", "--output", "json"],
      ["issue", "subscriber", "remove", "vtb-1", "--user-id", "agent-pm", "--output", "json"],
    ]);
  });

  it("rejects mutations for Issues outside the bound Project before writing", async () => {
    const commands = new WorkbenchCommands();
    const service = new MulticaProjectWorkbenchService(commands, new WorkbenchBindings());

    await expect(service.setStatus("vtb-二代safe", "other-1", "done")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(commands.calls.some(call => call.args[1] === "status")).toBe(false);
  });
});

function flag(args: string[], name: string): string {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? "" : "";
}

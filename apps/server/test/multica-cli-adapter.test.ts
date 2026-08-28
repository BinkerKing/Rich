import { describe, expect, it } from "vitest";
import type { MulticaBindingRepo, MulticaProjectBinding } from "../src/mcp-v2/delegation/multica/MulticaBindingRepo.js";
import { MulticaCliAdapter } from "../src/mcp-v2/delegation/multica/MulticaCliAdapter.js";
import type { MulticaCommandPort } from "../src/mcp-v2/delegation/multica/types.js";

class BindingRepo implements MulticaBindingRepo {
  constructor(readonly binding: MulticaProjectBinding | null) {}
  getBinding() { return structuredClone(this.binding); }
  saveBinding() { throw new Error("not used"); }
  createPlan() { throw new Error("not used"); }
  getPlan() { return null; }
  markPlanApplied() { throw new Error("not used"); }
}

class FakeCommands implements MulticaCommandPort {
  calls: Array<{ args: string[]; stdin?: string }> = [];
  issue = { id: "issue-1", identifier: "RICH-4", title: "实现 Adapter", status: "in_progress", status_category: "started" };
  runs: any[] = [
    { id: "run-leader", issue_id: "issue-1", agent_id: "leader", status: "completed", result: { output: "delegated", pr_url: "" } },
    { id: "run-dev", issue_id: "issue-1", agent_id: "developer", status: "running", result: null },
    { id: "run-old", issue_id: "issue-1", agent_id: "developer", status: "failed", error: "retrying", result: null },
  ];

  async runJson<T>(args: string[], options?: { stdin?: string }): Promise<T> {
    this.calls.push({ args: [...args], stdin: options?.stdin });
    const key = args.slice(0, 2).join(" ");
    if (key === "issue create") return { ...this.issue, status: "todo" } as T;
    if (key === "issue get") return structuredClone(this.issue) as T;
    if (key === "issue runs") return structuredClone(this.runs) as T;
    if (key === "issue cancel-task") return { ok: true } as T;
    throw new Error(`Unexpected command ${args.join(" ")}`);
  }
}

const binding: MulticaProjectBinding = {
  richProjectId: "rich", richProjectName: "Rich", projectId: "project-1", projectTitle: "Rich",
  defaultSquadId: "squad-1", defaultSquadName: "Rich 执行小队",
  agents: [{ agentId: "agent-dev", name: "Rich 开发", capabilities: ["development"], role: "负责实现" }],
  createdAt: "2026-08-28T01:00:00.000Z", updatedAt: "2026-08-28T01:00:00.000Z",
};

describe("MulticaCliAdapter", () => {
  it("creates a project Issue assigned to the bound default Squad", async () => {
    const commands = new FakeCommands();
    const adapter = new MulticaCliAdapter(commands, new BindingRepo(binding));

    const receipt = await adapter.delegate({
      projectId: "rich",
      title: "实现 Adapter",
      instructions: "按设计实现并运行测试",
      acceptanceCriteria: ["服务端测试通过", "不修改无关模块"],
      requiredCapabilities: ["development", "review"],
      workingDirectory: "/workspace/Rich",
      contextRefs: [{ type: "project", id: "rich", label: "Rich" }],
    });

    expect(receipt).toMatchObject({ externalTaskId: "issue-1", status: "queued", progressSummary: expect.stringContaining("RICH-4") });
    expect(commands.calls[0].args).toEqual([
      "issue", "create", "--title", "实现 Adapter", "--description-stdin", "--assignee-id", "squad-1",
      "--project", "project-1", "--status", "todo", "--output", "json",
    ]);
    expect(commands.calls[0].stdin).toContain("## Acceptance criteria\n- 服务端测试通过\n- 不修改无关模块");
    expect(commands.calls[0].stdin).toContain("## Required capabilities\n- development\n- review");
    expect(commands.calls[0].stdin).toContain("/workspace/Rich");
  });

  it("aggregates Issue and Run status using the Issue as stable external ID", async () => {
    const commands = new FakeCommands();
    const adapter = new MulticaCliAdapter(commands, new BindingRepo(binding));

    await expect(adapter.getStatus("issue-1")).resolves.toMatchObject({ status: "running", progressSummary: expect.stringContaining("1 running") });
    expect(commands.calls.map(call => call.args.slice(0, 2).join(" "))).toEqual(["issue get", "issue runs"]);
  });

  it("cancels every active Run but leaves terminal Runs untouched", async () => {
    const commands = new FakeCommands();
    commands.runs.push({ id: "run-waiting", issue_id: "issue-1", status: "waiting_local_directory", result: null });
    const adapter = new MulticaCliAdapter(commands, new BindingRepo(binding));

    await adapter.cancel("issue-1");

    const cancellations = commands.calls.filter(call => call.args[0] === "issue" && call.args[1] === "cancel-task");
    expect(cancellations.map(call => call.args)).toEqual([
      ["issue", "cancel-task", "run-dev", "--issue", "issue-1", "--output", "json"],
      ["issue", "cancel-task", "run-waiting", "--issue", "issue-1", "--output", "json"],
    ]);
  });

  it("refuses delegation until the Rich project has an applied team binding", async () => {
    const adapter = new MulticaCliAdapter(new FakeCommands(), new BindingRepo(null));
    await expect(adapter.delegate({
      projectId: "unbound", title: "work", instructions: "do it", acceptanceCriteria: [], requiredCapabilities: [], contextRefs: [],
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

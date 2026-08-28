import type { WorkDelegationPort, WorkDelegationReceipt, WorkDelegationRequest, WorkDelegationStatus } from "../WorkDelegationPort.js";
import { RichMcpError } from "../../registry/errors.js";
import type { MulticaBindingRepo } from "./MulticaBindingRepo.js";
import { aggregateMulticaStatus, isActiveMulticaRun } from "./MulticaStateMapper.js";
import { multicaIssueSchema, multicaRunListSchema, type MulticaCommandPort } from "./types.js";

export class MulticaCliAdapter implements WorkDelegationPort {
  readonly backend = "multica-cli";

  constructor(
    private readonly commands: MulticaCommandPort,
    private readonly bindings: MulticaBindingRepo,
  ) {}

  async delegate(request: WorkDelegationRequest): Promise<WorkDelegationReceipt> {
    const binding = await this.bindings.getBinding(request.projectId);
    if (!binding) {
      throw new RichMcpError("CONFLICT", `Rich project ${request.projectId} has no applied execution-team plan. Plan and apply a team before delegating.`);
    }
    const issue = multicaIssueSchema.parse(await this.commands.runJson([
      "issue", "create",
      "--title", request.title,
      "--description-stdin",
      "--assignee-id", binding.defaultSquadId,
      "--project", binding.projectId,
      "--status", "todo",
      "--output", "json",
    ], { stdin: issueDescription(request) }));
    return {
      externalTaskId: issue.id,
      status: "queued",
      progressSummary: `${issue.identifier || issue.id} created and assigned to ${binding.defaultSquadName}.`,
    };
  }

  async getStatus(externalTaskId: string): Promise<WorkDelegationStatus> {
    const [issueValue, runsValue] = await Promise.all([
      this.commands.runJson(["issue", "get", externalTaskId, "--output", "json"]),
      this.commands.runJson(["issue", "runs", externalTaskId, "--output", "json"]),
    ]);
    return aggregateMulticaStatus(multicaIssueSchema.parse(issueValue), multicaRunListSchema.parse(runsValue));
  }

  async cancel(externalTaskId: string): Promise<void> {
    const runs = multicaRunListSchema.parse(await this.commands.runJson(["issue", "runs", externalTaskId, "--output", "json"]));
    for (const run of runs.filter(isActiveMulticaRun)) {
      await this.commands.runJson(["issue", "cancel-task", run.id, "--issue", externalTaskId, "--output", "json"]);
    }
  }
}

function issueDescription(request: WorkDelegationRequest): string {
  const criteria = request.acceptanceCriteria.length > 0
    ? request.acceptanceCriteria.map(item => `- ${item}`).join("\n")
    : "- Complete the requested work and report verification evidence.";
  const capabilities = request.requiredCapabilities.length > 0
    ? request.requiredCapabilities.map(item => `- ${item}`).join("\n")
    : "- General execution";
  const refs = request.contextRefs.length > 0
    ? request.contextRefs.map(ref => `- ${ref.type}:${ref.id}${ref.label ? ` (${ref.label})` : ""}`).join("\n")
    : "- None";
  return [
    "## Goal", request.title,
    "", "## Instructions", request.instructions,
    "", "## Acceptance criteria", criteria,
    "", "## Required capabilities", capabilities,
    "", "## Working directory", request.workingDirectory ?? "Use the project resource configured in Multica.",
    "", "## Rich context references", refs,
  ].join("\n");
}

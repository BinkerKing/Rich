import type { McpTask } from "../repos/McpTaskRepo.js";
import type { WorkDelegationPort } from "../mcp-v2/delegation/WorkDelegationPort.js";
import type { AiTaskExecutor } from "./AiTaskDispatcher.js";
import { parseAiTaskRequest } from "./types.js";

export class MulticaTaskExecutor implements AiTaskExecutor {
  readonly executor = "multica" as const;
  constructor(private readonly delegation: WorkDelegationPort, private readonly availableForProject: (projectId: string) => Promise<boolean>) {}
  available(projectId: string) { return this.availableForProject(projectId); }
  async execute(task: McpTask) {
    const request = parseAiTaskRequest(task.request);
    const receipt = await this.delegation.delegate({
      projectId: request.projectId, title: task.title, instructions: request.instructions,
      acceptanceCriteria: request.acceptanceCriteria, requiredCapabilities: ["deliverable"],
      contextRefs: [{ type: "rich-ai-task", id: task.id, label: "Frozen deliverable context" }],
    });
    return { externalTaskId: receipt.externalTaskId, progressSummary: receipt.progressSummary };
  }
}

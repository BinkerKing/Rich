import type { RichResourceRef } from "../mcp-v2/registry/types.js";
import type { McpTask, McpTaskReviewStatus } from "../repos/McpTaskRepo.js";
import type { PersistentTaskService } from "../mcp-v2/tasks/persistentTaskService.js";
import { parseAiTaskRequest } from "./types.js";

export type DeliverableTaskHistoryItem = {
  id: string;
  title: string;
  status: McpTask["status"];
  reviewStatus?: McpTaskReviewStatus;
  summary?: string;
  resultRefs: RichResourceRef[];
  createdAt: string;
  finishedAt?: string;
};

export class DeliverableTaskHistoryService {
  constructor(private readonly tasks: Pick<PersistentTaskService, "list">) {}

  async list(projectId: string, deliverableId: string, excludeTaskId?: string): Promise<DeliverableTaskHistoryItem[]> {
    const tasks = await this.tasks.list({ limit: 200 });
    return tasks.flatMap(task => {
      if (task.id === excludeTaskId || task.type !== "deliverable-ai-task") return [];
      try {
        const request = parseAiTaskRequest(task.request);
        if (request.projectId !== projectId || request.deliverableId !== deliverableId) return [];
        return [{ id: task.id, title: task.title, status: task.status, reviewStatus: task.reviewStatus, summary: task.progressSummary, resultRefs: task.resultRefs, createdAt: task.createdAt, finishedAt: task.finishedAt }];
      } catch { return []; }
    }).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}

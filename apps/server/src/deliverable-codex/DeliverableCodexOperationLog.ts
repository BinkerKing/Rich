import { randomUUID } from "node:crypto";
import type { DeliverablesRepo } from "../repos/DeliverablesRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";

type OperationLogDeps = {
  projects: Pick<ProjectManagementRepo, "listAllModuleItems" | "updateModuleItem">;
  standaloneDeliverables?: Pick<DeliverablesRepo, "get" | "update">;
  projectId: string;
  deliverableId: string;
  summary: string;
  attachment?: { fileName: string; relativePath: string; size: number };
};

const operationSummaries: Record<string, string> = {
  rich_deliverable_file_write: "写入交付物文件",
  rich_deliverable_file_copy: "复制交付物文件",
  rich_deliverable_record_create: "新增交付物记录",
  rich_deliverable_record_update: "更新交付物记录",
  rich_deliverable_requirement_update: "更新需求说明",
  rich_deliverable_settings_update: "更新版本策略",
  rich_deliverable_file_meta_update: "更新文件信息",
};

export function describeDeliverableCodexOperation(tool: string): string | undefined {
  return operationSummaries[tool];
}

function isDeliverableContent(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && (value as Record<string, unknown>).recordType === "deliverable";
}

export async function appendDeliverableCodexOperationRecord({ projects, standaloneDeliverables, projectId, deliverableId, summary, attachment }: OperationLogDeps): Promise<boolean> {
  const projectItem = (await projects.listAllModuleItems(projectId, "deliverables")).find(item => item.id === deliverableId);
  const standalone = projectItem ? undefined : await standaloneDeliverables?.get(deliverableId);
  const deliverable = projectItem ?? standalone;
  if (!deliverable || !isDeliverableContent(deliverable.content)) return false;

  const report = attachment
    ? `已完成：${summary}\n已产出附件：${attachment.fileName}（${formatSize(attachment.size)}）。文件已保存至当前交付物目录，并已完成写入校验。`
    : `已完成：${summary}`;
  const record = {
    id: `codex-operation-${randomUUID()}`,
    kind: "status",
    text: report,
    createdAt: new Date().toISOString(),
    informationType: "information",
    attachments: attachment ? [attachment] : [],
    author: "Codex",
  };
  const records = Array.isArray(deliverable.content.records) ? deliverable.content.records : [];
  const content = { ...deliverable.content, records: [...records, record] };
  const updated = await projects.updateModuleItem(projectId, deliverableId, { content })
    ?? await standaloneDeliverables?.update(deliverableId, { content });
  return Boolean(updated);
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

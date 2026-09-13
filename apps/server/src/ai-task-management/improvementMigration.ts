import type { ImprovementsStore, ImprovementTask } from "../repos/ImprovementsRepo.js";
import type { AiTaskManagementRepo, AiTaskStatus } from "../repos/AiTaskManagementRepo.js";
import { AiTaskManagementService } from "./service.js";

/**
 * Copy the legacy system-improvement board into the unified AI task manager.
 * The old board stays untouched for auditability; legacyImprovementId makes the
 * backfill safe to run on every server start.
 */
export async function migrateImprovementTasks(
  improvements: ImprovementsStore,
  taskRepo: AiTaskManagementRepo,
  tasks = new AiTaskManagementService(taskRepo),
): Promise<number> {
  const existing = await taskRepo.list({ sceneId: "system_improvement", limit: 500 });
  const migratedIds = new Set(existing.map(task => task.payload.legacyImprovementId).filter((id): id is string => typeof id === "string"));
  const legacy = await improvements.list({ limit: 500 });
  let migrated = 0;

  for (const item of legacy) {
    if (migratedIds.has(item.id)) continue;
    const task = await tasks.create({
      sceneId: "system_improvement",
      title: item.title,
      input: {
        text: [item.reason && `改造原因：${item.reason}`, item.description && `问题说明：${item.description}`, item.prdContent && `原 PRD：${item.prdContent}`].filter(Boolean).join("\n\n"),
        images: [],
        materials: (item.relatedFiles ?? []).map(path => ({ id: `legacy-file:${path}`, label: path, path })),
      },
      contextSummary: conciseLegacyContext(item),
      payload: {
        legacyImprovementId: item.id,
        priority: item.priority,
        category: item.category,
        legacyTasks: item.tasks,
        legacyStatus: item.status,
      },
    });
    const status = legacyStatus(item.status);
    if (status !== "ready") {
      await taskRepo.save({ ...task, status, updatedAt: item.updatedAt });
    }
    migrated += 1;
  }
  return migrated;
}

function legacyStatus(status: ImprovementTask["status"]): AiTaskStatus {
  if (status === "verified") return "resolved";
  if (status === "rejected") return "blocked";
  return "ready";
}

function conciseLegacyContext(item: ImprovementTask): string {
  const verification = item.verifications.at(-1);
  return [
    item.reason && `原因：${item.reason}`,
    item.description && `说明：${item.description}`,
    item.tasks.length ? `原拆分：${item.tasks.map(task => task.title).join("；")}` : "",
    verification ? `最近验证：${verification.result === "pass" ? "通过" : "失败"}${verification.notes ? `，${verification.notes}` : ""}` : "",
  ].filter(Boolean).join("\n").slice(0, 4000);
}

import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { ImprovementsRepo } from "../src/repos/ImprovementsRepo.js";
import { SqliteAiTaskManagementRepo } from "../src/repos/SqliteAiTaskManagementRepo.js";
import { migrateImprovementTasks } from "../src/ai-task-management/improvementMigration.js";
import { AiTaskManagementService } from "../src/ai-task-management/service.js";

describe("system improvement migration", () => {
  it("copies legacy improvements once and preserves their useful context", async () => {
    const db = openDb(":memory:");
    const improvements = new ImprovementsRepo(db);
    const legacy = improvements.create({ title: "统一任务入口", description: "入口分散", reason: "减少遗漏", prdContent: "需要统一管理", relatedFiles: ["apps/web/src/App.tsx"], tasks: [{ id: "one", title: "设计模型" }] });
    improvements.update(legacy.id, { status: "ready_to_develop" });
    const repo = new SqliteAiTaskManagementRepo(db);

    expect(await migrateImprovementTasks(improvements, repo)).toBe(1);
    expect(await migrateImprovementTasks(improvements, repo)).toBe(0);
    const [task] = repo.list({ sceneId: "system_improvement" });
    expect(task).toMatchObject({ title: "统一任务入口", status: "ready", payload: { legacyImprovementId: legacy.id } });
    expect(task.input.materials).toEqual([{ id: "legacy-file:apps/web/src/App.tsx", label: "apps/web/src/App.tsx", path: "apps/web/src/App.tsx" }]);
    expect(task.contextSummary).toContain("设计模型");
  });

  it("does not recreate a legacy improvement after its migrated task is deleted", async () => {
    const db = openDb(":memory:");
    const improvements = new ImprovementsRepo(db);
    const legacy = improvements.create({ title: "已删除的旧改造", description: "不应回来" });
    const repo = new SqliteAiTaskManagementRepo(db);
    const tasks = new AiTaskManagementService(repo, improvements);

    await migrateImprovementTasks(improvements, repo, tasks);
    const [task] = repo.list({ sceneId: "system_improvement" });
    await tasks.remove(task.id);

    expect(improvements.get(legacy.id)).toBeNull();
    expect(await migrateImprovementTasks(improvements, repo, tasks)).toBe(0);
  });
});

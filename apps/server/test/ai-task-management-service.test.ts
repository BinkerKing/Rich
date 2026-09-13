import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAiTaskManagementRepo } from "../src/repos/SqliteAiTaskManagementRepo.js";
import { AiTaskManagementService } from "../src/ai-task-management/service.js";

describe("AI task management service", () => {
  it("returns a concise task packet and creates a continuation from a result node", async () => {
    const service = new AiTaskManagementService(new SqliteAiTaskManagementRepo(openDb(":memory:")));
    const task = await service.create({
      sceneId: "bug_fix", title: "首页不刷新", input: { text: "完成后没有刷新", images: [{ id: "image-1", label: "初始截图" }], materials: [] },
      payload: { gitDeployLatest: false }, contextSummary: "初始问题：首页列表没有刷新。",
    });
    await service.claim(task.id, "codex-app");
    await service.reportResult(task.id, "codex-app", {
      analysis: "任务更新事件未触发刷新。", result: "已补充刷新事件。", carryForward: "若继续，检查切页后订阅重连。", statusAfter: "needs_review",
    });

    const packet = await service.getPacket(task.id);
    expect(packet).toMatchObject({ task: { id: task.id, status: "needs_review" }, scene: { id: "bug_fix" }, nodes: [{ result: "已补充刷新事件。" }] });
    expect(packet).not.toHaveProperty("conversation");

    const followUp = await service.continue(task.id);
    expect(followUp).toMatchObject({ rootTaskId: task.id, parentTaskId: task.id, status: "ready" });
    expect(followUp.contextSummary).toContain("检查切页后订阅重连");
  });

  it("lets the claiming AI add a short title without replacing the original bug description", async () => {
    const service = new AiTaskManagementService(new SqliteAiTaskManagementRepo(openDb(":memory:")));
    const task = await service.create({ sceneId: "bug_fix", title: "待 AI 命名", input: { text: "原始 Bug 描述：点击保存后列表未刷新", images: [], materials: [] } });
    await service.claim(task.id, "codex-app");
    await service.reportResult(task.id, "codex-app", { title: "保存后列表未刷新", analysis: "刷新事件缺失", result: "已补充刷新事件", carryForward: "无", statusAfter: "needs_review" });

    const packet = await service.getPacket(task.id);
    expect(packet.task.title).toBe("保存后列表未刷新");
    expect(packet.task.input.text).toBe("原始 Bug 描述：点击保存后列表未刷新");
    expect((await service.list())[0]).toMatchObject({ latestFeedback: "已补充刷新事件" });
  });

  it("deletes a task together with its feedback nodes", async () => {
    const service = new AiTaskManagementService(new SqliteAiTaskManagementRepo(openDb(":memory:")));
    const task = await service.create({ sceneId: "system_improvement", title: "移除的任务", input: { text: "不再需要", images: [], materials: [] } });
    await service.claim(task.id, "codex-app");
    await service.reportResult(task.id, "codex-app", { analysis: "无需继续", result: "准备删除", carryForward: "无", statusAfter: "needs_review" });

    await service.remove(task.id);

    await expect(service.getPacket(task.id)).rejects.toThrow(`AI task ${task.id} was not found.`);
    expect(await service.list()).toEqual([]);
  });

  it("saves an unfinished task as a draft and publishes that same task", async () => {
    const service = new AiTaskManagementService(new SqliteAiTaskManagementRepo(openDb(":memory:")));
    const input = { sceneId: "bug_fix" as const, title: "暂存的首页问题", input: { text: "页面定位：首页\n\n列表还未完成", images: [{ id: "image-1", label: "任务截图" }], materials: [] }, payload: { page: ["首页"], draft: { text: "列表还未完成", location: "首页" } } };
    const draft = await service.saveDraft(input);
    expect(draft).toMatchObject({ status: "draft", title: "暂存的首页问题" });

    const updated = await service.saveDraft({ ...input, title: "暂存的首页问题（已补充）" }, draft.id);
    expect(updated).toMatchObject({ id: draft.id, status: "draft", title: "暂存的首页问题（已补充）" });

    const published = await service.publishDraft(draft.id, input);
    expect(published).toMatchObject({ id: draft.id, status: "ready" });
  });
});

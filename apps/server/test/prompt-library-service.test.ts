import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PromptLibraryService } from "../src/prompt-library/PromptLibraryService.js";

describe("PromptLibraryService", () => {
  it("expands explicit common templates and reads a saved edit on the next render", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rich-prompts-"));
    try {
      const prompts = new PromptLibraryService(join(directory, "prompt-library.json"));
      const initial = await prompts.render("codex.deliverable-analysis-start", {
        modeLabel: "交付物分析", page: "项目管理 / 交付物", businessKind: "交付物", businessTitle: "验收报告", project: "项目 A", projectId: "p", deliverableId: "d", deliverableContext: "当前资料", projectFolder: "/project",
      });
      expect(initial.content).toContain("项目 ID：p");
      expect(initial.content).toContain("不明确的先询问");
      expect(initial.content).toContain("需求确认后同步");
      expect(initial.content).toContain("核实成功后编排计划");
      expect(initial.content).toContain("各阶段确认不可相互替代");
      expect(initial.content).toContain("两项选定后开始");
      expect(initial.content).toContain("每步完成后等用户确认");
      expect(initial.content).toContain("最后集中确认再修改");
      expect(initial.content).toContain("选择保留过程文档时");
      expect(initial.content).toContain("不设固定标题、顺序或栏目");
      expect(initial.content).toContain("能帮助理解才用");
      expect(initial.content).toContain("不重复整套答复");
      expect(initial.content).not.toContain("固定输出模板");
      const turn = await prompts.render("codex.deliverable-analysis-turn", {});
      expect(turn.content).toContain("两项选定后开始");
      expect(turn.content).toContain("不设固定标题、顺序或栏目");
      for (const rendered of [initial, turn]) {
        expect(rendered.content).toContain("rich_deliverable_get");
        expect(rendered.content).toContain("rich_deliverable_requirement_update");
        expect(rendered.content).toContain("rich_deliverable_record_create");
        expect(rendered.content).toContain("attachmentRelativePaths");
      }
      expect(initial.content).toContain("项目目录：/project");
      expect(initial.content).not.toMatch(/{{[^}]+}}/);
      const revisionBefore = await prompts.revision("codex.deliverable-analysis-turn");
      await prompts.update("common.deliverable-analysis-rules", { content: "只保留最新规则。" });
      const next = await prompts.render("codex.deliverable-analysis-turn", {});
      expect(next.content).toContain("只保留最新规则。");
      expect(next.content).not.toContain("各阶段确认不可相互替代");
      expect(next.content).not.toContain("当前资料");
      expect(await prompts.revision("codex.deliverable-analysis-turn")).not.toBe(revisionBefore);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

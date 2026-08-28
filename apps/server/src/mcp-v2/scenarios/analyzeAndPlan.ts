import { z } from "zod";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { ProjectManagementRepo } from "../../repos/ProjectManagementRepo.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richContextSchema } from "../resources/schemas.js";

export function registerAnalyzeAndPlanTool(registry: RichToolRegistry, elements: ElementsRepo, projects: ProjectManagementRepo): void {
  registry.register({
    name: "rich_project_analyze_and_plan", title: "结合 Rich 上下文分析并规划", category: "plan",
    description: "读取 Rich 知识和指定项目的相关信息，形成目标、上下文缺口、风险和可验证执行步骤；不写入项目。",
    inputSchema: z.object({
      goal: z.string().trim().min(1), projectId: z.string().trim().min(1).optional(),
      constraints: z.array(z.string().trim().min(1)).max(30).default([]),
      desiredOutcome: z.string().trim().min(1).optional(), context: richContextSchema,
    }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "结合 Rich 当前资料规划 Agent 委派能力", input: { projectId: "rich", goal: "使用 Multica CLI 委派 Agent", constraints: ["保留人工验收"] } }],
    verification: "Reports which current Rich records were read and does not perform writes.",
    handler: async input => {
      const knowledge = await elements.list();
      const normalizedGoal = input.goal.toLocaleLowerCase();
      const knowledgeHits = knowledge
        .filter(item => normalizedGoal.includes(item.title.toLocaleLowerCase()) || tokens(item.title).some(token => normalizedGoal.includes(token)))
        .slice(0, 10)
        .map(item => ({ source: "knowledge" as const, id: item.id, title: item.title, type: item.type }));
      const projectHits = input.projectId
        ? (await projects.searchAll(input.projectId, input.goal, 10)).map(hit => ({ source: "project" as const, id: hit.entityId, title: hit.title, moduleKey: hit.moduleKey }))
        : [];
      const relevantContext = [...knowledgeHits, ...projectHits];
      const risks = [
        ...(relevantContext.length === 0 ? ["Rich 中未找到直接相关资料，执行前需要补充上下文。"] : []),
        ...input.constraints.map(constraint => `约束需要在验收时验证：${constraint}`),
      ];
      const steps = [
        { order: 1, action: "确认范围与成功标准", verification: input.desiredOutcome ?? "目标、边界和验收结果均明确" },
        { order: 2, action: "基于相关 Rich 记录实施最小变更", verification: "每项变更都能追溯到目标或约束" },
        { order: 3, action: "执行验证并回写结果", verification: "产物、测试结果和未解决问题都有引用" },
      ];
      return richSuccess("rich_project_analyze_and_plan", {
        analysis: { goal: input.goal, desiredOutcome: input.desiredOutcome, constraints: input.constraints, relevantContext, risks },
        plan: { steps },
      }, {
        refs: relevantContext.map(item => ({ type: item.source === "project" ? "projectItem" : "knowledge", id: item.id, label: item.title })),
        verification: { status: "verified", details: `Read ${knowledgeHits.length} knowledge and ${projectHits.length} project records; no writes performed.` },
      });
    },
  });
}

function tokens(value: string): string[] {
  return value.toLocaleLowerCase().split(/[\s、，,。.:：/_-]+/).filter(token => token.length >= 2);
}

import type { AiTaskSceneId } from "../repos/AiTaskManagementRepo.js";

export interface AiTaskScene { id: AiTaskSceneId; version: number; label: string; instructions: string; }

export const AI_TASK_SCENES: Record<AiTaskSceneId, AiTaskScene> = {
  bug_fix: { id: "bug_fix", version: 1, label: "Bug 修复", instructions: "读取问题、初始页面定位和资料。处理前认领任务；每次代码修正完成必须提交 Git。只回写问题分析、处理结果和待处理事项；除非任务明确要求重新部署 App，否则不得部署。" },
  requirement_analysis: { id: "requirement_analysis", version: 1, label: "需求分析", instructions: "完善需求并写出简洁 PRD 结论、已确认范围和待确认事项；不直接派发开发工作。" },
  deliverable_task: { id: "deliverable_task", version: 1, label: "交付物任务", instructions: "读取关联交付物和必要资料，回写分析、结果及后续事项。" },
  system_improvement: { id: "system_improvement", version: 1, label: "系统改造", instructions: "处理 Rich 系统能力改造，回写问题分析、处理结果及待处理事项。" },
};

export function getAiTaskScene(id: AiTaskSceneId): AiTaskScene { return AI_TASK_SCENES[id]; }

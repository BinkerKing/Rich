import { pendingStepCheckpoints, type WorkbenchTask } from "@ke/domain";

export function nextPlaybackStep(task: WorkbenchTask): { kind: "prepare" | "blocked" | "execute" | "aggregate"; stepId: string } | undefined {
  const visit = (parentId?: string): ReturnType<typeof nextPlaybackStep> => {
    for (const step of task.steps.filter(item => item.parentId === parentId)) {
      if (["done", "skipped"].includes(step.status)) continue;
      const hasChildren = task.steps.some(item => item.parentId === step.id);
      if (!hasChildren && !(task.checkpoints ?? []).some(item => item.stepId === step.id)) return { kind: "prepare", stepId: step.id };
      if (pendingStepCheckpoints(task, step.id).length) return { kind: "blocked", stepId: step.id };
      if (hasChildren) return visit(step.id) ?? { kind: "aggregate", stepId: step.id };
      return { kind: "execute", stepId: step.id };
    }
  };
  return visit();
}

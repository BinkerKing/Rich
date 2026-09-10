/** Business tasks displayed in Rich; separate from runtime AI turns/jobs. */
export type WorkbenchStepStatus = "todo" | "running" | "blocked" | "done" | "skipped";
export interface WorkbenchStep {
  startedAt?: string;
  id: string;
  parentId?: string;
  title: string;
  goal: string;
  acceptance: string;
  status: WorkbenchStepStatus;
  evidence: string;
}
export interface WorkbenchRecord {
  id: string;
  stepId?: string;
  kind: "progress" | "conclusion" | "decision" | "question";
  text: string;
  evidence: string;
  resolved: boolean;
  createdAt: string;
}
export interface WorkbenchResource {
  id: string;
  stepId?: string;
  kind: "material" | "intermediate" | "final";
  title: string;
  format?: "file" | "link" | "information";
  content?: string;
  location: string;
  version: string;
  summary: string;
}
export interface WorkbenchCheckpoint {
  id: string;
  stepId: string;
  title: string;
  description: string;
  phase: "before" | "during";
  required: boolean;
  options: Array<{ value: string; label: string; allowsExecution: boolean }>;
  answer?: string;
  answerMode?: "option" | "text";
  answeredAt?: string;
}
export type WorkbenchAction = "clarify" | "refine" | "optimize" | "execute" | "check" | "play";
export interface WorkbenchExecutionEvent {
  id: string; at: string; stepId?: string; text: string;
}
export interface WorkbenchCommand {
  activeStepId?: string;
  events?: WorkbenchExecutionEvent[];
  owner?: string;
  id: string;
  action: WorkbenchAction;
  stepId?: string;
  taskVersion: number;
  prompt: string;
  status: "sending" | "running" | "finished" | "failed" | "unknown";
  error?: string;
  createdAt: string;
  updatedAt: string;
}
export interface WorkbenchTask {
  id: string;
  title: string;
  /** Rich Codex conversation record ID, not a native Codex thread ID. */
  conversationId: string;
  projectId?: string;
  prd?: string;
  requirementChangeSummary?: string;
  requirement: string;
  acceptance: string;
  openQuestions: string;
  outputTarget: string;
  status: "draft" | "active" | "blocked" | "completed" | "archived";
  requirementConfirmed: boolean;
  planConfirmed: boolean;
  version: number;
  steps: WorkbenchStep[];
  records: WorkbenchRecord[];
  resources: WorkbenchResource[];
  checkpoints?: WorkbenchCheckpoint[];
  commands: WorkbenchCommand[];
  createdAt: string;
  updatedAt: string;
}

export function checkpointSatisfied(item: WorkbenchCheckpoint): boolean {
  return Boolean(item.answer?.trim()) && (item.answerMode === "text" || !item.options.length || item.options.some(option => option.value === item.answer && option.allowsExecution));
}

export function pendingStepCheckpoints(task: WorkbenchTask, stepId: string): WorkbenchCheckpoint[] {
  const scope = new Set<string>();
  let id: string | undefined = stepId;
  while (id && !scope.has(id)) { scope.add(id); id = task.steps.find(step => step.id === id)?.parentId; }
  return (task.checkpoints ?? []).filter(item => scope.has(item.stepId) && item.required && !checkpointSatisfied(item));
}

export function unconfirmedExecutionSteps(task: WorkbenchTask, scopeId?: string): WorkbenchStep[] {
  return task.steps.filter(step => {
    if (["done", "skipped"].includes(step.status)) return false;
    let current: WorkbenchStep | undefined = step;
    const seen = new Set<string>();
    while (scopeId && current && current.id !== scopeId && !seen.has(current.id)) { seen.add(current.id); current = task.steps.find(item => item.id === current?.parentId); }
    if (scopeId && current?.id !== scopeId) return false;
    return (!task.steps.some(child => child.parentId === step.id) && !(task.checkpoints ?? []).some(item => item.stepId === step.id)) || pendingStepCheckpoints(task, step.id).length > 0;
  });
}

export const requirementFields = ["title", "requirement", "acceptance", "openQuestions", "outputTarget", "prd"] as const;
export type WorkbenchRequirementVersion = Pick<WorkbenchTask, typeof requirementFields[number] | "version" | "updatedAt" | "requirementChangeSummary">;
export type WorkbenchRequirementSnapshot = WorkbenchRequirementVersion & Pick<WorkbenchTask, "requirementConfirmed">;
export function requirementVersions(snapshots: WorkbenchRequirementSnapshot[]): WorkbenchRequirementVersion[] {
  const result: WorkbenchRequirementVersion[] = [];
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.requirementConfirmed) return;
    const { requirementConfirmed: _, ...version } = snapshot;
    if (!snapshots[index - 1]?.requirementConfirmed) result.push({ ...version, version: result.length + 1 });
    else {
      const current = result[result.length - 1];
      result[result.length - 1] = { ...version, version: current.version, updatedAt: current.updatedAt, requirementChangeSummary: current.requirementChangeSummary };
    }
  });
  return result;
}

export function requirementDocument(task: Pick<WorkbenchTask, "title" | "requirement" | "acceptance" | "openQuestions" | "outputTarget" | "prd">): string {
  return task.prd?.trim() || `# ${task.title}

## 背景与目标

${task.requirement || "待明确"}

## 验收标准

${task.acceptance || "待明确"}

## 交付要求

${task.outputTarget || "待明确"}

## 待明确事项

${task.openQuestions || "暂无记录"}`;
}

export function stepScopeIds(task: Pick<WorkbenchTask, "steps">, stepId: string): Set<string> {
  const ids = new Set([stepId]);
  for (let i = 0; i < task.steps.length; i++) for (const step of task.steps) if (step.parentId && ids.has(step.parentId)) ids.add(step.id);
  return ids;
}

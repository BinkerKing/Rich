export const AUTOMATION_STEPS = [
  "validate_sql",
  "sync_table",
  "prepare_extraction",
  "extract",
] as const;

export type AutomationStep = typeof AUTOMATION_STEPS[number];
export type AutomationExecutionStatus = "pending" | "running" | "success" | "error";

export interface AutomationRunStep {
  step: AutomationStep;
  status: AutomationExecutionStatus;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AutomationRunItem {
  id: string;
  tableId: string;
  tableName: string;
  groupId: string;
  groupName: string;
  groupOrder: number;
  itemOrder: number;
  status: AutomationExecutionStatus;
  steps: AutomationRunStep[];
  affectedRows?: number;
  failedStep?: AutomationStep;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AutomationRunResult {
  status: "success" | "paused";
  items: AutomationRunItem[];
  error?: string;
}

export interface AutomationExecutionContext {
  runtimeParams?: Record<string, unknown>;
}

export type AutomationStepExecutor = (
  item: AutomationRunItem,
  step: AutomationStep,
  context?: AutomationExecutionContext,
) => Promise<{ affectedRows?: number; message?: string }>;

export async function runAutomationItems(
  inputItems: AutomationRunItem[],
  executeStep: AutomationStepExecutor,
  onChange?: (items: AutomationRunItem[]) => Promise<void> | void,
  context: AutomationExecutionContext = {},
): Promise<AutomationRunResult> {
  const items = [...inputItems]
    .sort((left, right) => left.groupOrder - right.groupOrder || left.itemOrder - right.itemOrder)
    .map(cloneRunItem);

  for (const item of items) {
    if (item.status === "success") continue;
    item.status = "running";
    item.error = undefined;
    item.failedStep = undefined;
    item.startedAt ??= new Date().toISOString();
    await onChange?.(items);

    for (const stepName of AUTOMATION_STEPS) {
      const step = item.steps.find(candidate => candidate.step === stepName);
      if (!step || step.status === "success") continue;
      step.status = "running";
      step.error = undefined;
      step.startedAt = new Date().toISOString();
      step.finishedAt = undefined;
      await onChange?.(items);
      try {
        const result = await executeStep(item, stepName, context);
        step.status = "success";
        step.finishedAt = new Date().toISOString();
        if (typeof result.affectedRows === "number") item.affectedRows = result.affectedRows;
        await onChange?.(items);
      } catch (errorValue) {
        const error = errorValue instanceof Error ? errorValue.message : String(errorValue);
        step.status = "error";
        step.error = error;
        step.finishedAt = new Date().toISOString();
        item.status = "error";
        item.failedStep = stepName;
        item.error = error;
        item.finishedAt = step.finishedAt;
        await onChange?.(items);
        return { status: "paused", items, error };
      }
    }

    item.status = "success";
    item.finishedAt = new Date().toISOString();
    await onChange?.(items);
  }

  return { status: "success", items };
}

function cloneRunItem(item: AutomationRunItem): AutomationRunItem {
  return { ...item, steps: item.steps.map(step => ({ ...step })) };
}

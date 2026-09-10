import type { WorkbenchTask } from "@ke/domain";

function visibleExecutionEvent(text: string) {
  const value = text.trim();
  return value.length > 4
    && !/^(开始|结束)：(?:调用工具 · rich_workbench_manage|执行命令)$/.test(value)
    && !/^(已向 Codex 发送执行指令|开始步骤：|步骤完成：)/.test(value)
    && !/^工具 .+ · (?:started|completed|running)$/.test(value);
}

export function recordStepTarget(task: WorkbenchTask, stepId?: string) {
  if (!stepId) return undefined;
  const steps = task.steps ?? [];
  const step = steps.find(item => item.id === stepId);
  if (!step) return undefined;
  const descendants = (parentId: string): typeof steps => steps.flatMap(item => item.parentId === parentId ? (steps.some(child => child.parentId === item.id) ? descendants(item.id) : [item]) : []);
  const leaves = descendants(step.id);
  if (!leaves.length) return { id: step.id, label: step.title };
  const checkpointLeaves = leaves.filter(item => (task.checkpoints ?? []).some(checkpoint => checkpoint.stepId === item.id));
  const relevant = checkpointLeaves.length ? checkpointLeaves : leaves;
  return { id: relevant[0].id, label: relevant.length === 1 ? relevant[0].title : `${relevant[0].title} 等 ${relevant.length} 个子步骤` };
}

export function stepRecordEntries(task: WorkbenchTask) {
  const entries = [
    ...task.commands.flatMap(command => (command.events ?? [])
      .filter(event => visibleExecutionEvent(event.text))
      .map(event => ({ ...event, id: `${command.id}:${event.id}` }))),
    ...(task.records ?? []).filter(record => record.kind === "progress").map(record => ({ id: record.id, at: record.createdAt, stepId: record.stepId, text: record.text })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Set<string>();
  const distinct = entries.filter(entry => {
    const key = `${entry.stepId ?? "task"}:${entry.text.trim().replace(/\s+/g, " ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const recordedSteps = new Set<string>();
  return distinct.filter(entry => {
    const key = recordStepTarget(task, entry.stepId)?.id ?? entry.stepId ?? "task";
    if (recordedSteps.has(key)) return false;
    recordedSteps.add(key);
    return true;
  }).slice(0, 300);
}

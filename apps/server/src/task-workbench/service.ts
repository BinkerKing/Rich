import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requirementDocument, pendingStepCheckpoints, checkpointSatisfied, type WorkbenchTask } from "@ke/domain";
import type { WorkbenchRepo } from "./repository.js";
import type { DeliverableCodexConversationRepo } from "../repos/DeliverableCodexConversationRepo.js";
import { eventBus } from "../lib/eventBus.js";
import { RichMcpError } from "../mcp-v2/registry/errors.js";
import { createTaskSchema, taskPatchSchema, stepSchema, stepPatchSchema, recordSchema, resourceSchema, writeSchema, checkpointSchema, checkpointAnswerSchema } from "./schema.js";

export function conflict(message: string): never { throw new RichMcpError("CONFLICT", message); }
export function invalid(message: string): never { throw new RichMcpError("VALIDATION_ERROR", message); }

export class WorkbenchService {
  constructor(readonly repo: WorkbenchRepo, readonly conversations: Pick<DeliverableCodexConversationRepo, "get">) {}
  async list() { return (await this.repo.list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async get(id: string) {
    const task = await this.repo.get(id);
    if (!task) throw new RichMcpError("NOT_FOUND", "任务不存在");
    return task;
  }
  async binding(task: Pick<WorkbenchTask, "conversationId">) {
    const conversation = await this.conversations.get(task.conversationId);
    if (!conversation || conversation.status !== "active") conflict("绑定的 Codex 对话不存在或已归档，请在有效对话中重新承接任务");
    return conversation;
  }
  async create(raw: unknown) {
    const input = createTaskSchema.parse(raw);
    await this.binding(input);
    const now = new Date().toISOString();
    const task: WorkbenchTask = {
      ...input, id: `work-${randomUUID()}`, status: "draft", requirementConfirmed: false, planConfirmed: false,
      version: 1, steps: [], records: [], resources: [], commands: [], createdAt: now, updatedAt: now,
    };
    if (!await this.repo.save(task, 0)) conflict("创建任务发生冲突");
    this.changed(task); return task;
  }
  async mutate(id: string, expectedVersion: number, change: (task: WorkbenchTask) => void, allowCommandChanges = false) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const task = await this.get(id);
      if (task.version !== expectedVersion) {
        const baseline = allowCommandChanges ? await this.repo.getVersion(id, expectedVersion) : null;
        const business = ({ commands, updatedAt, version, ...document }: WorkbenchTask) => JSON.stringify(document);
        if (!baseline || business(baseline) !== business(task)) conflict(`任务已更新为 v${task.version}，请重新读取后修改`);
      }
      const currentVersion = task.version;
      change(task);
      validateTask(task);
      task.version += 1; task.updatedAt = new Date().toISOString();
      if (!await this.repo.save(task, currentVersion)) {
        if (allowCommandChanges) continue;
        conflict("任务被其他操作更新，请重新读取后修改");
      }
      this.changed(task); return task;
    }
    conflict("任务被其他操作更新，请重新读取后修改");
  }
  async write(id: string, raw: unknown) {
    const { action, expectedVersion, input } = writeSchema.parse(raw);
    if (action === "update") {
      const patch = taskPatchSchema.parse(input);
      if (patch.conversationId) await this.binding({ conversationId: patch.conversationId });
    }
    return this.mutate(id, expectedVersion, task => {
      if (task.status === "archived" && action !== "update") conflict("任务已归档");
      if (action === "update") {
        const { requirementUpdateKind, ...patch } = taskPatchSchema.parse(input);
        if (patch.status === "archived" && task.commands.some(command => ["sending", "running"].includes(command.status))) conflict("指令执行期间不能归档任务");
        if (patch.conversationId && patch.conversationId !== task.conversationId && task.commands.some(command => ["sending", "running"].includes(command.status))) conflict("指令执行期间不能更换绑定对话");
        const changesRequirement = (["title", "requirement", "acceptance", "openQuestions", "outputTarget", "prd"] as const).some(key => patch[key] !== undefined && patch[key] !== task[key]);
        if (changesRequirement && !patch.requirementChangeSummary) task.requirementChangeSummary = "调整了" + Object.keys(patch).filter(key => ["title", "requirement", "acceptance", "openQuestions", "outputTarget", "prd"].includes(key)).map(key => ({title:"需求标题",requirement:"需求目标",acceptance:"验收标准",openQuestions:"待明确事项",outputTarget:"交付要求",prd:"PRD 正文"}[key])).join("、");
        if (task.prd && changesRequirement && patch.prd === undefined && ["title", "requirement", "acceptance", "openQuestions", "outputTarget"].some(key => key in patch)) invalid("请同步更新完整 PRD 正文，保持需求信息一致");
        Object.assign(task, patch);
        if (changesRequirement && requirementUpdateKind === "change") { task.requirementConfirmed = false; task.planConfirmed = false; if (task.status === "completed") task.status = "draft"; }
      } else if (action === "plan") {
        const { steps } = z.object({ steps: z.array(stepSchema).max(500) }).strict().parse(input);
        const internallyRefined = isInternalRefinement(task, steps);
        for (const old of task.steps) {
          const next = steps.find(step => step.id === old.id);
          if (!next) invalid("不能删除已有步骤；不再执行的步骤请标记 skipped 并说明原因");
          if (stepLocked(old) && planStructure([old]) !== planStructure([next])) invalid("已执行步骤不能修改；请新增后续步骤承接调整");
          next.startedAt = old.startedAt;
          if (next.status !== old.status || next.evidence !== old.evidence) invalid("调整计划不能覆盖执行记录；请通过 step 操作更新状态与依据");
        }
        for (const old of task.steps.filter(stepLocked)) {
          const oldChildren = task.steps.filter(step => step.parentId === old.id).map(step => step.id);
          const newChildren = steps.filter(step => step.parentId === old.id).map(step => step.id);
          const addsChildrenToRunningStep = internallyRefined && old.status === "running" && oldChildren.every(id => newChildren.includes(id));
          if ((!addsChildrenToRunningStep && JSON.stringify(oldChildren) !== JSON.stringify(newChildren)) || task.steps.indexOf(old) !== steps.findIndex(step => step.id === old.id)) invalid("已执行步骤不能调整顺序或子计划");
        }
        const lockedIds = task.steps.filter(stepLocked).map(step => step.id);
        if (JSON.stringify(lockedIds) !== JSON.stringify(steps.filter(step => lockedIds.includes(step.id)).map(step => step.id))) invalid("已执行步骤不能调整顺序");
        if (steps.some(step => !task.steps.some(old => old.id === step.id) && step.parentId && task.steps.some(old => old.id === step.parentId && stepLocked(old)) && !(internallyRefined && task.steps.some(old => old.id === step.parentId && old.status === "running")))) invalid("已执行步骤不能新增子计划；请新增后续步骤");
        if (!internallyRefined && planStructure(task.steps) !== planStructure(steps)) task.planConfirmed = false;
        task.steps = steps;
      } else if (action === "step") {
        const patch = stepPatchSchema.parse(input);
        const step = task.steps.find(item => item.id === patch.id);
        if (!step) invalid("步骤不存在，请先更新计划");
        if (patch.status && ["running", "done"].includes(patch.status) && !(task.checkpoints ?? []).some(item => item.stepId === step.id) && !(patch.status === "done" && task.steps.some(child => child.parentId === step.id))) invalid("请先梳理步骤确认项");
        if (stepLocked(step) && planStructure([step]) !== planStructure([{ ...step, ...patch }])) invalid("已执行步骤不能修改；请新增后续步骤承接调整");
        if (patch.parentId !== undefined && patch.parentId !== step.parentId && task.steps.some(parent => stepLocked(parent) && [step.parentId, patch.parentId].includes(parent.id))) invalid("已执行步骤不能调整子计划");
        if (stepLocked(step) && patch.status === "todo") invalid("已执行步骤不能重置为未执行");
        if (stepLocked(step) || patch.status && ["running", "done", "skipped"].includes(patch.status)) step.startedAt ??= new Date().toISOString();
        const before = planStructure(task.steps);
        Object.assign(step, patch);
        if (patch.status === "running") { const command = task.commands.slice().reverse().find(item => ["sending", "running"].includes(item.status)); if (command) command.activeStepId = step.id; }
        if (before !== planStructure(task.steps)) task.planConfirmed = false;
      } else if (action === "checkpoint") {
        const next = checkpointSchema.parse(input);
        if (!task.steps.some(step => step.id === next.stepId)) invalid("确认项关联的步骤不存在");
        const previous = task.checkpoints?.find(item => item.id === next.id);
        const unchanged = previous && JSON.stringify({ ...previous, answer: undefined, answerMode: undefined, answeredAt: undefined }) === JSON.stringify(next);
        task.checkpoints = [...(task.checkpoints ?? []).filter(item => item.id !== next.id), unchanged ? previous : next];
        if (task.status === "completed") task.status = "active";
        reopenCheckpointSteps(task, next.stepId, Boolean(previous?.answer) && !unchanged);
      } else if (action === "answer") {
        const answer = checkpointAnswerSchema.parse(input);
        const item = task.checkpoints?.find(item => item.id === answer.id);
        if (!item) invalid("确认项不存在");
        const answerMode = answer.answerMode ?? (item.options.length ? "option" : "text");
        if (answerMode === "option" && !item.options.some(option => option.value === answer.answer)) invalid("请选择有效选项");
        const answerChanged = item.answer !== answer.answer.trim() || (item.answerMode ?? (item.options.length ? "option" : "text")) !== answerMode;
        const changedAnswer = checkpointSatisfied(item) && answerChanged;
        item.answer = answer.answer.trim(); item.answerMode = answerMode; item.answeredAt = new Date().toISOString();
        task.records.push({ id: randomUUID(), stepId: item.stepId, kind: "decision", text: `确认项：${item.title}\n答复：${item.answerMode === "text" ? item.answer : item.options.find(option => option.value === item.answer)?.label ?? item.answer}`, evidence: "工作台确认项答复", resolved: true, createdAt: item.answeredAt });
        if (answerChanged) {
          const start = "<!-- workbench-confirmations -->";
          const end = "<!-- /workbench-confirmations -->";
          let document = requirementDocument(task);
          const from = document.indexOf(start), to = document.indexOf(end, from);
          if (from >= 0 && to >= from) document = document.slice(0, from) + document.slice(to + end.length);
          const escape = (value: string) => value.replace(/[\\`*_{}\[\]<>#]/g, char => "\\" + char);
          const facts = (task.checkpoints ?? []).filter(check => check.answer).map(check => `### ${escape(check.title)}

${escape(check.answerMode === "text" ? check.answer! : check.options.find(option => option.value === check.answer)?.label ?? check.answer!)}`).join("\n\n");
          task.prd = `${document.trim()}\n\n${start}\n## 执行中明确的信息\n\n${facts}\n${end}`;
          task.requirementChangeSummary = [...new Set([!task.requirementConfirmed ? task.requirementChangeSummary : "", `补充确认信息：${item.title}`].filter(Boolean))].join("；");
          if (changedAnswer) { task.requirementConfirmed = false; task.planConfirmed = false; }
        }
        if (task.status === "completed") task.status = "active";
        reopenCheckpointSteps(task, item.stepId, changedAnswer);
      } else if (action === "record") {
        const record = recordSchema.parse(input);
        const old = record.id ? task.records.find(item => item.id === record.id) : undefined;
        const next = { ...record, id: record.id ?? randomUUID(), createdAt: old?.createdAt ?? new Date().toISOString() };
        task.records = [...task.records.filter(item => item.id !== next.id), next];
      } else if (action === "resource") {
        const resource = resourceSchema.parse(input);
        const next = { ...resource, id: resource.id ?? randomUUID() };
        task.resources = [...task.resources.filter(item => item.id !== next.id), next];
      } else {
        const confirmation = z.object({ target: z.enum(["requirement", "plan"]), evidence: z.string().trim().min(1).max(4000) }).strict().parse(input);
        if (confirmation.target === "requirement") {
          if (!task.requirement.trim()) invalid("请先记录初步需求");
          task.requirementConfirmed = true;
        } else {
          if (!task.requirementConfirmed || !task.steps.length) invalid("请先确认需求并制定计划");
          task.planConfirmed = true;
        }
        task.records.push({ id: randomUUID(), kind: "decision", text: confirmation.target === "plan" ? "已确认当前计划" : "已确认当前需求", evidence: confirmation.evidence, resolved: true, createdAt: new Date().toISOString() });
      }
    }, true);
  }
  private changed(task: WorkbenchTask) { eventBus.publish("workbench.changed", { detail: { taskId: task.id, version: task.version } }); }
}

function stepLocked(step: WorkbenchTask["steps"][number]) { return Boolean(step.startedAt) || ["running", "done", "skipped"].includes(step.status) || Boolean(step.evidence.trim()); }
function planStructure(steps: WorkbenchTask["steps"]) {
  return JSON.stringify(steps.map(({ id, parentId, title, goal, acceptance }) => ({ id, parentId, title, goal, acceptance })));
}
function isInternalRefinement(task: WorkbenchTask, next: WorkbenchTask["steps"]) {
  const existingIds = new Set(task.steps.map(step => step.id));
  const existing = next.filter(step => existingIds.has(step.id));
  const additions = next.filter(step => !existingIds.has(step.id));
  if (!additions.length || planStructure(task.steps) !== planStructure(existing)) return false;
  return additions.every(step => {
    const parent = step.parentId && task.steps.find(item => item.id === step.parentId);
    return Boolean(parent && ["todo", "running"].includes(parent.status));
  });
}
export function validateTask(task: WorkbenchTask): void {
  const ids = new Set(task.steps.map(step => step.id));
  if (ids.size !== task.steps.length) invalid("步骤 ID 不可重复");
  const byId = new Map(task.steps.map(step => [step.id, step]));
  for (const step of task.steps) {
    const seen = new Set([step.id]); let parentId = step.parentId;
    while (parentId) {
      if (seen.has(parentId)) invalid("步骤父子关系不能形成循环");
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) invalid("父步骤不存在");
      parentId = parent.parentId;
    }
    if (["running", "done"].includes(step.status) && pendingStepCheckpoints(task, step.id).length) invalid("步骤存在未满足的必填确认项");
    if ((step.status === "done" || step.status === "skipped") && !step.evidence.trim()) invalid("完成或跳过步骤必须提供依据");
    if (step.status === "done" && task.steps.some(child => child.parentId === step.id && !["done", "skipped"].includes(child.status))) invalid("子步骤尚未完成");
  }
  for (const item of [...task.records, ...task.resources]) if (item.stepId && !ids.has(item.stepId)) invalid("记录或产物关联的步骤不存在");
  if (task.status === "completed" && (!task.requirementConfirmed || !task.planConfirmed || !task.steps.length || task.steps.some(step => !["done", "skipped"].includes(step.status)) || !task.resources.some(resource => resource.kind === "final"))) invalid("完成任务需要已确认计划、所有步骤完成或跳过，以及最终产物");
}

function reopenCheckpointSteps(task: WorkbenchTask, stepId: string, changedAnswer: boolean) {
  const affected = new Set([stepId]);
  for (let index = 0; index < task.steps.length; index++) for (const step of task.steps) if (step.parentId && affected.has(step.parentId)) affected.add(step.id);
  for (const step of task.steps) if (["running", "done"].includes(step.status) && affected.has(step.id)) {
    step.startedAt ??= new Date().toISOString();
    if (pendingStepCheckpoints(task, step.id).length) step.status = "blocked";
    else if (changedAnswer) step.status = "todo";
  }
  for (let index = 0; index < task.steps.length; index++) for (const step of task.steps) if (step.status === "done" && task.steps.some(child => child.parentId === step.id && !["done", "skipped"].includes(child.status))) step.status = "todo";
  if (changedAnswer) task.planConfirmed = false;
}

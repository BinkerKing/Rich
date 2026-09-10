import { z } from "zod";
import { randomUUID } from "node:crypto";
import { nextPlaybackStep } from "./playback.js";
import { hostname } from "node:os";
import { stepScopeIds, unconfirmedExecutionSteps, type WorkbenchAction, type WorkbenchTask, type WorkbenchCommand } from "@ke/domain";
import type { AgentConversationService } from "../agent-conversations/AgentConversationService.js";
import type { DeliverableCodexContextService } from "../deliverable-codex/DeliverableCodexContextService.js";
import { KeyedLock } from "../lib/KeyedLock.js";
import { WorkbenchService, conflict, invalid } from "./service.js";

export const commandSchema = z.object({
  requestId: z.string().trim().min(1).max(160), expectedVersion: z.number().int().positive(),
  action: z.enum(["clarify", "refine", "optimize", "execute", "check", "play"]), stepId: z.string().min(1).optional(),
}).strict();
const actionText: Record<WorkbenchAction, string> = {
  play: "按计划逐步推进，完成当前步骤后继续下一步；遇到确认项或失败停下。每个步骤开始时写入 running，完成时写入 done 和实际依据。",
  check: "梳理指定步骤的前置确认项和当前阻塞项，使用 checkpoint 写回。能选择的提供选项；缺少信息用文字输入。明确哪些答案满足执行条件，不替用户作答，暂不执行步骤。",
  clarify: "细化当前需求，列出需要用户明确的问题，将有价值的信息写回。暂不执行计划。",
  refine: "细化指定步骤为可跟踪的子计划；保留既有步骤和执行记录。暂不执行。",
  optimize: "检查并优化指定范围的计划，保留已完成工作；涉及范围变化需重新确认。暂不执行。",
  execute: "按照用户已确认的需求和计划执行指定范围；每个步骤写回进展、结论、问题与实际产物。",
};
function taskReference(task: WorkbenchTask): string {
  return [
    `任务 ID：${task.id}；按钮发起版本：${task.version}`,
    "先通过 rich_workbench_manage get 读取该任务最新需求、计划、确认项和材料；如变化影响本次范围，先说明差异，不执行过期指令。写回使用最新 expectedVersion，不代替用户确认。",
  ].join("\n");
}
export function buildWorkbenchCommand(task: WorkbenchTask, action: WorkbenchAction, stepId?: string) {
  const step = stepId ? task.steps.find(item => item.id === stepId) : undefined;
  if (stepId && !step) invalid("步骤不存在");
  if (task.status === "archived") conflict("任务已归档");
  if (action === "refine" && !step) invalid("请先选择要细化的步骤");
  if (action === "play" && (!task.requirementConfirmed || !task.planConfirmed || !task.steps.length || task.status === "completed")) conflict("请先确认需求和计划，且任务尚未完成");
  if (action === "execute") {
    if (!task.requirementConfirmed || !task.planConfirmed || !task.steps.length) conflict("请先确认当前需求和计划");
    if (unconfirmedExecutionSteps(task, stepId).length) conflict("请先梳理并满足步骤确认项");
    if (task.status === "completed" || (step && ["done", "skipped"].includes(step.status))) conflict("所选工作已完成或跳过");
  }
  return ["## 工作台按钮指令", taskReference(task),
    `执行范围：${step ? `仅步骤 ${step.id}「${step.title}」及其子步骤` : "整个任务"}`,
    actionText[action],
    "回合结束不代表任务完成；最终交付需要真实产物和核验依据。",
  ].join("\n");
}

export class WorkbenchCommands {
  private owner = `${hostname()}:${process.env.PORT ?? "3001"}`;
  private locks = new KeyedLock();
  private active = new Set<string>();
  constructor(private tasks: WorkbenchService, private agents: Pick<AgentConversationService, "start" | "sendMessage" | "isRunning">, private context: Pick<DeliverableCodexContextService, "build">) {}

  async dispatch(taskId: string, raw: unknown): Promise<WorkbenchCommand> {
    const input = commandSchema.parse(raw);
    const initial = await this.tasks.get(taskId);
    return this.locks.run(initial.conversationId, async () => {
      const task = await this.tasks.get(taskId);
      const previous = task.commands.find(command => command.id === input.requestId);
      if (previous) {
        if (previous.action !== input.action || previous.stepId !== input.stepId || previous.taskVersion !== input.expectedVersion) conflict("指令 ID 已用于不同请求");
        return previous;
      }
      if (task.version !== input.expectedVersion) conflict("任务已更新，请刷新后重试");
      const conversation = await this.tasks.binding(task);
      if (this.active.has(conversation.conversationId) || this.agents.isRunning(conversation.conversationId)) conflict("绑定对话正在执行，请等待当前回合结束");
      const prompt = buildWorkbenchCommand(task, input.action, input.stepId);
      const now = new Date().toISOString();
      const command: WorkbenchCommand = { id: input.requestId, owner: this.owner, action: input.action, stepId: input.stepId, taskVersion: task.version, prompt, status: "sending", createdAt: now, updatedAt: now };
      await this.tasks.mutate(task.id, task.version, next => { next.commands.push(command); });
      this.active.add(conversation.conversationId);
      // Persistent receipt precedes dispatch. Never silently replay after a server restart.
      void this.run(task.id, conversation, command).catch(error => console.error("[workbench] Could not persist command receipt", error)).finally(() => this.active.delete(conversation.conversationId));
      return command;
    });
  }
  private async run(taskId: string, conversation: Awaited<ReturnType<WorkbenchService["binding"]>>, command: WorkbenchCommand) {
    try {
      const context = await this.context.build({ projectId: conversation.projectId, deliverableId: conversation.deliverableId, mode: "free" });
      await this.agents.start(conversation.conversationId, { executor: "codex", workspaceRoot: context.workspaceRoot });
      const send = async (prompt: string, stepId: string | undefined, round: number) => {
        await this.changeCommand(taskId, command.id, item => { item.activeStepId = stepId; item.status = "running"; });
        await this.log(taskId, command.id, "已向 Codex 发送执行指令", stepId);
        let output = ""; let lastFlush = 0;
        const outputId = `${command.id}:${round}:output`;
        const result = await this.agents.sendMessage(conversation.conversationId, {
          content: prompt, clientRequestId: `workbench:${taskId}:${command.id}:${round}`, userMessageId: `workbench:${taskId}:${command.id}:${round}`,
          metadata: { type: "workbench-command", taskId, stepId, commandId: command.id },
        }, async event => {
          if (event.type === "turn" && event.status === "running") await this.receipt(taskId, command.id, "running");
          if (event.type === "activity" && !/^(开始|结束)：调用工具 · rich_workbench_manage$/.test(event.text)) await this.log(taskId, command.id, event.text, stepId);
          if (event.type === "tool" && event.name !== "rich_workbench_manage") await this.log(taskId, command.id, `工具 ${event.name} · ${event.status}`, stepId);
          if (event.type === "approval_required") await this.log(taskId, command.id, `等待工具审批：${event.name}`, stepId);
          if (event.type === "delta") {
            output += event.text;
            if (Date.now() - lastFlush > 1500) { await this.log(taskId, command.id, output.slice(-6000), stepId, outputId); lastFlush = Date.now(); }
          }
          if (event.type === "done" && !output) output = event.content;
          if (event.type === "error") await this.log(taskId, command.id, event.message, stepId);
        });
        if (output) await this.log(taskId, command.id, output.slice(-6000), stepId, outputId);
        if (result.turn.status !== "succeeded") throw new Error(`Codex 回合状态：${result.turn.status}`);
      };
      if (command.action !== "play") {
        await send(command.prompt, command.stepId, 0);
        if (command.action === "check") {
          const saved = await this.tasks.get(taskId);
          const scope = stepScopeIds(saved, command.stepId!);
          if (!saved.checkpoints?.some(item => scope.has(item.stepId))) throw new Error("确认项未成功保存，请重新梳理确认项；尚未执行步骤");
          await this.log(taskId, command.id, "确认项已保存，请在步骤确认项中查看并填写", command.stepId);
        }
      }
      else {
        await this.receipt(taskId, command.id, "running");
        for (let round = 0; round < 500; round++) {
          const task = await this.tasks.get(taskId);
          if (!task.requirementConfirmed || !task.planConfirmed || ["completed", "archived"].includes(task.status)) {
            await this.log(taskId, command.id, task.status === "completed" ? "任务已完成交付" : "计划或需求发生变化，已停止，等待重新确认"); break;
          }
          const next = nextPlaybackStep(task);
          if (!next) {
            await send(`${taskReference(task)}\n所有计划步骤已经完成或跳过。核验最终产物与交付条件，符合后写回 completed；缺少交付项则记录原因，不得虚报完成。`, undefined, round);
            break;
          }
          const step = task.steps.find(item => item.id === next.stepId)!;
          await this.changeCommand(taskId, command.id, item => { item.activeStepId = step.id; });
          if (next.kind === "aggregate") {
            await this.tasks.write(taskId, { action: "step", expectedVersion: (await this.tasks.get(taskId)).version, input: { id: step.id, status: "done", evidence: "所有子步骤均已完成或明确跳过，父步骤按子步骤结果汇总" } });
            await this.log(taskId, command.id, `子步骤已完成，汇总：${step.title}`, step.id); continue;
          }
          if (next.kind === "blocked") { await this.log(taskId, command.id, "已停止：本步骤或上级步骤的必填确认项尚未满足", step.id); break; }
          const latest = await this.tasks.get(taskId);
          if (next.kind === "prepare") {
            await this.log(taskId, command.id, "先梳理本步骤的前置确认项，暂不执行", step.id);
            await send(buildWorkbenchCommand(latest, "check", step.id), step.id, round);
            const prepared = await this.tasks.get(taskId);
            const scope = stepScopeIds(prepared, step.id);
            const checkpoints = (prepared.checkpoints ?? []).filter(item => scope.has(item.stepId));
            if (!checkpoints.length) throw new Error(`步骤「${step.title}」确认项未成功保存，请重新梳理确认项；尚未执行步骤`);
            await this.log(taskId, command.id, "已停止：确认项已保存，请在当前步骤的确认项中填写", step.id); break;
          }
          await this.log(taskId, command.id, `开始步骤：${step.title}`, step.id);
          await send(buildWorkbenchCommand(latest, "execute", step.id) + "\n仅执行本步骤，开始时立即写回 running；完成后写回 done 与依据，不自行跨到其他步骤。", step.id, round);
          const after = await this.tasks.get(taskId);
          if (!["done", "skipped"].includes(after.steps.find(item => item.id === step.id)?.status ?? "")) {
            await this.log(taskId, command.id, "已停止：本步骤尚未完成，请查看确认项和执行记录", step.id); break;
          }
          await this.log(taskId, command.id, `步骤完成：${step.title}`, step.id);
          if (round === 499) await this.log(taskId, command.id, "本轮达到步骤上限，请核对进度后继续播放");
        }
      }
      await this.receipt(taskId, command.id, "finished");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.log(taskId, command.id, `执行停止：${message}`);
      await this.receipt(taskId, command.id, "failed", message);
    }
  }
  private async log(taskId: string, commandId: string, text: string, stepId?: string, id: string = randomUUID()) {
    await this.changeCommand(taskId, commandId, command => {
      command.events ??= [];
      const existing = command.events.find(item => item.id === id);
      if (existing) { existing.text = text; existing.at = new Date().toISOString(); }
      else command.events.push({ id, at: new Date().toISOString(), stepId: stepId ?? command.activeStepId, text });
      command.events = command.events.slice(-300);
    });
  }
  private async changeCommand(taskId: string, commandId: string, change: (command: WorkbenchCommand) => void) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const task = await this.tasks.get(taskId);
      try {
        await this.tasks.mutate(taskId, task.version, next => { const command = next.commands.find(item => item.id === commandId)!; change(command); command.updatedAt = new Date().toISOString(); }); return;
      } catch (cause) { if (!(cause instanceof Error && "code" in cause && cause.code === "CONFLICT")) throw cause; }
    }
    throw new Error("指令回执保存冲突，请查看绑定对话");
  }
  private async receipt(taskId: string, commandId: string, status: WorkbenchCommand["status"], error?: string) {
    await this.changeCommand(taskId, commandId, command => { Object.assign(command, { status, error }); });
  }
  async recoverInterrupted() {
    for (const task of await this.tasks.list()) {
      if (!task.commands.some(command => command.owner === this.owner && (command.status === "sending" || command.status === "running"))) continue;
      await this.tasks.mutate(task.id, task.version, next => {
        for (const command of next.commands) if (command.owner === this.owner && (command.status === "sending" || command.status === "running")) {
          command.status = "unknown"; command.error = "服务已重启，请查看绑定对话核对结果；未自动重发"; command.updatedAt = new Date().toISOString();
        }
      });
    }
  }
}

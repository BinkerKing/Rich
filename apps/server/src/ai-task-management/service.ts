import { randomUUID } from "node:crypto";
import { getAiTaskScene, type AiTaskScene } from "./scenes.js";
import type { AiManagedTask, AiTaskManagementRepo, AiTaskNode, AiTaskSceneId } from "../repos/AiTaskManagementRepo.js";

type TaskInput = AiManagedTask["input"];
type TaskDraftInput = { sceneId: AiTaskSceneId; title: string; input: TaskInput; payload?: Record<string, unknown>; contextSummary?: string; sourceConversationId?: string; projectId?: string; deliverableId?: string };
export class AiTaskManagementService {
  constructor(private readonly repo: AiTaskManagementRepo) {}
  async list() {
    const tasks = await this.repo.list();
    return Promise.all(tasks.map(async task => {
      const latest = (await this.repo.listNodes(task.id)).at(-1);
      return latest ? { ...task, latestFeedback: latest.result } : task;
    }));
  }
  async create(input: TaskDraftInput): Promise<AiManagedTask> {
    const scene = getAiTaskScene(input.sceneId); const now = new Date().toISOString(); const id = `ai-task-${randomUUID()}`;
    const task: AiManagedTask = { id, rootTaskId: id, sceneId: scene.id, sceneVersion: scene.version, title: input.title, status: "ready", input: input.input, payload: input.payload ?? {}, contextSummary: input.contextSummary ?? input.input.text.slice(0, 2000), ...(input.sourceConversationId ? { sourceConversationId: input.sourceConversationId } : {}), ...(input.projectId ? { projectId: input.projectId } : {}), ...(input.deliverableId ? { deliverableId: input.deliverableId } : {}), createdAt: now, updatedAt: now };
    await this.repo.create(task); return task;
  }
  async saveDraft(input: TaskDraftInput, id?: string): Promise<AiManagedTask> {
    const now = new Date().toISOString();
    if (!id) {
      const scene = getAiTaskScene(input.sceneId); const draftId = `ai-task-${randomUUID()}`;
      const task: AiManagedTask = { id: draftId, rootTaskId: draftId, sceneId: scene.id, sceneVersion: scene.version, title: input.title, status: "draft", input: input.input, payload: input.payload ?? {}, contextSummary: input.contextSummary ?? input.input.text.slice(0, 2000), createdAt: now, updatedAt: now };
      await this.repo.create(task); return task;
    }
    const task = await this.requireTask(id);
    if (task.status !== "draft") throw new Error("Only draft tasks can be updated as drafts.");
    const scene = getAiTaskScene(input.sceneId);
    const next: AiManagedTask = { ...task, sceneId: scene.id, sceneVersion: scene.version, title: input.title, status: "draft", input: input.input, payload: input.payload ?? {}, contextSummary: input.contextSummary ?? input.input.text.slice(0, 2000), updatedAt: now };
    await this.repo.save(next); return next;
  }
  async publishDraft(id: string, input: TaskDraftInput): Promise<AiManagedTask> {
    const task = await this.requireTask(id);
    if (task.status !== "draft") throw new Error("Only draft tasks can be published.");
    const scene = getAiTaskScene(input.sceneId); const now = new Date().toISOString();
    const next: AiManagedTask = { ...task, sceneId: scene.id, sceneVersion: scene.version, title: input.title, status: "ready", input: input.input, payload: input.payload ?? {}, contextSummary: input.contextSummary ?? input.input.text.slice(0, 2000), updatedAt: now };
    await this.repo.save(next); return next;
  }
  async claim(id: string, agentId: string) { return this.repo.claim(id, agentId); }
  async getPacket(id: string): Promise<{ task: AiManagedTask; scene: AiTaskScene; nodes: AiTaskNode[] }> { const task = await this.requireTask(id); return { task, scene: getAiTaskScene(task.sceneId), nodes: await this.repo.listNodes(id) }; }
  async reportResult(id: string, agentId: string, input: Pick<AiTaskNode, "analysis" | "result" | "carryForward" | "statusAfter"> & { title?: string; pending?: string; resourceIds?: string[] }): Promise<AiTaskNode> {
    const task = await this.requireTask(id); if (task.claimedBy !== agentId) throw new Error("Only the claiming Agent can report a result.");
    const nodes = await this.repo.listNodes(id); const now = new Date().toISOString(); const node: AiTaskNode = { id: `ai-node-${randomUUID()}`, taskId: id, sequence: nodes.length + 1, kind: input.statusAfter === "blocked" ? "blocked" : "result", statusAfter: input.statusAfter, analysis: input.analysis, result: input.result, carryForward: input.carryForward, ...(input.pending ? { pending: input.pending } : {}), resourceIds: input.resourceIds ?? [], createdBy: "external_ai", createdAt: now };
    await this.repo.addNode(node); await this.repo.save({ ...task, ...(input.title?.trim() ? { title: input.title.trim().slice(0, 280) } : {}), status: input.statusAfter, contextSummary: conciseContext(task.contextSummary, node), updatedAt: now }); return node;
  }
  async continue(id: string): Promise<AiManagedTask> {
    const parent = await this.requireTask(id); const nodes = await this.repo.listNodes(id); const latest = nodes.at(-1); const now = new Date().toISOString(); const nextId = `ai-task-${randomUUID()}`;
    const task: AiManagedTask = { ...parent, id: nextId, rootTaskId: parent.rootTaskId, parentTaskId: parent.id, status: "ready", contextSummary: conciseContext(parent.contextSummary, latest), claimedBy: undefined, claimedAt: undefined, createdAt: now, updatedAt: now };
    await this.repo.create(task); return task;
  }
  async resolve(id: string): Promise<AiManagedTask> { const task = await this.requireTask(id); const next = { ...task, status: "resolved" as const, updatedAt: new Date().toISOString() }; await this.repo.save(next); return next; }
  async remove(id: string): Promise<void> { await this.requireTask(id); await this.repo.remove(id); }
  private async requireTask(id: string): Promise<AiManagedTask> { const task = await this.repo.get(id); if (!task) throw new Error(`AI task ${id} was not found.`); return task; }
}
function conciseContext(current: string, node?: Pick<AiTaskNode, "analysis" | "result" | "carryForward" | "pending">): string { const next = node ? [current, `已确认：${node.analysis}`, `结果：${node.result}`, `后续：${node.carryForward}`, node.pending ? `待处理：${node.pending}` : ""].filter(Boolean).join("\n") : current; return next.slice(-4000); }

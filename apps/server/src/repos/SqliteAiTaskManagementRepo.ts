import type Database from "better-sqlite3";
import type { AiManagedTask, AiTaskClaimResult, AiTaskManagementRepo, AiTaskNode, AiTaskSceneId, AiTaskStatus } from "./AiTaskManagementRepo.js";

const TASK_COLUMNS = "id, root_task_id, parent_task_id, scene_id, scene_version, title, status, input_json, payload_json, context_summary, source_conversation_id, project_id, deliverable_id, claimed_by, claimed_at, created_at, updated_at";
type TaskRow = Record<string, string | number | null>;
type NodeRow = Record<string, string | number | null>;

export class SqliteAiTaskManagementRepo implements AiTaskManagementRepo {
  constructor(private readonly db: Database.Database) {}
  create(task: AiManagedTask): void { this.db.prepare(`INSERT INTO ai_tasks (${TASK_COLUMNS}) VALUES (${Array(17).fill("?").join(", ")})`).run(...taskValues(task)); }
  get(id: string): AiManagedTask | null { const row = this.db.prepare(`SELECT ${TASK_COLUMNS} FROM ai_tasks WHERE id=?`).get(id) as TaskRow | undefined; return row ? hydrateTask(row) : null; }
  list(options: { status?: AiTaskStatus; sceneId?: AiTaskSceneId; limit?: number } = {}): AiManagedTask[] {
    const where: string[] = []; const values: unknown[] = [];
    if (options.status) { where.push("status=?"); values.push(options.status); }
    if (options.sceneId) { where.push("scene_id=?"); values.push(options.sceneId); }
    values.push(Math.min(Math.max(options.limit ?? 100, 1), 500));
    return (this.db.prepare(`SELECT ${TASK_COLUMNS} FROM ai_tasks ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC LIMIT ?`).all(...values) as TaskRow[]).map(hydrateTask);
  }
  save(task: AiManagedTask): void { const result = this.db.prepare(`UPDATE ai_tasks SET root_task_id=?, parent_task_id=?, scene_id=?, scene_version=?, title=?, status=?, input_json=?, payload_json=?, context_summary=?, source_conversation_id=?, project_id=?, deliverable_id=?, claimed_by=?, claimed_at=?, created_at=?, updated_at=? WHERE id=?`).run(...taskValues(task).slice(1), task.id); if (result.changes !== 1) throw new Error(`AI task ${task.id} was not found.`); }
  claim(id: string, agentId: string): AiTaskClaimResult {
    const now = new Date().toISOString();
    const result = this.db.prepare("UPDATE ai_tasks SET status='claimed', claimed_by=?, claimed_at=?, updated_at=? WHERE id=? AND status='ready' AND claimed_by IS NULL").run(agentId, now, now, id);
    const task = this.get(id);
    if (!task) throw new Error(`AI task ${id} was not found.`);
    if (result.changes === 1 || task.claimedBy === agentId) return { ok: true, task };
    return { ok: false, conflict: { currentAgentId: task.claimedBy ?? "(unknown)", claimedAt: task.claimedAt ?? "" } };
  }
  addNode(node: AiTaskNode): void { this.db.prepare("INSERT INTO ai_task_nodes (id, task_id, sequence, kind, status_after, analysis, result, carry_forward, pending, resource_ids_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(node.id, node.taskId, node.sequence, node.kind, node.statusAfter, node.analysis, node.result, node.carryForward, node.pending ?? null, JSON.stringify(node.resourceIds), node.createdBy, node.createdAt); }
  listNodes(taskId: string): AiTaskNode[] { return (this.db.prepare("SELECT id, task_id, sequence, kind, status_after, analysis, result, carry_forward, pending, resource_ids_json, created_by, created_at FROM ai_task_nodes WHERE task_id=? ORDER BY sequence ASC").all(taskId) as NodeRow[]).map(hydrateNode); }
}

function taskValues(task: AiManagedTask): unknown[] { return [task.id, task.rootTaskId, task.parentTaskId ?? null, task.sceneId, task.sceneVersion, task.title, task.status, JSON.stringify(task.input), JSON.stringify(task.payload), task.contextSummary, task.sourceConversationId ?? null, task.projectId ?? null, task.deliverableId ?? null, task.claimedBy ?? null, task.claimedAt ?? null, task.createdAt, task.updatedAt]; }
function hydrateTask(row: TaskRow): AiManagedTask { return { id: String(row.id), rootTaskId: String(row.root_task_id), ...(row.parent_task_id ? { parentTaskId: String(row.parent_task_id) } : {}), sceneId: row.scene_id as AiTaskSceneId, sceneVersion: Number(row.scene_version), title: String(row.title), status: row.status as AiTaskStatus, input: JSON.parse(String(row.input_json)), payload: JSON.parse(String(row.payload_json)), contextSummary: String(row.context_summary), ...(row.source_conversation_id ? { sourceConversationId: String(row.source_conversation_id) } : {}), ...(row.project_id ? { projectId: String(row.project_id) } : {}), ...(row.deliverable_id ? { deliverableId: String(row.deliverable_id) } : {}), ...(row.claimed_by ? { claimedBy: String(row.claimed_by) } : {}), ...(row.claimed_at ? { claimedAt: String(row.claimed_at) } : {}), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
function hydrateNode(row: NodeRow): AiTaskNode { return { id: String(row.id), taskId: String(row.task_id), sequence: Number(row.sequence), kind: row.kind as AiTaskNode["kind"], statusAfter: row.status_after as AiTaskNode["statusAfter"], analysis: String(row.analysis), result: String(row.result), carryForward: String(row.carry_forward), ...(row.pending ? { pending: String(row.pending) } : {}), resourceIds: JSON.parse(String(row.resource_ids_json)), createdBy: row.created_by as AiTaskNode["createdBy"], createdAt: String(row.created_at) }; }

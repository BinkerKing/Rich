export const aiTaskScenes = ["bug_fix", "requirement_analysis", "deliverable_task", "system_improvement"] as const;
export type AiTaskSceneId = typeof aiTaskScenes[number];
export const aiTaskStatuses = ["ready", "claimed", "needs_review", "blocked", "resolved"] as const;
export type AiTaskStatus = typeof aiTaskStatuses[number];

export interface AiTaskResourceRef { id: string; label: string; path?: string; mime?: string; }
export interface AiManagedTask {
  id: string; rootTaskId: string; parentTaskId?: string; sceneId: AiTaskSceneId; sceneVersion: number;
  title: string; status: AiTaskStatus; input: { text: string; images: AiTaskResourceRef[]; materials: AiTaskResourceRef[] };
  payload: Record<string, unknown>; contextSummary: string; sourceConversationId?: string;
  projectId?: string; deliverableId?: string; claimedBy?: string; claimedAt?: string; latestFeedback?: string; createdAt: string; updatedAt: string;
}
export interface AiTaskNode {
  id: string; taskId: string; sequence: number; kind: "result" | "blocked" | "decision";
  statusAfter: Extract<AiTaskStatus, "needs_review" | "blocked" | "ready">;
  analysis: string; result: string; carryForward: string; pending?: string; resourceIds: string[];
  createdBy: "external_ai" | "user" | "system"; createdAt: string;
}
export type AiTaskClaimResult = { ok: true; task: AiManagedTask } | { ok: false; conflict: { currentAgentId: string; claimedAt: string } };

export interface AiTaskManagementRepo {
  create(task: AiManagedTask): void | Promise<void>;
  get(id: string): AiManagedTask | null | Promise<AiManagedTask | null>;
  list(options?: { status?: AiTaskStatus; sceneId?: AiTaskSceneId; limit?: number }): AiManagedTask[] | Promise<AiManagedTask[]>;
  save(task: AiManagedTask): void | Promise<void>;
  remove(id: string): void | Promise<void>;
  claim(id: string, agentId: string): AiTaskClaimResult | Promise<AiTaskClaimResult>;
  addNode(node: AiTaskNode): void | Promise<void>;
  listNodes(taskId: string): AiTaskNode[] | Promise<AiTaskNode[]>;
}

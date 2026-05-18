import { create } from "zustand";
import type { Element, Relation, LearningPath, ElementId, PathKind, RichnessLevel } from "@ke/domain";
import { api, type Model } from "../api/client.js";
import { createDemoLargeTree } from "../data/demoLargeTree.js";

export type OpKind = "generate" | "refine" | "expand" | "extend" | "feedback" | "path" | "hydrate";

export interface InflightOp {
  kind: OpKind;
  elementId?: string;
  delta: string;
  startedAt: number;
}

export type TaskStatus = "running" | "done" | "error";

/**
 * Persistent record of an AI op, kept after completion so the task panel
 * can offer "查看" actions. Newest-first; capped at TASK_HISTORY_MAX.
 */
export interface TaskRecord {
  id: string;
  kind: OpKind;
  title: string;
  status: TaskStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  /** For generate: the new tree's root id, used by "查看" to enter the tree. */
  rootId?: string;
  /** For refine/expand/extend: the target element id. */
  elementId?: string;
  /** Optional summary for done state (e.g. new children count). */
  summary?: string;
}

const TASK_HISTORY_MAX = 20;

interface AppState {
  elements: Map<ElementId, Element>;
  relations: Relation[];
  pathsByCenter: Map<ElementId, LearningPath[]>;
  rootId: ElementId | null;
  centerId: ElementId | null;
  visiblePathKinds: Set<string>;
  /** Topic elements present in backend (shown on home for "open existing tree"). */
  availableTopics: Element[];
  /** True while the very first generate/hydrate is running and no tree visible yet. */
  loading: boolean;
  /** Last error surfaced to UI (banner). Cleared on next op start. */
  error: string | null;
  /** Map of per-op in-flight state. Multiple ops may run on different elements concurrently. */
  inflight: Map<string, InflightOp>;
  /** Backend availability flag. False = backend unreachable, UI shows demo. */
  backendAvailable: boolean;
  /** Last persisted center, used to suggest "继续上次学习". */
  lastCenterId: ElementId | null;
  /** Newest-first log of AI ops shown in the task panel. */
  tasks: TaskRecord[];

  // ----- read actions -----
  hydrate(): Promise<void>;
  /** Switch into TreeView with `rootId` as root. Center = rootId by default. */
  enterTree(rootId: ElementId): Promise<void>;
  /** Enter the tree that contains this element and center on it. */
  enterAtElement(elementId: ElementId): Promise<void>;
  /** Return to InputView (without losing elements/relations cache). */
  exitToHome(): void;

  // ----- AI actions (streaming) -----
  generate(topic: string, opts?: { model?: Model; richness?: RichnessLevel }): Promise<void>;
  refine(elementId: ElementId, targetRichness?: RichnessLevel, direction?: string, model?: Model): Promise<void>;
  expand(elementId: ElementId, count?: number, direction?: string, model?: Model): Promise<void>;
  extend(elementId: ElementId, direction: string, count?: number, model?: Model): Promise<void>;
  feedback(elementId: ElementId, feedback: string, model?: Model): Promise<void>;
  /** Section-scoped feedback. AI only touches that one section; server merges
   *  the new section JSON back into element.content.sections by id. */
  sectionFeedback(elementId: ElementId, sectionId: string, feedback: string, model?: Model): Promise<void>;
  /** Re-fetch one element and merge it; used after side-channel writes (e.g. analyze-mark). */
  refreshElement(elementId: ElementId): Promise<void>;
  /** Delete an element and its entire descendant subtree. */
  deleteElement(elementId: ElementId): Promise<{ removed: string[] }>;
  /** Move an element under a new parent (or null to make it a root). */
  moveElement(elementId: ElementId, newParentId: ElementId | null): Promise<void>;
  /** Deep-analyze a highlighted snippet — when annotationId is given, result attaches to the annotation (inline); otherwise appended to element. */
  analyzeMark(input: { elementId: ElementId; markedText: string; annotationId?: string; contextBefore?: string; contextAfter?: string; hint?: string; model?: Model }): Promise<void>;
  generatePaths(elementId: ElementId, kinds?: PathKind[], model?: Model): Promise<void>;

  // ----- navigation -----
  setCenter(id: ElementId): void;
  togglePathKind(kind: string): void;

  // ----- demo -----
  loadDemoTree(): void;
}

const opKey = (kind: OpKind, elementId?: string) => `${kind}:${elementId ?? "_"}`;

function treeToState(tree: {
  rootId: ElementId;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}) {
  const elements = new Map(tree.elements.map(e => [e.id, e] as const));
  const pathsByCenter = new Map<ElementId, LearningPath[]>();
  for (const p of tree.paths) {
    const list = pathsByCenter.get(p.centerElementId) ?? [];
    list.push(p);
    pathsByCenter.set(p.centerElementId, list);
  }
  return {
    elements,
    relations: tree.relations,
    pathsByCenter,
    rootId: tree.rootId,
    centerId: tree.rootId,
  };
}

function demoState() {
  return treeToState(createDemoLargeTree());
}

function withInflightStart(state: AppState, kind: OpKind, elementId?: string): Map<string, InflightOp> {
  const next = new Map(state.inflight);
  next.set(opKey(kind, elementId), {
    kind, elementId, delta: "", startedAt: Date.now(),
  });
  return next;
}

function withInflightDelta(state: AppState, kind: OpKind, elementId: string | undefined, text: string): Map<string, InflightOp> {
  const next = new Map(state.inflight);
  const key = opKey(kind, elementId);
  const cur = next.get(key);
  if (cur) next.set(key, { ...cur, delta: cur.delta + text });
  return next;
}

function withInflightDone(state: AppState, kind: OpKind, elementId?: string): Map<string, InflightOp> {
  const next = new Map(state.inflight);
  next.delete(opKey(kind, elementId));
  return next;
}

function pushTask(state: AppState, task: TaskRecord): TaskRecord[] {
  const next = [task, ...state.tasks].slice(0, TASK_HISTORY_MAX);
  saveTasks(next);
  return next;
}

function updateTask(state: AppState, id: string, patch: Partial<TaskRecord>): TaskRecord[] {
  const next = state.tasks.map(t => (t.id === id ? { ...t, ...patch } : t));
  saveTasks(next);
  return next;
}

let taskCounter = 0;
const nextTaskId = () => `task-${Date.now()}-${++taskCounter}`;

// ----- Task persistence (localStorage) -----
// Tasks must survive page reloads. We keep at most TASK_HISTORY_MAX records.
// On load, any task still "running" is downgraded to "error" since we can't
// resume its SSE stream after a refresh.
const TASKS_STORAGE_KEY = "ke.tasks.v1";

function saveTasks(tasks: TaskRecord[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch { /* quota or private mode — ignore */ }
}

function loadTasks(): TaskRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TaskRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(t => t.status === "running"
      ? { ...t, status: "error" as const, error: "页面刷新中断", finishedAt: t.finishedAt ?? Date.now() }
      : t,
    );
  } catch {
    return [];
  }
}

function mergeElements(
  cur: Map<ElementId, Element>,
  incoming: Element[],
): Map<ElementId, Element> {
  const next = new Map(cur);
  for (const el of incoming) next.set(el.id, el);
  return next;
}

function mergeRelations(cur: Relation[], incoming: Relation[]): Relation[] {
  const have = new Set(cur.map(r => r.id));
  return [...cur, ...incoming.filter(r => !have.has(r.id))];
}

function mergePaths(
  cur: Map<ElementId, LearningPath[]>,
  centerId: ElementId,
  newPaths: LearningPath[],
): Map<ElementId, LearningPath[]> {
  const next = new Map(cur);
  const existing = next.get(centerId) ?? [];
  const byId = new Map(existing.map(p => [p.id, p] as const));
  for (const p of newPaths) byId.set(p.id, p);
  next.set(centerId, Array.from(byId.values()));
  return next;
}

export const useStore = create<AppState>((set, get) => ({
  elements: new Map(),
  relations: [],
  pathsByCenter: new Map(),
  rootId: null,
  centerId: null,
  visiblePathKinds: new Set(["quick", "academic", "practice"]),
  loading: false,
  error: null,
  inflight: new Map(),
  backendAvailable: true,
  availableTopics: [],
  tasks: loadTasks(),
  lastCenterId: null,

  async hydrate() {
    set({ loading: true, error: null });
    try {
      const [elements, relations, state] = await Promise.all([
        api.listElements(),
        api.listRelations(),
        api.getCenterState().catch(() => ({ current: null, updatedAt: null, recent: [] })),
      ]);
      const elementMap = new Map(elements.map(e => [e.id, e] as const));
      const topics = elements.filter(e => e.type === "topic");
      set({
        elements: elementMap,
        relations,
        availableTopics: topics,
        lastCenterId: state.current && elementMap.has(state.current) ? state.current : null,
        loading: false,
        backendAvailable: true,
      });
    } catch (e) {
      set({
        loading: false,
        backendAvailable: false,
        error: `后端不可用：${String(e)}`,
      });
    }
  },

  async enterTree(rootId) {
    const state = get();
    if (!state.elements.has(rootId)) {
      // If the element isn't in memory, refetch list
      try {
        const fresh = await api.listElements();
        const map = new Map(fresh.map(e => [e.id, e] as const));
        if (!map.has(rootId)) {
          set({ error: `元 ${rootId} 不存在` });
          return;
        }
        set({ elements: map });
      } catch { /* ignore */ }
    }
    // Always start at the topic root; user can drill in from there.
    const center = rootId;
    let pathsByCenter = state.pathsByCenter;
    try {
      const paths = await api.listPathsForCenter(rootId);
      if (paths.length > 0) {
        pathsByCenter = new Map(state.pathsByCenter);
        pathsByCenter.set(rootId, paths);
      }
    } catch { /* missing paths file is fine */ }
    set({ rootId, centerId: center, pathsByCenter, error: null });
    api.setCenterState(center).catch(() => undefined);
  },

  async enterAtElement(elementId) {
    // Refetch elements/relations if the element isn't in memory yet.
    let { elements, relations } = get();
    if (!elements.has(elementId)) {
      try {
        const fresh = await api.listElements();
        elements = new Map(fresh.map(e => [e.id, e] as const));
        const freshRel = await api.listRelations();
        relations = freshRel;
        set({ elements, relations });
      } catch { /* ignore */ }
    }
    if (!elements.has(elementId)) {
      set({ error: `元 ${elementId} 不存在` });
      return;
    }
    // Walk up `child` relations to find the topic root.
    let rootId = elementId;
    const seen = new Set<string>();
    while (!seen.has(rootId)) {
      seen.add(rootId);
      const parent = relations.find(r => r.kind === "child" && r.to === rootId)?.from;
      if (!parent) break;
      rootId = parent;
    }
    let pathsByCenter = get().pathsByCenter;
    try {
      const paths = await api.listPathsForCenter(rootId);
      if (paths.length > 0) {
        pathsByCenter = new Map(pathsByCenter);
        pathsByCenter.set(rootId, paths);
      }
    } catch { /* ignore */ }
    set({ rootId, centerId: elementId, pathsByCenter, error: null });
    api.setCenterState(elementId).catch(() => undefined);
  },

  exitToHome() {
    set({ rootId: null });
    // keep elements/relations/topics so the home page still shows them
  },

  async generate(topic, opts) {
    const taskId = nextTaskId();
    set(s => ({
      loading: true, error: null,
      inflight: withInflightStart(s, "generate"),
      tasks: pushTask(s, {
        id: taskId,
        kind: "generate",
        title: `生成知识树「${topic.slice(0, 32)}${topic.length > 32 ? "…" : ""}」`,
        status: "running",
        startedAt: Date.now(),
      }),
    }));
    try {
      for await (const ev of api.generateTreeStream(topic, opts?.model, opts?.richness)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "generate", undefined, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({
            error: `生成失败：${ev.message}`,
            loading: false,
            inflight: withInflightDone(s, "generate"),
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
          }));
          return;
        } else if (ev.type === "done") {
          const next = treeToState(ev.result);
          // Merge the new tree into the in-memory cache but DO NOT switch the
          // current view to it — keep rootId/centerId as-is so the user stays
          // wherever they were (home or another tree). They click the task in
          // the AI 任务 panel to enter the new tree on their own terms.
          set(s => {
            const mergedElements = new Map(s.elements);
            for (const [id, el] of next.elements) mergedElements.set(id, el);
            const mergedRelations = [...s.relations];
            const have = new Set(mergedRelations.map(r => r.id));
            for (const r of next.relations) if (!have.has(r.id)) mergedRelations.push(r);
            const mergedPaths = new Map(s.pathsByCenter);
            for (const [k, v] of next.pathsByCenter) mergedPaths.set(k, v);
            const newTopics = [
              ...s.availableTopics.filter(t => !next.elements.has(t.id)),
              ...Array.from(next.elements.values()).filter(el => el.type === "topic"),
            ];
            return {
              elements: mergedElements,
              relations: mergedRelations,
              pathsByCenter: mergedPaths,
              availableTopics: newTopics,
              loading: false,
              inflight: withInflightDone(s, "generate"),
              backendAvailable: true,
              tasks: updateTask(s, taskId, {
                status: "done",
                finishedAt: Date.now(),
                rootId: next.rootId,
                summary: `${next.elements.size} 个元`,
              }),
            };
          });
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `后端不可用：${String(e)}`,
        loading: false,
        backendAvailable: false,
        inflight: withInflightDone(s, "generate"),
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
    }
  },

  async refine(elementId, targetRichness = 3, direction, model) {
    const title = get().elements.get(elementId)?.title ?? elementId;
    const taskId = nextTaskId();
    const taskTitle = direction ? `细化「${title}」· ${direction}` : `细化「${title}」`;
    set(s => ({
      inflight: withInflightStart(s, "refine", elementId),
      error: null,
      tasks: pushTask(s, { id: taskId, kind: "refine", title: taskTitle, status: "running", startedAt: Date.now(), elementId }),
    }));
    try {
      for await (const ev of api.refineStream(elementId, targetRichness, direction, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "refine", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({
            error: `细化失败：${ev.message}`,
            inflight: withInflightDone(s, "refine", elementId),
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
          }));
          return;
        } else if (ev.type === "done") {
          // Re-fetch the updated element from backend so we get the persisted metadata.
          const fresh = await api.getElement(elementId);
          set(s => ({
            elements: fresh ? mergeElements(s.elements, [fresh]) : s.elements,
            inflight: withInflightDone(s, "refine", elementId),
            tasks: updateTask(s, taskId, { status: "done", finishedAt: Date.now(), summary: `richness → ${targetRichness}` }),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `细化失败：${String(e)}`,
        inflight: withInflightDone(s, "refine", elementId),
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
    }
  },

  async expand(elementId, count, direction, model) {
    const title = get().elements.get(elementId)?.title ?? elementId;
    const taskId = nextTaskId();
    const taskTitle = direction ? `展开「${title}」· ${direction}` : `展开「${title}」`;
    set(s => ({
      inflight: withInflightStart(s, "expand", elementId),
      error: null,
      tasks: pushTask(s, { id: taskId, kind: "expand", title: taskTitle, status: "running", startedAt: Date.now(), elementId }),
    }));
    try {
      for await (const ev of api.expandStream(elementId, count, direction, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "expand", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({
            error: `展开失败：${ev.message}`,
            inflight: withInflightDone(s, "expand", elementId),
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
          }));
          return;
        } else if (ev.type === "done") {
          set(s => ({
            elements: mergeElements(s.elements, ev.result.elements),
            relations: mergeRelations(s.relations, ev.result.relations),
            inflight: withInflightDone(s, "expand", elementId),
            tasks: updateTask(s, taskId, { status: "done", finishedAt: Date.now(), summary: `新增 ${ev.result.elements.length} 个子元` }),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `展开失败：${String(e)}`,
        inflight: withInflightDone(s, "expand", elementId),
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
    }
  },

  async extend(elementId, direction, count, model) {
    const title = get().elements.get(elementId)?.title ?? elementId;
    const taskId = nextTaskId();
    set(s => ({
      inflight: withInflightStart(s, "extend", elementId),
      error: null,
      tasks: pushTask(s, { id: taskId, kind: "extend", title: `延伸「${title}」→ ${direction}`, status: "running", startedAt: Date.now(), elementId }),
    }));
    try {
      for await (const ev of api.extendStream(elementId, direction, count, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "extend", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({
            error: `延伸失败：${ev.message}`,
            inflight: withInflightDone(s, "extend", elementId),
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
          }));
          return;
        } else if (ev.type === "done") {
          set(s => ({
            elements: mergeElements(s.elements, ev.result.elements),
            relations: mergeRelations(s.relations, ev.result.relations),
            inflight: withInflightDone(s, "extend", elementId),
            tasks: updateTask(s, taskId, { status: "done", finishedAt: Date.now(), summary: `新增 ${ev.result.elements.length} 个相关元` }),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `延伸失败：${String(e)}`,
        inflight: withInflightDone(s, "extend", elementId),
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
    }
  },

  async refreshElement(elementId) {
    const fresh = await api.getElement(elementId).catch(() => null);
    if (!fresh) return;
    set(s => ({ elements: mergeElements(s.elements, [fresh]) }));
  },

  async deleteElement(elementId) {
    const result = await api.deleteElement(elementId);
    set(s => {
      const removed = new Set(result.removed);
      const nextElements = new Map(s.elements);
      for (const id of removed) nextElements.delete(id);
      const nextRelations = s.relations.filter(r => !removed.has(r.from) && !removed.has(r.to));
      const nextTopics = s.availableTopics.filter(t => !removed.has(t.id));
      // If the current center / root / selected was deleted, clear it.
      const stillExists = (id: ElementId | null) => id != null && !removed.has(id);
      return {
        elements: nextElements,
        relations: nextRelations,
        availableTopics: nextTopics,
        centerId: stillExists(s.centerId) ? s.centerId : null,
        rootId: stillExists(s.rootId) ? s.rootId : null,
        lastCenterId: stillExists(s.lastCenterId) ? s.lastCenterId : null,
      };
    });
    return result;
  },

  async moveElement(elementId, newParentId) {
    await api.moveElement(elementId, newParentId);
    // Replace the child edge in local state to avoid a full reload.
    set(s => {
      const filtered = s.relations.filter(r => !(r.kind === "child" && r.to === elementId));
      if (newParentId) {
        filtered.push({
          id: `rel.move.${newParentId}.${elementId}`,
          from: newParentId,
          to: elementId,
          kind: "child",
          createdAt: new Date().toISOString(),
        });
      }
      return { relations: filtered };
    });
  },

  async analyzeMark({ elementId, markedText, annotationId, contextBefore, contextAfter, hint, model }) {
    const title = get().elements.get(elementId)?.title ?? elementId;
    const snip = markedText.length > 24 ? markedText.slice(0, 24) + "…" : markedText;
    const taskId = nextTaskId();
    set(s => ({
      tasks: pushTask(s, { id: taskId, kind: "refine", title: `深入分析「${title}」· ${snip}`, status: "running", startedAt: Date.now(), elementId }),
    }));
    try {
      for await (const ev of api.analyzeMarkStream({ elementId, markedText, annotationId, contextBefore, contextAfter, hint, model })) {
        if (ev.type === "error") {
          set(s => ({ tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }) }));
          return;
        }
        if (ev.type === "done") {
          if (!annotationId) await get().refreshElement(elementId);
          set(s => ({ tasks: updateTask(s, taskId, { status: "done", finishedAt: Date.now(), summary: annotationId ? "已在标记下方写入分析" : `已新增章节「${ev.result.title}」` }) }));
          if (annotationId) {
            window.dispatchEvent(new CustomEvent("ke-annotations-changed", { detail: { elementId } }));
          }
          return;
        }
      }
    } catch (e) {
      set(s => ({ tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }) }));
    }
  },

  async feedback(elementId, feedback, model) {
    const title = get().elements.get(elementId)?.title ?? elementId;
    const taskId = nextTaskId();
    const shortFb = feedback.length > 32 ? feedback.slice(0, 32) + "…" : feedback;
    set(s => ({
      inflight: withInflightStart(s, "refine", elementId),
      error: null,
      tasks: pushTask(s, {
        id: taskId, kind: "feedback",
        title: `反馈整改「${title}」· ${shortFb}`,
        status: "running", startedAt: Date.now(), elementId,
      }),
    }));
    try {
      for await (const ev of api.feedbackStream(elementId, feedback, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "refine", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({
            error: `反馈整改失败：${ev.message}`,
            inflight: withInflightDone(s, "refine", elementId),
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
          }));
          return;
        } else if (ev.type === "done") {
          const fresh = await api.getElement(elementId);
          set(s => ({
            elements: fresh ? mergeElements(s.elements, [fresh]) : s.elements,
            inflight: withInflightDone(s, "refine", elementId),
            tasks: updateTask(s, taskId, { status: "done", finishedAt: Date.now(), summary: "已根据反馈更新内容" }),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `反馈整改失败：${String(e)}`,
        inflight: withInflightDone(s, "refine", elementId),
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
    }
  },

  async sectionFeedback(elementId, sectionId, feedback, model) {
    const title = get().elements.get(elementId)?.title ?? elementId;
    const taskId = nextTaskId();
    const shortFb = feedback.length > 32 ? feedback.slice(0, 32) + "…" : feedback;
    set(s => ({
      inflight: withInflightStart(s, "feedback", elementId),
      error: null,
      tasks: pushTask(s, {
        id: taskId, kind: "feedback",
        title: `反馈整改「${title}」· 章节「${sectionId}」· ${shortFb}`,
        status: "running", startedAt: Date.now(), elementId,
      }),
    }));
    try {
      for await (const ev of api.sectionFeedbackStream(elementId, sectionId, feedback, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "feedback", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({
            error: `反馈整改失败：${ev.message}`,
            inflight: withInflightDone(s, "feedback", elementId),
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
          }));
          return;
        } else if (ev.type === "done") {
          // Server already merged the new section into element.content;
          // just reload the freshest element from storage.
          const fresh = await api.getElement(elementId);
          set(s => ({
            elements: fresh ? mergeElements(s.elements, [fresh]) : s.elements,
            inflight: withInflightDone(s, "feedback", elementId),
            tasks: updateTask(s, taskId, { status: "done", finishedAt: Date.now(), summary: "已按章节反馈更新内容" }),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `反馈整改失败：${String(e)}`,
        inflight: withInflightDone(s, "feedback", elementId),
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
    }
  },

  async generatePaths(elementId, kinds, model) {
    set(s => ({ inflight: withInflightStart(s, "path", elementId), error: null }));
    try {
      for await (const ev of api.pathStream(elementId, kinds, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "path", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({ error: `生成路径失败：${ev.message}`, inflight: withInflightDone(s, "path", elementId) }));
          return;
        } else if (ev.type === "done") {
          set(s => ({
            pathsByCenter: mergePaths(s.pathsByCenter, elementId, ev.result.paths),
            inflight: withInflightDone(s, "path", elementId),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({ error: `生成路径失败：${String(e)}`, inflight: withInflightDone(s, "path", elementId) }));
    }
  },

  setCenter(id) {
    set({ centerId: id });
    // Fire-and-forget — UI must not block on this.
    api.setCenterState(id).catch(() => undefined);
  },

  togglePathKind(kind) {
    const next = new Set(get().visiblePathKinds);
    next.has(kind) ? next.delete(kind) : next.add(kind);
    set({ visiblePathKinds: next });
  },

  loadDemoTree() {
    set({
      ...demoState(),
      loading: false,
      error: null,
      backendAvailable: false,
    });
  },
}));

/** Walk up child relations from `id` until no parent found; returns topmost ancestor. */
function rootOf(id: string, relations: Relation[]): string | null {
  let current = id;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const parent = relations.find(r => r.kind === "child" && r.to === current)?.from;
    if (!parent) return current;
    current = parent;
  }
  return current;
}

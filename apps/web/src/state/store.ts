import { create } from "zustand";
import type { Element, Relation, LearningPath, ElementId, PathKind, RichnessLevel } from "@ke/domain";
import { api, type Model, type GreatMeBrainResult, type GreatMeMode } from "../api/client.js";
import { createDemoLargeTree } from "../data/demoLargeTree.js";
import type { SystemPanelMode } from "../components/SystemPanel.js";

export type OpKind = "generate" | "refine" | "expand" | "extend" | "feedback" | "path" | "daily-news" | "ai-search" | "mindmap" | "image-gen" | "greatme-brain";

/** Top-level app views. Switched via the SystemPanel "视图系统" mode.
 *  "tree" auto-falls-back to the home picker (InputView) when no rootId is set. */
export type AppView = "home" | "tree" | "admin" | "news" | "mindmap" | "greatme" | "toolbox";

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
  /** Whether the user has clicked this task to navigate after completion.
   *  Done tasks that aren't yet viewed get a gold "unread" highlight. */
  viewed?: boolean;
  /** Soft-delete flag — task stays in the store + on-disk record, but the
   *  embedded task list hides it. Allows "history" recovery later. */
  hidden?: boolean;
  /** True if the auto-retry sweep has already kicked this task off (either
   *  AS the failed task being retried, or AS the freshly-pushed retry of
   *  another task). Prevents infinite auto-retry chains on persistent
   *  failures — each lineage gets at most one auto attempt. */
  autoRetried?: boolean;
  /** For kind === "ai-search": id of the corresponding homeAnalyses session.
   *  Clicking the task opens the home view and activates that tab. */
  analysisId?: string;
  /** Serialized arguments needed to retry this op. Shape depends on `kind`:
   *   generate    → { topic, richness }
   *   refine      → { elementId, targetRichness, direction? }
   *   expand      → { elementId, count?, direction? }
   *   extend      → { elementId, direction, count? }
   *   feedback    → { elementId, feedback }
   *   daily-news  → { date }
   *  Missing for tasks created before this field existed; retry button is
   *  hidden in that case. */
  retryArgs?: Record<string, unknown>;
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
  /** In-memory results of completed greatme-brain tasks, keyed by task id.
   *  Not persisted: across reloads any running task becomes "error" anyway,
   *  and "done" tasks already had their result applied to the GreatMe state
   *  (which IS persisted, server-side, via /api/great-me/state). The view
   *  consults this on task transitions to apply the AI result then forgets. */
  greatMeResults: Map<string, { adapter: string; result: GreatMeBrainResult }>;
  /** Current top-level view — switched via the right-side 视图系统 panel. */
  appView: AppView;
  /** Which system panel is shown on the right side (search / view / map / notice). */
  systemMode: SystemPanelMode;
  /** Whether the right-side system panel drawer is visible. Default hidden
   *  to give the main content area more breathing room; the TopBar tool
   *  buttons toggle it open/closed for the matching mode. */
  systemPanelOpen: boolean;
  /** True when user jumped to tree view from a news card's "深入了解" button.
   *  ESC in tree view + a topbar pill use this to return to the news view. */
  cameFromNews: boolean;
  /** AI 解析结果 sessions on the home page. Each submission adds a tab here;
   *  tabs persist until user closes them or accepts an option from that tab.
   *  Survives view switches. */
  homeAnalyses: Array<{
    id: string;
    analyzedText: string;
    analysis: import("../api/client.js").AnalyzeInputResult | null;
    collapsed?: boolean;
    /** Lifecycle: "running" while codex is fetching, "done" when result is in,
     *  "error" if fetch failed. Drives tab visual (charging / gold / red). */
    status?: "running" | "done" | "error";
    /** Whether the user has clicked this tab since it completed. Done sessions
     *  start unviewed (gold). Clicking marks viewed → falls back to normal color. */
    viewed?: boolean;
    /** Error message when status === "error". */
    error?: string;
  }>;
  /** Id of the currently-shown analysis tab, or null when none. */
  homeActiveAnalysisId: string | null;
  /** Favorite elements (the "收藏夹" pool). Persisted to localStorage. */
  favorites: string[];
  /** Quick-nav pinned shortcuts on the home left rail. Subset curated by the
   *  user by dragging from 收藏夹. Persisted to localStorage. */
  quickNav: string[];
  /** Currently-open mindmap deck (when appView === "mindmap"). null shows list. */
  mindmapDeckId: string | null;
  /** Open a specific mindmap deck (switches appView to "mindmap"). */
  openMindmap(deckId: string): void;
  /** Close the open deck and return to the mindmap list. */
  closeMindmap(): void;
  /** Track an in-flight image-gen op as a task. The kick-off API call (e.g.
   *  `api.retryMindmapCover`) is fire-and-forget — this action pushes a
   *  "running" task into the list and polls the element until the embed's
   *  cover.status flips to "ready" or "failed", then marks the task. */
  startImageGenTask(args: {
    elementId: ElementId;
    deckRootId: ElementId;
    title: string;
    hint?: string;
  }): string;

  // ----- read actions -----
  hydrate(): Promise<void>;
  /** Switch into TreeView with `rootId` as root. Center = rootId by default. */
  enterTree(rootId: ElementId): Promise<void>;
  /** Enter the tree that contains this element and center on it. */
  enterAtElement(elementId: ElementId): Promise<void>;
  /** Return to InputView (without losing elements/relations cache). */
  exitToHome(): void;
  /** Switch the top-level app view. */
  setAppView(view: AppView): void;
  /** Switch which system panel is shown on the right. Also switches to tree view
   *  when called from admin, so the panel is actually visible to the user. */
  setSystemMode(mode: SystemPanelMode): void;
  /** Toggle the right drawer. If already open for the same mode, closes it;
   *  otherwise opens it (and switches mode if needed). */
  toggleSystemPanel(mode: SystemPanelMode): void;
  closeSystemPanel(): void;
  /** Start a new analysis session — creates a new tab, sets as active.
   *  Returns the session id so the caller can fill in `analysis` later. */
  startHomeAnalysis(analyzedText: string): string;
  /** Set the analysis result on a specific session — also marks status=done. */
  setHomeAnalysisResult(id: string, analysis: import("../api/client.js").AnalyzeInputResult): void;
  /** Mark session as failed with an error message. */
  setHomeAnalysisError(id: string, message: string): void;
  /** Mark session as viewed (clears the gold "unread" tab highlight). */
  markHomeAnalysisViewed(id: string): void;
  /** Close a tab by id (× button or chooseOption). */
  closeHomeAnalysis(id: string): void;
  /** Switch which tab is shown. */
  setActiveHomeAnalysis(id: string | null): void;
  /** Toggle the collapsed state of a specific analysis tab. */
  toggleHomeAnalysisCollapsed(id: string): void;
  /** Open the home view and activate the given analysis tab. Used when the
   *  user clicks an ai-search task from anywhere. */
  openHomeAnalysisTab(id: string): void;
  /** Mark a task as viewed (clears the gold "unread" highlight). */
  markTaskViewed(taskId: string): void;
  /** Hide a task from the embedded task list (soft-delete). The record is
   *  preserved in store + localStorage so it can be recovered or audited
   *  later. Doesn't cancel any running server-side work. */
  removeTask(taskId: string): void;
  /** Re-run a failed task using its stored retryArgs. No-op if the task has
   *  no retryArgs (created before retry support). */
  retryTask(taskId: string): Promise<void>;
  /** Periodic background sweep called on a timer (~ every 60s):
   *   1. Any "running" task older than ~10 min is marked "error" (it's stuck
   *      — the backend op probably crashed; this lets the next sweep retry).
   *   2. Each "error" task with retryArgs + !hidden + !autoRetried is kicked
   *      off via retryTask. Both the old failed task AND its new replacement
   *      are stamped autoRetried so persistent failures don't chain-retry
   *      forever. User-initiated manual retries still work as before. */
  runAutoRetrySweep(): Promise<void>;
  /** Toggle / add / remove / reorder favorites. All variants persist to localStorage. */
  toggleFavorite(id: ElementId): void;
  setFavorites(list: ElementId[]): void;
  /** Quick-nav helpers — separate list, populated by dragging from favorites. */
  setQuickNav(list: ElementId[]): void;
  /** Enter tree view focused on a news element so the user can edit / extend /
   *  refine it. Sets `cameFromNews` so ESC + the topbar pill can return. */
  enterFromNews(elementId: ElementId): Promise<void>;
  /** Trigger AI generation of today's (or a given date's) AI 早报. Streams
   *  progress as a task; on success refreshes the local element cache so the
   *  news view picks up the new roundup + items. */
  generateDailyNews(date?: string): Promise<void>;
  /** Run the GreatMe "Hermes brain" AI op. Returns the task id so the
   *  GreatMeView can watch it transition to done/error and pick up the
   *  result from `greatMeResults`. Snapshot is the GreatMe state subset
   *  to feed the AI; pass null on retry to use the latest persisted copy. */
  greatMeBrain(mode: GreatMeMode, text: string, snapshot: unknown | null): Promise<string>;

  // ----- AI actions (streaming) -----
  generate(topic: string, opts?: { model?: Model; richness?: RichnessLevel }): Promise<void>;
  refine(elementId: ElementId, targetRichness?: RichnessLevel, direction?: string, model?: Model): Promise<void>;
  expand(elementId: ElementId, count?: number, direction?: string, model?: Model): Promise<void>;
  extend(elementId: ElementId, direction: string, count?: number, model?: Model): Promise<void>;
  feedback(elementId: ElementId, feedback: string, model?: Model): Promise<void>;
  /** Section-scoped feedback. AI only touches that one section; server merges
   *  the new section JSON back into element.content.sections by id. */
  sectionFeedback(elementId: ElementId, sectionId: string, feedback: string, model?: Model): Promise<void>;
  /** Strict-attach: create exactly 1 leaf or a vertical chain under a parent. */
  attachUnder(parentId: ElementId, args: { mode: "leaf"|"chain"; leafTitle?: string; chain?: string[]; fullIntent: string; richness?: RichnessLevel }, model?: Model): Promise<void>;
  /** Update user-editable surface fields (title / subtitle). */
  editElement(id: ElementId, patch: { title?: string; subtitle?: string; type?: string; difficulty?: "low" | "mid" | "high" | null }): Promise<void>;
  /** Manually create an empty topic element with just a title. Returns its id. */
  createManualElement(title: string, type?: string): Promise<ElementId>;
  /** Manually create an empty child element under a parent. Returns its id. */
  createChildElement(parentId: ElementId, title: string, type?: string): Promise<ElementId>;
  /** Re-fetch one element and merge it; used after side-channel writes (e.g. analyze-mark). */
  refreshElement(elementId: ElementId): Promise<void>;
  /** Delete an element and its entire descendant subtree. */
  deleteElement(elementId: ElementId): Promise<{ removed: string[] }>;
  /** Move an element under a new parent (or null to make it a root). */
  moveElement(elementId: ElementId, newParentId: ElementId | null): Promise<void>;
  /** Reorder a parent's direct children. `orderedChildIds` is the desired full
   *  display order; missing children get appended at the end. */
  reorderChildren(parentId: ElementId, orderedChildIds: ElementId[]): Promise<void>;
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
export const TASKS_STORAGE_KEY = "ke.tasks.v1";

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

/** Pull the text between the first `「…」` pair in a string, used to recover
 *  a generate-task's topic from its display title for old tasks that have no
 *  retryArgs field. */
function extractQuoted(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/「([^」]+)」/);
  return m ? m[1] : null;
}

/** Pick the user feedback text out of a feedback-task display title for old
 *  tasks that have no retryArgs. Both shapes end with "· <feedback>":
 *    "反馈整改「X」· <feedback>"
 *    "反馈整改「X」· 章节「Y」· <feedback>"
 *  Returns null if nothing after the last "· " or if it's just punctuation. */
function feedbackFromTitle(s: string | undefined): string | null {
  if (!s) return null;
  const i = s.lastIndexOf("· ");
  if (i < 0) return null;
  const tail = s.slice(i + 2).trim().replace(/…$/, "");
  return tail.length >= 2 ? tail : null;
}

/** Generic localStorage string-list helpers used by favorites + quickNav. */
function loadStringList(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}
function saveStringList(key: string, ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore */ }
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
  greatMeResults: new Map(),
  lastCenterId: null,
  appView: (typeof window !== "undefined" && window.location.hash === "#greatme") ? "greatme" : "home",
  systemMode: "view",
  systemPanelOpen: false,
  cameFromNews: false,
  favorites: loadStringList("ke.favorites.v1"),
  quickNav: loadStringList("ke.quickNav.v1"),
  homeAnalyses: [],
  homeActiveAnalysisId: null,
  mindmapDeckId: null,

  async hydrate() {
    set({ loading: true, error: null });
    try {
      const [elements, relations, state] = await Promise.all([
        api.listElements(),
        api.listRelations(),
        api.getCenterState().catch(() => ({ current: null, updatedAt: null, recent: [] })),
      ]);
      const elementMap = new Map(elements.map(e => [e.id, e] as const));
      // Home shows ALL true root elements — anything without an incoming
      // `child` relation, regardless of type. Type is reflected in the card
      // color, not in whether it shows.
      const childIds = new Set(
        relations.filter(r => r.kind === "child").map(r => r.to),
      );
      const topics = elements.filter(e => !childIds.has(e.id));
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
    set({ rootId, centerId: center, pathsByCenter, error: null, appView: "tree", cameFromNews: false });
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
    set({ rootId, centerId: elementId, pathsByCenter, error: null, appView: "tree" });
    api.setCenterState(elementId).catch(() => undefined);
  },

  exitToHome() {
    // Snapshot the current centerId as lastCenterId so the home page's
    // "继续学习" reflects where the user actually was just now — not the
    // server value loaded at initial hydrate.
    set(s => ({
      rootId: null, appView: "tree", cameFromNews: false,
      lastCenterId: s.centerId ?? s.lastCenterId,
    }));
    // keep elements/relations/topics so the home page still shows them.
    // appView stays "tree" — TreeView auto-falls back to InputView when rootId is null.
  },

  setAppView(view) {
    // Clear "came from news" whenever we leave the tree view, so a later return
    // doesn't get the news pill / ESC behavior unexpectedly.
    set(s => ({ appView: view, cameFromNews: view === "tree" ? s.cameFromNews : false }));
  },

  setSystemMode(mode) {
    set({ systemMode: mode });
  },

  toggleSystemPanel(mode) {
    set(s => {
      // Same mode while already open → close. Otherwise open + switch mode.
      const sameModeOpen = s.systemPanelOpen && s.systemMode === mode;
      return {
        systemMode: mode,
        systemPanelOpen: !sameModeOpen,
      };
    });
  },

  closeSystemPanel() {
    set({ systemPanelOpen: false });
  },

  openMindmap(deckId) {
    set({ appView: "mindmap", mindmapDeckId: deckId, cameFromNews: false });
  },
  closeMindmap() {
    set({ mindmapDeckId: null });
  },

  startImageGenTask({ elementId, deckRootId, title, hint }) {
    const taskId = nextTaskId();
    set(s => ({
      tasks: pushTask(s, {
        id: taskId, kind: "image-gen", title,
        status: "running", startedAt: Date.now(),
        elementId,
        retryArgs: { elementId, deckRootId, hint },
      }),
    }));

    // Poll the element until this deck's embed cover flips to ready/failed.
    // imageQueue is serial (concurrency=1) — typical wait ~30-90s per image.
    // Give up after ~6min so a dead worker doesn't leave the task running.
    const intervalMs = 4000;
    const maxAttempts = 90; // 90 * 4s = 6min
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const el = await api.getElement(elementId);
        const sections = (el?.content as { sections?: Array<{ id?: string; blocks?: Array<Record<string, unknown>> }> } | undefined)?.sections ?? [];
        let embed: Record<string, unknown> | null = null;
        for (const s of sections) {
          if (s.id !== "mindmap-ppt") continue;
          for (const b of s.blocks ?? []) {
            if ((b as { style?: string }).style !== "mindmap-embed") continue;
            const drid = (b as { deckRootId?: string }).deckRootId
              ?? ((b as { origin?: string }).origin === "child-of-deck" ? null : elementId);
            if (drid === deckRootId) { embed = b; break; }
          }
          if (embed) break;
        }
        const cover = embed?.cover as { status?: string; src?: string; error?: string } | undefined;
        if (cover?.status === "ready") {
          // Refresh local state + finish task.
          await get().hydrate();
          set(s => ({
            tasks: updateTask(s, taskId, {
              status: "done", finishedAt: Date.now(),
              summary: "封面已生成",
            }),
          }));
          return;
        }
        if (cover?.status === "failed") {
          await get().hydrate();
          set(s => ({
            tasks: updateTask(s, taskId, {
              status: "error", finishedAt: Date.now(),
              error: cover.error ?? "图片生成失败",
            }),
          }));
          return;
        }
      } catch {
        // Network blip — keep polling until maxAttempts.
      }
      if (attempts >= maxAttempts) {
        set(s => ({
          tasks: updateTask(s, taskId, {
            status: "error", finishedAt: Date.now(),
            error: "图片生成超时（6 分钟未完成）",
          }),
        }));
        return;
      }
      window.setTimeout(tick, intervalMs);
    };
    window.setTimeout(tick, intervalMs);

    return taskId;
  },

  startHomeAnalysis(analyzedText) {
    const id = `an-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
    const taskId = nextTaskId();
    const shortText = analyzedText.slice(0, 32) + (analyzedText.length > 32 ? "…" : "");
    set(s => ({
      homeAnalyses: [...s.homeAnalyses, { id, analyzedText, analysis: null, status: "running" }],
      homeActiveAnalysisId: id,
      tasks: pushTask(s, {
        id: taskId,
        kind: "ai-search",
        title: `AI 搜索「${shortText}」`,
        status: "running",
        startedAt: Date.now(),
        analysisId: id,
        retryArgs: { text: analyzedText },
      }),
    }));
    return id;
  },
  setHomeAnalysisResult(id, analysis) {
    set(s => ({
      homeAnalyses: s.homeAnalyses.map(a =>
        a.id === id ? { ...a, analysis, status: "done", viewed: false } : a,
      ),
      tasks: s.tasks.map(t =>
        t.kind === "ai-search" && t.analysisId === id
          ? { ...t, status: "done" as const, finishedAt: Date.now(), viewed: false, summary: `${analysis.options.length} 个挂载选项` }
          : t,
      ),
    }));
    // Mirror the new tasks list to localStorage so refreshes don't lose it.
    saveTasks(get().tasks);
  },
  setHomeAnalysisError(id, message) {
    set(s => ({
      homeAnalyses: s.homeAnalyses.map(a =>
        a.id === id ? { ...a, status: "error", error: message } : a,
      ),
      tasks: s.tasks.map(t =>
        t.kind === "ai-search" && t.analysisId === id
          ? { ...t, status: "error" as const, error: message, finishedAt: Date.now() }
          : t,
      ),
    }));
    saveTasks(get().tasks);
  },
  markHomeAnalysisViewed(id) {
    set(s => ({
      homeAnalyses: s.homeAnalyses.map(a => a.id === id ? { ...a, viewed: true } : a),
    }));
  },
  closeHomeAnalysis(id) {
    set(s => {
      const next = s.homeAnalyses.filter(a => a.id !== id);
      const nextActive = s.homeActiveAnalysisId === id
        ? (next[next.length - 1]?.id ?? null)
        : s.homeActiveAnalysisId;
      return { homeAnalyses: next, homeActiveAnalysisId: nextActive };
    });
  },
  setActiveHomeAnalysis(id) {
    set({ homeActiveAnalysisId: id });
  },

  toggleHomeAnalysisCollapsed(id) {
    set(s => ({
      homeAnalyses: s.homeAnalyses.map(a => a.id === id ? { ...a, collapsed: !a.collapsed } : a),
    }));
  },

  openHomeAnalysisTab(id) {
    // Switch to home (tree view + no rootId = InputView) and activate the tab.
    set({ rootId: null, appView: "tree", cameFromNews: false, homeActiveAnalysisId: id });
  },

  markTaskViewed(taskId) {
    set(s => ({ tasks: updateTask(s, taskId, { viewed: true }) }));
  },

  removeTask(taskId) {
    // Soft-delete only: flip `hidden: true`. Keeps the record intact for
    // history / undo / audit; the embedded list just filters hidden ones out.
    set(s => ({ tasks: updateTask(s, taskId, { hidden: true }) }));
  },

  async retryTask(taskId) {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    const a = (task.retryArgs ?? {}) as Record<string, unknown>;
    const api = get();

    // Resolve the retry call FIRST. Only after we know we can fire a new
    // attempt do we hide the old task — otherwise a missing retryArgs would
    // both vanish the failed task and create no replacement.
    let retry: (() => Promise<void>) | null = null;
    switch (task.kind) {
      case "generate": {
        const topic = String(a.topic ?? extractQuoted(task.title) ?? "");
        if (topic) retry = () => api.generate(topic, {
          model: (a.model as Model | undefined) ?? "codex",
          richness: (a.richness as RichnessLevel | undefined) ?? 3,
        });
        break;
      }
      case "refine": {
        const elementId = String(a.elementId ?? task.elementId ?? "");
        if (elementId) retry = () => api.refine(
          elementId,
          (a.targetRichness as RichnessLevel | undefined) ?? 3,
          a.direction as string | undefined,
          a.model as Model | undefined,
        );
        break;
      }
      case "expand": {
        const elementId = String(a.elementId ?? task.elementId ?? "");
        if (elementId) retry = () => api.expand(
          elementId,
          a.count as number | undefined,
          a.direction as string | undefined,
          a.model as Model | undefined,
        );
        break;
      }
      case "extend": {
        const elementId = String(a.elementId ?? task.elementId ?? "");
        if (elementId) retry = () => api.extend(
          elementId,
          String(a.direction ?? ""),
          a.count as number | undefined,
          a.model as Model | undefined,
        );
        break;
      }
      case "feedback": {
        const elementId = String(a.elementId ?? task.elementId ?? "");
        // Fallback: parse the feedback text from the title. Section-feedback
        // titles look like "反馈整改「X」· 章节「Y」· <feedback>", regular
        // feedback titles "反馈整改「X」· <feedback>". Either way the text
        // after the last "· " is the feedback (possibly truncated).
        const feedback = String(a.feedback ?? feedbackFromTitle(task.title) ?? "");
        const sectionId = a.sectionId as string | undefined;
        if (elementId && feedback) {
          retry = sectionId
            ? () => api.sectionFeedback(elementId, sectionId, feedback, a.model as Model | undefined)
            : () => api.feedback(elementId, feedback, a.model as Model | undefined);
        }
        break;
      }
      case "daily-news":
        retry = () => api.generateDailyNews(a.date as string | undefined);
        break;
      case "greatme-brain": {
        const mode = a.mode as GreatMeMode | undefined;
        const text = String(a.text ?? "");
        if (mode && text) {
          // Pass null snapshot — the action re-pulls the latest from server.
          retry = async () => { await api.greatMeBrain(mode, text, null); };
        }
        break;
      }
      case "image-gen": {
        const elementId = String(a.elementId ?? task.elementId ?? "");
        const deckRootId = String(a.deckRootId ?? "");
        if (elementId && deckRootId) retry = async () => {
          const { api: client } = await import("../api/client.js");
          await client.retryMindmapCover(elementId, deckRootId, a.hint as string | undefined);
          const el = get().elements.get(elementId);
          const dec = get().elements.get(deckRootId);
          const taskTitle = elementId === deckRootId
            ? `生成封面 · ${el?.title ?? elementId}`
            : `生成封面 · ${el?.title ?? elementId}(${dec?.title ?? deckRootId} PPT)`;
          get().startImageGenTask({ elementId, deckRootId, title: taskTitle, hint: a.hint as string | undefined });
        };
        break;
      }
    }

    if (!retry) {
      // Couldn't reconstruct enough args — leave the failed task visible so
      // the user can at least see what failed, instead of silently vanishing.
      return;
    }
    set(s => ({ tasks: updateTask(s, taskId, { hidden: true }) }));
    await retry();
  },

  async runAutoRetrySweep() {
    const STUCK_MS = 10 * 60 * 1000;
    const now = Date.now();

    // 1. Demote stuck-running tasks to error so they become retry-eligible
    //    next pass. Anything still "running" > 10min after startedAt is
    //    almost certainly orphaned (server restarted / SSE dropped / queue
    //    worker crashed).
    set(s => ({
      tasks: s.tasks.map(t =>
        t.status === "running" && now - t.startedAt > STUCK_MS
          ? { ...t, status: "error" as TaskStatus, error: "任务超时(>10min,可能卡死)", finishedAt: now }
          : t,
      ),
    }));

    // 2. Auto-retry each unretried failed task.
    const candidates = get().tasks.filter(t =>
      t.status === "error" && !t.autoRetried && !t.hidden && t.retryArgs);
    for (const t of candidates) {
      // Mark old as autoRetried up-front so even if the retry call throws
      // we won't loop on it next sweep.
      set(s => ({ tasks: updateTask(s, t.id, { autoRetried: true }) }));
      const idsBefore = new Set(get().tasks.map(x => x.id));
      // Fire-and-forget. retryTask is async + awaits the full op; we don't
      // want to block the sweep on it. The sync portion (and any short
      // pre-fetch the retry handler does) pushes a new task into the store
      // within a few hundred ms.
      void get().retryTask(t.id);
      // Stamp the new task as autoRetried too — bound the lineage at one
      // automatic attempt. If THAT task also fails, the user can still
      // click 重跑 manually. We poll briefly because some retry handlers
      // (e.g. image-gen) await an HTTP call before pushing.
      void (async () => {
        for (let i = 0; i < 12; i++) { // ~ 6s max
          await new Promise(r => setTimeout(r, 500));
          const newTask = get().tasks.find(x => !idsBefore.has(x.id));
          if (newTask) {
            set(s => ({ tasks: updateTask(s, newTask.id, { autoRetried: true }) }));
            return;
          }
        }
      })();
    }
  },

  toggleFavorite(id) {
    set(s => {
      const next = s.favorites.includes(id)
        ? s.favorites.filter(x => x !== id)
        : [...s.favorites, id];
      saveStringList("ke.favorites.v1", next);
      // Favorites and quickNav are independent — un-favoriting does NOT
      // remove from quickNav.
      return { favorites: next };
    });
  },
  setFavorites(list) {
    saveStringList("ke.favorites.v1", list);
    set({ favorites: list });
  },
  setQuickNav(list) {
    saveStringList("ke.quickNav.v1", list);
    set({ quickNav: list });
  },

  async enterFromNews(elementId) {
    await get().enterAtElement(elementId);
    set({ cameFromNews: true });
  },

  async generateDailyNews(date) {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const taskId = nextTaskId();
    set(s => ({
      tasks: pushTask(s, {
        id: taskId,
        kind: "daily-news",
        title: `生成 ${targetDate} AI 早报`,
        retryArgs: { date: targetDate },
        status: "running",
        startedAt: Date.now(),
      }),
    }));
    try {
      for await (const ev of api.generateDailyNewsStream(targetDate, "codex")) {
        if (ev.type === "error") {
          set(s => ({
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
            error: `早报生成失败：${ev.message}`,
          }));
          return;
        }
        if (ev.type === "done") {
          // Server emits "done" then a separate "materialized" event after it
          // writes elements + relations. We rely on a fresh hydrate to pick
          // them up — simpler than racing the materialized event over SSE.
          continue;
        }
      }
      // Refetch everything so the news view shows the new roundup + children.
      await get().hydrate();
      set(s => ({
        tasks: updateTask(s, taskId, {
          status: "done",
          finishedAt: Date.now(),
          elementId: `ai-news.${targetDate}`,
          summary: "已写入 ai-news 树",
        }),
      }));
    } catch (e) {
      set(s => ({
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
        error: `早报生成失败：${String(e)}`,
      }));
    }
  },

  async greatMeBrain(mode, text, snapshot) {
    const taskId = nextTaskId();
    // Title shows the mode and a snippet of the seed so the user can tell
    // multiple GreatMe ops apart in the task panel.
    const modeLabel = mode === "goal" ? "解析目标"
      : mode === "mission" ? "生成任务"
      : mode === "review" ? "请求反馈"
      : "模拟一周";
    const seedSnippet = text.slice(0, 24) + (text.length > 24 ? "…" : "");
    set(s => ({
      tasks: pushTask(s, {
        id: taskId,
        kind: "greatme-brain",
        title: `计划管理 · ${modeLabel}「${seedSnippet}」`,
        status: "running",
        startedAt: Date.now(),
        // Snapshot intentionally NOT in retryArgs — auto-retry should use
        // the LATEST persisted state, not the stale snapshot from when
        // this attempt was kicked off. The action re-fetches when snapshot
        // is null.
        retryArgs: { mode, text },
      }),
    }));
    try {
      // On retry path the caller passes null; pull the freshest copy from
      // the server (P0-1 backed). If that also fails (offline), let the
      // request go through with an empty state — the AI will degrade.
      const effectiveSnapshot = snapshot ?? await api.getGreatMeState<unknown>().catch(() => null);
      const { adapter, result } = await api.greatMeBrain({
        mode, text, state: effectiveSnapshot, model: "hermes",
      });
      set(s => {
        const nextResults = new Map(s.greatMeResults);
        nextResults.set(taskId, { adapter, result });
        return {
          tasks: updateTask(s, taskId, {
            status: "done",
            finishedAt: Date.now(),
            summary: `${adapter} · ${result.title}`,
          }),
          greatMeResults: nextResults,
        };
      });
    } catch (e) {
      set(s => ({
        tasks: updateTask(s, taskId, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
          finishedAt: Date.now(),
        }),
      }));
    }
    return taskId;
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
        retryArgs: { topic, model: opts?.model, richness: opts?.richness },
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
            const newChildIds = new Set(
              mergedRelations.filter(r => r.kind === "child").map(r => r.to),
            );
            const newTopics = [
              ...s.availableTopics.filter(t => !next.elements.has(t.id)),
              ...Array.from(next.elements.values()).filter(el => !newChildIds.has(el.id)),
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
      tasks: pushTask(s, { id: taskId, kind: "refine", title: taskTitle, status: "running", startedAt: Date.now(), elementId, retryArgs: { elementId, targetRichness, direction, model } }),
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
      tasks: pushTask(s, { id: taskId, kind: "expand", title: taskTitle, status: "running", startedAt: Date.now(), elementId, retryArgs: { elementId, count, direction, model } }),
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

  async attachUnder(parentId, args, model) {
    const title = get().elements.get(parentId)?.title ?? parentId;
    const taskId = nextTaskId();
    const label = args.mode === "leaf"
      ? `挂载「${args.leafTitle ?? ""}」到「${title}」下`
      : `链式挂载「${(args.chain ?? []).join(" → ")}」到「${title}」下`;
    set(s => ({
      inflight: withInflightStart(s, "expand", parentId),
      error: null,
      tasks: pushTask(s, { id: taskId, kind: "expand", title: label, status: "running", startedAt: Date.now(), elementId: parentId }),
    }));
    try {
      for await (const ev of api.attachUnderStream(parentId, args, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "expand", parentId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({
            error: `挂载失败：${ev.message}`,
            inflight: withInflightDone(s, "expand", parentId),
            tasks: updateTask(s, taskId, { status: "error", error: ev.message, finishedAt: Date.now() }),
          }));
          return;
        } else if (ev.type === "done") {
          const deepest = ev.result.elements[ev.result.elements.length - 1];
          set(s => ({
            elements: mergeElements(s.elements, ev.result.elements),
            relations: mergeRelations(s.relations, ev.result.relations),
            inflight: withInflightDone(s, "expand", parentId),
            tasks: updateTask(s, taskId, {
              status: "done", finishedAt: Date.now(),
              summary: `新增 ${ev.result.elements.length} 个元`,
              elementId: deepest?.id ?? parentId,
            }),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `挂载失败：${String(e)}`,
        inflight: withInflightDone(s, "expand", parentId),
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
    }
  },

  async createManualElement(title, type) {
    const taskId = nextTaskId();
    const trimmed = title.trim();
    set(s => ({
      tasks: pushTask(s, {
        id: taskId, kind: "generate",
        title: `手动创建「${trimmed}」`,
        status: "running", startedAt: Date.now(),
      }),
    }));
    try {
      const { element: el } = await api.createElement({ title: trimmed, type });
      set(s => ({
        elements: mergeElements(s.elements, [el]),
        availableTopics: el.type === "topic"
          ? [el, ...s.availableTopics.filter(t => t.id !== el.id)]
          : s.availableTopics,
        tasks: updateTask(s, taskId, {
          status: "done", finishedAt: Date.now(),
          rootId: el.id, elementId: el.id,
          summary: "已创建空元",
        }),
      }));
      return el.id;
    } catch (e) {
      set(s => ({
        error: `创建失败：${String(e)}`,
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
      throw e;
    }
  },

  async createChildElement(parentId, title, type) {
    const trimmed = title.trim();
    const parentTitle = get().elements.get(parentId)?.title ?? parentId;
    const taskId = nextTaskId();
    set(s => ({
      tasks: pushTask(s, {
        id: taskId, kind: "expand",
        title: `新增下级元「${trimmed}」（挂在「${parentTitle}」下）`,
        status: "running", startedAt: Date.now(), elementId: parentId,
      }),
    }));
    try {
      const { element: el, relation } = await api.createElement({ title: trimmed, type, parentId });
      set(s => ({
        elements: mergeElements(s.elements, [el]),
        relations: relation ? mergeRelations(s.relations, [relation]) : s.relations,
        tasks: updateTask(s, taskId, {
          status: "done", finishedAt: Date.now(),
          elementId: el.id,
          summary: "已创建下级元",
        }),
      }));
      return el.id;
    } catch (e) {
      set(s => ({
        error: `创建失败：${String(e)}`,
        tasks: updateTask(s, taskId, { status: "error", error: String(e), finishedAt: Date.now() }),
      }));
      throw e;
    }
  },

  async editElement(id, patch) {
    try {
      const next = await api.patchElement(id, patch);
      set(s => ({ elements: mergeElements(s.elements, [next]), error: null }));
    } catch (e) {
      set({ error: `修改失败：${e instanceof Error ? e.message : String(e)}` });
      throw e;
    }
  },

  async extend(elementId, direction, count, model) {
    const title = get().elements.get(elementId)?.title ?? elementId;
    const taskId = nextTaskId();
    set(s => ({
      inflight: withInflightStart(s, "extend", elementId),
      error: null,
      tasks: pushTask(s, { id: taskId, kind: "extend", title: `延伸「${title}」→ ${direction}`, status: "running", startedAt: Date.now(), elementId, retryArgs: { elementId, direction, count, model } }),
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

  async reorderChildren(parentId, orderedChildIds) {
    // Optimistic local reorder: rearrange child-relations for parentId in
    // place so the UI updates before the network round-trip.
    set(s => {
      const childRels = s.relations.filter(r => r.kind === "child" && r.from === parentId);
      if (childRels.length === 0) return {};
      const byTo = new Map(childRels.map(r => [r.to, r]));
      const reorderedCR: typeof childRels = [];
      const seen = new Set<string>();
      for (const cid of orderedChildIds) {
        const r = byTo.get(cid);
        if (!r) continue;
        seen.add(cid);
        reorderedCR.push(r);
      }
      for (const r of childRels) if (!seen.has(r.to)) reorderedCR.push(r);
      // Stitch back into the full relations array, preserving slots.
      const next = s.relations.slice();
      let k = 0;
      for (let i = 0; i < next.length; i++) {
        if (next[i].kind === "child" && next[i].from === parentId) {
          next[i] = reorderedCR[k++];
        }
      }
      return { relations: next };
    });
    try {
      await api.reorderChildren(parentId, orderedChildIds);
    } catch (e) {
      // Reload server state on failure so UI doesn't lie.
      const rels = await api.listRelations().catch(() => null);
      if (rels) set({ relations: rels });
      throw e;
    }
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
        retryArgs: { elementId, feedback, model },
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
    // Note: server now auto-migrates legacy concept-content elements (those
    // with oneSentence / coreExplain / ... but no content.sections[]) into
    // sections[] form before processing. The synthetic section ids the
    // frontend uses (what / how / why / ...) line up with that migration, so
    // section-feedback works for legacy elements too — no destructive whole-
    // element rewrite anymore.
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
        retryArgs: { elementId, sectionId, feedback, model },
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
    // Track every center change locally so home page's 继续学习 stays accurate
    // even if user never goes home — e.g. after a refresh.
    set({ centerId: id, lastCenterId: id });
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

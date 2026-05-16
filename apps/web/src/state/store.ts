import { create } from "zustand";
import type { Element, Relation, LearningPath, ElementId, PathKind, RichnessLevel } from "@ke/domain";
import { api, type Model } from "../api/client.js";
import { createDemoLargeTree } from "../data/demoLargeTree.js";

export type OpKind = "generate" | "refine" | "expand" | "extend" | "path" | "hydrate";

export interface InflightOp {
  kind: OpKind;
  elementId?: string;
  delta: string;
  startedAt: number;
}

interface AppState {
  elements: Map<ElementId, Element>;
  relations: Relation[];
  pathsByCenter: Map<ElementId, LearningPath[]>;
  rootId: ElementId | null;
  centerId: ElementId | null;
  visiblePathKinds: Set<string>;
  /** True while the very first generate/hydrate is running and no tree visible yet. */
  loading: boolean;
  /** Last error surfaced to UI (banner). Cleared on next op start. */
  error: string | null;
  /** Map of per-op in-flight state. Multiple ops may run on different elements concurrently. */
  inflight: Map<string, InflightOp>;
  /** Backend availability flag. False = backend unreachable, UI shows demo. */
  backendAvailable: boolean;

  // ----- read actions -----
  hydrate(): Promise<void>;

  // ----- AI actions (streaming) -----
  generate(topic: string, opts?: { model?: Model; richness?: RichnessLevel }): Promise<void>;
  refine(elementId: ElementId, targetRichness?: RichnessLevel, model?: Model): Promise<void>;
  expand(elementId: ElementId, count?: number, model?: Model): Promise<void>;
  extend(elementId: ElementId, direction: string, count?: number, model?: Model): Promise<void>;
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

  async hydrate() {
    set({ loading: true, error: null });
    try {
      const [elements, relations, state] = await Promise.all([
        api.listElements(),
        api.listRelations(),
        api.getCenterState().catch(() => ({ current: null, updatedAt: null, recent: [] })),
      ]);
      if (elements.length === 0) {
        // Empty backend — keep "input topic" screen visible (rootId stays null).
        set({ loading: false, backendAvailable: true });
        return;
      }
      const elementMap = new Map(elements.map(e => [e.id, e] as const));
      // Pick root: state.current if present + valid; else first topic; else first element.
      const center = state.current && elementMap.has(state.current) ? state.current
        : (elements.find(e => e.type === "topic") ?? elements[0])?.id ?? null;
      // Pick rootId: walk up from center along child relations
      const root = center ? rootOf(center, relations) ?? center : null;
      // Pull paths for the chosen root (may be empty)
      let pathsByCenter = new Map<ElementId, LearningPath[]>();
      if (root) {
        try {
          const paths = await api.listPathsForCenter(root);
          if (paths.length > 0) pathsByCenter = new Map([[root, paths]]);
        } catch { /* missing paths file is fine */ }
      }
      set({
        elements: elementMap,
        relations,
        pathsByCenter,
        rootId: root,
        centerId: center,
        loading: false,
        backendAvailable: true,
      });
    } catch (e) {
      // Backend down: do NOT auto-load demo (let user explicitly pick).
      set({
        loading: false,
        backendAvailable: false,
        error: `后端不可用：${String(e)}。可点击"载入示例树"查看 UI`,
      });
    }
  },

  async generate(topic, opts) {
    set(s => ({
      loading: true, error: null,
      inflight: withInflightStart(s, "generate"),
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
          }));
          return;
        } else if (ev.type === "done") {
          const next = treeToState(ev.result);
          set(s => ({
            ...next,
            loading: false,
            inflight: withInflightDone(s, "generate"),
            backendAvailable: true,
          }));
          // fire-and-forget: persist the new center
          api.setCenterState(next.centerId!).catch(() => undefined);
          return;
        }
      }
    } catch (e) {
      set(s => ({
        error: `后端不可用：${String(e)}`,
        loading: false,
        backendAvailable: false,
        inflight: withInflightDone(s, "generate"),
      }));
    }
  },

  async refine(elementId, targetRichness = 3, model) {
    set(s => ({ inflight: withInflightStart(s, "refine", elementId), error: null }));
    try {
      for await (const ev of api.refineStream(elementId, targetRichness, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "refine", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({ error: `细化失败：${ev.message}`, inflight: withInflightDone(s, "refine", elementId) }));
          return;
        } else if (ev.type === "done") {
          // Re-fetch the updated element from backend so we get the persisted metadata.
          const fresh = await api.getElement(elementId);
          if (fresh) {
            set(s => ({
              elements: mergeElements(s.elements, [fresh]),
              inflight: withInflightDone(s, "refine", elementId),
            }));
          } else {
            set(s => ({ inflight: withInflightDone(s, "refine", elementId) }));
          }
          return;
        }
      }
    } catch (e) {
      set(s => ({ error: `细化失败：${String(e)}`, inflight: withInflightDone(s, "refine", elementId) }));
    }
  },

  async expand(elementId, count, model) {
    set(s => ({ inflight: withInflightStart(s, "expand", elementId), error: null }));
    try {
      for await (const ev of api.expandStream(elementId, count, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "expand", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({ error: `展开失败：${ev.message}`, inflight: withInflightDone(s, "expand", elementId) }));
          return;
        } else if (ev.type === "done") {
          set(s => ({
            elements: mergeElements(s.elements, ev.result.elements),
            relations: mergeRelations(s.relations, ev.result.relations),
            inflight: withInflightDone(s, "expand", elementId),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({ error: `展开失败：${String(e)}`, inflight: withInflightDone(s, "expand", elementId) }));
    }
  },

  async extend(elementId, direction, count, model) {
    set(s => ({ inflight: withInflightStart(s, "extend", elementId), error: null }));
    try {
      for await (const ev of api.extendStream(elementId, direction, count, model)) {
        if (ev.type === "delta") {
          set(s => ({ inflight: withInflightDelta(s, "extend", elementId, ev.text) }));
        } else if (ev.type === "error") {
          set(s => ({ error: `延伸失败：${ev.message}`, inflight: withInflightDone(s, "extend", elementId) }));
          return;
        } else if (ev.type === "done") {
          set(s => ({
            elements: mergeElements(s.elements, ev.result.elements),
            relations: mergeRelations(s.relations, ev.result.relations),
            inflight: withInflightDone(s, "extend", elementId),
          }));
          return;
        }
      }
    } catch (e) {
      set(s => ({ error: `延伸失败：${String(e)}`, inflight: withInflightDone(s, "extend", elementId) }));
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

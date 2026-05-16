import { create } from "zustand";
import type { Element, Relation, LearningPath, ElementId } from "@ke/domain";
import { api } from "../api/client.js";

interface AppState {
  elements: Map<ElementId, Element>;
  relations: Relation[];
  pathsByCenter: Map<ElementId, LearningPath[]>;
  rootId: ElementId | null;
  centerId: ElementId | null;
  visiblePathKinds: Set<string>;
  loading: boolean;
  error: string | null;
  generate(topic: string): Promise<void>;
  setCenter(id: ElementId): void;
  togglePathKind(kind: string): void;
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

  async generate(topic) {
    set({ loading: true, error: null });
    try {
      const tree = await api.generateTree(topic);
      const elements = new Map(tree.elements.map(e => [e.id, e]));
      const paths = new Map<string, LearningPath[]>();
      for (const p of tree.paths) {
        const list = paths.get(p.centerElementId) ?? [];
        list.push(p);
        paths.set(p.centerElementId, list);
      }
      set({
        elements,
        relations: tree.relations,
        pathsByCenter: paths,
        rootId: tree.rootId,
        centerId: tree.rootId,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setCenter(id) { set({ centerId: id }); },

  togglePathKind(kind) {
    const next = new Set(get().visiblePathKinds);
    next.has(kind) ? next.delete(kind) : next.add(kind);
    set({ visiblePathKinds: next });
  },
}));

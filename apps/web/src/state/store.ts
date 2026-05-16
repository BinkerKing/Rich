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
  deltaText: string;
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
  deltaText: "",

  async generate(topic) {
    set({ loading: true, error: null, deltaText: "" });
    try {
      for await (const ev of api.generateTreeStream(topic)) {
        if (ev.type === "delta") {
          set(s => ({ deltaText: (s.deltaText ?? "") + ev.text }));
        } else if (ev.type === "error") {
          set({ error: ev.message, loading: false });
          return;
        } else if (ev.type === "done") {
          const tree = ev.result;
          const elements = new Map(tree.elements.map(e => [e.id, e]));
          const paths = new Map<string, LearningPath[]>();
          for (const p of tree.paths) {
            const list = paths.get(p.centerElementId) ?? [];
            list.push(p);
            paths.set(p.centerElementId, list);
          }
          set({
            elements, relations: tree.relations, pathsByCenter: paths,
            rootId: tree.rootId, centerId: tree.rootId,
            loading: false, deltaText: "",
          });
          return;
        }
      }
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

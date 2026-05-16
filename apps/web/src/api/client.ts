import type {
  Element, Relation, LearningPath, PathKind, RichnessLevel,
} from "@ke/domain";

// ---------- shared SSE plumbing ----------

export type AiStreamEvent<TResult> =
  | { type: "delta"; text: string }
  | { type: "done"; result: TResult }
  | { type: "error"; message: string };

async function* sseStream<TResult>(
  path: string,
  body: Record<string, unknown>,
): AsyncIterable<AiStreamEvent<TResult>> {
  const r = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    throw new Error(`${path} failed: ${r.status}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = chunk.split("\n").find(l => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const obj = JSON.parse(dataLine.slice(6)) as AiStreamEvent<TResult>;
        yield obj;
      } catch { /* ignore malformed chunk */ }
    }
  }
}

// ---------- AI op result types (mirrors server) ----------

export interface GenerateTreeResult {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

export interface RefineResult {
  content: unknown;
}

export interface ElementsAndRelationsResult {
  elements: Element[];
  relations: Relation[];
}

export interface PathResult {
  paths: LearningPath[];
}

// ---------- AI ops ----------

export type Model = "claude-code" | "codex";

export const api = {
  // ----- generate-tree -----
  generateTreeStream(topic: string, model?: Model, richness?: RichnessLevel) {
    return sseStream<GenerateTreeResult>("/ai/generate-tree", { topic, model, richness });
  },

  // ----- per-element ops -----
  refineStream(elementId: string, targetRichness?: RichnessLevel, model?: Model) {
    return sseStream<RefineResult>("/ai/refine", { elementId, targetRichness, model });
  },
  expandStream(elementId: string, count?: number, model?: Model) {
    return sseStream<ElementsAndRelationsResult>("/ai/expand", { elementId, count, model });
  },
  extendStream(elementId: string, direction: string, count?: number, model?: Model) {
    return sseStream<ElementsAndRelationsResult>("/ai/extend", { elementId, direction, count, model });
  },
  pathStream(elementId: string, kinds?: PathKind[], model?: Model) {
    return sseStream<PathResult>("/ai/path", { elementId, kinds, model });
  },

  // ----- read endpoints -----
  async listElements(): Promise<Element[]> {
    const r = await fetch("/api/elements");
    if (!r.ok) throw new Error(`listElements ${r.status}`);
    return r.json();
  },
  async getElement(id: string): Promise<Element | null> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`getElement ${r.status}`);
    return r.json();
  },
  async listRelations(opts: { from?: string; to?: string } = {}): Promise<Relation[]> {
    const qs = new URLSearchParams();
    if (opts.from) qs.set("from", opts.from);
    if (opts.to) qs.set("to", opts.to);
    const q = qs.toString();
    const r = await fetch(`/api/relations${q ? `?${q}` : ""}`);
    if (!r.ok) throw new Error(`listRelations ${r.status}`);
    return r.json();
  },
  async listPathsForCenter(center: string): Promise<LearningPath[]> {
    const r = await fetch(`/api/paths?center=${encodeURIComponent(center)}`);
    if (!r.ok) throw new Error(`listPaths ${r.status}`);
    return r.json();
  },
  async listAllPathCenters(): Promise<string[]> {
    const r = await fetch("/api/paths");
    if (!r.ok) throw new Error(`listAllPathCenters ${r.status}`);
    return r.json();
  },

  // ----- history -----
  async listVersions(id: string): Promise<{ timestamp: string; element: Element }[]> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}/history`);
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`listVersions ${r.status}`);
    return r.json();
  },
  async revert(id: string, timestamp: string): Promise<Element> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}/revert`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timestamp }),
    });
    if (!r.ok) throw new Error(`revert ${r.status}`);
    return r.json();
  },

  // ----- state (current center) -----
  async getCenterState(): Promise<{ current: string | null; updatedAt: string | null; recent: string[] }> {
    const r = await fetch("/api/state/center");
    if (!r.ok) throw new Error(`getCenterState ${r.status}`);
    return r.json();
  },
  async setCenterState(elementId: string): Promise<void> {
    const r = await fetch("/api/state/center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId }),
    });
    if (!r.ok && r.status !== 404) throw new Error(`setCenterState ${r.status}`);
  },

  // ----- meta -----
  async getModels(): Promise<{ name: string; available: boolean }[]> {
    const r = await fetch("/api/ai/models");
    if (!r.ok) throw new Error(`getModels ${r.status}`);
    return r.json();
  },
  async getHealth(): Promise<{ ok: boolean; adapters: { name: string; available: boolean }[]; uptimeSec: number; signals: number }> {
    const r = await fetch("/api/health");
    if (!r.ok) throw new Error(`getHealth ${r.status}`);
    return r.json();
  },
};

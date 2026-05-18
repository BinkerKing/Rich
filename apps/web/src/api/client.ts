import type {
  Element, Relation, LearningPath, PathKind, RichnessLevel, Signal, QARecord, Annotation, AnnotationKind,
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

export interface SectionRefineResult {
  section: { id: string; title: string; blocks: unknown[] };
}

export type AttachOption =
  | { kind: "new-topic"; confidence: "low"|"medium"|"high"; reasoning: string }
  | { kind: "attach-direct"; parentId: string; confidence: "low"|"medium"|"high"; reasoning: string }
  | { kind: "attach-with-bridge"; parentId: string; bridges: string[]; confidence: "low"|"medium"|"high"; reasoning: string };

export interface AnalyzeInputResult {
  /** Clean, title-ready noun phrase distilled by AI from the raw user input. */
  topic: string;
  keywords: string[];
  intent: string;
  type: string;
  candidates: Array<{ id: string; title: string; type: string; subtitle?: string; parentPath: string[]; tags?: string[] }>;
  options: AttachOption[];
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
  refineStream(elementId: string, targetRichness?: RichnessLevel, direction?: string, model?: Model) {
    return sseStream<RefineResult>("/ai/refine", { elementId, targetRichness, direction, model });
  },
  feedbackStream(elementId: string, feedback: string, model?: Model) {
    return sseStream<RefineResult>("/ai/feedback", { elementId, feedback, model });
  },
  sectionFeedbackStream(elementId: string, sectionId: string, feedback: string, model?: Model) {
    return sseStream<SectionRefineResult>("/ai/section-feedback", { elementId, sectionId, feedback, model });
  },
  async analyzeInput(text: string, model?: Model): Promise<AnalyzeInputResult> {
    const res = await fetch("/api/ai/analyze-input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, model }),
    });
    if (!res.ok) throw new Error(`analyze-input failed: ${res.status}`);
    return await res.json() as AnalyzeInputResult;
  },
  expandStream(elementId: string, count?: number, direction?: string, model?: Model) {
    return sseStream<ElementsAndRelationsResult>("/ai/expand", { elementId, count, direction, model });
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
  async deleteElement(id: string): Promise<{ removed: string[] }> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`deleteElement ${r.status}`);
    return r.json();
  },
  async moveElement(id: string, newParentId: string | null): Promise<{ id: string; newParentId: string | null }> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newParentId }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error ?? `moveElement ${r.status}`);
    }
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

  // ----- signals -----
  async listSignals(opts: { elementId?: string; manual?: string; since?: string; limit?: number } = {}): Promise<Signal[]> {
    const qs = new URLSearchParams();
    if (opts.elementId) qs.set("elementId", opts.elementId);
    if (opts.manual) qs.set("manual", opts.manual);
    if (opts.since) qs.set("since", opts.since);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const q = qs.toString();
    const r = await fetch(`/api/signals${q ? `?${q}` : ""}`);
    if (!r.ok) throw new Error(`listSignals ${r.status}`);
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
  async getRichnessSpec(): Promise<Record<string, { label: string; structure: string; content: string }>> {
    const r = await fetch("/api/ai/richness-spec");
    if (!r.ok) throw new Error(`getRichnessSpec ${r.status}`);
    return r.json();
  },

  // ----- Q&A -----
  async listQA(elementId: string): Promise<QARecord[]> {
    const r = await fetch(`/api/ai/qa?elementId=${encodeURIComponent(elementId)}`);
    if (!r.ok) throw new Error(`listQA ${r.status}`);
    return r.json();
  },
  askStream(input: {
    elementId: string;
    question: string;
    anchor?: { type: "section"; sectionId: string } | { type: "annotation"; annotationId: string } | { type: "element" };
    contextText?: string;
    model?: Model;
  }) {
    return sseStream<{ qa: QARecord }>("/ai/ask", input);
  },
  async deleteQA(id: string): Promise<void> {
    const r = await fetch(`/api/ai/qa/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`deleteQA ${r.status}`);
  },

  // ----- annotations (user text marks) -----
  async listAnnotations(elementId: string): Promise<Annotation[]> {
    const r = await fetch(`/api/annotations?elementId=${encodeURIComponent(elementId)}`);
    if (!r.ok) throw new Error(`listAnnotations ${r.status}`);
    return r.json();
  },
  async createAnnotation(input: {
    elementId: string;
    kind: AnnotationKind;
    text: string;
    contextBefore?: string;
    contextAfter?: string;
    note?: string;
  }): Promise<Annotation> {
    const r = await fetch("/api/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) throw new Error(`createAnnotation ${r.status}`);
    return r.json();
  },
  async deleteAnnotation(id: string): Promise<void> {
    const r = await fetch(`/api/annotations/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`deleteAnnotation ${r.status}`);
  },
  analyzeMarkStream(input: {
    elementId: string;
    markedText: string;
    annotationId?: string;
    contextBefore?: string;
    contextAfter?: string;
    hint?: string;
    model?: Model;
  }) {
    return sseStream<{ title: string; body: string }>("/ai/analyze-mark", input);
  },
};

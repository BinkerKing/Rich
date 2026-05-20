import type {
  Element, Relation, LearningPath, PathKind, RichnessLevel, Signal, QARecord, Annotation, AnnotationKind, MindmapDeckView,
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
  attachUnderStream(parentId: string, args: {
    mode: "leaf" | "chain";
    leafTitle?: string;
    chain?: string[];
    fullIntent: string;
    richness?: RichnessLevel;
  }, model?: Model) {
    return sseStream<ElementsAndRelationsResult>("/ai/attach-under", { parentId, ...args, model });
  },
  // ----- Mindmap PPT decks (element-backed) -----
  // Every deck IS an element with a `mindmap-embed` section. The list and
  // detail endpoints reconstruct the deck view (incl. indented markdown
  // source) from the element subtree on every call, so PPTs auto-reflect
  // edits to the underlying elements.
  async listMindmaps(): Promise<MindmapDeckView[]> {
    const r = await fetch("/api/mindmaps");
    if (!r.ok) throw new Error(`list mindmaps failed: ${r.status}`);
    return await r.json() as MindmapDeckView[];
  },
  async getMindmap(elementId: string): Promise<MindmapDeckView> {
    const r = await fetch(`/api/mindmaps/${encodeURIComponent(elementId)}`);
    if (!r.ok) throw new Error(`get mindmap failed: ${r.status}`);
    return await r.json() as MindmapDeckView;
  },
  /** Attach the PPT section to an existing element. Returns the deck view. */
  async attachMindmap(elementId: string, caption?: string): Promise<MindmapDeckView> {
    const r = await fetch("/api/mindmaps/attach", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ elementId, caption }),
    });
    if (!r.ok) throw new Error(`attach mindmap failed: ${r.status}`);
    return await r.json() as MindmapDeckView;
  },
  /** Re-trigger image generation for the PPT cover on the embed identified by
   *  (elementId, deckRootId). Optional `hint` is a free-form description that
   *  gets injected into the image prompt at top priority. */
  async retryMindmapCover(elementId: string, deckRootId: string, hint?: string): Promise<void> {
    const r = await fetch(`/api/mindmaps/${encodeURIComponent(elementId)}/retry-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckRootId, hint: hint?.trim() || undefined }),
    });
    if (!r.ok) throw new Error(`retry mindmap cover failed: ${r.status}`);
  },
  /** Toggle whether this deck appears in the mindmap list view. Per-deck. */
  async toggleMindmapHidden(elementId: string, deckRootId: string): Promise<{ hidden: boolean }> {
    const r = await fetch(`/api/mindmaps/${encodeURIComponent(elementId)}/toggle-hidden`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckRootId }),
    });
    if (!r.ok) throw new Error(`toggle mindmap hidden failed: ${r.status}`);
    return await r.json() as { hidden: boolean };
  },
  /** Toggle "image disabled" for this element in the given deck. */
  async toggleMindmapImageDisabled(elementId: string, deckRootId: string): Promise<{ imageDisabled: boolean }> {
    const r = await fetch(`/api/mindmaps/${encodeURIComponent(elementId)}/toggle-image-disabled`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckRootId }),
    });
    if (!r.ok) throw new Error(`toggle mindmap image-disabled failed: ${r.status}`);
    return await r.json() as { imageDisabled: boolean };
  },
  /** Toggle "text disabled" for this element in the given deck. */
  async toggleMindmapTextDisabled(elementId: string, deckRootId: string): Promise<{ textDisabled: boolean }> {
    const r = await fetch(`/api/mindmaps/${encodeURIComponent(elementId)}/toggle-text-disabled`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckRootId }),
    });
    if (!r.ok) throw new Error(`toggle mindmap text-disabled failed: ${r.status}`);
    return await r.json() as { textDisabled: boolean };
  },
  /** Detach this element from the given deck. When elementId === deckRootId,
   *  also removes the deck's embeds from every descendant. */
  async detachMindmap(elementId: string, deckRootId: string): Promise<void> {
    const r = await fetch(`/api/mindmaps/${encodeURIComponent(elementId)}/detach`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckRootId }),
    });
    if (!r.ok && r.status !== 404) throw new Error(`detach mindmap failed: ${r.status}`);
  },
  /** Prose → AI → new element tree + PPT section. Server streams progress;
   *  on `materialized` event the new tree is committed and `rootElementId`
   *  is returned via the wrapped done payload. */
  generateMindmapStream(args: {
    prose: string; titleHint?: string; audience?: string; model?: Model;
  }) {
    return sseStream<{ title: string; subtitle?: string; source: string; images: unknown[] }>(
      "/mindmaps/generate", args,
    );
  },
  // ----- AI 早报 daily news generation -----
  // Streams progress; "materialized" event on success carries the new roundup id.
  generateDailyNewsStream(date?: string, model?: Model) {
    return sseStream<{ date: string; editorNote: string; items: unknown[] }>(
      "/ai/news/generate-daily",
      { date, model },
    );
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
  async createElement(input: {
    title: string;
    type?: string;
    subtitle?: string;
    parentId?: string;
  }): Promise<{ element: Element; relation: Relation | null }> {
    const r = await fetch("/api/elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`createElement ${r.status}: ${t}`);
    }
    return r.json();
  },
  async patchElement(id: string, patch: { title?: string; subtitle?: string; type?: string; difficulty?: "low" | "mid" | "high" | null }): Promise<Element> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`patchElement ${r.status}: ${t}`);
    }
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

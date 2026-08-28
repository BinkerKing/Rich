import type {
  Element, Relation, LearningPath, PathKind, RichnessLevel, Signal, QARecord, Annotation, AnnotationKind, MindmapDeckView,
} from "@ke/domain";

// ---------- shared SSE plumbing ----------

export type AiStreamEvent<TResult> =
  | { type: "delta"; text: string }
  | { type: "done"; result: TResult }
  | { type: "error"; message: string };

export type ProjectDictionaryTestFileMeta = {
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  downloadUrl: string;
};

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

async function projectFolderAction(projectId: string, action: "move" | "rename" | "delete" | "open" | "ignore" | "reveal", body: Record<string, unknown>): Promise<void> {
  const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/folder/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const payload = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error ?? `${action}ProjectFolderEntry ${r.status}`);
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

export type Model = "hermes" | "claude-code" | "codex" | "bailian";

export type GreatMeMode = "goal" | "mission" | "review" | "week-simulation";

export interface GreatMeBrainResult {
  mode: GreatMeMode;
  title: string;
  summary: string;
  focus: string;
  risks: string[];
  nextActions: string[];
  missions: Array<{
    title: string;
    lane: string;
    impact: number;
    effort: number;
    reason?: string;
  }>;
  pdca: Partial<Record<"plan" | "do" | "check" | "act", string>>;
  axisAdjustments: Array<{
    axis: "body" | "mind" | "wealth" | "craft" | "relations" | "creation";
    delta: number;
    reason: string;
  }>;
  weekSimulation: Array<{
    day: number;
    theme: string;
    mission: string;
    evidence: string;
    review: string;
  }>;
}

export const api = {
  // ----- generate-tree -----
  generateTreeStream(topic: string, model?: Model, richness?: RichnessLevel) {
    return sseStream<GenerateTreeResult>("/ai/generate-tree", { topic, model, richness });
  },

  async greatMeBrain(input: {
    mode: GreatMeMode;
    text?: string;
    state: unknown;
    model?: Model;
  }): Promise<{ adapter: string; result: GreatMeBrainResult }> {
    const r = await fetch("/api/ai/great-me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: input.mode,
        input: input.text ?? "",
        state: input.state,
        model: input.model,
      }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string; adapter?: string };
      throw new Error(body.error ?? `great-me failed: ${r.status}`);
    }
    return await r.json() as { adapter: string; result: GreatMeBrainResult };
  },

  // ----- great-me persisted state -----
  /** Load the persisted GreatMe cockpit state. Returns null if nothing saved
   *  server-side yet (first run / fresh install). */
  async getGreatMeState<T>(): Promise<T | null> {
    const r = await fetch("/api/great-me/state");
    if (!r.ok) throw new Error(`get great-me state failed: ${r.status}`);
    const body = await r.json() as { state: T | null };
    return body.state;
  },
  /** Save the GreatMe cockpit state. Server validates shape + size cap.
   *  Phase 1 (多设备并发安全): server returns 409 when client's `version`
   *  field doesn't match server's stored version. Caller should refetch
   *  + reconcile. Returns `{ ok: true, version }` on success or
   *  `{ conflict: true, current, currentVersion }` on 409. */
  async saveGreatMeState(state: unknown): Promise<
    | { ok: true; version: number }
    | { conflict: true; current: unknown; currentVersion: number }
  > {
    const r = await fetch("/api/great-me/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    if (r.status === 409) {
      const body = await r.json().catch(() => ({})) as { current?: unknown; currentVersion?: number };
      return { conflict: true, current: body.current ?? null, currentVersion: body.currentVersion ?? 0 };
    }
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `save great-me state failed: ${r.status}`);
    }
    const body = await r.json().catch(() => ({})) as { ok?: true; version?: number };
    return { ok: true, version: body.version ?? 0 };
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

  // ----- 项目实战 helpers -----
  /** 创建一个 type=practice 的实战项目元 + 4 个默认分组（知识点/需求分析/PRD/开发任务）。
   *  自动带 "实战项目" 标签 → 在 项目实战 页可见。
   *  分组本身是 type=group 的子元，可以改名、删、加。 */
  async createPracticeElement(input: { title: string; subtitle?: string }): Promise<Element> {
    const r = await fetch("/api/elements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        subtitle: input.subtitle,
        type: "practice",
        tags: ["实战项目"],
      }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `createPracticeElement ${r.status}`);
    }
    const { element: practice } = await r.json() as { element: Element };
    // 顺序创建 7 个默认分组（顺序保留 = 创建顺序 = UI 渲染顺序）
    const defaults = ["知识点", "场景分析", "功能说明", "PRD", "开发任务", "整改建议", "提问"];
    for (const groupTitle of defaults) {
      await fetch("/api/elements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: groupTitle,
          type: "group",
          parentId: practice.id,
        }),
      });
    }
    return practice;
  },
  /** 在指定 group 元下创建一个子元 (项目实战专属类型)。
   *  parentId 应该是 group 元的 id，不是 practice 元本身。
   *  type 枚举跟分组对应：knowledge=知识点 / requirement=场景分析 / feature=功能说明 / prd=PRD / dev-task=开发任务 / revision=整改建议。 */
  async createPracticeChild(input: {
    parentId: string;
    type: "knowledge" | "requirement" | "feature" | "prd" | "dev-task" | "revision" | "inquiry";
    title: string;
    subtitle?: string;
    content?: unknown;
  }): Promise<Element> {
    const r = await fetch("/api/elements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        subtitle: input.subtitle,
        type: input.type,
        parentId: input.parentId,
        content: input.content,
        ...(input.type === "dev-task" ? { status: "todo" } : {}),
      }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `createPracticeChild ${r.status}`);
    }
    const result = await r.json() as { element: Element };
    return result.element;
  },
  /** 在指定 practice 下新建一个分组 */
  async createPracticeGroup(input: { practiceId: string; title: string }): Promise<Element> {
    const r = await fetch("/api/elements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        type: "group",
        parentId: input.practiceId,
      }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `createPracticeGroup ${r.status}`);
    }
    const result = await r.json() as { element: Element };
    return result.element;
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
    content?: unknown;
    status?: "todo" | "doing" | "done";
    tags?: string[];
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
  async patchElement(id: string, patch: {
    title?: string;
    subtitle?: string;
    type?: string;
    difficulty?: "low" | "mid" | "high" | null;
    /** 项目实战：开发任务的 status 字段 */
    status?: "todo" | "doing" | "done" | null;
    /** 项目实战：替换 content 整体（PRD / drawer 编辑用） */
    content?: unknown;
    /** 项目实战开关：tags 里有 "实战项目" 就在 项目实战 列表显示 */
    tags?: string[] | null;
  }): Promise<Element> {
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
  /** Replace element.content.sections with the given array. Other content
   *  fields and metadata are preserved (server only touches sections). */
  async putElementSections(id: string, sections: unknown[]): Promise<Element> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}/sections`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`putElementSections ${r.status}: ${t}`);
    }
    return r.json();
  },
  /** Upload one or more files as attachments of an element. Server saves
   *  them under `data/attachments/<elementId>/` and returns the list of
   *  served URLs. The caller is responsible for splicing the result into
   *  the AttachmentsBlock and persisting the element sections. */
  async uploadAttachments(elementId: string, files: File[]): Promise<Array<{ name: string; src: string; size: number }>> {
    if (files.length === 0) return [];
    const form = new FormData();
    for (const f of files) form.append("files", f, f.name);
    const r = await fetch(`/api/attachments/${encodeURIComponent(elementId)}`, {
      method: "POST",
      body: form,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`uploadAttachments ${r.status}: ${t}`);
    }
    const json = await r.json() as { files: Array<{ name: string; src: string; size: number }> };
    return json.files;
  },
  async getProjectDictionaryTestFile(projectId: string, tableId: string): Promise<ProjectDictionaryTestFileMeta | null> {
    const r = await fetch(`/api/project-dictionary-test-files/${encodeURIComponent(projectId)}/${encodeURIComponent(tableId)}`);
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`getProjectDictionaryTestFile ${r.status}: ${t}`);
    }
    const json = await r.json() as { file: ProjectDictionaryTestFileMeta | null };
    return json.file;
  },
  async uploadProjectDictionaryTestFile(projectId: string, tableId: string, file: File): Promise<ProjectDictionaryTestFileMeta> {
    const form = new FormData();
    form.append("file", file, file.name);
    const r = await fetch(`/api/project-dictionary-test-files/${encodeURIComponent(projectId)}/${encodeURIComponent(tableId)}`, {
      method: "POST",
      body: form,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`uploadProjectDictionaryTestFile ${r.status}: ${t}`);
    }
    const json = await r.json() as { file: ProjectDictionaryTestFileMeta };
    return json.file;
  },
  /** Remove a previously uploaded attachment. */
  async deleteAttachment(elementId: string, filename: string): Promise<void> {
    const r = await fetch(`/api/attachments/${encodeURIComponent(elementId)}/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    if (!r.ok && r.status !== 404) {
      const t = await r.text().catch(() => "");
      throw new Error(`deleteAttachment ${r.status}: ${t}`);
    }
  },
  /** Trigger one-shot legacy → sections[] migration on the server. Idempotent. */
  async migrateElementToSections(id: string): Promise<Element> {
    const r = await fetch(`/api/elements/${encodeURIComponent(id)}/sections/migrate`, {
      method: "POST",
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`migrateElementToSections ${r.status}: ${t}`);
    }
    return r.json();
  },
  /** Reorder direct children under a parent. The list is the desired full
   *  display order. Children omitted from the list keep their relative order
   *  and get appended at the end (defensive). */
  async reorderChildren(parentId: string, childIds: string[]): Promise<void> {
    const r = await fetch("/api/relations/reorder-children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, childIds }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`reorderChildren ${r.status}: ${t}`);
    }
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

  // ----- 项目管理 · 文件夹 -----
  async scanProjectFolder(projectId: string, maxDepth = 1000): Promise<ProjectFolderScanResult> {
    const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/folder/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxDepth }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`scanProjectFolder ${r.status}: ${t.slice(0, 200)}`);
    }
    return r.json();
  },
  async probeConnections(connections: Array<{ id: string; ip: string; port: number }>): Promise<ProbeConnectionsResult> {
    const r = await fetch(`/api/projects/probe-connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connections }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`probeConnections ${r.status}: ${t.slice(0, 200)}`);
    }
    return r.json();
  },
  async mkdirsInProjectFolder(projectId: string, paths: string[]): Promise<ProjectFolderMkdirsResult> {
    const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/folder/mkdirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`mkdirsInProjectFolder ${r.status}: ${t.slice(0, 200)}`);
    }
    return r.json();
  },
  async moveProjectFolderEntry(projectId: string, itemId: string, targetDirectoryId: string): Promise<void> {
    await projectFolderAction(projectId, "move", { itemId, targetDirectoryId });
  },
  async renameProjectFolderEntry(projectId: string, itemId: string, name: string): Promise<void> {
    await projectFolderAction(projectId, "rename", { itemId, name });
  },
  async deleteProjectFolderEntry(projectId: string, itemId: string): Promise<void> {
    await projectFolderAction(projectId, "delete", { itemId });
  },
  async openProjectFolderFile(projectId: string, itemId: string): Promise<void> {
    await projectFolderAction(projectId, "open", { itemId });
  },
  async setProjectFolderIgnored(projectId: string, itemId: string, ignored: boolean): Promise<void> {
    await projectFolderAction(projectId, "ignore", { itemId, ignored });
  },
  async revealProjectFolderEntry(projectId: string, itemId: string): Promise<void> {
    await projectFolderAction(projectId, "reveal", { itemId });
  },

  // ----- 项目管理 · 新领域模块 -----
  async getProjectManagementSummary(projectId: string): Promise<ProjectManagementSummary> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/summary`);
    if (!r.ok) throw new Error(`getProjectManagementSummary ${r.status}`);
    return r.json();
  },
  async getProjectDescription(projectId: string): Promise<ProjectDescription> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/description`);
    if (!r.ok) throw new Error(`getProjectDescription ${r.status}`);
    return r.json();
  },
  async saveProjectDescription(projectId: string, html: string): Promise<ProjectDescription> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/description`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html }),
    });
    if (!r.ok) throw new Error(`saveProjectDescription ${r.status}`);
    return r.json();
  },
  async searchProjectManagement(projectId: string, query: string, limit = 30): Promise<ProjectManagementSearchResult> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/search?${params.toString()}`);
    if (!r.ok) throw new Error(`searchProjectManagement ${r.status}`);
    return r.json();
  },
  async listProjectManagementModuleItems(
    projectId: string,
    moduleKey: ProjectManagementModuleKey,
    parentId?: string,
    all = false,
  ): Promise<ProjectModuleItem[]> {
    const params = new URLSearchParams();
    if (parentId) params.set("parentId", parentId);
    if (all) params.set("all", "1");
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleKey)}/items${suffix}`);
    if (!r.ok) throw new Error(`listProjectManagementModuleItems ${r.status}`);
    return r.json();
  },
  async createProjectManagementModuleItem(
    projectId: string,
    moduleKey: ProjectManagementModuleKey,
    input: ProjectModuleItemInput,
  ): Promise<ProjectModuleItem> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleKey)}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) throw new Error(`createProjectManagementModuleItem ${r.status}`);
    return r.json();
  },
  async updateProjectManagementModuleItem(
    projectId: string,
    itemId: string,
    patch: ProjectModuleItemPatch,
  ): Promise<ProjectModuleItem> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/modules/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`updateProjectManagementModuleItem ${r.status}`);
    return r.json();
  },
  async deleteProjectManagementModuleItem(projectId: string, itemId: string): Promise<void> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/modules/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`deleteProjectManagementModuleItem ${r.status}`);
  },
  async reorderProjectManagementModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, itemIds: string[]): Promise<void> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleKey)}/reorder`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemIds }),
    });
    if (!r.ok) throw new Error(`reorderProjectManagementModuleItems ${r.status}`);
  },
  async listProjectAutomationPlans(projectId: string): Promise<ProjectAutomationPlan[]> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans`);
  },
  async createProjectAutomationPlan(projectId: string, input: { name: string; description?: string }): Promise<ProjectAutomationPlan> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans`, { method: "POST", body: JSON.stringify(input) });
  },
  async getProjectAutomationPlan(projectId: string, planId: string): Promise<ProjectAutomationPlanDetail> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}`);
  },
  async checkProjectAutomationPlan(projectId: string, planId: string): Promise<ProjectAutomationPlanInspection> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}/check`, { method: "POST" });
  },
  async deleteProjectAutomationPlan(projectId: string, planId: string): Promise<void> {
    await projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}`, { method: "DELETE" });
  },
  async createProjectAutomationGroup(projectId: string, planId: string, input: { name: string; sortOrder?: number }): Promise<ProjectAutomationGroup> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}/groups`, { method: "POST", body: JSON.stringify(input) });
  },
  async deleteProjectAutomationGroup(projectId: string, groupId: string): Promise<void> {
    await projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });
  },
  async reorderProjectAutomationGroups(projectId: string, planId: string, groupIds: string[]): Promise<void> {
    await projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}/groups/reorder`, { method: "POST", body: JSON.stringify({ groupIds }) });
  },
  async addProjectAutomationItem(projectId: string, planId: string, groupId: string, tableId: string): Promise<ProjectAutomationItem> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}/groups/${encodeURIComponent(groupId)}/items`, { method: "POST", body: JSON.stringify({ tableId }) });
  },
  async removeProjectAutomationItem(projectId: string, itemId: string): Promise<void> {
    await projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
  },
  async reorderProjectAutomationItems(projectId: string, groupId: string, itemIds: string[]): Promise<void> {
    await projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/groups/${encodeURIComponent(groupId)}/items/reorder`, { method: "POST", body: JSON.stringify({ itemIds }) });
  },
  async listProjectAutomationRuns(projectId: string, planId: string): Promise<ProjectAutomationRun[]> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}/runs`);
  },
  async startProjectAutomationRun(projectId: string, planId: string, runtimeParams: Record<string, unknown> = {}): Promise<ProjectAutomationRun> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/plans/${encodeURIComponent(planId)}/runs`, { method: "POST", body: JSON.stringify({ runtimeParams }) });
  },
  async getProjectAutomationRun(projectId: string, runId: string): Promise<ProjectAutomationRun> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/runs/${encodeURIComponent(runId)}`);
  },
  async resumeProjectAutomationRun(projectId: string, runId: string, runtimeParams: Record<string, unknown> = {}): Promise<ProjectAutomationRun> {
    return projectAutomationRequest(`/api/project-management/${encodeURIComponent(projectId)}/automation/runs/${encodeURIComponent(runId)}/resume`, { method: "POST", body: JSON.stringify({ runtimeParams }) });
  },
  async listProjectDictionarySystems(projectId: string): Promise<ProjectDictionarySystem[]> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/systems`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listProjectDictionarySystems ${r.status}`);
    return r.json();
  },
  async updateProjectDictionarySystem(projectId: string, systemId: string, patch: ProjectDictionarySystemPatch): Promise<ProjectDictionarySystem> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/systems/${encodeURIComponent(systemId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`updateProjectDictionarySystem ${r.status}`);
    return r.json();
  },
  async testProjectDictionarySystemConnection(projectId: string, systemId: string, patch: ProjectDictionarySystemPatch): Promise<ProjectDictionaryConnectionTestResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/systems/${encodeURIComponent(systemId)}/entity/test-connection`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `testProjectDictionarySystemConnection ${r.status}`);
    }
    return r.json();
  },
  async listProjectDictionaryTables(projectId: string, systemId?: string): Promise<ProjectDictionaryTable[]> {
    const params = new URLSearchParams();
    if (systemId) params.set("systemId", systemId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables${suffix}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listProjectDictionaryTables ${r.status}`);
    return r.json();
  },
  async listProjectDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/fields`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listProjectDictionaryFields ${r.status}`);
    return r.json();
  },
  async listProjectDictionaryMappingTempTables(projectId: string, tableId: string): Promise<ProjectDictionaryMappingTempTable[]> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/mapping/temp-tables`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listProjectDictionaryMappingTempTables ${r.status}`);
    return r.json();
  },
  async listProjectDictionaryMappingScenarios(projectId: string, tableId: string): Promise<ProjectDictionaryMappingScenario[]> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/mapping/scenarios`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listProjectDictionaryMappingScenarios ${r.status}`);
    return r.json();
  },
  async replaceProjectDictionaryMappingTempTables(
    projectId: string,
    tableId: string,
    tempTables: ProjectDictionaryMappingTempTableInput[],
  ): Promise<ProjectDictionaryMappingTempTable[]> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/mapping/temp-tables`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tempTables }),
    });
    if (!r.ok) throw new Error(`replaceProjectDictionaryMappingTempTables ${r.status}`);
    return r.json();
  },
  async createProjectDictionaryEntityTable(projectId: string, tableId: string): Promise<ProjectDictionaryEntitySyncResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/create`, { method: "POST" });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `createProjectDictionaryEntityTable ${r.status}`);
    }
    return r.json();
  },
  async inspectProjectDictionaryEntitySchema(projectId: string, tableId: string): Promise<ProjectDictionaryEntitySchemaStatusResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/schema`, { method: "POST" });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `inspectProjectDictionaryEntitySchema ${r.status}`);
    }
    return r.json();
  },
  async writeProjectDictionaryEntityTestData(
    projectId: string,
    tableId: string,
    rows: Array<Record<string, unknown>>,
  ): Promise<ProjectDictionaryEntitySyncResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/test-data`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `writeProjectDictionaryEntityTestData ${r.status}`);
    }
    return r.json();
  },
  async replaceProjectDictionaryEntityTestData(
    projectId: string,
    tableId: string,
    rows: Array<Record<string, unknown>>,
  ): Promise<ProjectDictionaryEntitySyncResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/test-data/replace`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `replaceProjectDictionaryEntityTestData ${r.status}`);
    }
    return r.json();
  },
  async queryProjectDictionaryEntityTestData(
    projectId: string,
    tableId: string,
    input: { page: number; pageSize: number; searchFieldId?: string; search?: string },
  ): Promise<ProjectDictionaryEntityTestDataQueryResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `queryProjectDictionaryEntityTestData ${r.status}`);
    }
    return r.json();
  },
  async extractProjectDictionaryEntityTestData(
    projectId: string,
    tableId: string,
    input: { limit?: number; runtimeParams?: Record<string, unknown> } = {},
  ): Promise<ProjectDictionaryEntityExtractionJob> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `extractProjectDictionaryEntityTestData ${r.status}`);
    }
    return r.json();
  },
  async prepareProjectDictionaryEntityExtractionSql(
    projectId: string,
    tableId: string,
    input: { limit?: number; runtimeParams?: Record<string, unknown> } = {},
  ): Promise<ProjectDictionaryEntityExtractionPrepareResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/extract/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `prepareProjectDictionaryEntityExtractionSql ${r.status}`);
    }
    return r.json();
  },
  async getProjectDictionaryEntityExtractionJob(
    projectId: string,
    tableId: string,
    jobId: string,
  ): Promise<ProjectDictionaryEntityExtractionJob> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/entity/extract/${encodeURIComponent(jobId)}`);
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `getProjectDictionaryEntityExtractionJob ${r.status}`);
    }
    return r.json();
  },
  async validateProjectDictionaryMappingSql(
    projectId: string,
    tableId: string,
    input: { caliber?: string; fieldRules?: Array<{ fieldId: string; logic: string }>; runtimeParams?: Record<string, unknown> } = {},
  ): Promise<ProjectDictionaryMappingSqlValidationResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/mapping/sql-validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `validateProjectDictionaryMappingSql ${r.status}`);
    }
    return r.json();
  },
  async validateProjectDictionaryTempTableSql(
    projectId: string,
    tableId: string,
    tempTableId: string,
    input: { runtimeParams?: Record<string, unknown> } = {},
  ): Promise<ProjectDictionaryMappingSqlValidationResult> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/tables/${encodeURIComponent(tableId)}/temp-tables/${encodeURIComponent(tempTableId)}/sql-validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error || `validateProjectDictionaryTempTableSql ${r.status}`);
    }
    return r.json();
  },
  async resolveProjectDictionaryFieldRefs(projectId: string, refs: string[]): Promise<ProjectDictionaryFieldHit[]> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/fields/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refs }),
    });
    if (!r.ok) throw new Error(`resolveProjectDictionaryFieldRefs ${r.status}`);
    const data = await r.json() as { results?: ProjectDictionaryFieldHit[] };
    return data.results ?? [];
  },
  async searchProjectDictionaryFields(projectId: string, query: string, limit = 30): Promise<ProjectDictionaryFieldSearchResult> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/fields/search?${params.toString()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`searchProjectDictionaryFields ${r.status}`);
    return r.json();
  },
  async getProjectDictionaryField(projectId: string, fieldId: string): Promise<ProjectDictionaryFieldDetail> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/fields/${encodeURIComponent(fieldId)}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`getProjectDictionaryField ${r.status}`);
    return r.json();
  },
  async listProjectDictionaryRectifications(projectId: string): Promise<ProjectDictionaryRectification[]> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/rectifications`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listProjectDictionaryRectifications ${r.status}`);
    return r.json();
  },
  async createProjectDictionaryRectification(
    projectId: string,
    input: ProjectDictionaryRectificationInput,
  ): Promise<ProjectDictionaryRectification> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/rectifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) throw new Error(`createProjectDictionaryRectification ${r.status}`);
    return r.json();
  },
  async updateProjectDictionaryRectification(
    projectId: string,
    rectificationId: string,
    patch: ProjectDictionaryRectificationPatch,
  ): Promise<ProjectDictionaryRectification> {
    const r = await fetch(`/api/project-management/${encodeURIComponent(projectId)}/dictionary/rectifications/${encodeURIComponent(rectificationId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`updateProjectDictionaryRectification ${r.status}`);
    return r.json();
  },
};

async function projectAutomationRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init.body ? { "content-type": "application/json", ...init.headers } : init.headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `数据自动化请求失败 (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export interface ProjectFolderNode {
  path: string;
  name: string;
  kind: "dir" | "file";
  size: number;
  children?: ProjectFolderNode[];
  truncated?: boolean;
  ignored?: boolean;
  ext?: string;
  mtime?: string;
}
export interface ProjectFolderScanResult {
  rootPath: string;
  scannedAt: string;
  totalNodes: number;
  totalFiles: number;
  totalDirs: number;
  totalSize: number;
  extStats: Array<{ ext: string; count: number; totalBytes: number }>;
  root: ProjectFolderNode;
  warnings: string[];
  records?: { created: number; updated: number; removed: number; total: number };
}
export interface ProjectFolderMkdirsResult {
  created: string[];
  skipped: Array<{ path: string; reason: string }>;
  count: number;
  manual?: { path: string; created: boolean };
}

export type ProjectManagementModuleKey =
  | "description"
  | "dictionary"
  | "automation"
  | "workflow"
  | "scenarios"
  | "environments"
  | "deploymentSteps"
  | "monitoring"
  | "codeVersions"
  | "todos"
  | "healthChecks"
  | "folder";

export type ProjectAutomationStep = "validate_sql" | "sync_table" | "prepare_extraction" | "extract";
export type ProjectAutomationExecutionStatus = "pending" | "running" | "success" | "error";

export interface ProjectAutomationPlan {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAutomationItem {
  id: string;
  projectId: string;
  planId: string;
  groupId: string;
  tableId: string;
  tableName: string;
  tableCn?: string;
  systemId?: string;
  systemName?: string;
  sortOrder: number;
}

export interface ProjectAutomationGroup {
  id: string;
  projectId: string;
  planId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  items: ProjectAutomationItem[];
}

export interface ProjectAutomationPlanDetail extends ProjectAutomationPlan {
  groups: ProjectAutomationGroup[];
}

export interface ProjectAutomationPlanInspection {
  planId: string;
  ready: boolean;
  checkedAt: string;
  parameters: Array<{ name: string; types: string[]; tableIds: string[] }>;
  items: Array<{
    tableId: string;
    tableName: string;
    groupId: string;
    groupName: string;
    ready: boolean;
    parameterNames: string[];
    message?: string;
    error?: string;
  }>;
}

export interface ProjectAutomationRunItem {
  id: string;
  tableId: string;
  tableName: string;
  groupId: string;
  groupName: string;
  groupOrder: number;
  itemOrder: number;
  status: ProjectAutomationExecutionStatus;
  steps: Array<{ step: ProjectAutomationStep; status: ProjectAutomationExecutionStatus; error?: string; startedAt?: string; finishedAt?: string }>;
  affectedRows?: number;
  failedStep?: ProjectAutomationStep;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ProjectAutomationRun {
  id: string;
  projectId: string;
  planId: string;
  planName: string;
  status: "running" | "paused" | "success";
  error?: string;
  startedAt: string;
  finishedAt?: string;
  updatedAt: string;
  runtimeParams?: Record<string, unknown>;
  items: ProjectAutomationRunItem[];
}

export interface ProjectManagementSummary {
  projectId: string;
  modules: Array<{ key: ProjectManagementModuleKey; label: string; count: number }>;
  dictionary: {
    systems: number;
    tables: number;
    fields: number;
  };
}

export interface ProjectManagementSearchHit {
  id: string;
  moduleKey: ProjectManagementModuleKey;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  score: number;
  updatedAt: string;
  destination: ProjectManagementSearchDestination;
}

export interface ProjectManagementSearchDestination {
  section: ProjectManagementModuleKey;
  entityType: string;
  entityId: string;
  systemId?: string;
  tableId?: string;
}

export interface ProjectManagementSearchResult {
  query: string;
  results: ProjectManagementSearchHit[];
}

export interface ProjectDescription {
  projectId: string;
  html: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectModuleItem {
  id: string;
  projectId: string;
  moduleKey: ProjectManagementModuleKey;
  parentId?: string;
  title: string;
  subtitle?: string;
  sortOrder: number;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectModuleItemInput {
  parentId?: string | null;
  title: string;
  subtitle?: string | null;
  sortOrder?: number;
  content?: Record<string, unknown>;
}

export interface ProjectModuleItemPatch {
  parentId?: string | null;
  title?: string;
  subtitle?: string | null;
  sortOrder?: number;
  content?: Record<string, unknown>;
}

export interface ProjectDictionarySystem {
  id: string;
  code: string;
  name: string;
  type?: string;
  assetLayer?: string;
  extra?: Record<string, unknown>;
  dbType?: ProjectDictionaryDatabaseType;
  sqlDialect?: ProjectDictionarySqlDialect;
  connection?: ProjectDictionaryConnectionConfig;
  entitySyncPolicy?: ProjectDictionaryEntitySyncPolicy;
  fieldCount: number;
  tableCount: number;
}

export type ProjectDictionaryDatabaseType = "postgresql" | "sqlserver" | "unknown";
export type ProjectDictionarySqlDialect = "postgresql" | "sqlserver";
export type ProjectDictionaryEntitySyncPolicy = "metadata_only" | "create_schema_allowed" | "create_table_allowed" | "insert_test_data_allowed" | "readonly";

export interface ProjectDictionaryConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  username?: string;
  password?: string;
  secretRef?: string;
  ssl?: boolean;
}

export interface ProjectDictionarySystemPatch {
  type?: string | null;
  assetLayer?: string | null;
  extra?: Record<string, unknown>;
}

export interface ProjectDictionaryConnectionTestResult {
  ok: true;
  dialect: ProjectDictionarySqlDialect;
  database: string;
  schema?: string;
  schemaExists?: boolean;
  message: string;
}

export interface ProjectDictionaryTable {
  id: string;
  systemId?: string;
  tableName: string;
  tableCn?: string;
  tableGroup?: string;
  dataLayer?: string;
  tableType?: string;
  sourceKind?: string;
  fileType?: string;
  hasMapping?: boolean;
  usageStatus?: string;
  verificationStatus?: "未验证" | "已验证" | "待整改";
  verificationRemark?: string;
  description?: string;
  caliber?: string;
  extra?: Record<string, unknown>;
  fieldCount: number;
}

export interface ProjectDictionaryEntitySyncResult {
  ok: true;
  dialect: "postgresql" | "sqlserver";
  tableName: string;
  sql: string;
  affectedRows?: number;
  message: string;
  validationIssues?: ProjectDictionaryExtractionValidationIssue[];
}

export interface ProjectDictionaryEntityExtractionJob {
  ok: true;
  id: string;
  projectId: string;
  tableId: string;
  status: "running" | "success" | "error";
  message: string;
  startedAt: string;
  finishedAt?: string;
  result?: ProjectDictionaryEntitySyncResult;
  error?: string;
}

export interface ProjectDictionaryEntityExtractionPrepareResult {
  ok: true;
  dialect: "postgresql" | "sqlserver";
  tableName: string;
  ready: boolean;
  sql: string;
  message: string;
  runtimeParamNames?: string[];
  runtimeParamTypes?: Record<string, string>;
  caliber: {
    status: "valid" | "invalid";
    sql?: string;
    error?: string;
  };
  validationIssues?: ProjectDictionaryExtractionValidationIssue[];
  statementError?: string;
}

export interface ProjectDictionaryMappingSqlValidationField {
  fieldId: string;
  fieldName: string;
  fieldCn?: string;
  logicFingerprint?: string;
  status: "valid" | "invalid" | "skipped";
  sql?: string;
  error?: string;
}

export interface ProjectDictionaryMappingSqlValidationResult {
  ok: boolean;
  dialect: "postgresql" | "sqlserver";
  sourceKind?: "file" | "database";
  message: string;
  caliber: {
    status: "valid" | "invalid";
    sql?: string;
    error?: string;
  };
  fields: ProjectDictionaryMappingSqlValidationField[];
}

export interface ProjectDictionaryMappingTempField {
  id: string;
  projectId: string;
  tempTableId: string;
  fieldName: string;
  fieldCn?: string;
  fieldType?: string;
  fieldLength?: string;
  logicText?: string;
  convertedSql?: string;
  remark?: string;
  verificationStatus?: "未验证" | "已验证" | "待整改";
  verificationRemark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingRuleSummary {
  id: string;
  fieldId?: string;
  logicText?: string;
  convertedSql?: string;
  remark?: string;
  verificationStatus?: "未验证" | "已验证" | "待整改";
  verificationRemark?: string;
  sortOrder: number;
}

export interface ProjectDictionaryMappingScenario {
  id: string;
  projectId: string;
  tableId: string;
  title: string;
  caliber?: string;
  remark?: string;
  sortOrder: number;
  rules: ProjectDictionaryMappingRuleSummary[];
}

export interface ProjectDictionaryMappingTempTable {
  id: string;
  projectId: string;
  targetTableId: string;
  tableName: string;
  tableCn?: string;
  logicText?: string;
  convertedSql?: string;
  remark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  fields: ProjectDictionaryMappingTempField[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingTempFieldInput {
  id?: string;
  fieldName: string;
  fieldCn?: string | null;
  fieldType?: string | null;
  fieldLength?: string | null;
  logicText?: string | null;
  convertedSql?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
}

export interface ProjectDictionaryMappingTempTableInput {
  id?: string;
  tableName: string;
  tableCn?: string | null;
  logicText?: string | null;
  convertedSql?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
  fields?: ProjectDictionaryMappingTempFieldInput[];
}

export interface ProjectDictionaryExtractionValidationIssue {
  kind: "invalid_rule" | "unsupported_op" | "missing_source" | "empty_required" | "evaluate_error";
  fieldId: string;
  fieldName: string;
  fieldCn?: string;
  message: string;
}

export interface ProjectDictionaryEntitySchemaIssue {
  kind: "missing" | "extra" | "type_mismatch";
  columnName: string;
  fieldName?: string;
  expectedType?: string;
  actualType?: string;
  message: string;
}

export interface ProjectDictionaryEntitySchemaStatusResult {
  ok: true;
  dialect: "postgresql" | "sqlserver";
  tableName: string;
  connectionOk: true;
  tableExists: boolean;
  schemaSynced: boolean;
  issues: ProjectDictionaryEntitySchemaIssue[];
  message: string;
}

export interface ProjectDictionaryEntityTestDataQueryResult {
  ok: true;
  dialect: "postgresql" | "sqlserver";
  tableName: string;
  page: number;
  pageSize: number;
  total: number;
  rows: Array<{ lineNumber: number; values: Record<string, unknown> }>;
  message: string;
}

export interface ProjectDictionaryCodeItem {
  id?: string;
  value: string;
  description: string;
  remark?: string;
  sortOrder?: number;
}

export interface ProjectDictionaryCodeSet {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  items: ProjectDictionaryCodeItem[];
}

export interface ProjectDictionaryFieldHit {
  id: string;
  systemId?: string;
  systemName?: string;
  systemCode?: string;
  tableId?: string;
  tableName?: string;
  tableCn?: string;
  fieldName: string;
  fieldCn?: string;
  fieldType?: string;
  fieldLength?: string;
  formatPattern?: string;
  carrierKind?: string;
  fieldOrder?: number;
  sourceFieldOrder?: number;
  description?: string;
  acquireLogic?: string;
  codeValue?: string;
  codeSetId?: string;
  codeSetName?: string;
  codeItems?: ProjectDictionaryCodeItem[];
  mappedTable?: string;
  mappedField?: string;
  mappedFieldCn?: string;
  remark?: string;
  verificationStatus?: "未验证" | "已验证" | "待整改";
  verificationRemark?: string;
  extra?: Record<string, unknown>;
  score: number;
}

export interface ProjectDictionaryFieldDetail extends ProjectDictionaryFieldHit {
  fieldLength?: string;
  formatPattern?: string;
  nullable?: string;
  primaryKey: boolean;
  required: boolean;
  validationRule?: string;
  codeValue?: string;
  mappedFieldCn?: string;
  dataSource?: string;
  remark?: string;
  tableDescription?: string;
  tableCaliber?: string;
  tableDataLayer?: string;
  tableSourceKind?: string;
  systemType?: string;
  systemAssetLayer?: string;
  systemDescription?: string;
  extra?: Record<string, unknown>;
}

export type ProjectDictionaryRectificationStatus = "open" | "fixed" | "verified" | "cancelled";

export interface ProjectDictionaryRectification {
  id: string;
  projectId: string;
  entityType: "library" | "table" | "field" | "codeSet" | "mapping";
  entityId: string;
  propertyKey: string;
  requirement: string;
  status: ProjectDictionaryRectificationStatus;
  resolutionNote?: string;
  createdBy?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ProjectDictionaryRectificationInput {
  entityType: ProjectDictionaryRectification["entityType"];
  entityId: string;
  propertyKey: string;
  requirement: string;
  createdBy?: string;
}

export interface ProjectDictionaryRectificationPatch {
  status?: ProjectDictionaryRectificationStatus;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
}

export interface ProjectDictionaryFieldSearchResult {
  query: string;
  results: ProjectDictionaryFieldHit[];
}
export interface ProbeConnectionsResult {
  probedAt: string;
  results: Array<{
    id: string;
    status: "ok" | "timeout" | "refused" | "unreachable";
    message?: string;
  }>;
}

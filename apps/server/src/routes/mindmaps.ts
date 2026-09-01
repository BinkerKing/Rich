import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Element, Relation, DynamicSection, MindmapEmbedBlock, MindmapEmbedCover } from "@ke/domain";
import type { AIAdapter } from "../ai/adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import { pickScenarioAdapter } from "../ai/pickAdapter.js";
import { generateTreeFor } from "../ai/operations.js";
import { generateMindmap } from "../ai/content/operations.js";
import { recordSignal } from "../ai/signalRecorder.js";
import { imageQueue } from "../ai/imageQueue.js";
import type { Logger } from "../lib/logger.js";
import { noopLogger } from "../lib/logger.js";

export interface MindmapsRoutesDeps {
  adapters: AIAdapter[];
  elements: ElementsRepo;
  relations: RelationsRepo;
  signals: SignalsRepo;
  logger?: Logger;
}

const MINDMAP_SECTION_ID = "mindmap-ppt";
const MINDMAP_SECTION_TITLE = "PPT 展示图";

// ----- content shape helpers ---------------------------------------------

type ContentWithSections = { sections?: DynamicSection[] } & Record<string, unknown>;
function sectionsOf(el: Element): DynamicSection[] {
  return ((el.content as ContentWithSections | null | undefined)?.sections) ?? [];
}
function contentObj(el: Element): ContentWithSections {
  return (el.content && typeof el.content === "object" ? el.content as ContentWithSections : {});
}

/** Read the deckRootId of an embed, applying a migration for old data that
 *  predates the multi-deck refactor. Old roots get their own element id; old
 *  child-of-deck embeds (without a deckRootId) return null and are treated as
 *  orphaned — re-attaching the deck fixes them. */
function deckRootIdOf(embed: MindmapEmbedBlock, elementId: string): string | null {
  if (embed.deckRootId) return embed.deckRootId;
  return embed.origin === "child-of-deck" ? null : elementId;
}

/** Enumerate all mindmap-embed blocks on an element. Each yielded entry
 *  includes its resolved deckRootId (post-migration) plus the section index +
 *  block index for downstream mutators / image queue. */
interface EmbedRef {
  embed: MindmapEmbedBlock;
  deckRootId: string;
  sectionIndex: number;
  blockIndex: number;
}
function embedsOf(el: Element): EmbedRef[] {
  const out: EmbedRef[] = [];
  const sections = sectionsOf(el);
  for (let s = 0; s < sections.length; s++) {
    const blocks = sections[s].blocks ?? [];
    for (let b = 0; b < blocks.length; b++) {
      if ((blocks[b] as { style?: string }).style !== "mindmap-embed") continue;
      const embed = blocks[b] as unknown as MindmapEmbedBlock;
      const drid = deckRootIdOf(embed, el.id);
      if (!drid) continue;
      out.push({ embed, deckRootId: drid, sectionIndex: s, blockIndex: b });
    }
  }
  return out;
}

/** Find the embed on `el` that belongs to deck `deckRootId`, or null. */
function findEmbedFor(el: Element, deckRootId: string): EmbedRef | null {
  for (const ref of embedsOf(el)) {
    if (ref.deckRootId === deckRootId) return ref;
  }
  return null;
}

// ----- mutation helpers (per-deck) ---------------------------------------

/** Ensure `el` has an embed for `deckRootId`. Idempotent. If the section
 *  doesn't exist, appends it at the END of the element's sections so we never
 *  reorder existing user content. */
function withEmbed(
  el: Element,
  deckRootId: string,
  origin: MindmapEmbedBlock["origin"],
  patch: Partial<MindmapEmbedBlock> = {},
): Element {
  // Already present?
  if (findEmbedFor(el, deckRootId)) return el;

  const newBlock: MindmapEmbedBlock = {
    style: "mindmap-embed",
    deckRootId,
    origin,
    generatedAt: new Date().toISOString(),
    ...patch,
  };
  const sections = sectionsOf(el);
  const next: DynamicSection[] = [];
  let touched = false;
  for (const s of sections) {
    if (s.id === MINDMAP_SECTION_ID) {
      next.push({ ...s, blocks: [...(s.blocks ?? []), newBlock as unknown as never] });
      touched = true;
    } else {
      next.push(s);
    }
  }
  if (!touched) {
    next.push({
      id: MINDMAP_SECTION_ID, title: MINDMAP_SECTION_TITLE,
      blocks: [newBlock as unknown as never],
    });
  }
  return {
    ...el,
    content: { ...contentObj(el), sections: next } as Element["content"],
    metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
  };
}

/** Mutate a specific embed (by deckRootId) using `mut`. Returns a new
 *  element; no-op if no matching embed exists. */
function mutateEmbed(
  el: Element,
  deckRootId: string,
  mut: (e: MindmapEmbedBlock) => MindmapEmbedBlock,
): Element {
  const ref = findEmbedFor(el, deckRootId);
  if (!ref) return el;
  const sections = sectionsOf(el);
  const newSection = { ...sections[ref.sectionIndex] };
  const newBlocks = [...(newSection.blocks ?? [])];
  newBlocks[ref.blockIndex] = mut(ref.embed) as unknown as never;
  newSection.blocks = newBlocks;
  const nextSections = sections.slice();
  nextSections[ref.sectionIndex] = newSection;
  return {
    ...el,
    content: { ...contentObj(el), sections: nextSections } as Element["content"],
    metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
  };
}

/** Remove the embed for `deckRootId` from `el`. If that was the last embed in
 *  the PPT section, removes the section entirely so we don't leave an empty
 *  "PPT 展示图" header. */
function withoutEmbed(el: Element, deckRootId: string): Element {
  const ref = findEmbedFor(el, deckRootId);
  if (!ref) return el;
  const sections = sectionsOf(el);
  const section = sections[ref.sectionIndex];
  const remaining = (section.blocks ?? []).filter((_, i) => i !== ref.blockIndex);
  const nextSections = sections.slice();
  if (remaining.some(b => (b as { style?: string }).style === "mindmap-embed")) {
    nextSections[ref.sectionIndex] = { ...section, blocks: remaining };
  } else {
    // Last embed gone → drop the whole PPT section.
    nextSections.splice(ref.sectionIndex, 1);
  }
  return {
    ...el,
    content: { ...contentObj(el), sections: nextSections } as Element["content"],
    metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
  };
}

// ----- image prompt building --------------------------------------------

/** Pull every text fragment from an element's content sections that could
 *  help codex picture the subject. Excludes the PPT section itself. */
function gatherContextText(el: Element): string {
  const parts: string[] = [];
  const sub = (el.subtitle ?? "").trim();
  if (sub) parts.push(sub);
  for (const s of sectionsOf(el)) {
    if (s.id === MINDMAP_SECTION_ID) continue;
    for (const b of s.blocks ?? []) {
      const style = (b as { style?: string }).style;
      const blk = b as unknown as Record<string, unknown>;
      if (style === "lead" || style === "prose" || style === "quote") {
        if (typeof blk.text === "string") parts.push(blk.text);
      } else if (style === "callout") {
        if (typeof blk.title === "string") parts.push(blk.title as string);
        if (typeof blk.body === "string") parts.push(blk.body as string);
      } else if (style === "dot-list" || style === "check-list" || style === "warn-cards" || style === "example-list") {
        const items = blk.items as unknown;
        if (Array.isArray(items)) {
          for (const it of items.slice(0, 4)) {
            if (typeof it === "string") parts.push(it);
            else if (it && typeof it === "object" && typeof (it as { text?: string }).text === "string") {
              parts.push((it as { text: string }).text);
            }
          }
        }
      }
      if (parts.join(" ").length > 500) break;
    }
    if (parts.join(" ").length > 500) break;
  }
  return parts.join(" · ").slice(0, 500);
}

function buildOverviewImagePrompt(
  el: Element,
  childTitles: string[] = [],
  userHint?: string,
): { alt: string; imagePrompt: string; caption: string } {
  const title = el.title.trim();
  const subtitle = (el.subtitle ?? "").trim();
  const summary = gatherContextText(el);
  const concreteChildren = childTitles.map(t => t.trim()).filter(Boolean).slice(0, 5).join("; ");
  const imagePrompt = [
    `Create a clean editorial illustration for a single PPT mindmap node.`,
    `The illustration must be concrete and readable — never abstract text-only.`,
    `Node title (verbatim, do NOT render as text inside the image): ${title}.`,
    subtitle ? `Subtitle: ${subtitle}.` : "",
    summary ? `Source context (Chinese): ${summary}` : "",
    concreteChildren ? `Sub-topics this node groups: ${concreteChildren}.` : "",
    userHint ? `USER-SPECIFIED REQUIREMENTS (highest priority — override other defaults where conflicting): ${userHint}` : "",
    `Visual elements: pick 2-4 simple iconic shapes that represent the node's idea — e.g. a stylized newspaper / data card / circuit motif for AI news, a path / map for travel, a tool icon for a method, a person silhouette for a practice. Compose them as a small editorial scene.`,
    `Style: restrained flat editorial illustration, warm off-white background, dark teal #183a4a, muted green #eef7f3, orange accent #d8894f, simple geometric shapes, thin shadows, no photorealism, no logos, no UI mockups, no emojis. Avoid putting Chinese or English text inside the image; if absolutely necessary, at most 2 short keywords.`,
    `Composition: centered subject, generous whitespace, readable at thumbnail size, aspect ratio 16:10.`,
  ].filter(Boolean).join(" ");
  return {
    alt: subtitle ? `${title} — ${subtitle}` : title,
    caption: subtitle || (concreteChildren ? `涵盖：${concreteChildren}` : title),
    imagePrompt,
  };
}

// ----- mindmap source builder (per deck) -------------------------------

/** First image URL to use as the deck-`rootId` cover for `el`:
 *   1. embed.cover.src on the embed for THIS deck (the PPT-dedicated image)
 *   2. fallback to any other image block in any other section (e.g. AI 早报
 *      news items ship with their own article image)
 *  Returns null when only an in-flight placeholder is present. */
/** The cover image to render for this node in deck `deckRootId`.
 *  Single source of truth: the embed's inline `cover.src`. If cover isn't
 *  ready (pending / generating / failed / absent), the node has no image in
 *  the PPT — this keeps the embed card and the PPT player perfectly in sync.
 *  The user explicitly opts in to image generation via "生成图片" on the card. */
function firstImageOf(el: Element, deckRootId: string): string | null {
  const ref = findEmbedFor(el, deckRootId);
  const cover = ref?.embed.cover;
  if (cover?.status === "ready" && cover.src) return cover.src;
  return null;
}

function sanitize(s: string): string {
  return s.replace(/\s*\n\s*/g, " ").replace(/^-+\s*/, "");
}
function typeLabel(t: Element["type"]): string {
  const map: Partial<Record<Element["type"], string>> = {
    topic: "主题", concept: "概念", step: "步骤", practice: "实战",
    project: "项目", report: "报告", guide: "攻略", case: "案例",
    tool: "工具", ability: "能力", summary: "总结", question: "问题",
    viewpoint: "观点", exercise: "练习", dispute: "争议", relation: "关系",
  };
  return map[t] ?? "节点";
}

/** Build the indented Markdown tree for the player from an element subtree,
 *  scoped to the deck rooted at `rootId`. Per-deck disable flags + per-deck
 *  cover image come from the matching embed block. */
function buildMindmapSource(
  rootId: string,
  elementsByid: Map<string, Element>,
  relations: Relation[],
  maxDepth = 4,
): string {
  const childrenByParent = new Map<string, string[]>();
  for (const r of relations) {
    if (r.kind !== "child") continue;
    const list = childrenByParent.get(r.from) ?? [];
    list.push(r.to);
    childrenByParent.set(r.from, list);
  }
  const lines: string[] = [];
  walk(rootId, 0);
  return lines.join("\n");

  function walk(id: string, depth: number) {
    if (depth > maxDepth) return;
    const el = elementsByid.get(id);
    if (!el) return;
    const indent = "  ".repeat(depth);
    const ref = findEmbedFor(el, rootId);
    // Hidden child nodes are skipped entirely (the node card AND its subtree
    // don't appear in the player). Root-level hidden affects list visibility
    // only — buildMindmapSource still emits root content. Skip when:
    //   - this isn't the deck root (id !== rootId)
    //   - AND embed.hidden === true on the relevant embed
    if (id !== rootId && ref?.embed.hidden === true) return;
    const textDisabled = ref?.embed.textDisabled === true;
    const imageDisabled = ref?.embed.imageDisabled === true;
    if (textDisabled) {
      lines.push(`${indent}- ·`);
    } else {
      const subtitle = sanitize(el.subtitle?.trim() || typeLabel(el.type));
      const title = sanitize(el.title.trim());
      lines.push(`${indent}- ${subtitle}`);
      if (title && title !== subtitle) lines.push(`${indent}  ${title}`);
    }
    if (!imageDisabled) {
      const img = firstImageOf(el, rootId);
      if (img) lines.push(`${indent}  @image ${img}`);
    }
    for (const childId of childrenByParent.get(id) ?? []) walk(childId, depth + 1);
  }
}

// ----- deck view --------------------------------------------------------

interface MindmapDeckView {
  id: string;
  rootElementId: string;
  title: string;
  subtitle?: string;
  origin: "from-element" | "ai-from-prose";
  generatedAt: string;
  aiModel?: string;
  source: string;
  childCount: number;
}

async function loadAllRelations(relationsRepo: RelationsRepo): Promise<Relation[]> {
  return await (relationsRepo as { list?: () => Promise<Relation[]> }).list?.() ?? [];
}

/** Build a deck view from a root element's self-deck embed (origin is
 *  from-element or ai-from-prose; deckRootId === el.id). Returns null if no
 *  such embed exists or it's hidden (unless includeHidden is true). */
async function buildDeckView(
  rootEl: Element,
  elementsRepo: ElementsRepo,
  relations: Relation[],
  includeHidden = false,
  allElements?: Element[],
): Promise<MindmapDeckView | null> {
  // Only "root-style" embeds (deckRootId === el.id, origin not child-of-deck).
  const selfEmbed = embedsOf(rootEl).find(
    r => r.deckRootId === rootEl.id && r.embed.origin !== "child-of-deck",
  );
  if (!selfEmbed) return null;
  if (!includeHidden && selfEmbed.embed.hidden) return null;
  const all = allElements ?? await elementsRepo.list();
  const byId = new Map(all.map(e => [e.id, e]));
  const source = buildMindmapSource(rootEl.id, byId, relations);
  const childCount = countDescendants(rootEl.id, relations);
  return {
    id: rootEl.id,
    rootElementId: rootEl.id,
    title: rootEl.title,
    subtitle: rootEl.subtitle,
    origin: selfEmbed.embed.origin as "from-element" | "ai-from-prose",
    generatedAt: selfEmbed.embed.generatedAt,
    aiModel: selfEmbed.embed.aiModel,
    source,
    childCount,
  };
}

function directChildren(id: string, relations: Relation[]): string[] {
  const out: string[] = [];
  for (const r of relations) {
    if (r.kind === "child" && r.from === id) out.push(r.to);
  }
  return out;
}

async function childTitlesOf(
  id: string,
  relations: Relation[],
  elements: ElementsRepo,
): Promise<string[]> {
  const ids = directChildren(id, relations).slice(0, 5);
  const titles: string[] = [];
  for (const cid of ids) {
    const el = await elements.get(cid);
    if (el) titles.push(el.title);
  }
  return titles;
}

function descendantsOf(rootId: string, relations: Relation[]): string[] {
  const byParent = new Map<string, string[]>();
  for (const r of relations) {
    if (r.kind !== "child") continue;
    const list = byParent.get(r.from) ?? [];
    list.push(r.to);
    byParent.set(r.from, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  function walk(id: string) {
    for (const c of byParent.get(id) ?? []) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      walk(c);
    }
  }
  walk(rootId);
  return out;
}

function countDescendants(rootId: string, relations: Relation[]): number {
  return descendantsOf(rootId, relations).length;
}

// ----- routes -----------------------------------------------------------

export function mindmapsRoutes(deps: MindmapsRoutesDeps): Hono {
  const r = new Hono();
  const log = deps.logger ?? noopLogger;

  r.get("/", async (c) => {
    const els = await deps.elements.list();
    const relations = await loadAllRelations(deps.relations);
    const decks: MindmapDeckView[] = [];
    for (const el of els) {
      const view = await buildDeckView(el, deps.elements, relations, false, els);
      if (view) decks.push(view);
    }
    decks.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return c.json(decks);
  });

  r.get("/:id", async (c) => {
    const el = await deps.elements.get(c.req.param("id"));
    if (!el) return c.json({ error: "element not found" }, 404);
    const relations = await loadAllRelations(deps.relations);
    const view = await buildDeckView(el, deps.elements, relations, true);
    if (!view) return c.json({ error: "element has no PPT section" }, 404);
    return c.json(view);
  });

  // Per-deck flag toggle. Body: { deckRootId: string }. Flips the named bool
  // on the embed identified by deckRootId.
  async function toggleFlag(
    elementId: string, deckRootId: string,
    flag: "hidden" | "imageDisabled" | "textDisabled",
  ) {
    const el = await deps.elements.get(elementId);
    if (!el) return { code: 404, payload: { error: "not found" } } as const;
    const ref = findEmbedFor(el, deckRootId);
    if (!ref) return { code: 404, payload: { error: "no embed for that deckRootId" } } as const;
    const newValue = !ref.embed[flag];
    const updated = mutateEmbed(el, deckRootId, e => ({ ...e, [flag]: newValue }));
    await deps.elements.put(updated);
    return { code: 200, payload: { ok: true, [flag]: newValue } } as const;
  }

  r.post("/:id/toggle-hidden", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const drid = typeof body.deckRootId === "string" && body.deckRootId ? body.deckRootId : null;
    if (!drid) return c.json({ error: "deckRootId required" }, 400);
    const out = await toggleFlag(c.req.param("id"), drid, "hidden");
    return c.json(out.payload, out.code as 200 | 400 | 404);
  });
  r.post("/:id/toggle-image-disabled", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const drid = typeof body.deckRootId === "string" && body.deckRootId ? body.deckRootId : null;
    if (!drid) return c.json({ error: "deckRootId required" }, 400);
    const out = await toggleFlag(c.req.param("id"), drid, "imageDisabled");
    return c.json(out.payload, out.code as 200 | 400 | 404);
  });
  r.post("/:id/toggle-text-disabled", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const drid = typeof body.deckRootId === "string" && body.deckRootId ? body.deckRootId : null;
    if (!drid) return c.json({ error: "deckRootId required" }, 400);
    const out = await toggleFlag(c.req.param("id"), drid, "textDisabled");
    return c.json(out.payload, out.code as 200 | 400 | 404);
  });

  // Attach a new deck rooted at the given element. The element gets an
  // origin=from-element embed for ITSELF; every descendant gets an additional
  // origin=child-of-deck embed bound to the same deckRootId. Existing embeds
  // for OTHER decks on those elements are untouched.
  r.post("/attach", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = typeof body.elementId === "string" ? body.elementId : "";
    if (!elementId) return c.json({ error: "elementId required" }, 400);
    const el = await deps.elements.get(elementId);
    if (!el) return c.json({ error: "element not found" }, 404);

    const rootWithEmbed = withEmbed(el, elementId, "from-element", {
      caption: typeof body.caption === "string" ? body.caption : undefined,
    });
    await deps.elements.put(rootWithEmbed);

    const relations = await loadAllRelations(deps.relations);
    const descendantIds = descendantsOf(elementId, relations);
    for (const id of descendantIds) {
      const child = await deps.elements.get(id);
      if (!child) continue;
      await deps.elements.put(withEmbed(child, elementId, "child-of-deck"));
    }
    const view = await buildDeckView(rootWithEmbed, deps.elements, relations);
    return c.json(view);
  });

  // Generate / regenerate the cover image for the embed identified by
  // (:id, body.deckRootId). Sets cover.status = "pending" and enqueues a job.
  r.post("/:id/retry-cover", async (c) => {
    const elementId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const drid = typeof body.deckRootId === "string" && body.deckRootId ? body.deckRootId : null;
    if (!drid) return c.json({ error: "deckRootId required" }, 400);
    const hint = typeof body.hint === "string" && body.hint.trim() ? body.hint.trim() : undefined;
    const el = await deps.elements.get(elementId);
    if (!el) return c.json({ error: "not found" }, 404);
    if (!findEmbedFor(el, drid)) return c.json({ error: "no embed for that deckRootId" }, 404);
    const relations = await loadAllRelations(deps.relations);
    const titles = await childTitlesOf(elementId, relations, deps.elements);
    const { alt, imagePrompt, caption } = buildOverviewImagePrompt(el, titles, hint);
    const cover: MindmapEmbedCover = { status: "pending", alt, imagePrompt, caption };
    const updated = mutateEmbed(el, drid, e => ({ ...e, cover }));
    await deps.elements.put(updated);
    void imageQueue.scheduleForElement(elementId);
    return c.json({ ok: true });
  });

  // Detach a specific deck's embed from an element (or, on the deck root,
  // detach the deck and all its descendant embeds). Body: { deckRootId }.
  r.post("/:id/detach", async (c) => {
    const elementId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const drid = typeof body.deckRootId === "string" && body.deckRootId ? body.deckRootId : null;
    if (!drid) return c.json({ error: "deckRootId required" }, 400);
    const el = await deps.elements.get(elementId);
    if (!el) return c.json({ error: "not found" }, 404);
    if (!findEmbedFor(el, drid)) return c.json({ error: "no embed for that deckRootId" }, 404);

    if (elementId === drid) {
      // Detaching the deck root → also clean up child-of-deck embeds pointing
      // at this deck on every descendant.
      const relations = await loadAllRelations(deps.relations);
      const descIds = descendantsOf(elementId, relations);
      await deps.elements.put(withoutEmbed(el, drid));
      for (const id of descIds) {
        const child = await deps.elements.get(id);
        if (!child) continue;
        await deps.elements.put(withoutEmbed(child, drid));
      }
    } else {
      await deps.elements.put(withoutEmbed(el, drid));
    }
    return c.body(null, 204);
  });

  // Legacy: DELETE /:id removed the entire PPT section. With multi-deck we
  // can't infer which deck to drop, so it now returns 410 Gone with an
  // explanatory body. Use /:id/detach with deckRootId instead.
  r.delete("/:id", async (c) => {
    return c.json({ error: "use /:id/detach with deckRootId in body" }, 410);
  });

  // Prose → AI → element tree + PPT section.
  r.post("/generate", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const prose = typeof body.prose === "string" ? body.prose.trim() : "";
    if (!prose) return c.json({ error: "prose required" }, 400);
    const titleHint = typeof body.titleHint === "string" ? body.titleHint : undefined;
    const audience = typeof body.audience === "string" ? body.audience : undefined;
    const model = body.model as "claude-code" | "codex" | undefined;
    const adapter = pickScenarioAdapter(deps.adapters, "mindmap", model);
    const signal = c.req.raw.signal;
    const t0 = Date.now();
    log.info("ai.op.start", { op: "/api/mindmaps/generate", adapter: adapter.name });

    return streamSSE(c, async (stream) => {
      try {
        let outlineResult: { title: string; subtitle?: string; source: string } | null = null;
        for await (const ev of generateMindmap(adapter, { prose, titleHint, audience, withImages: false, signal })) {
          await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
          if (ev.type === "error") {
            await recordSignal(deps.signals, {
              ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
              op: "generate-mindmap", adapter: adapter.name,
              data: { durationMs: Date.now() - t0, message: ev.message },
            });
          }
          if (ev.type === "done") {
            outlineResult = { title: ev.result.title, subtitle: ev.result.subtitle, source: ev.result.source };
          }
        }
        if (!outlineResult) return;

        const tree = await runGenerateTreeOnce(adapter, outlineResult.title, signal);
        for (const el of tree.elements) await deps.elements.put(el);
        await deps.relations.append(tree.relations);

        const rootEl = await deps.elements.get(tree.rootId);
        if (rootEl) {
          const patched: Element = {
            ...rootEl,
            subtitle: outlineResult.subtitle || rootEl.subtitle,
            title: outlineResult.title || rootEl.title,
          };
          const withRootEmbed = withEmbed(patched, tree.rootId, "ai-from-prose", {
            aiModel: adapter.name,
            caption: outlineResult.subtitle,
          });
          await deps.elements.put(withRootEmbed);
        }
        const freshRelations = await loadAllRelations(deps.relations);
        const descIds = descendantsOf(tree.rootId, freshRelations);
        for (const id of descIds) {
          const child = await deps.elements.get(id);
          if (!child) continue;
          await deps.elements.put(withEmbed(child, tree.rootId, "child-of-deck"));
        }

        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "generate-mindmap", adapter: adapter.name, elementId: tree.rootId,
          data: { durationMs: Date.now() - t0, nodeCount: tree.elements.length },
        });
        await stream.writeSSE({ event: "materialized", data: JSON.stringify({ rootElementId: tree.rootId }) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error("ai.op.error", { op: "/api/mindmaps/generate", message: msg });
        await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", message: msg }) });
      }
    });
  });

  return r;
}

async function runGenerateTreeOnce(
  adapter: AIAdapter,
  topic: string,
  signal: AbortSignal,
): Promise<{ rootId: string; elements: Element[]; relations: Relation[] }> {
  for await (const ev of generateTreeFor(adapter, { topic, richness: 2, signal })) {
    if (ev.type === "error") throw new Error(ev.message);
    if (ev.type === "done") {
      return { rootId: ev.result.rootId, elements: ev.result.elements, relations: ev.result.relations };
    }
  }
  throw new Error("generate-tree produced no result");
}

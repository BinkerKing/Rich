import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DynamicSection, Element, MindmapEmbedBlock, MindmapEmbedCover, RichnessLevel, PathKind } from "@ke/domain";
import { randomUUID } from "node:crypto";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { PathsRepo } from "../repos/PathsRepo.js";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import type { QARepo } from "../repos/QARepo.js";
import type { AnnotationsRepo } from "../repos/AnnotationsRepo.js";
import type { Signal, Relation, LearningPath } from "@ke/domain";
import type { AIAdapter } from "../ai/adapter.js";
import { pickScenarioAdapter } from "../ai/pickAdapter.js";
import {
  refineElement,
  expandElement,
  extendElement,
  generatePathsFor,
  generateDailyNews,
} from "../ai/operations.js";
import type { StructuredEvent } from "../ai/runStructuredAI.js";
import { loadManual, manualToPromptFragment } from "../ai/manuals.js";
import { enqueue, get as getTask, list as listTasks } from "./tasks.js";
import { eventBus } from "../lib/eventBus.js";
import { registerPlanTools } from "./planTools.js";
import { registerPracticeTools } from "./practiceTools.js";
import { registerCorpusTools } from "./corpusTools.js";
import {
  listMascotAnimations, playMascotAnimation, getMascotState,
} from "../lib/mascotState.js";

/** Inline copy of routes/ai.ts's helper — load the `knowledge` AI manual
 *  and convert to a prompt fragment, or return "" if absent. */
async function knowledgeManualFragment(aiDir: string): Promise<string> {
  const m = await loadManual(aiDir, "knowledge");
  return m ? manualToPromptFragment(m) : "";
}

/**
 * Rich's MCP server — exposes the knowledge tree to Hermes (and any other
 * MCP-capable agent like Claude Desktop / Cline / Cursor / Codex).
 *
 * Two layers of tools:
 *
 *   Layer 1 — Data tools (synchronous, fast):
 *     list_topics, get_element, get_subtree,
 *     create_element, update_element, delete_element
 *
 *   Layer 2 — AI ops (fire-and-forget, returns task_id):
 *     refine, expand, extend, generate_paths
 *     (paired with get_task for status polling)
 *
 * Hermes flow:
 *   1. Hermes thinks via Codex backend (the user's existing Codex OAuth)
 *   2. Hermes calls a Rich tool over MCP/HTTP
 *   3. Rich either reads/writes data directly (Layer 1) OR kicks off an
 *      AI op using its own Codex adapter and tells Hermes the task_id
 *      to come back for (Layer 2)
 *
 * Sharing memory with Rich.app:
 *   This server lives inside the same Node process as Rich's Hono server,
 *   so it holds the SAME repo instances → same SQLite connection → same
 *   data, atomic with whatever the Rich UI is doing.
 */

export interface BuildMcpDeps {
  elements: ElementsRepo;
  relations: RelationsRepo;
  paths: PathsRepo;
  signals: SignalsRepo;
  qa: QARepo;
  annotations: AnnotationsRepo;
  adapters: AIAdapter[];
  aiDir: string;
  improvements?: import("../repos/ImprovementsRepo.js").ImprovementsStore | null;
  /** Optional — AI corpus templates shared by Admin UI, Hermes MCP, and CLI. */
  corpus?: import("../repos/CorpusRepo.js").CorpusRepo | null;
  /** Optional — Toolbox runtime, gives Hermes access to user-defined small
   *  utility tools (lock screen, etc) via a generic invoke entry-point. */
  toolRuntime?: import("../tools/runtime.js").ToolRuntime | null;
  /** Optional — when present, exposes plan / goal / task management tools
   *  for Hermes to control the 计划管理 module via MCP. */
  greatMe?: import("../repos/GreatMeRepo.js").GreatMeRepo | null;
}

/** Drain a structured-AI stream to a single Promise. Used by Layer-2
 *  fire-and-forget tools: we let the AsyncIterable run inside `enqueue`,
 *  collect the final result, and stash it on the task record. */
async function consume<T>(stream: AsyncIterable<StructuredEvent<T>>): Promise<T> {
  for await (const ev of stream) {
    if (ev.type === "done") return ev.result;
    if (ev.type === "error") throw new Error(ev.message);
  }
  throw new Error("AI stream ended without done/error");
}

/** URL-safe slug for child element ids. Mirrors routes/ai.ts:slugify. */
function slugify(s: string): string {
  const base = s.toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!base) return `n${Date.now().toString(36).slice(-6)}`;
  return base;
}

/** Compact JSON view of an element — strips internal fields that aren't
 *  useful for an external agent (sessionId, internal counters, ...). */
function viewElement(el: Element) {
  return {
    id: el.id,
    type: el.type,
    title: el.title,
    subtitle: el.subtitle,
    domain: el.domain,
    tags: el.tags,
    richness: el.metadata?.richness,
    content: el.content,
  };
}

const SUPPORTED_SECTION_BLOCK_STYLES = new Set([
  "attachments",
  "budget-table",
  "callout",
  "check-list",
  "checklist-grouped",
  "competitor-table",
  "day-schedule",
  "decision-list",
  "diagram",
  "dot-list",
  "example-list",
  "image",
  "image-placeholder",
  "kv-table",
  "lead",
  "markdown",
  "mechanism-flow",
  "mindmap-embed",
  "module-grid",
  "mvp-grid",
  "phase-timeline",
  "prose",
  "quote",
  "warn-cards",
]);

const UPDATE_SECTION_BLOCK_GUIDE = [
  "Blocks must use Rich section block styles only.",
  `Supported block.style values: ${Array.from(SUPPORTED_SECTION_BLOCK_STYLES).sort().map(style => `"${style}"`).join(", ")}.`,
  'Never use style "list"; for bullet recommendations use {"style":"dot-list","items":["item: reason"]}, or use {"style":"markdown","text":"- **item**: reason"}.',
].join(" ");

function findUnsupportedSectionBlockStyle(blocks: unknown[]): string | null {
  for (const block of blocks) {
    if (!block || typeof block !== "object") return "missing style";
    const style = (block as { style?: unknown }).style;
    if (typeof style !== "string") return "missing style";
    if (!SUPPORTED_SECTION_BLOCK_STYLES.has(style)) return style;
  }
  return null;
}

const MINDMAP_SECTION_ID = "mindmap-ppt";
const MINDMAP_SECTION_TITLE = "PPT 展示图";

type ContentWithSections = { sections?: DynamicSection[] } & Record<string, unknown>;

function sectionsOf(el: Element): DynamicSection[] {
  return ((el.content as ContentWithSections | null | undefined)?.sections) ?? [];
}

function contentObj(el: Element): ContentWithSections {
  return (el.content && typeof el.content === "object" ? el.content as ContentWithSections : {});
}

function deckRootIdOf(embed: MindmapEmbedBlock, elementId: string): string | null {
  if (embed.deckRootId) return embed.deckRootId;
  return embed.origin === "child-of-deck" ? null : elementId;
}

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

function findEmbedFor(el: Element, deckRootId: string): EmbedRef | null {
  for (const ref of embedsOf(el)) {
    if (ref.deckRootId === deckRootId) return ref;
  }
  return null;
}

function withEmbed(
  el: Element,
  deckRootId: string,
  origin: MindmapEmbedBlock["origin"],
  patch: Partial<MindmapEmbedBlock> = {},
): Element {
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
  for (const section of sections) {
    if (section.id === MINDMAP_SECTION_ID) {
      next.push({ ...section, blocks: [...(section.blocks ?? []), newBlock] });
      touched = true;
    } else {
      next.push(section);
    }
  }
  if (!touched) {
    next.push({ id: MINDMAP_SECTION_ID, title: MINDMAP_SECTION_TITLE, blocks: [newBlock] });
  }
  return {
    ...el,
    content: { ...contentObj(el), sections: next } as Element["content"],
    metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
  };
}

function mutateEmbed(
  el: Element,
  deckRootId: string,
  mut: (e: MindmapEmbedBlock) => MindmapEmbedBlock,
): Element {
  const ref = findEmbedFor(el, deckRootId);
  if (!ref) return el;
  const sections = sectionsOf(el);
  const nextSection = { ...sections[ref.sectionIndex] };
  const nextBlocks = [...(nextSection.blocks ?? [])];
  nextBlocks[ref.blockIndex] = mut(ref.embed);
  nextSection.blocks = nextBlocks;
  const nextSections = sections.slice();
  nextSections[ref.sectionIndex] = nextSection;
  return {
    ...el,
    content: { ...contentObj(el), sections: nextSections } as Element["content"],
    metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
  };
}

export function buildMcpServer(deps: BuildMcpDeps): McpServer {
  const server = new McpServer({
    name: "rich",
    version: "0.1.0",
  });

  server.tool(
    "get_rich_system_manual",
    "Read the Rich system learning manual before operating unfamiliar Rich modules. It explains pages, scenarios, usage rules, and the preferred CLI/MCP entrypoints for Hermes/Codex agents.",
    {},
    async () => {
      const manual = await loadManual(deps.aiDir, "rich-system");
      if (!manual) {
        return { isError: true, content: [{ type: "text", text: "rich-system manual not found" }] };
      }
      return { content: [{ type: "text", text: manual.raw }] };
    },
  );

  // ───── Layer 1 — Data tools ──────────────────────────────────────────

  server.tool(
    "list_topics",
    "List all top-level topics in the knowledge tree (elements without a parent). Use this to discover what's in the user's knowledge base before drilling into a specific topic.",
    {},
    async () => {
      const elements = await deps.elements.list();
      const relations = await deps.relations.list();
      const childIds = new Set(
        relations.filter(r => r.kind === "child").map(r => r.to),
      );
      const topics = elements.filter(e => !childIds.has(e.id));
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            topics.map(t => ({ id: t.id, title: t.title, type: t.type, subtitle: t.subtitle })),
          ),
        }],
      };
    },
  );

  server.tool(
    "get_element",
    "Get a single element by id, including its full content (all sections, blocks, etc.). Use this to read the current state of an element before deciding to refine or expand it.",
    { id: z.string().min(1).describe("Element id") },
    async ({ id }) => {
      const el = await deps.elements.get(id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${id} not found` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(viewElement(el)) }] };
    },
  );

  server.tool(
    "get_subtree",
    "Get an element and all its descendants down to `depth` levels. Returns a flat list of elements + the parent-child relations between them. Useful for understanding the structure around a topic before doing tree-wide operations.",
    {
      id: z.string().min(1).describe("Root element id"),
      depth: z.number().int().min(1).max(6).default(2).describe("Max depth (1 = direct children only, default 2)"),
    },
    async ({ id, depth }) => {
      const allEls = await deps.elements.list();
      const allRels = await deps.relations.list();
      const byParent = new Map<string, string[]>();
      for (const r of allRels) {
        if (r.kind !== "child") continue;
        const list = byParent.get(r.from) ?? [];
        list.push(r.to);
        byParent.set(r.from, list);
      }
      const visited = new Set<string>([id]);
      let frontier = [id];
      for (let d = 0; d < depth; d++) {
        const next: string[] = [];
        for (const p of frontier) {
          for (const c of byParent.get(p) ?? []) {
            if (visited.has(c)) continue;
            visited.add(c);
            next.push(c);
          }
        }
        frontier = next;
        if (frontier.length === 0) break;
      }
      const subset = allEls.filter(e => visited.has(e.id));
      const subsetRels = allRels.filter(
        r => r.kind === "child" && visited.has(r.from) && visited.has(r.to),
      );
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            elements: subset.map(viewElement),
            relations: subsetRels,
          }),
        }],
      };
    },
  );

  server.tool(
    "create_element",
    "Create a new element in the knowledge tree. If `parent_id` is provided, the new element is attached as a child of that parent; otherwise it becomes a top-level topic. `content` is optional — pass it when you've already generated the sections; otherwise leave empty and the user can refine later.",
    {
      title: z.string().min(1).max(80).describe("Element title (3-12 chars ideal)"),
      type: z.enum([
        "topic", "concept", "step", "product-design",
        "viewpoint", "question", "case", "tool", "ability",
        "project", "practice", "summary", "relation",
        "dispute", "exercise", "report", "guide",
      ]).default("topic"),
      parent_id: z.string().optional().describe("If set, attach as child of this element"),
      subtitle: z.string().max(120).optional(),
      domain: z.string().max(40).optional(),
      tags: z.array(z.string().min(1).max(80)).max(20).optional().describe("Optional tags such as ai-news, category:热门 SKILL, date:2026-05-23"),
      content: z.any().optional().describe("Pre-generated content (sections array). Optional."),
    },
    async ({ title, type, parent_id, subtitle, domain, tags, content }) => {
      const id = `el-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const el: Element = {
        id,
        type,
        title,
        subtitle,
        domain,
        tags: tags ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: (content ?? { sections: [] }) as any,
        metadata: {
          createdAt: now,
          updatedAt: now,
          generatedBy: "ai",         // The caller is an external AI agent (Hermes / etc.)
          richness: 1,
        },
      };
      await deps.elements.put(el);
      if (parent_id) {
        await deps.relations.append([{
          id: `rel-${randomUUID().slice(0, 8)}`,
          kind: "child",
          from: parent_id,
          to: id,
          createdAt: now,
        }]);
        eventBus.publish("relation.changed", { source: "mcp", detail: { op: "create_element.attach", parent_id, id } });
      }
      eventBus.publish("element.changed", { source: "mcp", detail: { op: "create_element", id } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, id, attached_to: parent_id ?? null }) }] };
    },
  );

  server.tool(
    "update_element",
    "Patch an existing element. Only the fields you pass are written; omitted fields stay unchanged. Use this AFTER you've generated new content for an element — call get_element first to know what's there.",
    {
      id: z.string().min(1),
      title: z.string().min(1).max(80).optional(),
      type: z.enum([
        "topic", "concept", "step", "product-design",
        "viewpoint", "question", "case", "tool", "ability",
        "project", "practice", "summary", "relation",
        "dispute", "exercise", "report", "guide",
      ]).optional(),
      subtitle: z.string().max(120).optional(),
      domain: z.string().max(40).optional(),
      tags: z.array(z.string().min(1).max(80)).max(20).optional(),
      content: z.any().optional().describe("Full sections payload"),
    },
    async ({ id, title, type, subtitle, domain, tags, content }) => {
      const el = await deps.elements.get(id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${id} not found` }] };
      }
      const next: Element = {
        ...el,
        ...(title !== undefined ? { title } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(subtitle !== undefined ? { subtitle } : {}),
        ...(domain !== undefined ? { domain } : {}),
        ...(tags !== undefined ? { tags } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(content !== undefined ? { content: content as any } : {}),
        metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
      };
      await deps.elements.put(next);
      eventBus.publish("element.changed", { source: "mcp", detail: { op: "update_element", id } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
    },
  );

  server.tool(
    "attach_mindmap",
    "Attach a mindmap/PPT embed card to an element. Use this after creating or identifying a deck root so the element shows the PPT view inline.",
    {
      id: z.string().min(1).describe("Element id to update"),
      deckRootId: z.string().min(1).describe("Deck root element id this embed belongs to"),
      caption: z.string().max(160).optional(),
      origin: z.enum(["from-element", "ai-from-prose", "child-of-deck"]).default("from-element"),
    },
    async ({ id, deckRootId, caption, origin }) => {
      const el = await deps.elements.get(id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${id} not found` }] };
      }
      const next = withEmbed(el, deckRootId, origin ?? "from-element", caption ? { caption } : {});
      await deps.elements.put(next);
      eventBus.publish("element.changed", { source: "mcp", detail: { op: "attach_mindmap", id, deckRootId } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, id, deckRootId }) }] };
    },
  );

  server.tool(
    "attach_cover",
    "Attach a ready cover image to an existing mindmap/PPT embed on an element.",
    {
      id: z.string().min(1).describe("Element id to update"),
      deckRootId: z.string().min(1).describe("Deck root element id whose embed should receive the cover"),
      src: z.string().min(1).describe("Image URL or served image path"),
      alt: z.string().max(160).optional(),
      caption: z.string().max(160).optional(),
    },
    async ({ id, deckRootId, src, alt, caption }) => {
      const el = await deps.elements.get(id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${id} not found` }] };
      }
      if (!findEmbedFor(el, deckRootId)) {
        return { isError: true, content: [{ type: "text", text: `Mindmap embed ${deckRootId} not found on element ${id}` }] };
      }
      const cover: MindmapEmbedCover = { status: "ready", src, ...(alt !== undefined ? { alt } : {}), ...(caption !== undefined ? { caption } : {}) };
      const next = mutateEmbed(el, deckRootId, embed => ({ ...embed, cover }));
      await deps.elements.put(next);
      eventBus.publish("element.changed", { source: "mcp", detail: { op: "attach_cover", id, deckRootId } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, id, deckRootId, cover }) }] };
    },
  );

  server.tool(
    "delete_element",
    "Delete an element AND all its descendants (cascading). Irreversible. Confirm with the user before calling this on anything non-trivial — the response includes how many elements were swept.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const el = await deps.elements.get(id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${id} not found` }] };
      }
      // Compute subtree via BFS over child relations (mirrors the
      // routes/elements.ts DELETE handler).
      const allRelations = await deps.relations.list();
      const childIndex = new Map<string, string[]>();
      for (const rel of allRelations) {
        if (rel.kind !== "child") continue;
        const list = childIndex.get(rel.from) ?? [];
        list.push(rel.to);
        childIndex.set(rel.from, list);
      }
      const toRemove: string[] = [];
      const seen = new Set<string>();
      const queue: string[] = [id];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        toRemove.push(cur);
        for (const child of childIndex.get(cur) ?? []) queue.push(child);
      }
      await deps.relations.removeForElements(toRemove);
      await deps.elements.removeMany(toRemove);
      eventBus.publish("relation.changed", { source: "mcp", detail: { op: "delete_element.cascade", removed: toRemove.length } });
      eventBus.publish("element.changed", { source: "mcp", detail: { op: "delete_element", removed: toRemove } });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ ok: true, removed: toRemove }),
        }],
      };
    },
  );

  // ───── Layer 2 — AI ops (fire-and-forget) ────────────────────────────

  const richnessSchema = z.number().int().min(1).max(5).default(3)
    .describe("Target richness 1-5 (1=低档, 3=高档, 5=专家). Default 3.");

  server.tool(
    "refine",
    "Refine (deepen / improve) an existing element's content. Returns a task_id immediately — poll get_task to read the result. Use this when the user wants more detail on a concept they already created.",
    {
      element_id: z.string().min(1),
      target_richness: richnessSchema,
      direction: z.string().optional().describe("Optional direction, e.g. '补充失败案例' / '加入数学推导'"),
      model: z.enum(["claude-code", "codex", "hermes", "bailian"]).optional(),
    },
    async ({ element_id, target_richness, direction, model }) => {
      const el = await deps.elements.get(element_id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${element_id} not found` }] };
      }
      const adapter = pickScenarioAdapter(deps.adapters, "knowledge", model);
      const queued = enqueue(
        "refine",
        async () => {
          const result = await consume(refineElement(adapter, {
            element: el,
            targetRichness: target_richness as RichnessLevel,
            direction,
            manual: await knowledgeManualFragment(deps.aiDir),
          }));
          // Persist the refined content back into the element.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await deps.elements.put({ ...el, content: result.content as any });
          eventBus.publish("element.changed", { source: "mcp", detail: { op: "refine", id: element_id } });
          return { element_id, content_updated: true };
        },
        { element_id, model: adapter.name },
      );
      return { content: [{ type: "text", text: JSON.stringify(queued) }] };
    },
  );

  server.tool(
    "expand",
    "Expand an element by generating children under it (one or more new sub-elements). Returns a task_id. Poll get_task to read the new element ids.",
    {
      parent_id: z.string().min(1),
      count: z.number().int().min(1).max(8).default(4).describe("How many children to generate (default 4)"),
      direction: z.string().optional(),
      model: z.enum(["claude-code", "codex", "hermes", "bailian"]).optional(),
    },
    async ({ parent_id, count, direction, model }) => {
      const parent = await deps.elements.get(parent_id);
      if (!parent) {
        return { isError: true, content: [{ type: "text", text: `Parent ${parent_id} not found` }] };
      }
      const allRels = await deps.relations.list();
      const childIds = allRels
        .filter(r => r.kind === "child" && r.from === parent_id)
        .map(r => r.to);
      const existingChildren: Element[] = [];
      for (const cid of childIds) {
        const c = await deps.elements.get(cid);
        if (c) existingChildren.push(c);
      }
      const adapter = pickScenarioAdapter(deps.adapters, "knowledge", model);
      const queued = enqueue(
        "expand",
        async () => {
          const result = await consume(expandElement(adapter, {
            parent, existingChildren, count, direction,
            manual: await knowledgeManualFragment(deps.aiDir),
          }));
          // Write generated children + their child relations.
          for (const e of result.elements) await deps.elements.put(e);
          if (result.relations.length > 0) await deps.relations.append(result.relations);
          eventBus.publish("element.changed", { source: "mcp", detail: { op: "expand", parent_id } });
          if (result.relations.length > 0) {
            eventBus.publish("relation.changed", { source: "mcp", detail: { op: "expand", parent_id } });
          }
          return {
            parent_id,
            new_element_ids: result.elements.map(e => e.id),
          };
        },
        { parent_id, model: adapter.name },
      );
      return { content: [{ type: "text", text: JSON.stringify(queued) }] };
    },
  );

  server.tool(
    "extend",
    "Extend an element laterally — generate sibling concepts in a specific direction (e.g. 'compare to' / 'opposite view' / 'similar concepts'). Returns task_id.",
    {
      element_id: z.string().min(1),
      direction: z.string().min(1).describe("The direction to extend in"),
      count: z.number().int().min(1).max(6).default(3),
      model: z.enum(["claude-code", "codex", "hermes", "bailian"]).optional(),
    },
    async ({ element_id, direction, count, model }) => {
      const el = await deps.elements.get(element_id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${element_id} not found` }] };
      }
      const adapter = pickScenarioAdapter(deps.adapters, "knowledge", model);
      const queued = enqueue(
        "extend",
        async () => {
          const result = await consume(extendElement(adapter, {
            element: el, direction, count,
            manual: await knowledgeManualFragment(deps.aiDir),
          }));
          for (const e of result.elements) await deps.elements.put(e);
          if (result.relations.length > 0) await deps.relations.append(result.relations);
          eventBus.publish("element.changed", { source: "mcp", detail: { op: "extend", element_id } });
          if (result.relations.length > 0) {
            eventBus.publish("relation.changed", { source: "mcp", detail: { op: "extend", element_id } });
          }
          return {
            element_id,
            new_element_ids: result.elements.map(e => e.id),
          };
        },
        { element_id, direction, model: adapter.name },
      );
      return { content: [{ type: "text", text: JSON.stringify(queued) }] };
    },
  );

  server.tool(
    "generate_news",
    "Generate today's (or a specific date's) AI daily news roundup. Pulls 30+ sources via Codex, distills 5-12 items, writes them as a roundup element + N child news elements under `ai-news`. Returns task_id; poll get_task for the materialised roundup id.",
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD; defaults to today"),
      model: z.enum(["claude-code", "codex", "hermes", "bailian"]).optional(),
    },
    async ({ date, model }) => {
      const targetDate = date ?? new Date().toISOString().slice(0, 10);
      const parent = await deps.elements.get("ai-news");
      if (!parent) {
        return {
          isError: true,
          content: [{ type: "text", text: "ai-news parent topic not found; create it first via create_element({ title: 'AI 早报', type: 'topic' }) — then the id 'ai-news' is auto-assigned by the user." }],
        };
      }
      const adapter = pickScenarioAdapter(deps.adapters, "content", model);
      const queued = enqueue(
        "generate_news",
        async () => {
          const result = await consume(generateDailyNews(adapter, { date: targetDate }));
          // Materialize: build daily-roundup parent + child news elements.
          // (Same shape as routes/ai.ts uses on the SSE done event.)
          const now = new Date().toISOString();
          const dailyRoundupId = `ai-news.${targetDate}`;
          const roundup: Element = {
            id: dailyRoundupId,
            type: "report",
            title: `${targetDate} AI 早报`,
            subtitle: result.editorNote.split(/[\n。]/).find((s: string) => s.trim())
              ?? `${targetDate} 当日 AI 进展速览`,
            tags: ["ai-news", `date:${targetDate}`, "daily-roundup"],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: {
              sections: [{
                id: "editor-note",
                title: "编辑按语",
                blocks: [{ style: "prose", text: result.editorNote }],
              }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", aiModel: adapter.name, richness: 2 },
          };
          await deps.elements.put(roundup);
          await deps.relations.append([{
            id: `rel.ai-news-child-${dailyRoundupId}`,
            kind: "child", from: "ai-news", to: dailyRoundupId, createdAt: now,
          }]);
          const childRels: Array<{ id: string; kind: "child"; from: string; to: string; createdAt: string }> = [];
          for (let i = 0; i < result.items.length; i++) {
            const item = result.items[i];
            const slug = slugify(item.title) || `item-${i + 1}`;
            const childId = `${dailyRoundupId}.${slug}`;
            await deps.elements.put({
              id: childId,
              type: "report",
              title: item.title,
              subtitle: item.subtitle,
              tags: ["ai-news", `category:${item.category}`, `impact:${item.impact}`, `date:${targetDate}`],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: { sections: item.sections } as any,
              metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", aiModel: adapter.name, richness: 2 },
            });
            childRels.push({
              id: `rel.${dailyRoundupId}-child-${childId}`,
              kind: "child", from: dailyRoundupId, to: childId, createdAt: now,
            });
          }
          if (childRels.length > 0) await deps.relations.append(childRels);
          eventBus.publish("element.changed", { source: "mcp", detail: { op: "generate_news", roundup_id: dailyRoundupId } });
          eventBus.publish("relation.changed", { source: "mcp", detail: { op: "generate_news", roundup_id: dailyRoundupId } });
          return {
            roundup_id: dailyRoundupId,
            item_count: result.items.length,
            date: targetDate,
          };
        },
        { date: targetDate, model: adapter.name },
      );
      return { content: [{ type: "text", text: JSON.stringify(queued) }] };
    },
  );

  server.tool(
    "generate_paths",
    "Generate learning paths through the knowledge tree centered on a specific element. Each path is a curated walk for a specific learner profile (quick / academic / practice / custom). Returns task_id.",
    {
      center_id: z.string().min(1),
      kinds: z.array(z.enum(["quick", "academic", "practice", "custom"])).min(1).default(["quick", "academic"]),
      model: z.enum(["claude-code", "codex", "hermes", "bailian"]).optional(),
    },
    async ({ center_id, kinds, model }) => {
      const center = await deps.elements.get(center_id);
      if (!center) {
        return { isError: true, content: [{ type: "text", text: `Element ${center_id} not found` }] };
      }
      const allElements = await deps.elements.list();
      const adapter = pickScenarioAdapter(deps.adapters, "knowledge", model);
      const queued = enqueue(
        "generate_paths",
        async () => {
          const result = await consume(generatePathsFor(adapter, {
            center,
            availableElements: allElements,
            kinds: kinds as PathKind[],
            manual: await knowledgeManualFragment(deps.aiDir),
          }));
          if (result.paths.length > 0) {
            await deps.paths.appendForCenter(center_id, result.paths);
            eventBus.publish("path.changed", { source: "mcp", detail: { op: "generate_paths", center_id } });
          }
          return { center_id, path_count: result.paths.length };
        },
        { center_id, kinds, model: adapter.name },
      );
      return { content: [{ type: "text", text: JSON.stringify(queued) }] };
    },
  );

  // ───── Task status helpers (paired with Layer 2) ─────────────────────

  server.tool(
    "get_task",
    "Get the status of a fire-and-forget task (returned by refine / expand / extend / generate_paths). Poll until status is 'done' or 'error'; then read the result.",
    { task_id: z.string().min(1) },
    async ({ task_id }) => {
      const t = getTask(task_id);
      if (!t) {
        return { isError: true, content: [{ type: "text", text: `Task ${task_id} not found` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(t) }] };
    },
  );

  server.tool(
    "list_tasks",
    "List recent tasks. Useful for figuring out what's running.",
    {
      status: z.enum(["queued", "running", "done", "error"]).optional(),
      kind: z.string().optional(),
    },
    async ({ status, kind }) => {
      const out = listTasks({ status, kind }).slice(0, 50);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  // ───── Phase 1 expansion — full data CRUD for Hermes ────────────────

  server.tool(
    "list_elements",
    "List elements with optional filters. Use this to find elements matching a type / tag / parent before reading their content.",
    {
      type: z.string().optional().describe("Filter by element type (topic / concept / step / ...)"),
      tag: z.string().optional().describe("Element must include this tag"),
      parent_id: z.string().optional().describe("Only direct children of this parent"),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ type, tag, parent_id, limit }) => {
      const all = await deps.elements.list();
      let out = all;
      if (type) out = out.filter(e => e.type === type);
      if (tag) out = out.filter(e => (e.tags ?? []).includes(tag));
      if (parent_id) {
        const childIds = new Set(
          (await deps.relations.byFrom(parent_id))
            .filter(r => r.kind === "child").map(r => r.to),
        );
        out = out.filter(e => childIds.has(e.id));
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            out.slice(0, limit).map(e => ({
              id: e.id, title: e.title, type: e.type, subtitle: e.subtitle,
              richness: e.metadata?.richness,
            })),
          ),
        }],
      };
    },
  );

  server.tool(
    "list_relations",
    "List relations (default: only kind=child). Use to understand structure around an element.",
    {
      kind: z.enum(["parent","child","sibling","related","prerequisite","extension","practice"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    },
    async ({ kind, from, to, limit }) => {
      const all = await deps.relations.list();
      let out = all;
      if (kind) out = out.filter(r => r.kind === kind);
      if (from) out = out.filter(r => r.from === from);
      if (to) out = out.filter(r => r.to === to);
      return { content: [{ type: "text", text: JSON.stringify(out.slice(0, limit)) }] };
    },
  );

  server.tool(
    "append_relations",
    "Append new relations between existing elements. Each relation auto-gets an id + createdAt if missing.",
    {
      relations: z.array(z.object({
        id: z.string().optional(),
        kind: z.enum(["parent","child","sibling","related","prerequisite","extension","practice"]),
        from: z.string().min(1),
        to: z.string().min(1),
        strength: z.number().optional(),
        reason: z.string().optional(),
      })).min(1),
    },
    async ({ relations }) => {
      const now = new Date().toISOString();
      const filled: Relation[] = relations.map(r => ({
        ...r,
        id: r.id ?? `rel-${randomUUID().slice(0, 8)}`,
        createdAt: now,
      }));
      await deps.relations.append(filled);
      eventBus.publish("relation.changed", { source: "mcp", detail: { op: "append_relations", count: filled.length } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, added: filled.length }) }] };
    },
  );

  server.tool(
    "reparent_element",
    "Move `child_id` under a new parent (or detach to top-level by passing null).",
    {
      child_id: z.string().min(1),
      new_parent_id: z.string().nullable(),
    },
    async ({ child_id, new_parent_id }) => {
      await deps.relations.reparent(child_id, new_parent_id);
      eventBus.publish("relation.changed", { source: "mcp", detail: { op: "reparent_element", child_id, new_parent_id } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
    },
  );

  server.tool(
    "reorder_children",
    "Set the display order of direct children under a parent. `child_ids` is the desired order; any existing children not in the list are appended at the end in their original order.",
    {
      parent_id: z.string().min(1),
      child_ids: z.array(z.string()).min(1),
    },
    async ({ parent_id, child_ids }) => {
      await deps.relations.reorderChildren(parent_id, child_ids);
      eventBus.publish("relation.changed", { source: "mcp", detail: { op: "reorder_children", parent_id } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
    },
  );

  server.tool(
    "update_section",
    `Replace a single section inside an element's content. The element's other sections stay untouched. Use this for section-scoped refinement to avoid risk of wiping unrelated sections. ${UPDATE_SECTION_BLOCK_GUIDE}`,
    {
      element_id: z.string().min(1),
      section_id: z.string().min(1),
      title: z.string().optional(),
      blocks: z.array(z.unknown()).describe(`New block payload for this section. ${UPDATE_SECTION_BLOCK_GUIDE}`),
    },
    async ({ element_id, section_id, title, blocks }) => {
      const el = await deps.elements.get(element_id);
      if (!el) {
        return { isError: true, content: [{ type: "text", text: `Element ${element_id} not found` }] };
      }
      const unsupportedStyle = findUnsupportedSectionBlockStyle(blocks);
      if (unsupportedStyle) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Unsupported Rich section block style: ${unsupportedStyle}. ${UPDATE_SECTION_BLOCK_GUIDE}`,
          }],
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any = el.content ?? { sections: [] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections: any[] = Array.isArray(content.sections) ? content.sections : [];
      const idx = sections.findIndex(s => s?.id === section_id);
      if (idx < 0) {
        return { isError: true, content: [{ type: "text", text: `Section ${section_id} not found in ${element_id}` }] };
      }
      sections[idx] = {
        ...sections[idx],
        ...(title !== undefined ? { title } : {}),
        blocks,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deps.elements.put({ ...el, content: { ...content, sections } as any });
      eventBus.publish("element.changed", { source: "mcp", detail: { op: "update_section", element_id, section_id } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, section_id }) }] };
    },
  );

  server.tool(
    "list_signals",
    "List user-feedback / op signals for evidence-trail analysis. Used by reviewManual to mine patterns.",
    {
      manual: z.string().optional().describe("Filter by AI manual name (e.g. 'knowledge')"),
      type: z.string().optional().describe("Filter by signal type (e.g. 'user.feedback')"),
      element_id: z.string().optional(),
      since: z.string().optional().describe("ISO timestamp lower bound"),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ manual, type, element_id, since, limit }) => {
      const list = await deps.signals.list({
        manual,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: type as any,
        elementId: element_id,
        since,
        limit,
      });
      return { content: [{ type: "text", text: JSON.stringify(list) }] };
    },
  );

  server.tool(
    "write_signal",
    "Append a signal record. Used to track AI op completion, user feedback, reverts, etc. — the Reviewer AI feeds on these.",
    {
      type: z.enum([
        "op.completed", "op.failed",
        "user.reverted", "user.repeated_op", "user.frustrated",
        "user.changed_center", "user.feedback", "user.edited",
      ]),
      manual: z.string().default("knowledge"),
      element_id: z.string().optional(),
      op: z.string().optional(),
      adapter: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ type, manual, element_id, op, adapter, data }) => {
      const signal: Signal = {
        ts: new Date().toISOString(),
        type, manual,
        elementId: element_id,
        op, adapter,
        data,
      };
      await deps.signals.append(signal);
      eventBus.publish("signal.changed", { source: "mcp", detail: { op: "write_signal", type } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
    },
  );

  server.tool(
    "list_qa",
    "List Q&A records for an element.",
    { element_id: z.string().min(1) },
    async ({ element_id }) => {
      const out = await deps.qa.listForElement(element_id);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  server.tool(
    "write_qa",
    "Save a Q&A pair attached to an element. `anchor` lets the UI render it under a specific section or annotation.",
    {
      element_id: z.string().min(1),
      question: z.string().min(1),
      answer: z.string().min(1),
      anchor: z.union([
        z.object({ type: z.literal("section"), sectionId: z.string() }),
        z.object({ type: z.literal("annotation"), annotationId: z.string() }),
        z.object({ type: z.literal("element") }),
      ]).optional(),
      ai_model: z.string().optional(),
    },
    async ({ element_id, question, answer, anchor, ai_model }) => {
      const id = `qa-${randomUUID().slice(0, 8)}`;
      await deps.qa.append({
        id, elementId: element_id, question, answer,
        anchor: anchor ?? { type: "element" },
        createdAt: new Date().toISOString(),
        aiModel: ai_model,
      });
      eventBus.publish("qa.changed", { source: "mcp", detail: { op: "write_qa", element_id, id } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
    },
  );

  server.tool(
    "write_annotation",
    "Save an annotation (highlight / underline) with optional AI analysis. Returns the new annotation id.",
    {
      element_id: z.string().min(1),
      kind: z.enum(["highlight", "underline"]).default("highlight"),
      text: z.string().min(1),
      context_before: z.string().optional(),
      context_after: z.string().optional(),
      note: z.string().optional(),
      analysis: z.object({
        title: z.string().optional(),
        body: z.string(),
        ai_model: z.string().optional(),
      }).optional(),
    },
    async ({ element_id, kind, text, context_before, context_after, note, analysis }) => {
      const id = `ann-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      await deps.annotations.append({
        id, elementId: element_id, kind, text,
        contextBefore: context_before,
        contextAfter: context_after,
        note,
        analysis: analysis
          ? { title: analysis.title, body: analysis.body, aiModel: analysis.ai_model, createdAt: now }
          : undefined,
        createdAt: now,
      });
      eventBus.publish("annotation.changed", { source: "mcp", detail: { op: "write_annotation", element_id, id } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
    },
  );

  server.tool(
    "list_paths_for",
    "List learning paths centered on a specific element.",
    { center_id: z.string().min(1) },
    async ({ center_id }) => {
      const paths = await deps.paths.byCenter(center_id);
      return { content: [{ type: "text", text: JSON.stringify(paths) }] };
    },
  );

  server.tool(
    "write_paths",
    "Replace ALL paths centered on `center_id`. Use this when regenerating; appendForCenter (via generate_paths) is the additive variant.",
    {
      center_id: z.string().min(1),
      paths: z.array(z.object({
        id: z.string(),
        kind: z.enum(["quick", "academic", "practice", "custom"]),
        label: z.string(),
        color: z.string(),
        steps: z.array(z.string()),
        estimatedTime: z.string().optional(),
      })),
    },
    async ({ center_id, paths }) => {
      const now = new Date().toISOString();
      const full: LearningPath[] = paths.map(p => ({
        ...p,
        centerElementId: center_id,
        generatedBy: "ai" as const,
        createdAt: now,
      }));
      await deps.paths.putForCenter(center_id, full);
      eventBus.publish("path.changed", { source: "mcp", detail: { op: "write_paths", center_id, count: full.length } });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, count: full.length }) }] };
    },
  );

  server.tool(
    "search_elements",
    "Substring + tag search across element titles, subtitles, and tags. Returns ranked matches. Use this to find candidates before deciding to attach / extend / refine.",
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(15),
    },
    async ({ query, limit }) => {
      const q = query.toLowerCase();
      const all = await deps.elements.list();
      const scored = all
        .map(e => {
          let score = 0;
          if (e.title.toLowerCase().includes(q)) score += 4;
          if (e.subtitle?.toLowerCase().includes(q)) score += 2;
          if ((e.tags ?? []).some(t => t.toLowerCase().includes(q))) score += 1;
          return { score, el: e };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            scored.map(({ score, el }) => ({
              id: el.id, title: el.title, type: el.type, score,
              subtitle: el.subtitle,
            })),
          ),
        }],
      };
    },
  );

  // ───── System-improvement task board ───────────────────────────────
  // Optional — only mounted when the SQLite-backed repo is wired (default).
  // The intended workflow:
  //   1. Hermes hits a capability gap → calls `create_improvement` to file
  //      a 待改造 task. The dev gets visibility via Rich's admin UI.
  //   2. Hermes/user refines the gap into PRD + implementation tasks, then
  //      status='ready_to_develop' so agents can claim and implement it.
  //   3. After shipping the fix, the dev marks status='ready_to_verify' (in
  //      UI) or asks Hermes "I shipped X, mark it ready" (Hermes calls
  //      `update_improvement`).
  //   4. Hermes verifies by attempting the original failing flow. Result:
  //      status='verified' (pass) or 'rejected' (fail, with notes).
  if (deps.improvements) {
    const improvements = deps.improvements;

    server.tool(
      "list_improvements",
      "List Rich system-improvement tasks (capability gaps Hermes filed, plus their PRD/tasks/status). Use this BEFORE filing a new one — if a similar task is already pending, ready_to_develop, or ready_to_verify, append to it via update_improvement instead of creating a duplicate. Status flow: pending → ready_to_develop → ready_to_verify → verified | rejected.",
      {
        status: z.enum(["pending", "ready_to_develop", "ready_to_verify", "verified", "rejected"]).optional()
          .describe("Filter by status. Omit to see all."),
        limit: z.number().int().min(1).max(200).default(50),
      },
      async ({ status, limit }) => {
        const items = await improvements.list({ status, limit });
        const counts = await improvements.countByStatus();
        return { content: [{ type: "text", text: JSON.stringify({ counts, items }) }] };
      },
    );

    server.tool(
      "create_improvement",
      "File a NEW system-improvement task — use this when you (Hermes) try to do something for the user and discover Rich is missing the necessary capability. Capture: a one-line `title`, full `description` of what the user wanted, `reason` describing the missing capability, and optionally `prd_content` plus decomposed `tasks` when you have already analyzed it. Status starts at 'pending'. After user review, set status='ready_to_develop'.",
      {
        title: z.string().min(3).max(160).describe("One-line summary, e.g. '新增 attach_mindmap MCP 工具'"),
        description: z.string().max(4000).optional()
          .describe("What did the user ask you to do? What is the desired end-state?"),
        reason: z.string().max(2000).optional()
          .describe("Exactly what capability is missing? e.g. 'MCP 没有 attach_mindmap 工具，无法给元素挂 PPT section'"),
        prd_content: z.string().max(30000).optional()
          .describe("PRD produced after analyzing the user's requirement. Include goal, scope, UX/API/data changes, acceptance criteria, and risks."),
        tasks: z.array(z.object({
          id: z.string().min(1).max(80),
          title: z.string().min(1).max(220),
          detail: z.string().max(4000).optional(),
          status: z.enum(["todo", "doing", "done", "blocked"]).optional(),
          priority: z.enum(["low", "medium", "high"]).optional(),
        })).max(100).optional().describe("Implementation tasks decomposed from the PRD. Keep each task independently claimable/testable."),
        priority: z.enum(["low", "medium", "high"]).optional(),
        category: z.string().max(60).optional()
          .describe("Free-form, e.g. 'mcp-tool' / 'ui' / 'integration' / 'data-model'"),
        related_files: z.array(z.string()).max(20).optional()
          .describe("Optional code-path hints for the dev — files likely to need editing"),
      },
      async ({ title, description, reason, prd_content, tasks, priority, category, related_files }) => {
        const created = await improvements.create({
          title,
          description,
          reason,
          prdContent: prd_content,
          tasks,
          priority,
          category,
          relatedFiles: related_files,
          createdBy: "hermes",
        });
        eventBus.publish("improvement.changed", { source: "mcp", detail: { op: "create", id: created.id } });
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, id: created.id, status: created.status }) }] };
      },
    );

    server.tool(
      "update_improvement",
      "Update an existing improvement task. Typical transitions: (1) analyze requirement → fill `prd_content` and `tasks`; (2) user reviewed PRD/tasks → status='ready_to_develop'; (3) dev shipped fix → status='ready_to_verify'; (4) verification pass/fail → status='verified' or 'rejected' with verification_notes. ALWAYS list_improvements first to confirm the id.",
      {
        id: z.string().min(1),
        title: z.string().min(3).max(160).optional(),
        description: z.string().max(4000).optional(),
        reason: z.string().max(2000).optional(),
        prd_content: z.string().max(30000).optional(),
        tasks: z.array(z.object({
          id: z.string().min(1).max(80),
          title: z.string().min(1).max(220),
          detail: z.string().max(4000).optional(),
          status: z.enum(["todo", "doing", "done", "blocked"]).optional(),
          priority: z.enum(["low", "medium", "high"]).optional(),
        })).max(100).optional(),
        status: z.enum(["pending", "ready_to_develop", "ready_to_verify", "verified", "rejected"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        category: z.string().max(60).optional(),
        verification_notes: z.string().max(2000).optional()
          .describe("When transitioning to verified/rejected: explain what you tested and the outcome. Stored in the audit trail."),
      },
      async ({ id, title, description, reason, prd_content, tasks, status, priority, category, verification_notes }) => {
        const updated = await improvements.update(id, {
          title, description, reason, prdContent: prd_content, tasks, status, priority, category,
          verificationNotes: verification_notes,
        });
        if (!updated) {
          return { isError: true, content: [{ type: "text", text: `Improvement ${id} not found` }] };
        }
        eventBus.publish("improvement.changed", { source: "mcp", detail: { op: "update", id } });
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, id, status: updated.status }) }] };
      },
    );

    server.tool(
      "delete_improvement",
      "Permanently delete an improvement task. Only use this when the user explicitly says 'remove that task'. Prefer status updates over deletion so the audit trail survives.",
      { id: z.string().min(1) },
      async ({ id }) => {
        const ok = await improvements.remove(id);
        if (!ok) {
          return { isError: true, content: [{ type: "text", text: `Improvement ${id} not found` }] };
        }
        eventBus.publish("improvement.changed", { source: "mcp", detail: { op: "delete", id } });
        return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
      },
    );

    server.tool(
      "claim_improvement",
      "ATOMIC claim — call this BEFORE you start developing, verifying, or otherwise working on an improvement task to prevent duplicate work across multiple Hermes / Codex / Claude Code agents that share the same Rich backend. Returns ok=true with the task if you got it, or ok=false with conflict.current_agent_id if someone else already has it (in which case SKIP this task and look at another pending/ready_to_develop task). Same agent re-calling is idempotent (200). agent_id defaults to '<hostname>-mcp' if omitted, but you should pass your own stable id like '<hostname>-hermes'.",
      {
        id: z.string().min(1).describe("Improvement task id, e.g. 'imp-c561511e'"),
        agent_id: z.string().min(1).max(120).optional()
          .describe("Stable identifier for the calling agent. Convention: '<hostname>-<provider>' e.g. 'mac-mini.local-hermes'. If omitted, defaults to '<hostname>-mcp'."),
      },
      async ({ id, agent_id }) => {
        const effectiveAgent = agent_id ?? `${(await import("node:os")).hostname()}-mcp`;
        const existing = await improvements.get(id);
        if (!existing) {
          return { isError: true, content: [{ type: "text", text: `Improvement ${id} not found` }] };
        }
        const result = await improvements.claim(id, effectiveAgent);
        if (result.ok) {
          eventBus.publish("improvement.changed", { source: "mcp", detail: { op: "claim", id, agentId: effectiveAgent } });
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, id, assigned_agent_id: effectiveAgent }) }] };
        }
        // Soft fail — Hermes should detect ok=false and skip to another task.
        return { content: [{ type: "text", text: JSON.stringify({
          ok: false,
          id,
          conflict: {
            current_agent_id: result.conflict.currentAgentId,
            assigned_at: result.conflict.assignedAt,
          },
        }) }] };
      },
    );

    server.tool(
      "release_improvement",
      "Release a previously-claimed improvement. Call after you finish or abandon work so other agents can pick it up if needed. agent_id must match the claimer; pass force=true to override (admin / unstick a crashed peer).",
      {
        id: z.string().min(1),
        agent_id: z.string().min(1).max(120).optional()
          .describe("Same id you used when claiming. Defaults to '<hostname>-mcp' if omitted."),
        force: z.boolean().optional()
          .describe("Force-release regardless of who currently holds it. Use only when a peer agent has crashed and left the claim dangling."),
      },
      async ({ id, agent_id, force }) => {
        const effectiveAgent = agent_id ?? `${(await import("node:os")).hostname()}-mcp`;
        const existing = await improvements.get(id);
        if (!existing) {
          return { isError: true, content: [{ type: "text", text: `Improvement ${id} not found` }] };
        }
        const released = await improvements.release(id, force ? null : effectiveAgent);
        eventBus.publish("improvement.changed", { source: "mcp", detail: { op: "release", id } });
        return { content: [{ type: "text", text: JSON.stringify({
          ok: true,
          id,
          assigned_agent_id: released?.assignedAgentId ?? null,
        }) }] };
      },
    );
  }

  // ───── Toolbox bridge ───────────────────────────────────────────────
  // Exposes the user's "工具箱" (lock screen / future small tools) to Hermes
  // via two generic entry-points. This way adding a new tool only requires
  // editing the toolbox registry — no new MCP tool registration each time.
  if (deps.toolRuntime) {
    const runtime = deps.toolRuntime;

    server.tool(
      "list_toolbox_tools",
      "List every tool available in Rich's user-defined toolbox, with each tool's input schema. Call this BEFORE invoke_toolbox_tool when you're not sure which tool fits — the schema tells you valid argument names + types + defaults. Distinct from the built-in Rich MCP tools (refine / expand / etc); toolbox tools are small utilities the user defines (lock screen, timers, system actions, ...).",
      {},
      async () => {
        const tools = runtime.listTools();
        return { content: [{ type: "text", text: JSON.stringify(tools) }] };
      },
    );

    server.tool(
      "invoke_toolbox_tool",
      "Run one of the user's toolbox tools by name. Args are validated against the tool's schema (call list_toolbox_tools first if unsure). If the schema includes `delay_minutes` or `delay_seconds` and the value is > 0, the invocation is SCHEDULED — the runtime fires it later, and the response shows status='scheduled' + scheduled_for. You can monitor or cancel from Rich's Toolbox UI. Example: `name=lock_screen, args={delay_minutes: 10}` → 'in 10 minutes the screen locks'.",
      {
        name: z.string().min(1).describe("Tool name from list_toolbox_tools, e.g. 'lock_screen'"),
        args: z.record(z.string(), z.unknown()).optional()
          .describe("Tool arguments; shape comes from the tool's schema. {} or omitted = use defaults."),
      },
      async ({ name, args }) => {
        try {
          const inv = await runtime.invoke({
            toolName: name,
            args: args ?? {},
            createdBy: "hermes",
          });
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, invocation: inv }) }] };
        } catch (e) {
          return {
            isError: true,
            content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          };
        }
      },
    );
  }

  // ───── Rich mascot animation control ───────────────────────────────
  // Always registered (independent of toolRuntime / improvements). Lets
  // Hermes drive Rich's emotional state on the homepage — celebrate after
  // a successful task, think while planning a multi-step flow, alert on
  // errors. The mascot is purely cosmetic but is the visual heartbeat
  // showing the user that Rich is alive and reacting.
  server.tool(
    "list_mascot_animations",
    "List every animation Rich's homepage mascot can play. Returns name + description so you can pick the right one for the moment. The mascot animation is the user-facing emotional signal of Rich — celebrate, think, alert, sleep, etc.",
    {},
    async () => {
      const animations = listMascotAnimations();
      const state = getMascotState();
      return { content: [{ type: "text", text: JSON.stringify({ current: state.current, animations }) }] };
    },
  );

  server.tool(
    "play_mascot_animation",
    "Trigger an animation on Rich's homepage mascot. One-shot animations (celebrate / wave / transform) auto-revert to the previous loop after their duration. Loops (walk / think / happy / sad / sleep / dance / etc) stay until you switch. Use this for emotional signalling: (1) finishing a meaningful task → celebrate, (2) starting a long thought → think, (3) hitting a blocker → alert, (4) idle / waiting → sleep, (5) user explicitly asks 'dance!'. Don't switch on every micro-action — it gets jittery.",
    {
      name: z.enum([
        "walk", "idle", "celebrate", "think", "happy", "sad",
        "alert", "sleep", "dance", "wave", "transform", "ironman",
      ]).describe("Animation name from list_mascot_animations"),
      duration_ms: z.number().int().min(100).max(60_000).optional()
        .describe("Override default duration (mainly meaningful for one-shot animations)"),
    },
    async ({ name, duration_ms }) => {
      const next = playMascotAnimation({
        name, durationMs: duration_ms, triggeredBy: "hermes",
      });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, state: next }) }] };
    },
  );

  // ───── 计划管理 (Plan / Goal / Task) tools ─────────────────────────
  // Only mount when the GreatMe repo is wired (always is, in production).
  // Lets Hermes drive 大斌哥's plan execution: list/create/update/delete
  // plans/goals/tasks, run the AI decompose flow end-to-end, fetch
  // analytics blockers, and ask AI for a 推进 strategy.
  if (deps.greatMe) {
    registerPlanTools(server, deps.greatMe, deps.adapters, eventBus);
  }

  // ───── AI 语料模板 tools ─────────────────────────
  // Lets Hermes read and update 大斌哥's preferred reply templates over time.
  if (deps.corpus) {
    registerCorpusTools(server, deps.corpus, eventBus);
  }

  // ───── 项目实战 (Practice) tools ─────────────────────────
  // Always mount — uses elements / relations which always exist in production.
  registerPracticeTools(server, deps.elements, deps.relations, deps.adapters, eventBus);

  return server;
}

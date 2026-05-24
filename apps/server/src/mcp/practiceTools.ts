/**
 * MCP tools for 项目实战 (practice projects).
 * Reads/writes via the existing ElementsRepo / RelationsRepo — same data
 * the knowledge tree uses. Sub-elements are linked via "child" relations.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { AIAdapter } from "../ai/adapter.js";
import { pickAdapter } from "../ai/pickAdapter.js";
import { runDraftPrd } from "../ai/operations.js";
import type { Element, ElementType } from "@ke/domain";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function listChildren(
  elements: ElementsRepo,
  relations: RelationsRepo,
  parentId: string,
): Promise<Element[]> {
  const rels = await relations.list();
  const childIds = rels.filter(r => r.kind === "child" && r.from === parentId).map(r => r.to);
  const all = await elements.list();
  const byId = new Map(all.map(e => [e.id, e] as const));
  return childIds.map(id => byId.get(id)).filter((e): e is Element => !!e);
}

export function registerPracticeTools(
  server: McpServer,
  elements: ElementsRepo,
  relations: RelationsRepo,
  adapters: AIAdapter[],
  eventBus: import("../lib/eventBus.js").RichEventBus,
): void {
  const ok = (obj: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(obj) }] });
  const err = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });
  const fire = (op: string, detail: Record<string, unknown>): void => {
    eventBus.publish("element.changed", { source: "mcp", detail: { op, ...detail } });
  };

  // ===== practice_list =====
  server.tool(
    "practice_list",
    "List all 实战项目 (type=practice elements) with sub-element counts + dev-task progress. Use this to orient on which projects 大斌哥 has and which need attention. Each item: id, title, subtitle, counts of each sub-type (concept/case/product-design/step), and step done/total.",
    {},
    async () => {
      const all = await elements.list();
      const rels = await relations.list();
      const practices = all.filter(e => e.type === "practice");
      const result = practices.map(p => {
        const childIds = rels.filter(r => r.kind === "child" && r.from === p.id).map(r => r.to);
        const children = childIds.map(id => all.find(e => e.id === id)).filter((e): e is Element => !!e);
        const counts: Record<string, number> = { concept: 0, case: 0, "product-design": 0, step: 0 };
        let stepDone = 0;
        for (const c of children) {
          if (c.type in counts) counts[c.type]++;
          if (c.type === "step" && c.status === "done") stepDone++;
        }
        return {
          id: p.id,
          title: p.title,
          subtitle: p.subtitle ?? null,
          tags: p.tags ?? [],
          counts,
          stepDone,
          stepTotal: counts.step,
        };
      });
      return ok({ count: result.length, practices: result });
    },
  );

  // ===== practice_get =====
  server.tool(
    "practice_get",
    "Fetch a single practice project with all its sub-elements grouped by type (knowledge/requirements/PRD/dev-task). Returns the full structure for a deep look.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const p = await elements.get(id);
      if (!p || p.type !== "practice") return err(`Practice ${id} not found`);
      const children = await listChildren(elements, relations, id);
      const grouped = {
        knowledge: children.filter(c => c.type === "concept"),
        requirements: children.filter(c => c.type === "case"),
        prds: children.filter(c => c.type === "product-design"),
        tasks: children.filter(c => c.type === "step"),
      };
      return ok({ practice: p, children: grouped });
    },
  );

  // ===== practice_create =====
  server.tool(
    "practice_create",
    "Create a new 实战项目 (practice element). After creation, use practice_add_child to populate it with knowledge points / requirements / PRDs / dev tasks.",
    {
      title: z.string().min(1).max(280),
      subtitle: z.string().max(280).optional(),
      tags: z.array(z.string().max(40)).max(10).default([]),
    },
    async ({ title, subtitle, tags }) => {
      const now = new Date().toISOString();
      const newElement: Element = {
        id: uid("e"),
        type: "practice",
        title,
        subtitle,
        tags,
        content: {},
        metadata: {
          createdAt: now,
          updatedAt: now,
          generatedBy: "ai",
          richness: 1,
        },
      };
      await elements.put(newElement);
      fire("practice.create", { id: newElement.id });
      return ok({ ok: true, element: newElement });
    },
  );

  // ===== practice_add_child =====
  server.tool(
    "practice_add_child",
    "Add a sub-element (concept/case/product-design/step) under a practice. Automatically creates the 'child' relation from practice → new sub-element. Use type=concept for knowledge points, case for requirement analyses, product-design for PRD docs, step for dev tasks.",
    {
      practiceId: z.string().min(1),
      type: z.enum(["concept", "case", "product-design", "step"] as [ElementType, ...ElementType[]]),
      title: z.string().min(1).max(280),
      subtitle: z.string().max(280).optional(),
      content: z.unknown().optional().describe("Optional rich content. Free-form per element type."),
      status: z.enum(["todo", "doing", "done"]).optional().describe("Only meaningful when type=step. Default todo."),
    },
    async ({ practiceId, type, title, subtitle, content, status }) => {
      const parent = await elements.get(practiceId);
      if (!parent || parent.type !== "practice") return err(`Practice ${practiceId} not found`);
      const now = new Date().toISOString();
      const newEl: Element = {
        id: uid("e"),
        type: type as ElementType,
        title,
        subtitle,
        content: content ?? {},
        status: type === "step" ? (status ?? "todo") : undefined,
        metadata: {
          createdAt: now,
          updatedAt: now,
          generatedBy: "ai",
          richness: 1,
        },
      };
      await elements.put(newEl);
      await relations.append([{
        id: uid("r"),
        from: practiceId,
        to: newEl.id,
        kind: "child",
        createdAt: now,
      }]);
      fire("practice.add_child", { practiceId, childId: newEl.id, type });
      return ok({ ok: true, element: newEl });
    },
  );

  // ===== practice_set_task_status =====
  server.tool(
    "practice_set_task_status",
    "Set the status of a dev-task (step element) to todo/doing/done. Quickest tool for marking task progress. Use task_complete in 计划管理 for plan tasks; this one is for project step elements.",
    {
      id: z.string().min(1),
      status: z.enum(["todo", "doing", "done"]),
    },
    async ({ id, status }) => {
      const e = await elements.get(id);
      if (!e) return err(`Element ${id} not found`);
      if (e.type !== "step") return err(`Element ${id} is type=${e.type}, not step`);
      const updated: Element = {
        ...e,
        status,
        metadata: { ...e.metadata, updatedAt: new Date().toISOString() },
      };
      await elements.put(updated);
      fire("practice.task_status", { id, status });
      return ok({ ok: true, element: updated });
    },
  );

  // ===== draft_prd =====
  server.tool(
    "draft_prd",
    "🪄 Ask Hermes to draft a PRD for a practice project based on its existing sub-elements (knowledge points, requirements). Writes the result as a new product-design child element. Takes 30-90s.",
    {
      practiceId: z.string().min(1),
      extraContext: z.string().max(2000).optional().describe("Optional: any specific requirements or scope hints"),
      model: z.enum(["claude-code", "codex", "hermes"]).optional(),
    },
    async ({ practiceId, extraContext, model }) => {
      const p = await elements.get(practiceId);
      if (!p || p.type !== "practice") return err(`Practice ${practiceId} not found`);
      const adapter = pickAdapter(adapters, model);
      if (!(await adapter.available())) return err(`${adapter.name} unavailable`);

      const children = await listChildren(elements, relations, practiceId);

      let result: import("../ai/operations.js").DraftPrdResult | null = null;
      let lastError = "";
      for await (const ev of runDraftPrd(adapter, {
        practice: { title: p.title, subtitle: p.subtitle, content: p.content },
        children: children.map(c => ({ type: c.type, title: c.title, subtitle: c.subtitle, content: c.content })),
        extraContext,
      })) {
        if (ev.type === "error") { lastError = ev.message; break; }
        if (ev.type === "done") { result = ev.result; break; }
      }
      if (!result) return err(lastError || "draft-prd failed");

      // Persist as a product-design child
      const now = new Date().toISOString();
      const prdEl: Element = {
        id: uid("e"),
        type: "product-design",
        title: result.title,
        content: result.sections,
        metadata: {
          createdAt: now,
          updatedAt: now,
          generatedBy: "ai",
          aiModel: adapter.name,
          richness: 2,
        },
      };
      await elements.put(prdEl);
      await relations.append([{
        id: uid("r"),
        from: practiceId,
        to: prdEl.id,
        kind: "child",
        createdAt: now,
      }]);
      fire("practice.draft_prd", { practiceId, prdId: prdEl.id });
      return ok({ ok: true, prdId: prdEl.id, title: result.title });
    },
  );
}

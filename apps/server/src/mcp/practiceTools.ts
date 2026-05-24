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
    "List 实战项目 — practice elements TAGGED with '实战项目' (the project-mode switch). Untagged practice elements are 'best-practice / 实战经验' entries from the knowledge tree and don't show here. Use includeAll=true to see ALL practice elements (including untagged seed/knowledge entries) for promotion workflows. Returns counts of sub-types + step done/total.",
    {
      includeAll: z.boolean().default(false).describe("true = include practice elements without the '实战项目' tag (the knowledge-tree best-practice entries). Default false → only project-mode practices."),
    },
    async ({ includeAll }) => {
      const all = await elements.list();
      const rels = await relations.list();
      const byId = new Map(all.map(e => [e.id, e] as const));
      const childrenOf = (pid: string): Element[] => rels
        .filter(r => r.kind === "child" && r.from === pid)
        .map(r => byId.get(r.to))
        .filter((e): e is Element => !!e);

      let practices = all.filter(e => e.type === "practice");
      if (!includeAll) {
        practices = practices.filter(p => (p.tags ?? []).includes("实战项目"));
      }
      const result = practices.map(p => {
        // 新结构：practice → groups → 实际子元；递归一层去聚合
        const directChildren = childrenOf(p.id);
        const allDescendants: Element[] = [];
        for (const c of directChildren) {
          if (c.type === "group") allDescendants.push(...childrenOf(c.id));
          else allDescendants.push(c);  // 历史孤儿数据兼容
        }
        // 用新 type 计数，兼容老数据（concept/case/product-design/step）算同类
        const counts = { knowledge: 0, requirement: 0, prd: 0, "dev-task": 0 };
        let stepDone = 0;
        for (const c of allDescendants) {
          if (c.type === "knowledge" || c.type === "concept") counts.knowledge++;
          else if (c.type === "requirement" || c.type === "case") counts.requirement++;
          else if (c.type === "prd" || c.type === "product-design") counts.prd++;
          else if (c.type === "dev-task" || c.type === "step") {
            counts["dev-task"]++;
            if (c.status === "done") stepDone++;
          }
        }
        return {
          id: p.id,
          title: p.title,
          subtitle: p.subtitle ?? null,
          tags: p.tags ?? [],
          counts,
          stepDone,
          stepTotal: counts["dev-task"],
        };
      });
      return ok({ count: result.length, practices: result });
    },
  );

  // ===== practice_get =====
  server.tool(
    "practice_get",
    "Fetch a practice project with its group structure: practice → groups → typed children. Each group has its own children array. Use this to understand the project hierarchy before adding/editing.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const p = await elements.get(id);
      if (!p || p.type !== "practice") return err(`Practice ${id} not found`);
      const directChildren = await listChildren(elements, relations, id);
      const groups = directChildren.filter(c => c.type === "group");
      const looseChildren = directChildren.filter(c => c.type !== "group");

      // 每个 group 拉它自己的子元
      const groupsWithChildren = await Promise.all(groups.map(async g => ({
        id: g.id,
        title: g.title,
        children: await listChildren(elements, relations, g.id),
      })));

      return ok({
        practice: p,
        groups: groupsWithChildren,
        looseChildren,  // 没挂在 group 下的旧数据（兼容历史）
      });
    },
  );

  // ===== practice_create =====
  server.tool(
    "practice_create",
    "Create a new 实战项目 (practice element) + 4 default groups (知识点 / 需求分析 / PRD / 开发任务). Auto-tagged '实战项目'. After creation, use practice_add_child to populate each group; pass the group's id as parentId.",
    {
      title: z.string().min(1).max(280),
      subtitle: z.string().max(280).optional(),
      tags: z.array(z.string().max(40)).max(10).default([]),
    },
    async ({ title, subtitle, tags }) => {
      const now = new Date().toISOString();
      const finalTags = tags.includes("实战项目") ? tags : ["实战项目", ...tags];
      const practice: Element = {
        id: uid("e"),
        type: "practice",
        title,
        subtitle,
        tags: finalTags,
        content: {},
        metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
      };
      await elements.put(practice);

      // 顺序建 4 个默认分组（顺序 = 创建顺序 = UI 渲染顺序）
      const defaults = ["知识点", "需求分析", "PRD", "开发任务"];
      const groups: Element[] = [];
      for (const g of defaults) {
        const grp: Element = {
          id: uid("e"),
          type: "group",
          title: g,
          content: {},
          metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
        };
        await elements.put(grp);
        await relations.append([{
          id: uid("r"), from: practice.id, to: grp.id, kind: "child", createdAt: now,
        }]);
        groups.push(grp);
      }

      fire("practice.create", { id: practice.id, groupCount: groups.length });
      return ok({ ok: true, element: practice, groups: groups.map(g => ({ id: g.id, title: g.title })) });
    },
  );

  // ===== practice_add_child =====
  server.tool(
    "practice_add_child",
    "Add a sub-element (knowledge/requirement/prd/dev-task) under a GROUP inside a practice. Pass parentId = the group's id (use practice_get to find groups). If parentId is a practice element, the tool auto-routes to a sensible default group based on type: knowledge→知识点, requirement→需求分析, prd→PRD, dev-task→开发任务 (creating the group if missing).",
    {
      parentId: z.string().min(1).describe("Group element id (preferred) or practice element id (auto-routes)."),
      type: z.enum(["knowledge", "requirement", "prd", "dev-task"] as [ElementType, ...ElementType[]]),
      title: z.string().min(1).max(280),
      subtitle: z.string().max(280).optional(),
      content: z.unknown().optional().describe("Optional rich content. Free-form per element type."),
      status: z.enum(["todo", "doing", "done"]).optional().describe("Only meaningful when type=dev-task. Default todo."),
    },
    async ({ parentId, type, title, subtitle, content, status }) => {
      const parent = await elements.get(parentId);
      if (!parent) return err(`Element ${parentId} not found`);

      const now = new Date().toISOString();
      let effectiveParentId = parentId;

      // 如果传的是 practice id，自动路由到对应的默认分组（不存在则建）
      if (parent.type === "practice") {
        const DEFAULT_GROUP: Record<string, string> = {
          knowledge: "知识点",
          requirement: "需求分析",
          prd: "PRD",
          "dev-task": "开发任务",
        };
        const wantedGroupTitle = DEFAULT_GROUP[type];
        const rels = await relations.list();
        const childIds = rels.filter(r => r.kind === "child" && r.from === parent.id).map(r => r.to);
        const all = await elements.list();
        const byId = new Map(all.map(e => [e.id, e] as const));
        const existingGroup = childIds
          .map(id => byId.get(id))
          .find(e => e?.type === "group" && e.title === wantedGroupTitle);
        if (existingGroup) {
          effectiveParentId = existingGroup.id;
        } else {
          const newGroup: Element = {
            id: uid("e"),
            type: "group",
            title: wantedGroupTitle,
            content: {},
            metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
          };
          await elements.put(newGroup);
          await relations.append([{
            id: uid("r"), from: parent.id, to: newGroup.id, kind: "child", createdAt: now,
          }]);
          effectiveParentId = newGroup.id;
        }
      } else if (parent.type !== "group") {
        return err(`parentId must be a practice or group element, got type=${parent.type}`);
      }

      const newEl: Element = {
        id: uid("e"),
        type: type as ElementType,
        title,
        subtitle,
        content: content ?? {},
        status: type === "dev-task" ? (status ?? "todo") : undefined,
        metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
      };
      await elements.put(newEl);
      await relations.append([{
        id: uid("r"),
        from: effectiveParentId,
        to: newEl.id,
        kind: "child",
        createdAt: now,
      }]);
      fire("practice.add_child", { parentId: effectiveParentId, childId: newEl.id, type });
      return ok({ ok: true, element: newEl, parentId: effectiveParentId });
    },
  );

  // ===== practice_add_group =====
  server.tool(
    "practice_add_group",
    "Add a new group element under a practice. Groups organize sub-elements (knowledge / requirements / PRD / dev-tasks etc.) inside a project. By default a new practice gets 4 groups; use this to add custom ones.",
    {
      practiceId: z.string().min(1),
      title: z.string().min(1).max(120),
    },
    async ({ practiceId, title }) => {
      const parent = await elements.get(practiceId);
      if (!parent || parent.type !== "practice") return err(`Practice ${practiceId} not found`);
      const now = new Date().toISOString();
      const grp: Element = {
        id: uid("e"),
        type: "group",
        title,
        content: {},
        metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
      };
      await elements.put(grp);
      await relations.append([{
        id: uid("r"), from: practiceId, to: grp.id, kind: "child", createdAt: now,
      }]);
      fire("practice.add_group", { practiceId, groupId: grp.id });
      return ok({ ok: true, element: grp });
    },
  );

  // ===== practice_set_project_mode =====
  server.tool(
    "practice_set_project_mode",
    "Toggle whether a practice element appears in the 项目实战 list. Adds/removes the '实战项目' tag. Use enabled=true to promote a knowledge-tree practice (一条实战经验) into a managed project; enabled=false to demote it back (it stays in the knowledge tree).",
    {
      id: z.string().min(1),
      enabled: z.boolean().describe("true = show in 项目实战 page; false = remove from 项目实战 list (stays in knowledge tree)"),
    },
    async ({ id, enabled }) => {
      const e = await elements.get(id);
      if (!e) return err(`Element ${id} not found`);
      if (e.type !== "practice") return err(`Element ${id} is type=${e.type}, not practice`);
      const currentTags = e.tags ?? [];
      const hasTag = currentTags.includes("实战项目");
      let nextTags: string[];
      if (enabled && !hasTag) nextTags = ["实战项目", ...currentTags];
      else if (!enabled && hasTag) nextTags = currentTags.filter(t => t !== "实战项目");
      else nextTags = currentTags;  // already in desired state
      const updated: Element = {
        ...e,
        tags: nextTags,
        metadata: { ...e.metadata, updatedAt: new Date().toISOString() },
      };
      await elements.put(updated);
      fire("practice.set_project_mode", { id, enabled });
      return ok({ ok: true, element: updated, projectMode: enabled });
    },
  );

  // ===== practice_set_task_status =====
  server.tool(
    "practice_set_task_status",
    "Set the status of a dev-task element to todo/doing/done. Used for 项目实战 dev tasks; for 计划管理 plan tasks use task_complete instead.",
    {
      id: z.string().min(1),
      status: z.enum(["todo", "doing", "done"]),
    },
    async ({ id, status }) => {
      const e = await elements.get(id);
      if (!e) return err(`Element ${id} not found`);
      // 兼容老数据：旧版用 step type，新版用 dev-task
      if (e.type !== "dev-task" && e.type !== "step") {
        return err(`Element ${id} is type=${e.type}, not dev-task`);
      }
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

      // 新结构：practice → groups → 实际子元。draft_prd 需要扁平化所有非 group 后代
      const directChildren = await listChildren(elements, relations, practiceId);
      const contentChildren: Element[] = [];
      for (const c of directChildren) {
        if (c.type === "group") {
          const grandchildren = await listChildren(elements, relations, c.id);
          contentChildren.push(...grandchildren);
        } else {
          contentChildren.push(c);  // 历史 / 未归到 group 的孤儿
        }
      }

      let result: import("../ai/operations.js").DraftPrdResult | null = null;
      let lastError = "";
      for await (const ev of runDraftPrd(adapter, {
        practice: { title: p.title, subtitle: p.subtitle, content: p.content },
        children: contentChildren.map(c => ({ type: c.type, title: c.title, subtitle: c.subtitle, content: c.content })),
        extraContext,
      })) {
        if (ev.type === "error") { lastError = ev.message; break; }
        if (ev.type === "done") { result = ev.result; break; }
      }
      if (!result) return err(lastError || "draft-prd failed");

      // Persist as a product-design child under the "PRD" group
      const now = new Date().toISOString();

      // 找/建 PRD 分组
      let prdGroupId: string | null = null;
      const dirRels = await relations.list();
      const dirChildIds = dirRels.filter(r => r.kind === "child" && r.from === practiceId).map(r => r.to);
      const allEls = await elements.list();
      const byId = new Map(allEls.map(e => [e.id, e] as const));
      const existingPrdGroup = dirChildIds
        .map(id => byId.get(id))
        .find(e => e?.type === "group" && e.title === "PRD");
      if (existingPrdGroup) {
        prdGroupId = existingPrdGroup.id;
      } else {
        const grp: Element = {
          id: uid("e"),
          type: "group",
          title: "PRD",
          content: {},
          metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
        };
        await elements.put(grp);
        await relations.append([{
          id: uid("r"), from: practiceId, to: grp.id, kind: "child", createdAt: now,
        }]);
        prdGroupId = grp.id;
      }

      const prdEl: Element = {
        id: uid("e"),
        type: "prd",
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
        from: prdGroupId,
        to: prdEl.id,
        kind: "child",
        createdAt: now,
      }]);
      fire("practice.draft_prd", { practiceId, prdId: prdEl.id, groupId: prdGroupId });
      return ok({ ok: true, prdId: prdEl.id, title: result.title, groupId: prdGroupId });
    },
  );
}

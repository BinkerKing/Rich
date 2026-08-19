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
import { pickScenarioAdapter } from "../ai/pickAdapter.js";
import { runDraftPrd, runDraftChild, runAdjustChild } from "../ai/operations.js";
import type { Inquiry } from "../ai/operations.js";
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
    "Create a new 实战项目 (practice element) + 7 default groups (知识点 / 场景分析 / 功能说明 / PRD / 开发任务 / 整改建议 / 提问). Auto-tagged '实战项目'. After creation, use practice_add_child to populate each group; pass the group's id as parentId.",
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

      // 顺序建 7 个默认分组（顺序 = 创建顺序 = UI 渲染顺序）
      const defaults = ["知识点", "场景分析", "功能说明", "PRD", "开发任务", "整改建议", "提问"];
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
    "Add a sub-element (knowledge/requirement/feature/prd/dev-task/revision/inquiry) under a GROUP inside a practice. Pass parentId = the group's id (use practice_get to find groups). If parentId is a practice element, the tool auto-routes to a sensible default group based on type: knowledge→知识点, requirement→场景分析, feature→功能说明, prd→PRD, dev-task→开发任务, revision→整改建议, inquiry→提问 (creating the group if missing).",
    {
      parentId: z.string().min(1).describe("Group element id (preferred) or practice element id (auto-routes)."),
      type: z.enum(["knowledge", "requirement", "feature", "prd", "dev-task", "revision", "inquiry"] as [ElementType, ...ElementType[]]),
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
          requirement: "场景分析",
          feature: "功能说明",
          prd: "PRD",
          "dev-task": "开发任务",
          revision: "整改建议",
          inquiry: "提问",
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
      const adapter = pickScenarioAdapter(adapters, "project-practice", model);
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
      // 落地 AI 提出的 inquiries
      const inquiryIds = await persistInquiries(
        elements, relations, practiceId, prdEl.id, result.inquiries ?? [],
      );

      fire("practice.draft_prd", { practiceId, prdId: prdEl.id, groupId: prdGroupId });
      return ok({
        ok: true, prdId: prdEl.id, title: result.title, groupId: prdGroupId,
        inquiries: inquiryIds.length,
      });
    },
  );

  // ===== practice_patch_child =====
  // 增量更新一个子元（title / subtitle / content / status / tags）。
  // 用于不调 AI、直接改某个字段；比 add_child 后删旧的更轻。
  server.tool(
    "practice_patch_child",
    "Patch fields of an existing practice sub-element (title / subtitle / content / status / tags). Only fields you pass get updated; others stay. Use this for surgical edits without AI.",
    {
      elementId: z.string().min(1),
      title: z.string().min(1).max(280).optional(),
      subtitle: z.string().max(400).optional(),
      content: z.unknown().optional().describe("If passed, REPLACES the whole content object."),
      status: z.enum(["todo", "doing", "done"]).optional(),
      tags: z.array(z.string().max(40)).max(20).optional(),
    },
    async ({ elementId, title, subtitle, content, status, tags }) => {
      const el = await elements.get(elementId);
      if (!el) return err(`Element ${elementId} not found`);
      const next: Element = { ...el, metadata: { ...el.metadata, updatedAt: new Date().toISOString() } };
      if (title !== undefined) next.title = title.trim();
      if (subtitle !== undefined) next.subtitle = subtitle.trim() || undefined;
      if (content !== undefined) next.content = content;
      if (status !== undefined) next.status = status;
      if (tags !== undefined) next.tags = tags;
      await elements.put(next);
      fire("practice.patch_child", { id: elementId, type: el.type });
      return ok({ ok: true, element: next });
    },
  );

  // ===== practice_delete_child =====
  // 级联删除：元 + 所有以它为父的子元 + 所有 relation。
  server.tool(
    "practice_delete_child",
    "Delete a practice sub-element. Cascades: removes the element + all its descendants + all relations. Cannot be undone.",
    {
      elementId: z.string().min(1),
    },
    async ({ elementId }) => {
      const el = await elements.get(elementId);
      if (!el) return err(`Element ${elementId} not found`);
      // BFS 收集要删的 id
      const allRels = await relations.list();
      const toDelete = new Set<string>([elementId]);
      const queue = [elementId];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const r of allRels) {
          if (r.kind === "child" && r.from === cur && !toDelete.has(r.to)) {
            toDelete.add(r.to);
            queue.push(r.to);
          }
        }
      }
      const idsArr = Array.from(toDelete);
      await relations.removeForElements(idsArr);
      await elements.removeMany(idsArr);
      fire("practice.delete_child", { id: elementId, cascadeCount: toDelete.size });
      return ok({ ok: true, deletedIds: idsArr, count: toDelete.size });
    },
  );

  // ===== practice_draft_child =====
  // AI 起草一个子元（知识点/场景分析/功能说明/开发任务/整改建议），输出 title+subtitle+content+inquiries。
  // 自动挂到对应分组下；inquiries 落到 "提问" 分组。
  server.tool(
    "practice_draft_child",
    "🪄 Ask Hermes to draft a single sub-element for a practice (knowledge / requirement / feature / dev-task / revision). AI generates title + subtitle + content based on the project context + user direction. If AI raises questions, they auto-land in the '提问' group. Takes 15-40s.",
    {
      practiceId: z.string().min(1),
      groupType: z.enum(["knowledge", "requirement", "feature", "dev-task", "revision"]),
      direction: z.string().min(1).max(1000).describe("What you want this element to be about (short sentence or two)"),
      model: z.enum(["claude-code", "codex", "hermes"]).optional(),
    },
    async ({ practiceId, groupType, direction, model }) => {
      const p = await elements.get(practiceId);
      if (!p || p.type !== "practice") return err(`Practice ${practiceId} not found`);
      const adapter = pickScenarioAdapter(adapters, "project-practice", model);
      if (!(await adapter.available())) return err(`${adapter.name} unavailable`);

      const GROUP_TITLE: Record<string, string> = {
        knowledge: "知识点",
        requirement: "场景分析",
        feature: "功能说明",
        "dev-task": "开发任务",
        revision: "整改建议",
      };
      const targetGroupTitle = GROUP_TITLE[groupType];

      // 找/建目标分组
      const groupId = await ensureGroup(elements, relations, practiceId, targetGroupTitle);
      const existing = await listChildren(elements, relations, groupId);

      let result: import("../ai/operations.js").DraftChildResult | null = null;
      let lastError = "";
      for await (const ev of runDraftChild(adapter, {
        practice: { title: p.title, subtitle: p.subtitle, content: p.content },
        groupType,
        existingTitles: existing.map(c => c.title),
        direction,
      })) {
        if (ev.type === "error") { lastError = ev.message; break; }
        if (ev.type === "done") { result = ev.result; break; }
      }
      if (!result) return err(lastError || "draft-child failed");

      const now = new Date().toISOString();
      const newEl: Element = {
        id: uid("e"),
        type: groupType as ElementType,
        title: result.title,
        subtitle: result.subtitle || undefined,
        content: result.content,
        metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", aiModel: adapter.name, richness: 2 },
      };
      await elements.put(newEl);
      await relations.append([{
        id: uid("r"), from: groupId, to: newEl.id, kind: "child", createdAt: now,
      }]);

      // AI 提出的不确定点 → 挂到 "提问" 分组
      const inquiryIds = await persistInquiries(
        elements, relations, practiceId, newEl.id, result.inquiries ?? [],
      );

      fire("practice.draft_child", { practiceId, childId: newEl.id, groupType });
      return ok({
        ok: true, childId: newEl.id, groupId,
        title: newEl.title, subtitle: newEl.subtitle,
        inquiries: inquiryIds.length,
      });
    },
  );

  // ===== practice_adjust_child =====
  // 基于"当前内容 + 调整方向"重写一个已有子元。整版替换 title+subtitle+content。
  server.tool(
    "practice_adjust_child",
    "🪄 Ask Hermes to adjust an existing practice sub-element based on a direction (e.g. 'make painPoint more concrete' / 'add an example'). AI re-writes the whole element preserving the content field structure. Takes 15-40s.",
    {
      elementId: z.string().min(1),
      direction: z.string().min(1).max(1000),
      model: z.enum(["claude-code", "codex", "hermes"]).optional(),
    },
    async ({ elementId, direction, model }) => {
      const el = await elements.get(elementId);
      if (!el) return err(`Element ${elementId} not found`);
      const ADJUSTABLE = new Set(["knowledge", "requirement", "feature", "prd", "dev-task", "revision"]);
      if (!ADJUSTABLE.has(el.type)) {
        return err(`Element type '${el.type}' is not adjustable. Adjustable: knowledge / requirement / feature / prd / dev-task / revision.`);
      }

      // 找所属 practice：el ← group ← practice
      const allRels = await relations.list();
      const parentRel = allRels.find(r => r.kind === "child" && r.to === el.id);
      if (!parentRel) return err(`Element ${elementId} has no parent`);
      const parent = await elements.get(parentRel.from);
      let practice: Element | null = null;
      if (parent?.type === "practice") {
        practice = parent;
      } else if (parent?.type === "group") {
        const gpRel = allRels.find(r => r.kind === "child" && r.to === parent.id);
        if (gpRel) {
          const gp = await elements.get(gpRel.from);
          if (gp?.type === "practice") practice = gp;
        }
      }
      if (!practice) return err(`Could not find parent practice for ${elementId}`);

      const adapter = pickScenarioAdapter(adapters, "project-practice", model);
      if (!(await adapter.available())) return err(`${adapter.name} unavailable`);

      let result: import("../ai/operations.js").AdjustChildResult | null = null;
      let lastError = "";
      for await (const ev of runAdjustChild(adapter, {
        practice: { title: practice.title, subtitle: practice.subtitle, content: practice.content },
        groupType: el.type as "knowledge" | "requirement" | "feature" | "prd" | "dev-task" | "revision",
        current: { title: el.title, subtitle: el.subtitle, content: el.content },
        direction,
      })) {
        if (ev.type === "error") { lastError = ev.message; break; }
        if (ev.type === "done") { result = ev.result; break; }
      }
      if (!result) return err(lastError || "adjust-child failed");

      const now = new Date().toISOString();
      const updated: Element = {
        ...el,
        title: result.title,
        subtitle: result.subtitle || undefined,
        content: result.content,
        metadata: { ...el.metadata, updatedAt: now, aiModel: adapter.name },
      };
      await elements.put(updated);

      const inquiryIds = await persistInquiries(
        elements, relations, practice.id, el.id, result.inquiries ?? [],
      );

      fire("practice.adjust_child", { elementId, practiceId: practice.id });
      return ok({
        ok: true, element: updated,
        inquiries: inquiryIds.length,
      });
    },
  );

  // ===== practice_list_inquiries =====
  // 列出待回答的提问（按 practice 过滤或全局）
  server.tool(
    "practice_list_inquiries",
    "List pending inquiries (questions raised by Rich that need 大斌哥's answer). Filter by practice or get all open ones. Use this to check 'what's waiting for me'.",
    {
      practiceId: z.string().optional().describe("Optional: filter to one practice. Omit = all practices."),
      includeAnswered: z.boolean().default(false).describe("Include already-answered inquiries"),
    },
    async ({ practiceId, includeAnswered }) => {
      const all = await elements.list();
      const allRels = await relations.list();
      const inquiries = all.filter(e => e.type === "inquiry");
      const filtered = inquiries.filter(inq => {
        if (!includeAnswered && inq.status === "done") return false;
        if (!practiceId) return true;
        // 反向追到顶层 practice
        const ancestors = findAncestors(inq.id, allRels);
        return ancestors.includes(practiceId);
      });
      return ok({
        count: filtered.length,
        inquiries: filtered.map(i => ({
          id: i.id,
          title: i.title,
          status: i.status ?? "todo",
          question: (i.content as { question?: string })?.question,
          options: (i.content as { options?: unknown[] })?.options,
          importance: (i.content as { importance?: string })?.importance,
          context: (i.content as { context?: string })?.context,
          relatedTo: (i.content as { relatedTo?: string })?.relatedTo,
        })),
      });
    },
  );

  // ===== practice_answer_inquiry =====
  // 回答一个提问：选择 option 或写自定义答案
  server.tool(
    "practice_answer_inquiry",
    "Answer an inquiry (the questions Rich raised). Either pick an option by index (0-based) OR provide a customAnswer text. Marks the inquiry as 'done'.",
    {
      inquiryId: z.string().min(1),
      optionIndex: z.number().int().min(0).optional().describe("0-based index of the chosen option. Omit if using customAnswer."),
      customAnswer: z.string().max(1000).optional().describe("Free-text answer. Omit if using optionIndex."),
    },
    async ({ inquiryId, optionIndex, customAnswer }) => {
      const el = await elements.get(inquiryId);
      if (!el || el.type !== "inquiry") return err(`Inquiry ${inquiryId} not found`);
      if (optionIndex === undefined && !customAnswer?.trim()) {
        return err("Must provide either optionIndex or customAnswer");
      }
      const now = new Date().toISOString();
      const oldContent = (el.content ?? {}) as Record<string, unknown>;
      const nextContent = {
        ...oldContent,
        selectedOption: optionIndex !== undefined ? optionIndex : -1,
        customAnswer: customAnswer?.trim() || undefined,
        answeredAt: now,
      };
      const updated: Element = {
        ...el,
        content: nextContent,
        status: "done" as const,
        metadata: { ...el.metadata, updatedAt: now },
      };
      await elements.put(updated);
      fire("practice.answer_inquiry", { id: inquiryId });
      return ok({ ok: true, element: updated });
    },
  );

  // ===== practice_delete_group =====
  // 级联删除一个分组 + 它下面所有的子元
  server.tool(
    "practice_delete_group",
    "Delete a group inside a practice + all its child elements (cascade). Cannot be undone.",
    {
      groupId: z.string().min(1),
    },
    async ({ groupId }) => {
      const g = await elements.get(groupId);
      if (!g || g.type !== "group") return err(`Group ${groupId} not found`);
      const allRels = await relations.list();
      const toDelete = new Set<string>([groupId]);
      const queue = [groupId];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const r of allRels) {
          if (r.kind === "child" && r.from === cur && !toDelete.has(r.to)) {
            toDelete.add(r.to);
            queue.push(r.to);
          }
        }
      }
      const idsArr = Array.from(toDelete);
      await relations.removeForElements(idsArr);
      await elements.removeMany(idsArr);
      fire("practice.delete_group", { groupId, cascadeCount: toDelete.size });
      return ok({ ok: true, deletedIds: idsArr, count: toDelete.size });
    },
  );

  // ===== practice_rename_group =====
  server.tool(
    "practice_rename_group",
    "Rename a group inside a practice. Sub-elements keep their type; only the group's display label changes.",
    {
      groupId: z.string().min(1),
      title: z.string().min(1).max(120),
    },
    async ({ groupId, title }) => {
      const g = await elements.get(groupId);
      if (!g || g.type !== "group") return err(`Group ${groupId} not found`);
      const updated: Element = {
        ...g,
        title: title.trim(),
        metadata: { ...g.metadata, updatedAt: new Date().toISOString() },
      };
      await elements.put(updated);
      fire("practice.rename_group", { groupId, title });
      return ok({ ok: true, group: updated });
    },
  );

  // ===== practice_set_revision_decision =====
  // 快速给一个 revision 元打 decision 标记（做 / 暂缓 / 不做）
  server.tool(
    "practice_set_revision_decision",
    "Set the decision field on a revision element (做 / 暂缓 / 不做). Convenience wrapper over patch_child — just updates content.decision without rewriting other fields.",
    {
      revisionId: z.string().min(1),
      decision: z.enum(["做", "暂缓", "不做"]),
      reason: z.string().max(400).optional(),
    },
    async ({ revisionId, decision, reason }) => {
      const el = await elements.get(revisionId);
      if (!el || el.type !== "revision") return err(`Revision ${revisionId} not found`);
      const oldContent = (el.content ?? {}) as Record<string, unknown>;
      const decisionStr = reason ? `${decision} —— ${reason}` : decision;
      const updated: Element = {
        ...el,
        content: { ...oldContent, decision: decisionStr },
        metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
      };
      await elements.put(updated);
      fire("practice.set_revision_decision", { revisionId, decision });
      return ok({ ok: true, element: updated });
    },
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 找/建一个 practice 下的指定 group。返回 group id。
 */
async function ensureGroup(
  elements: ElementsRepo,
  relations: RelationsRepo,
  practiceId: string,
  groupTitle: string,
): Promise<string> {
  const rels = await relations.list();
  const childIds = rels.filter(r => r.kind === "child" && r.from === practiceId).map(r => r.to);
  const all = await elements.list();
  const byId = new Map(all.map(e => [e.id, e] as const));
  const existing = childIds
    .map(id => byId.get(id))
    .find(e => e?.type === "group" && e.title === groupTitle);
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const grp: Element = {
    id: `${groupTitle.replace(/[^\w一-鿿]+/g, "-").slice(0, 30)}-${Math.random().toString(36).slice(2, 7)}`,
    type: "group",
    title: groupTitle,
    content: {},
    metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
  };
  await elements.put(grp);
  await relations.append([{
    id: `${practiceId}-child-${grp.id}`,
    from: practiceId, to: grp.id, kind: "child", createdAt: now,
  }]);
  return grp.id;
}

/**
 * AI 提出的 inquiries[] → 挂在 practice 下的 "提问" 分组里。
 * 返回新建的 inquiry id 数组。
 */
async function persistInquiries(
  elements: ElementsRepo,
  relations: RelationsRepo,
  practiceId: string,
  relatedToId: string,
  inquiries: Inquiry[],
): Promise<string[]> {
  if (inquiries.length === 0) return [];
  const groupId = await ensureGroup(elements, relations, practiceId, "提问");
  const askedAt = new Date().toISOString();
  const createdIds: string[] = [];
  for (const inq of inquiries) {
    const titleRaw = inq.question.trim();
    const title = titleRaw.length > 60 ? titleRaw.slice(0, 60) + "…" : titleRaw;
    const inqEl: Element = {
      id: `inquiry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type: "inquiry",
      title,
      subtitle: inq.context || undefined,
      content: {
        question: inq.question,
        options: inq.options,
        context: inq.context,
        importance: inq.importance,
        relatedTo: relatedToId,
        askedAt,
      },
      status: "todo" as const,
      metadata: { createdAt: askedAt, updatedAt: askedAt, generatedBy: "ai", richness: 1 },
    };
    await elements.put(inqEl);
    await relations.append([{
      id: `${groupId}-child-${inqEl.id}`,
      from: groupId, to: inqEl.id, kind: "child", createdAt: askedAt,
    }]);
    createdIds.push(inqEl.id);
  }
  return createdIds;
}

/**
 * 反向追溯祖先链（用 child relation 逆向走）。返回从直接父到顶层的 id 数组。
 */
function findAncestors(elementId: string, rels: Array<{ kind: string; from: string; to: string }>): string[] {
  const ancestors: string[] = [];
  let current = elementId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const parentRel = rels.find(r => r.kind === "child" && r.to === current);
    if (!parentRel) break;
    ancestors.push(parentRel.from);
    current = parentRel.from;
  }
  return ancestors;
}

# 项目实战 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增顶级模块"项目实战"——以知识树 type=`practice` 的元为根，提供结构拆解、AI 起草 PRD、效果图画廊三个核心能力。

**Architecture:** 复用知识树元素 + child relation；零新 element type，仅在 Element 加一个 optional `status` 字段。新增 1 个 AppView、1 个 AI endpoint、6 个 MCP 工具。客户端 3-tab 工作空间，子元编辑复用知识树现有编辑器（drawer 形式）。

**Tech Stack:** React + Zustand + Hono + zod + Vite + Electron。AI = Hermes via existing adapter chain。

**Verification pattern (本仓库惯例):** Server 改动用 curl 验证；UI 改动用 build + Rich.app 重启视觉验证。**不**写 React 组件单测——本仓库现有 UI 也不写。Server 端零侵入纯函数可补 vitest（若有现成 setup）。

**Total tasks:** 12. **Estimated:** 1-1.5 day.

---

## File Structure

**Domain / schema:**
- Modify: `packages/domain/src/types/element.ts` — add `status` field
- Modify: `packages/domain/src/schemas/element.ts` — add to zod

**Server (AI endpoint):**
- Create: `apps/server/src/ai/prompts/draftPrd.ts`
- Modify: `apps/server/src/ai/operations.ts` — `runDraftPrd`
- Modify: `apps/server/src/routes/ai.ts` — `POST /draft-prd`

**Server (MCP):**
- Create: `apps/server/src/mcp/practiceTools.ts` — 6 tools
- Modify: `apps/server/src/mcp/server.ts` — register

**Client (state + nav):**
- Modify: `apps/web/src/state/store.ts` — `AppView` += `"practice"`
- Modify: `apps/web/src/App.tsx` — route
- Modify: `apps/web/src/components/TopBar.tsx` or dock component — add entry
- Modify: `apps/web/src/api/client.ts` — `draftPrd` helper

**Client (views):**
- Create: `apps/web/src/views/PracticeView.tsx` — top container (router between list / workspace)
- Create: `apps/web/src/views/PracticeView.css`
- Create: `apps/web/src/views/PracticeListView.tsx`
- Create: `apps/web/src/views/PracticeWorkspace.tsx` — 3 tabs
- Create: `apps/web/src/views/PracticeWorkspace.css`
- Create: `apps/web/src/components/DraftPrdModal.tsx` — AI 预览
- Create: `apps/web/src/components/DraftPrdModal.css`
- Create: `apps/web/src/components/ChildElementDrawer.tsx` — 侧滑编辑
- Create: `apps/web/src/components/ChildElementDrawer.css`

---

## Task 1: Add `status` field to Element schema

**Role:** Backend Engineer

**Files:**
- Modify: `packages/domain/src/types/element.ts`
- Modify: `packages/domain/src/schemas/element.ts`

- [ ] **Step 1: Add status to Element TypeScript interface**

Edit `packages/domain/src/types/element.ts`:

```ts
export interface Element<TContent = unknown> {
  id: ElementId;
  type: ElementType;
  title: string;
  subtitle?: string;
  aliases?: string[];
  tags?: string[];
  domain?: string;
  difficulty?: "low" | "mid" | "high";
  /** 仅 type="step" (开发任务) 用。其他类型忽略。
   *  undefined → UI 按 "todo" 渲染（向后兼容老元素） */
  status?: "todo" | "doing" | "done";
  content: TContent;
  metadata: ElementMetadata;
}
```

- [ ] **Step 2: Add status to zod schema**

Edit `packages/domain/src/schemas/element.ts`. Find the ElementSchema and add:

```ts
status: z.enum(["todo", "doing", "done"]).optional(),
```

- [ ] **Step 3: Build domain package**

Run: `pnpm --filter @ke/domain test`
Expected: 27 tests pass (existing tests don't reference status, so still green).

- [ ] **Step 4: Commit**

```bash
git add packages/domain/src/types/element.ts packages/domain/src/schemas/element.ts
git commit -m "feat(domain): add optional status field to Element (for step type)"
```

---

## Task 2: Build draft-PRD AI prompt

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/src/ai/prompts/draftPrd.ts`

- [ ] **Step 1: Create the prompt file**

Write `apps/server/src/ai/prompts/draftPrd.ts`:

```ts
/**
 * AI 起草 PRD。
 *
 * 输入：practice 元 + 已有子元（concept / case / 已有的 product-design / step）
 *      + 用户可选的额外上下文
 * 输出：结构化 PRD（8 个 section），调用方写入一个新的 product-design 子元。
 */
export interface DraftPrdArgs {
  practice: {
    title: string;
    subtitle?: string;
    content?: unknown;
  };
  children: Array<{ type: string; title: string; subtitle?: string; content?: unknown }>;
  extraContext?: string;
}

export function buildDraftPrdPrompt(args: DraftPrdArgs): string {
  return `你是 Hermes Agent，正在帮 大斌哥 起草一份**实战项目的 PRD（产品需求文档）**。

任务：基于项目当前状态 + 已有的知识点 / 需求分析 / 旧 PRD，
输出一份**结构齐全、可执行、不写废话**的 PRD 草稿。

## 项目主元
- 标题：${args.practice.title}
- 副标题：${args.practice.subtitle ?? "(无)"}
- 详细内容：${args.practice.content ? JSON.stringify(args.practice.content).slice(0, 1200) : "(无)"}

## 已有子元（按类型）
${JSON.stringify(args.children, null, 2).slice(0, 6000)}

${args.extraContext ? `## 大斌哥 的额外要求\n${args.extraContext}\n` : ""}

## PRD 必含 8 个 section

1. **overview** — 项目概述（2-3 句话，能让一个不知情的人 30 秒理解你在做什么）
2. **targetUsers** — 目标用户 + 核心痛点（具体到角色和场景）
3. **coreFeatures** — 核心功能（3-7 条，每条一句话能说清楚做什么）
4. **userStories** — 用户故事（3-5 条，格式: "作为 X，我希望 Y，从而 Z"）
5. **acceptance** — 验收标准（3-5 条，每条**可观测、可验证**，不写"运行良好"）
6. **nonFunctional** — 非功能需求（性能 / 安全 / 可维护性 / 多端 etc.）一段话
7. **outOfScope** — 范围外（明确不做的事，避免范围蔓延）
8. **risks** — 风险与未决问题（3-5 条，每条标注：风险 + 影响 + 缓解方向）

PRD 的 title 字段：基于 practice 标题生成形如 "X PRD v0.1" 的命名。

## 严格输出 JSON

只输出合法 JSON，不要 Markdown 代码块，不要前后缀。

{
  "title": "...",
  "sections": {
    "overview": "...",
    "targetUsers": "...",
    "coreFeatures": ["...", "..."],
    "userStories": ["作为 X，我希望 Y，从而 Z"],
    "acceptance": ["..."],
    "nonFunctional": "...",
    "outOfScope": ["..."],
    "risks": ["..."]
  }
}`;
}
```

- [ ] **Step 2: Commit (prompt-only intermediate commit)**

```bash
git add apps/server/src/ai/prompts/draftPrd.ts
git commit -m "feat(ai): draft-PRD prompt for project practice"
```

---

## Task 3: Add `runDraftPrd` operation + HTTP route

**Role:** Backend Engineer

**Files:**
- Modify: `apps/server/src/ai/operations.ts`
- Modify: `apps/server/src/routes/ai.ts`

- [ ] **Step 1: Import the prompt builder in operations.ts**

In `apps/server/src/ai/operations.ts`, add to imports:

```ts
import { buildDraftPrdPrompt } from "./prompts/draftPrd.js";
```

- [ ] **Step 2: Add schema + runner in operations.ts**

Append after `runAnalyzeProgress` / `runDraftReview` (whichever is last):

```ts
const DraftPrdResultSchema = z.object({
  title: z.string().min(1).max(200),
  sections: z.object({
    overview: z.string().max(800),
    targetUsers: z.string().max(800),
    coreFeatures: z.array(z.string().max(280)).min(1).max(10),
    userStories: z.array(z.string().max(280)).max(10).default([]),
    acceptance: z.array(z.string().max(280)).max(10).default([]),
    nonFunctional: z.string().max(800).default(""),
    outOfScope: z.array(z.string().max(280)).max(10).default([]),
    risks: z.array(z.string().max(280)).max(10).default([]),
  }),
});
export type DraftPrdResult = z.infer<typeof DraftPrdResultSchema>;

export function runDraftPrd(
  adapter: AIAdapter,
  args: {
    practice: Parameters<typeof buildDraftPrdPrompt>[0]["practice"];
    children: Parameters<typeof buildDraftPrdPrompt>[0]["children"];
    extraContext?: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<DraftPrdResult>> {
  const prompt = buildDraftPrdPrompt({
    practice: args.practice,
    children: args.children,
    extraContext: args.extraContext,
  });
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(DraftPrdResultSchema),
    opLog: { op: "draft-prd", model: adapter.name, scope: { title: args.practice.title.slice(0, 80) } },
  });
}
```

- [ ] **Step 3: Add `runDraftPrd` to ai.ts imports**

In `apps/server/src/routes/ai.ts`, add to the existing operations import:

```ts
import {
  // ... existing
  runDraftPrd,
} from "../ai/operations.js";
```

- [ ] **Step 4: Add the HTTP route**

Add this route right after the `/draft-review` route in `apps/server/src/routes/ai.ts`:

```ts
// ----- draft-prd: AI 起草项目实战 PRD -----
const DraftPrdBodySchema = z.object({
  practice: z.object({
    title: z.string().min(1).max(280),
    subtitle: z.string().max(280).optional(),
    content: z.unknown().optional(),
  }),
  children: z.array(z.object({
    type: z.string().max(40),
    title: z.string().max(280),
    subtitle: z.string().max(280).optional(),
    content: z.unknown().optional(),
  })).max(100).default([]),
  extraContext: z.string().max(2000).optional(),
  model: z.enum(["claude-code", "codex", "hermes"]).optional(),
});
const DRAFT_PRD_BODY_MAX = 256 * 1024;
r.post("/draft-prd", async (c) => {
  const text = await c.req.text();
  if (text.length > DRAFT_PRD_BODY_MAX) {
    return c.json({ error: `body too large (>${DRAFT_PRD_BODY_MAX} bytes)` }, 413);
  }
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { return c.json({ error: "invalid JSON" }, 400); }
  const parsed = DraftPrdBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
  }
  const { practice, children, extraContext, model } = parsed.data;
  const adapter = pickAdapter(deps.adapters, model);
  const reqId = newReqId();
  const t0 = Date.now();
  log.info("ai.op.start", { reqId, op: "/api/ai/draft-prd", adapter: adapter.name });

  if (!(await adapter.available())) {
    return c.json({ error: `${adapter.name} unavailable`, adapter: adapter.name }, 503);
  }

  let finalResult: unknown = null;
  let lastError = "";
  for await (const ev of runDraftPrd(adapter, {
    practice, children, extraContext, signal: c.req.raw.signal,
  })) {
    if (ev.type === "error") { lastError = ev.message; break; }
    if (ev.type === "done") {
      await recordSignal(deps.signals, {
        ts: new Date().toISOString(), type: "op.completed", manual: "draft-prd",
        op: "draft-prd", adapter: adapter.name,
        data: { title: practice.title.slice(0, 120), durationMs: Date.now() - t0 },
      });
      finalResult = ev.result;
      break;
    }
  }
  if (finalResult) return c.json({ adapter: adapter.name, result: finalResult });
  return c.json({ error: lastError || "draft-prd failed", adapter: adapter.name }, 500);
});
```

- [ ] **Step 5: Build + restart server**

```bash
pnpm --filter @ke/server build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
sleep 3
```

Expected: build clean, no TS errors.

- [ ] **Step 6: Smoke test via curl**

```bash
curl -s -o /tmp/prd.json -w "HTTP %{http_code} (took %{time_total}s)\n" \
  --max-time 180 \
  -X POST http://127.0.0.1:31515/api/ai/draft-prd \
  -H "content-type: application/json" \
  -d '{"practice":{"title":"做一个 Chrome 插件，自动给 Notion 文档加目录","subtitle":"测试 draft-prd endpoint"},"children":[],"extraContext":"目标用户是知识工作者"}'
python3 -c "import json; d=json.load(open('/tmp/prd.json')); print('title:', d['result']['title']); [print(k, '→', str(v)[:80]) for k,v in d['result']['sections'].items()]"
```

Expected: HTTP 200, ~30-60s, 8 sections all populated.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/ai/operations.ts apps/server/src/routes/ai.ts
git commit -m "feat(ai): POST /api/ai/draft-prd — AI drafts PRD for practice project"
```

---

## Task 4: Build 6 MCP practice tools

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/src/mcp/practiceTools.ts`
- Modify: `apps/server/src/mcp/server.ts`

- [ ] **Step 1: Create practiceTools.ts skeleton + helpers**

Write `apps/server/src/mcp/practiceTools.ts`:

```ts
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

const SUB_TYPES: ElementType[] = ["concept", "case", "product-design", "step"];

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
      type: z.enum(["concept", "case", "product-design", "step"]),
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
        type,
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
      await relations.append([{ from: practiceId, to: newEl.id, kind: "child" }]);
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
      const updated: Element = { ...e, status, metadata: { ...e.metadata, updatedAt: new Date().toISOString() } };
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
      await relations.append([{ from: practiceId, to: prdEl.id, kind: "child" }]);
      fire("practice.draft_prd", { practiceId, prdId: prdEl.id });
      return ok({ ok: true, prdId: prdEl.id, title: result.title });
    },
  );
}
```

- [ ] **Step 2: Register practice tools in server.ts**

Edit `apps/server/src/mcp/server.ts`. Find where `registerPlanTools` is called (near the end) and add:

```ts
import { registerPracticeTools } from "./practiceTools.js";
```

And near where plan tools are registered:

```ts
// 项目实战 (Practice) tools — always mount (uses elements/relations which always exist)
registerPracticeTools(server, deps.elements, deps.relations, deps.adapters, eventBus);
```

- [ ] **Step 3: Build server**

```bash
pnpm --filter @ke/server build
```

Expected: no TS errors.

- [ ] **Step 4: Repackage + restart**

```bash
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
sleep 3
```

- [ ] **Step 5: Verify tools registered via MCP**

```bash
curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | python3 -c "
import sys, json
raw = sys.stdin.read()
line = [l for l in raw.split('\n') if l.startswith('data:')]
d = json.loads(line[0][5:].strip()) if line else json.loads(raw)
practice = [t['name'] for t in d['result']['tools'] if 'practice' in t['name'] or t['name'] == 'draft_prd']
print('practice tools:', practice)
"
```

Expected: `['practice_list', 'practice_get', 'practice_create', 'practice_add_child', 'practice_set_task_status', 'draft_prd']`

- [ ] **Step 6: End-to-end MCP test**

```bash
# Create a test practice
PID=$(curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"practice_create","arguments":{"title":"MCP 测试项目","subtitle":"端到端验证"}}}' \
  | python3 -c "import sys,json; raw=sys.stdin.read(); line=[l for l in raw.split('\n') if l.startswith('data:')]; d=json.loads(line[0][5:].strip() if line else raw); print(json.loads(d['result']['content'][0]['text'])['element']['id'])")
echo "created practice: $PID"

# Add a step
TID=$(curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"practice_add_child\",\"arguments\":{\"practiceId\":\"$PID\",\"type\":\"step\",\"title\":\"测试任务 A\"}}}" \
  | python3 -c "import sys,json; raw=sys.stdin.read(); line=[l for l in raw.split('\n') if l.startswith('data:')]; d=json.loads(line[0][5:].strip() if line else raw); print(json.loads(d['result']['content'][0]['text'])['element']['id'])")
echo "created step: $TID"

# Mark done
curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"practice_set_task_status\",\"arguments\":{\"id\":\"$TID\",\"status\":\"done\"}}}" | head -c 300

# Cleanup via delete_element
curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"delete_element\",\"arguments\":{\"id\":\"$PID\"}}}" | head -c 200
```

Expected: each step prints a valid id, set_task_status returns ok=true, cleanup succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/mcp/practiceTools.ts apps/server/src/mcp/server.ts
git commit -m "feat(mcp): 6 practice tools for 项目实战 system"
```

---

## Task 5: Add "practice" AppView + nav entry

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/state/store.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: nav component (find via grep)

- [ ] **Step 1: Find the nav/dock component**

```bash
grep -rn "mindmap\b" /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/web/src/components/ --include="*.tsx" | grep -i "icon\|dock\|topbar\|nav" | head -5
```

Identify the file that renders the 计划管理 / PPT 导图 / 知识树 icons in the side dock. Likely `apps/web/src/components/TopBar.tsx` or a SystemPanel.

- [ ] **Step 2: Add "practice" to AppView type**

In `apps/web/src/state/store.ts`, find:

```ts
export type AppView = "home" | "tree" | "admin" | "news" | "mindmap" | "greatme" | "toolbox";
```

Change to:

```ts
export type AppView = "home" | "tree" | "admin" | "news" | "mindmap" | "greatme" | "toolbox" | "practice";
```

- [ ] **Step 3: Add the view to App.tsx routing**

In `apps/web/src/App.tsx`, find the block with `{appView === "greatme" && <GreatMeView />}` and add right after:

```tsx
{appView === "practice" && <PracticeView />}
```

Also add the import at the top:

```tsx
import { PracticeView } from "./views/PracticeView.js";
```

- [ ] **Step 4: Create a stub PracticeView so the build passes**

Write `apps/web/src/views/PracticeView.tsx`:

```tsx
import type { ReactNode } from "react";

export function PracticeView(): ReactNode {
  return (
    <div style={{ padding: 40, color: "#e6b25a" }}>
      <h1>项目实战</h1>
      <p>正在搭建中...</p>
    </div>
  );
}
```

- [ ] **Step 5: Add nav entry in the dock component**

In the dock component identified in Step 1 (assuming it's `TopBar.tsx` — adapt path as needed), find where mindmap or greatme button is rendered. Add a sibling button:

```tsx
<button
  className={`topbar__nav-btn ${appView === "practice" ? "is-active" : ""}`}
  onClick={() => setAppView("practice")}
  title="项目实战"
>
  🛠
</button>
```

(emoji 🛠 chosen as placeholder; can be replaced with a proper SVG later.)

- [ ] **Step 6: Build + restart**

```bash
pnpm --filter @ke/web build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
```

Expected: dock now shows 🛠 button. Clicking it shows "项目实战 - 正在搭建中..."

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/state/store.ts apps/web/src/App.tsx apps/web/src/views/PracticeView.tsx apps/web/src/components/TopBar.tsx
git commit -m "feat(practice): add AppView + dock entry (stub view)"
```

---

## Task 6: Build PracticeListView (project cards)

**Role:** UI Developer

**Files:**
- Create: `apps/web/src/views/PracticeListView.tsx`
- Create: `apps/web/src/views/PracticeView.css`
- Modify: `apps/web/src/views/PracticeView.tsx`

- [ ] **Step 1: Create PracticeListView**

Write `apps/web/src/views/PracticeListView.tsx`:

```tsx
import type { ReactNode } from "react";
import { useStore } from "../state/store.js";

interface Props {
  onPickPractice: (id: string) => void;
}

export function PracticeListView({ onPickPractice }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);

  const practices = Array.from(elements.values()).filter(e => e.type === "practice");

  // 每个 practice 算子元统计
  const statsOf = (practiceId: string) => {
    const childIds = relations
      .filter(r => r.kind === "child" && r.from === practiceId)
      .map(r => r.to);
    const children = childIds
      .map(id => elements.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e);
    return {
      concepts: children.filter(c => c.type === "concept").length,
      cases: children.filter(c => c.type === "case").length,
      prds: children.filter(c => c.type === "product-design").length,
      steps: children.filter(c => c.type === "step").length,
      stepsDone: children.filter(c => c.type === "step" && c.status === "done").length,
    };
  };

  return (
    <div className="pv">
      <div className="pv__head">
        <div className="pv__title">项目实战</div>
        <div className="pv__sub">{practices.length} 个项目</div>
      </div>
      <div className="pv__grid">
        {practices.map(p => {
          const s = statsOf(p.id);
          const stepPct = s.steps === 0 ? 0 : Math.round((s.stepsDone / s.steps) * 100);
          return (
            <button key={p.id} className="pv-card" onClick={() => onPickPractice(p.id)}>
              <div className="pv-card__title">{p.title}</div>
              {p.subtitle && <div className="pv-card__sub">{p.subtitle}</div>}
              <div className="pv-card__stats">
                <span title="知识点">📚 {s.concepts}</span>
                <span title="需求分析">🎯 {s.cases}</span>
                <span title="PRD">📄 {s.prds}</span>
                <span title="开发任务">⚙️ {s.stepsDone}/{s.steps}</span>
              </div>
              {s.steps > 0 && (
                <div className="pv-card__bar">
                  <span style={{ width: `${stepPct}%` }} />
                </div>
              )}
            </button>
          );
        })}
        {practices.length === 0 && (
          <div className="pv__empty">
            还没有实战项目。让 Hermes 帮你建一个，或者直接说"建一个项目叫 X"。
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PracticeView.css**

Write `apps/web/src/views/PracticeView.css`:

```css
.pv {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  color: #e6b25a;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  background: #050302;
  overflow: hidden;
}
.pv__head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 18px; }
.pv__title { font-size: 22px; font-weight: 700; }
.pv__sub { font-size: 12px; color: #a87526; }
.pv__grid {
  flex: 1 1 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  align-content: start;
  overflow-y: auto;
  padding-right: 4px;
}
.pv__empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  font-size: 13px;
  color: #6a4f1a;
}
.pv-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(217, 154, 62, 0.04);
  border: 1px solid rgba(217, 154, 62, 0.22);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background .12s, border-color .12s, transform .12s;
}
.pv-card:hover {
  background: rgba(217, 154, 62, 0.1);
  border-color: rgba(217, 154, 62, 0.5);
  transform: translateY(-1px);
}
.pv-card__title { font-size: 14px; font-weight: 600; color: #e6b25a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-card__sub { font-size: 11px; color: #a87526; }
.pv-card__stats { display: flex; gap: 10px; font-size: 11px; color: #c9a96a; margin-top: 4px; }
.pv-card__bar {
  height: 5px; border-radius: 3px; background: rgba(255,255,255,.05); overflow: hidden;
}
.pv-card__bar > span {
  display: block; height: 100%;
  background: linear-gradient(90deg, #d99a3e, #e6b25a);
}
```

- [ ] **Step 3: Wire list into PracticeView**

Replace contents of `apps/web/src/views/PracticeView.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import { PracticeListView } from "./PracticeListView.js";
import "./PracticeView.css";

export function PracticeView(): ReactNode {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);

  if (selectedPracticeId) {
    // Workspace 在 Task 7 里塞进来；现在先放占位
    return (
      <div className="pv">
        <button onClick={() => setSelectedPracticeId(null)} style={{ background: "transparent", border: "1px solid rgba(217,154,62,.3)", color: "#a87526", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>← 全部项目</button>
        <div>工作空间 {selectedPracticeId} (Task 7 待填)</div>
      </div>
    );
  }

  return <PracticeListView onPickPractice={setSelectedPracticeId} />;
}
```

- [ ] **Step 4: Build + restart + visual verify**

```bash
pnpm --filter @ke/web build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
```

Open Rich, click 项目实战 in dock. Should show the card grid (likely empty grid + empty-state text).

- [ ] **Step 5: Create a test practice via MCP to see a card**

```bash
curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"practice_create","arguments":{"title":"做一个 Chrome 插件","subtitle":"测试 PracticeListView 渲染"}}}' | head -c 300
```

Focus Rich window. The list should show 1 card (focus refetch picks it up via SSE).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/views/PracticeListView.tsx apps/web/src/views/PracticeView.css apps/web/src/views/PracticeView.tsx
git commit -m "feat(practice): list view with practice cards + stats"
```

---

## Task 7: Build PracticeWorkspace shell + tab switcher

**Role:** UI Developer

**Files:**
- Create: `apps/web/src/views/PracticeWorkspace.tsx`
- Create: `apps/web/src/views/PracticeWorkspace.css`
- Modify: `apps/web/src/views/PracticeView.tsx`

- [ ] **Step 1: Create PracticeWorkspace**

Write `apps/web/src/views/PracticeWorkspace.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import type { Element } from "@ke/domain";
import "./PracticeWorkspace.css";

type TabId = "overview" | "breakdown" | "mockups";

interface Props {
  practiceId: string;
  onBack: () => void;
}

export function PracticeWorkspace({ practiceId, onBack }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const [tab, setTab] = useState<TabId>("overview");

  const practice = elements.get(practiceId);
  if (!practice || practice.type !== "practice") {
    return (
      <div className="pw">
        <button className="pw__back" onClick={onBack}>← 全部项目</button>
        <div className="pw__error">项目不存在或已删除</div>
      </div>
    );
  }

  const childIds = relations
    .filter(r => r.kind === "child" && r.from === practiceId)
    .map(r => r.to);
  const children = childIds.map(id => elements.get(id)).filter((e): e is Element => !!e);

  const concepts = children.filter(c => c.type === "concept");
  const cases = children.filter(c => c.type === "case");
  const prds = children.filter(c => c.type === "product-design");
  const steps = children.filter(c => c.type === "step");
  const stepDone = steps.filter(s => s.status === "done").length;

  return (
    <div className="pw">
      <div className="pw__top">
        <button className="pw__back" onClick={onBack}>← 全部项目</button>
        <div className="pw__title">{practice.title}</div>
        {practice.subtitle && <span className="pw__subtitle">{practice.subtitle}</span>}
      </div>

      <div className="pw__tabs">
        {(["overview", "breakdown", "mockups"] as TabId[]).map(t => (
          <button key={t}
            className={`pw__tab ${tab === t ? "is-active" : ""}`}
            onClick={() => setTab(t)}>
            {t === "overview" ? "总览" : t === "breakdown" ? "拆解" : "效果图"}
          </button>
        ))}
      </div>

      <div className="pw__body">
        {tab === "overview" && (
          <OverviewTab concepts={concepts.length} cases={cases.length}
            prds={prds.length} steps={steps.length} stepDone={stepDone}
            practice={practice} />
        )}
        {tab === "breakdown" && (
          <div className="pw__placeholder">拆解 tab (Task 8 填充)</div>
        )}
        {tab === "mockups" && (
          <div className="pw__placeholder">效果图 tab (Task 10 填充)</div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ concepts, cases, prds, steps, stepDone, practice }: {
  concepts: number; cases: number; prds: number; steps: number; stepDone: number;
  practice: Element;
}): ReactNode {
  const stepPct = steps === 0 ? 0 : Math.round((stepDone / steps) * 100);
  return (
    <div className="pw-overview">
      <div className="pw-overview__kpis">
        <div className="pw-kpi"><div className="pw-kpi__num">{concepts}</div><div className="pw-kpi__label">知识点</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{cases}</div><div className="pw-kpi__label">需求分析</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{prds}</div><div className="pw-kpi__label">PRD</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{stepDone}/{steps}</div><div className="pw-kpi__label">任务</div></div>
      </div>
      {steps > 0 && (
        <div className="pw-overview__progress">
          <div className="pw-overview__progress-label">开发任务进度 {stepPct}%</div>
          <div className="pw-overview__progress-bar"><span style={{ width: `${stepPct}%` }} /></div>
        </div>
      )}
      <div className="pw-overview__meta">
        <span>创建于 {new Date(practice.metadata.createdAt).toLocaleDateString("zh-CN")}</span>
        <span>最近更新 {new Date(practice.metadata.updatedAt).toLocaleDateString("zh-CN")}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PracticeWorkspace.css**

Write `apps/web/src/views/PracticeWorkspace.css`:

```css
.pw {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 22px 28px;
  color: #e6b25a;
  background: #050302;
  overflow: hidden;
  font-family: inherit;
}
.pw__top { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.pw__back {
  background: transparent;
  border: 1px solid rgba(217, 154, 62, .3);
  color: #a87526;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}
.pw__back:hover { color: #e6b25a; border-color: rgba(217, 154, 62, .65); }
.pw__title { font-size: 18px; font-weight: 700; }
.pw__subtitle { font-size: 12px; color: #a87526; }
.pw__error { padding: 60px; text-align: center; color: #ff9a8a; }

.pw__tabs { display: flex; gap: 6px; margin-bottom: 12px; }
.pw__tab {
  padding: 6px 16px; border-radius: 999px; cursor: pointer;
  background: transparent; border: 1px solid rgba(217,154,62,.3);
  color: #a87526; font-size: 12px; font-family: inherit;
}
.pw__tab:hover { color: #e6b25a; border-color: rgba(217, 154, 62, .65); }
.pw__tab.is-active { background: #3a2408; color: #e6b25a; border-color: rgba(217, 154, 62, .65); }

.pw__body {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  border-radius: 12px;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(217, 154, 62, .22);
  padding: 22px;
}
.pw__placeholder { color: #6a4f1a; padding: 40px; text-align: center; font-size: 13px; }

.pw-overview { display: flex; flex-direction: column; gap: 18px; }
.pw-overview__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.pw-kpi {
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(217, 154, 62, .2);
  text-align: center;
}
.pw-kpi__num { font-size: 24px; font-weight: 700; color: #e6b25a; }
.pw-kpi__label { font-size: 11px; color: #a87526; margin-top: 4px; }
.pw-overview__progress { }
.pw-overview__progress-label { font-size: 11px; color: #a87526; margin-bottom: 6px; }
.pw-overview__progress-bar {
  height: 8px; border-radius: 4px; background: rgba(255,255,255,.05); overflow: hidden;
}
.pw-overview__progress-bar > span {
  display: block; height: 100%;
  background: linear-gradient(90deg, #d99a3e, #e6b25a);
}
.pw-overview__meta { display: flex; gap: 18px; font-size: 11px; color: #a87526; }
```

- [ ] **Step 3: Wire workspace into PracticeView**

Replace the placeholder in `apps/web/src/views/PracticeView.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import { PracticeListView } from "./PracticeListView.js";
import { PracticeWorkspace } from "./PracticeWorkspace.js";
import "./PracticeView.css";

export function PracticeView(): ReactNode {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);

  if (selectedPracticeId) {
    return (
      <PracticeWorkspace
        practiceId={selectedPracticeId}
        onBack={() => setSelectedPracticeId(null)} />
    );
  }

  return <PracticeListView onPickPractice={setSelectedPracticeId} />;
}
```

- [ ] **Step 4: Build + restart + verify**

```bash
pnpm --filter @ke/web build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
```

In Rich → 项目实战 → click the test card → workspace opens, 3 tabs visible, 总览 shows 4 KPI cards (all 0). Click 拆解 / 效果图 → see placeholders.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/views/PracticeWorkspace.tsx apps/web/src/views/PracticeWorkspace.css apps/web/src/views/PracticeView.tsx
git commit -m "feat(practice): workspace shell + 3-tab nav + overview tab"
```

---

## Task 8: Build 拆解 tab — 4 groups + step kanban

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/views/PracticeWorkspace.tsx`
- Modify: `apps/web/src/views/PracticeWorkspace.css`
- Modify: `apps/web/src/api/client.ts` (helpers for createChild + updateStatus)

- [ ] **Step 1: Add API client helpers**

In `apps/web/src/api/client.ts`, find the existing `createElement` / `updateElement` API methods, then add:

```ts
async createPracticeChild(input: {
  practiceId: string;
  type: "concept" | "case" | "product-design" | "step";
  title: string;
  subtitle?: string;
}): Promise<{ ok: true; element: import("@ke/domain").Element }> {
  // MCP-style helper via plain REST: uses elements + relations endpoints
  // — but we can also call our own /api directly. For now, use the existing
  // tools through the MCP HTTP endpoint:
  const r = await fetch("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "practice_add_child", arguments: input },
    }),
  });
  if (!r.ok) throw new Error(`practice_add_child failed: ${r.status}`);
  const raw = await r.text();
  let parsed: { result?: { content: { text: string }[] }, error?: unknown };
  if (raw.startsWith("event:") || raw.includes("data:")) {
    const line = raw.split("\n").find(l => l.startsWith("data:"))!;
    parsed = JSON.parse(line.slice(5).trim());
  } else parsed = JSON.parse(raw);
  if (!parsed.result) throw new Error("MCP error");
  return JSON.parse(parsed.result.content[0].text);
},
```

Wait — the codebase already exposes REST endpoints for element CRUD. Use those instead to avoid MCP-from-UI antipattern. Replace with:

```ts
async createPracticeChild(input: {
  practiceId: string;
  type: "concept" | "case" | "product-design" | "step";
  title: string;
  subtitle?: string;
}): Promise<import("@ke/domain").Element> {
  // 1. Create the element via existing elements API
  const newEl = {
    id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    title: input.title,
    subtitle: input.subtitle,
    content: {},
    ...(input.type === "step" ? { status: "todo" as const } : {}),
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generatedBy: "user" as const,
      richness: 1 as const,
    },
  };
  const r1 = await fetch(`/api/elements/${encodeURIComponent(newEl.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(newEl),
  });
  if (!r1.ok) throw new Error(`create element failed: ${r1.status}`);
  // 2. Add the "child" relation
  const r2 = await fetch("/api/relations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ relations: [{ from: input.practiceId, to: newEl.id, kind: "child" }] }),
  });
  if (!r2.ok) throw new Error(`append relation failed: ${r2.status}`);
  return newEl;
},

async setStepStatus(elementId: string, status: "todo" | "doing" | "done"): Promise<void> {
  const r = await fetch(`/api/elements/${encodeURIComponent(elementId)}`);
  if (!r.ok) throw new Error(`get element failed: ${r.status}`);
  const el = await r.json();
  el.status = status;
  el.metadata.updatedAt = new Date().toISOString();
  const r2 = await fetch(`/api/elements/${encodeURIComponent(elementId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(el),
  });
  if (!r2.ok) throw new Error(`update element failed: ${r2.status}`);
},
```

Verify actual API endpoint shape first by inspecting `apps/server/src/routes/elements.ts`. If endpoints differ (POST vs PUT, single vs batch), adapt accordingly.

- [ ] **Step 2: Add BreakdownTab component to PracticeWorkspace.tsx**

Add this component to `apps/web/src/views/PracticeWorkspace.tsx`:

```tsx
import { api } from "../api/client.js";

interface BreakdownTabProps {
  practiceId: string;
  concepts: Element[];
  cases: Element[];
  prds: Element[];
  steps: Element[];
  onOpenChild: (id: string) => void;
  onDraftPrd: () => void;
}

function BreakdownTab({
  practiceId, concepts, cases, prds, steps,
  onOpenChild, onDraftPrd,
}: BreakdownTabProps): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const [newTitle, setNewTitle] = useState<Record<string, string>>({});

  const addChild = async (type: "concept" | "case" | "product-design" | "step") => {
    const title = (newTitle[type] ?? "").trim();
    if (!title) return;
    try {
      await api.createPracticeChild({ practiceId, type, title });
      setNewTitle(s => ({ ...s, [type]: "" }));
      await hydrate();
    } catch (e) {
      alert(`新增失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const setStatus = async (id: string, status: "todo" | "doing" | "done") => {
    try {
      await api.setStepStatus(id, status);
      await hydrate();
    } catch (e) {
      alert(`修改状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const Group = ({ icon, label, type, items, extraButton }: {
    icon: string; label: string;
    type: "concept" | "case" | "product-design" | "step";
    items: Element[]; extraButton?: ReactNode;
  }) => (
    <div className="pw-bd-group">
      <div className="pw-bd-group__head">
        <span>{icon} {label} ({items.length})</span>
        <div className="pw-bd-group__actions">
          {extraButton}
          <input className="pw-bd-input"
            placeholder={`+ 新增${label}`}
            value={newTitle[type] ?? ""}
            onChange={e => setNewTitle(s => ({ ...s, [type]: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") void addChild(type); }} />
        </div>
      </div>
      {items.map(it => (
        <button key={it.id} className="pw-bd-item" onClick={() => onOpenChild(it.id)}>
          <span className="pw-bd-item__title">{it.title}</span>
          {it.subtitle && <span className="pw-bd-item__sub">{it.subtitle}</span>}
        </button>
      ))}
      {items.length === 0 && <div className="pw-bd-empty">暂无</div>}
    </div>
  );

  // Step kanban (3 columns)
  const todo = steps.filter(s => (s.status ?? "todo") === "todo");
  const doing = steps.filter(s => s.status === "doing");
  const done = steps.filter(s => s.status === "done");

  return (
    <div className="pw-bd">
      <Group icon="📚" label="知识点" type="concept" items={concepts} />
      <Group icon="🎯" label="需求分析" type="case" items={cases} />
      <Group icon="📄" label="PRD" type="product-design" items={prds}
        extraButton={
          <button className="pw-bd-ai" onClick={onDraftPrd}>🪄 让 Rich 起草</button>
        } />

      <div className="pw-bd-group">
        <div className="pw-bd-group__head">
          <span>⚙️ 开发任务 ({steps.length})</span>
          <input className="pw-bd-input"
            placeholder="+ 新增任务"
            value={newTitle.step ?? ""}
            onChange={e => setNewTitle(s => ({ ...s, step: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") void addChild("step"); }} />
        </div>
        <div className="pw-bd-kanban">
          {([
            { id: "todo", label: "todo", items: todo },
            { id: "doing", label: "doing", items: doing },
            { id: "done", label: "done", items: done },
          ] as const).map(col => (
            <div key={col.id} className={`pw-bd-col pw-bd-col--${col.id}`}>
              <div className="pw-bd-col__head">{col.label} ({col.items.length})</div>
              {col.items.map(s => (
                <div key={s.id} className="pw-bd-task">
                  <button className="pw-bd-task__title" onClick={() => onOpenChild(s.id)}>
                    {s.title}
                  </button>
                  <div className="pw-bd-task__actions">
                    {(["todo","doing","done"] as const).map(st => (
                      <button key={st}
                        className={`pw-bd-task__chip ${(s.status ?? "todo") === st ? "is-active" : ""}`}
                        onClick={() => void setStatus(s.id, st)}>
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {col.items.length === 0 && <div className="pw-bd-empty">空</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Update the workspace's tab body to invoke it:

```tsx
{tab === "breakdown" && (
  <BreakdownTab
    practiceId={practiceId}
    concepts={concepts}
    cases={cases}
    prds={prds}
    steps={steps}
    onOpenChild={(id) => setOpenChildId(id)}      // wired in Task 11
    onDraftPrd={() => setDraftPrdOpen(true)}      // wired in Task 9
  />
)}
```

Also add the new state:

```tsx
const [openChildId, setOpenChildId] = useState<string | null>(null);
const [draftPrdOpen, setDraftPrdOpen] = useState(false);
```

- [ ] **Step 3: Add CSS for breakdown tab**

Append to `apps/web/src/views/PracticeWorkspace.css`:

```css
.pw-bd { display: flex; flex-direction: column; gap: 18px; }
.pw-bd-group {
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(217, 154, 62, .03);
  border: 1px solid rgba(217, 154, 62, .18);
}
.pw-bd-group__head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; font-weight: 600; color: #e6b25a;
  margin-bottom: 10px;
}
.pw-bd-group__actions { display: flex; gap: 8px; align-items: center; }
.pw-bd-input {
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(217, 154, 62, .25);
  color: #e6b25a;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  width: 180px;
}
.pw-bd-input:focus { border-color: #d99a3e; }
.pw-bd-ai {
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(217, 154, 62, .15);
  border: 1px solid rgba(217, 154, 62, .4);
  color: #d99a3e;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.pw-bd-ai:hover { background: rgba(217, 154, 62, .25); color: #e6b25a; }
.pw-bd-item {
  display: flex; flex-direction: column;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255,255,255,.015);
  border: 1px solid transparent;
  color: #e6b25a;
  font-family: inherit;
  cursor: pointer;
  margin-bottom: 4px;
}
.pw-bd-item:hover { background: rgba(217, 154, 62, .06); border-color: rgba(217, 154, 62, .25); }
.pw-bd-item__title { font-size: 13px; color: #e6b25a; }
.pw-bd-item__sub { font-size: 10px; color: #8a6520; margin-top: 2px; }
.pw-bd-empty { font-size: 11px; color: #6a4f1a; padding: 6px 0; }

.pw-bd-kanban { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.pw-bd-col {
  padding: 8px;
  border-radius: 8px;
  background: rgba(255,255,255,.015);
  border: 1px solid rgba(217, 154, 62, .15);
  min-height: 120px;
}
.pw-bd-col__head { font-size: 11px; color: #a87526; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
.pw-bd-task {
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(217, 154, 62, .04);
  border: 1px solid rgba(217, 154, 62, .15);
  margin-bottom: 6px;
}
.pw-bd-task__title {
  background: transparent; border: none; padding: 0; color: #e6b25a;
  font-size: 12px; cursor: pointer; font-family: inherit; text-align: left;
  display: block; width: 100%;
}
.pw-bd-task__actions { display: flex; gap: 4px; margin-top: 6px; }
.pw-bd-task__chip {
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
  background: transparent;
  border: 1px solid rgba(217, 154, 62, .2);
  color: #6a4f1a;
  cursor: pointer; font-family: inherit;
}
.pw-bd-task__chip:hover { color: #a87526; }
.pw-bd-task__chip.is-active {
  background: #d99a3e; border-color: #d99a3e; color: #1a1208; font-weight: 600;
}
```

- [ ] **Step 4: Build + restart + verify**

```bash
pnpm --filter @ke/web build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
```

Open test practice → 拆解 tab → see 4 groups. Type in 知识点 输入框 → 回车 → should appear as a list item.

For 开发任务, type 2 names → kanban shows 2 items in `todo` column. Click `doing` chip on one → moves to `doing` column.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/views/PracticeWorkspace.tsx apps/web/src/views/PracticeWorkspace.css apps/web/src/api/client.ts
git commit -m "feat(practice): breakdown tab — 4 grouped sub-elements + step kanban"
```

---

## Task 9: Build PRD draft AI modal

**Role:** UI Developer

**Files:**
- Create: `apps/web/src/components/DraftPrdModal.tsx`
- Create: `apps/web/src/components/DraftPrdModal.css`
- Modify: `apps/web/src/api/client.ts` (add `draftPrd` helper)
- Modify: `apps/web/src/views/PracticeWorkspace.tsx` (mount modal)

- [ ] **Step 1: Add API helper**

In `apps/web/src/api/client.ts`, add:

```ts
async draftPrd(input: {
  practice: { title: string; subtitle?: string; content?: unknown };
  children: Array<{ type: string; title: string; subtitle?: string; content?: unknown }>;
  extraContext?: string;
}): Promise<{ result: {
  title: string;
  sections: {
    overview: string; targetUsers: string;
    coreFeatures: string[]; userStories: string[];
    acceptance: string[]; nonFunctional: string;
    outOfScope: string[]; risks: string[];
  };
} }> {
  const r = await fetch("/api/ai/draft-prd", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `draft-prd failed: ${r.status}`);
  }
  return await r.json();
},
```

- [ ] **Step 2: Create the modal**

Write `apps/web/src/components/DraftPrdModal.tsx`:

```tsx
import { useRef, useState, type ReactNode } from "react";
import type { Element } from "@ke/domain";
import { api } from "../api/client.js";
import { useStore } from "../state/store.js";
import "./DraftPrdModal.css";

interface PrdSections {
  overview: string; targetUsers: string;
  coreFeatures: string[]; userStories: string[];
  acceptance: string[]; nonFunctional: string;
  outOfScope: string[]; risks: string[];
}

interface Props {
  practice: Element;
  children: Element[];
  onClose: () => void;
}

export function DraftPrdModal({ practice, children, onClose }: Props): ReactNode {
  const [step, setStep] = useState<"input" | "loading" | "preview" | "error">("input");
  const [extraContext, setExtraContext] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<PrdSections | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydrate = useStore(s => s.hydrate);

  const generate = async () => {
    setStep("loading");
    setError("");
    abortRef.current = new AbortController();
    try {
      const body = await api.draftPrd({
        practice: { title: practice.title, subtitle: practice.subtitle, content: practice.content },
        children: children.map(c => ({ type: c.type, title: c.title, subtitle: c.subtitle, content: c.content })),
        extraContext: extraContext.trim() || undefined,
      });
      setTitle(body.result.title);
      setSections(body.result.sections);
      setStep("preview");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") { setStep("input"); return; }
      setError(err.message ?? String(e));
      setStep("error");
    }
  };

  const confirmCreate = async () => {
    if (!sections || !title.trim()) return;
    try {
      await api.createPracticeChild({
        practiceId: practice.id,
        type: "product-design",
        title: title.trim(),
        subtitle: sections.overview.slice(0, 60),
      });
      // After child created, we need to update its content. Re-fetch and patch.
      // Simplest: call the elements PUT directly with the full PRD body.
      // Actually createPracticeChild already created an element with empty content.
      // We need to update content. Use PUT on the element id... but we don't have id.
      // Better: create the element with PRD content already.
      // Refactor — see Step 3.
      await hydrate();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  return (
    <div className="dpm-back" onClick={onClose}>
      <div className={`dpm-modal dpm-modal--${step}`} onClick={e => e.stopPropagation()}>
        <div className="dpm-head">
          <div className="dpm-title">🪄 AI 起草 PRD</div>
          <button className="dpm-close" onClick={onClose}>×</button>
        </div>

        {step === "input" && (
          <div className="dpm-body">
            <div className="dpm-context">
              基于项目「{practice.title}」+ 已有 {children.length} 个子元生成
            </div>
            <label className="dpm-label">额外要求（可选）</label>
            <textarea className="dpm-textarea" rows={3}
              placeholder="例：MVP 阶段，先解决付费用户的核心痛点；移动端优先"
              value={extraContext}
              onChange={e => setExtraContext(e.target.value)} />
            <div className="dpm-foot">
              <button className="dpm-btn" onClick={onClose}>取消</button>
              <button className="dpm-btn is-primary" onClick={() => void generate()}>开始起草</button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="dpm-body dpm-loading">
            <div className="dpm-spinner" />
            <div>Hermes 正在起草 PRD…</div>
            <div className="dpm-hint">通常 30-60 秒</div>
            <button className="dpm-btn" onClick={() => abortRef.current?.abort()}>取消</button>
          </div>
        )}

        {step === "error" && (
          <div className="dpm-body">
            <div className="dpm-error">起草失败：{error}</div>
            <div className="dpm-foot">
              <button className="dpm-btn" onClick={onClose}>关闭</button>
              <button className="dpm-btn is-primary" onClick={() => setStep("input")}>重试</button>
            </div>
          </div>
        )}

        {step === "preview" && sections && (
          <div className="dpm-body dpm-preview">
            <input className="dpm-prd-title"
              value={title}
              onChange={e => setTitle(e.target.value)} />
            <Section name="项目概述" value={sections.overview}
              onChange={v => setSections({ ...sections, overview: v })} />
            <Section name="目标用户 + 痛点" value={sections.targetUsers}
              onChange={v => setSections({ ...sections, targetUsers: v })} />
            <ListSection name="核心功能" items={sections.coreFeatures}
              onChange={items => setSections({ ...sections, coreFeatures: items })} />
            <ListSection name="用户故事" items={sections.userStories}
              onChange={items => setSections({ ...sections, userStories: items })} />
            <ListSection name="验收标准" items={sections.acceptance}
              onChange={items => setSections({ ...sections, acceptance: items })} />
            <Section name="非功能需求" value={sections.nonFunctional}
              onChange={v => setSections({ ...sections, nonFunctional: v })} />
            <ListSection name="范围外" items={sections.outOfScope}
              onChange={items => setSections({ ...sections, outOfScope: items })} />
            <ListSection name="风险" items={sections.risks}
              onChange={items => setSections({ ...sections, risks: items })} />

            <div className="dpm-foot">
              <button className="dpm-btn" onClick={onClose}>取消</button>
              <button className="dpm-btn" onClick={() => void generate()}>↻ 重新生成</button>
              <button className="dpm-btn is-primary"
                disabled={!title.trim()}
                onClick={() => void confirmCreate()}>确认 创建 PRD</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }): ReactNode {
  return (
    <div className="dpm-sec">
      <div className="dpm-sec__name">{name}</div>
      <textarea className="dpm-sec__text" rows={3} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ListSection({ name, items, onChange }: { name: string; items: string[]; onChange: (items: string[]) => void }): ReactNode {
  return (
    <div className="dpm-sec">
      <div className="dpm-sec__name">{name}</div>
      {items.map((it, i) => (
        <div key={i} className="dpm-sec__row">
          <input className="dpm-sec__input" value={it}
            onChange={e => {
              const next = [...items]; next[i] = e.target.value; onChange(next);
            }} />
          <button className="dpm-sec__del"
            onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className="dpm-sec__add" onClick={() => onChange([...items, ""])}>+ 加一条</button>
    </div>
  );
}
```

- [ ] **Step 3: Refactor — createPracticeChild needs content arg**

The Step 2 PRD save logic needs the content set. Update `createPracticeChild` signature in `apps/web/src/api/client.ts`:

```ts
async createPracticeChild(input: {
  practiceId: string;
  type: "concept" | "case" | "product-design" | "step";
  title: string;
  subtitle?: string;
  content?: unknown;          // ← NEW
}): Promise<import("@ke/domain").Element> {
  const newEl = {
    id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    title: input.title,
    subtitle: input.subtitle,
    content: input.content ?? {},      // ← USE
    ...(input.type === "step" ? { status: "todo" as const } : {}),
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generatedBy: "user" as const,
      richness: 1 as const,
    },
  };
  // ... rest same
},
```

Update the modal's confirmCreate to pass content:

```tsx
const confirmCreate = async () => {
  if (!sections || !title.trim()) return;
  try {
    await api.createPracticeChild({
      practiceId: practice.id,
      type: "product-design",
      title: title.trim(),
      subtitle: sections.overview.slice(0, 60),
      content: sections,              // ← store all 8 sections in content
    });
    await hydrate();
    onClose();
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
    setStep("error");
  }
};
```

- [ ] **Step 4: Create DraftPrdModal.css**

Write `apps/web/src/components/DraftPrdModal.css`:

```css
.dpm-back {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.78);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.dpm-modal {
  background: #0a0604;
  border: 1px solid rgba(217, 154, 62, .65);
  border-radius: 16px;
  padding: 22px 24px 18px;
  width: 720px; max-width: 92vw;
  max-height: 86vh;
  box-shadow: 0 0 0 1px rgba(217, 154, 62, .4), 0 0 60px rgba(217, 154, 62, .2);
  color: #e6b25a;
  font-family: inherit;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.dpm-modal--input, .dpm-modal--loading, .dpm-modal--error { width: 520px; }
.dpm-modal--preview { width: 800px; max-height: 88vh; }
.dpm-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.dpm-title { font-size: 16px; font-weight: 700; }
.dpm-close {
  width: 26px; height: 26px; border-radius: 50%; border: none;
  background: rgba(255,255,255,.08); color: #a87526; cursor: pointer; font-size: 16px;
}
.dpm-body { display: flex; flex-direction: column; overflow: hidden; }
.dpm-preview { overflow-y: auto; padding-right: 4px; gap: 14px; flex: 1 1 0; min-height: 0; }

.dpm-context { font-size: 12px; color: #a87526; margin-bottom: 10px; }
.dpm-label { display: block; font-size: 11px; color: #a87526; margin-bottom: 6px; }
.dpm-textarea, .dpm-sec__text, .dpm-sec__input {
  width: 100%; padding: 8px 10px; border-radius: 6px;
  background: rgba(0,0,0,.4);
  border: 1px solid rgba(217, 154, 62, .3);
  color: #e6b25a; font-size: 12px; outline: none;
  font-family: inherit; resize: vertical;
}
.dpm-textarea:focus, .dpm-sec__text:focus, .dpm-sec__input:focus { border-color: #d99a3e; }

.dpm-loading {
  align-items: center; padding: 20px 0; gap: 10px;
}
.dpm-spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(217, 154, 62, .2);
  border-top-color: #d99a3e;
  border-radius: 50%;
  animation: dpm-spin .8s linear infinite;
}
@keyframes dpm-spin { to { transform: rotate(360deg); } }
.dpm-hint { font-size: 11px; color: #6a4f1a; }
.dpm-error {
  padding: 14px; border-radius: 8px;
  background: rgba(255,80,80,.08);
  border: 1px solid rgba(255,80,80,.4);
  color: #ff9a8a; font-size: 13px;
  margin-bottom: 14px;
}

.dpm-prd-title {
  width: 100%; padding: 10px 12px;
  background: rgba(217, 154, 62, .05);
  border: 1px solid rgba(217, 154, 62, .35);
  border-radius: 8px;
  color: #e6b25a; font-size: 15px; font-weight: 700;
  outline: none; font-family: inherit;
  margin-bottom: 6px;
}

.dpm-sec {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255,255,255,.02);
  border-left: 3px solid #d99a3e;
}
.dpm-sec__name { font-size: 11px; font-weight: 700; color: #d99a3e; margin-bottom: 6px; }
.dpm-sec__row { display: flex; gap: 6px; margin-bottom: 4px; }
.dpm-sec__del {
  width: 28px; border-radius: 4px; border: none;
  background: rgba(255,255,255,.04); color: #a87526; cursor: pointer; font-size: 14px;
}
.dpm-sec__del:hover { background: rgba(255,80,80,.18); color: #ff9a8a; }
.dpm-sec__add {
  padding: 4px 10px; border-radius: 6px;
  background: transparent;
  border: 1px dashed rgba(217, 154, 62, .4);
  color: #a87526; font-size: 11px; cursor: pointer; font-family: inherit;
  margin-top: 4px;
}
.dpm-sec__add:hover { color: #e6b25a; border-color: rgba(217, 154, 62, .7); }

.dpm-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid rgba(217, 154, 62, .18);
}
.dpm-btn {
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
  background: transparent;
  border: 1px solid rgba(217, 154, 62, .3); color: #a87526;
  font-family: inherit;
}
.dpm-btn:hover { color: #e6b25a; border-color: rgba(217, 154, 62, .65); }
.dpm-btn.is-primary {
  background: #d99a3e; color: #1a1208; border-color: #d99a3e; font-weight: 600;
}
.dpm-btn.is-primary:hover { background: #e6b25a; }
.dpm-btn:disabled { opacity: .35; cursor: not-allowed; }
```

- [ ] **Step 5: Mount the modal in PracticeWorkspace**

Add to `apps/web/src/views/PracticeWorkspace.tsx` (at the end of the returned JSX, before the closing div):

```tsx
{draftPrdOpen && (
  <DraftPrdModal
    practice={practice}
    children={children}
    onClose={() => setDraftPrdOpen(false)} />
)}
```

Add the import:

```tsx
import { DraftPrdModal } from "../components/DraftPrdModal.js";
```

- [ ] **Step 6: Build + restart + verify**

```bash
pnpm --filter @ke/web build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
```

In Rich → 项目实战 → test card → 拆解 → PRD 分组 → click 🪄 让 Rich 起草 → modal opens.
Type optional context → 开始起草 → spinner → ~30-60s → 8-section preview appears.
Edit a section → click 确认 创建 PRD → modal closes → PRD count goes from 0 to 1.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/DraftPrdModal.tsx apps/web/src/components/DraftPrdModal.css apps/web/src/api/client.ts apps/web/src/views/PracticeWorkspace.tsx
git commit -m "feat(practice): 🪄 AI draft PRD modal — generate, edit, save to product-design child"
```

---

## Task 10: Build 效果图 tab (gallery + upload)

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/views/PracticeWorkspace.tsx`
- Modify: `apps/web/src/views/PracticeWorkspace.css`

- [ ] **Step 1: Locate existing image attachment API**

```bash
grep -rn "uploadImage\|imageAttachment\|/api/images" /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/web/src/api/ /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/server/src/routes/images.ts 2>/dev/null | head -10
```

Identify the upload endpoint (likely `POST /api/images/:elementId/upload` or similar). Note the URL pattern + accepted body (FormData? raw bytes?).

- [ ] **Step 2: Add MockupsTab component**

In `apps/web/src/views/PracticeWorkspace.tsx`, add:

```tsx
interface MockupsTabProps {
  practice: Element;
}

function MockupsTab({ practice }: MockupsTabProps): ReactNode {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const hydrate = useStore(s => s.hydrate);

  // The element's image attachments live in practice.content as a list of
  // { src, caption } OR inside a "mindmap-embed" / similar section. Check
  // existing knowledge tree pattern; for V1 we'll read from
  // (practice.content as any)?.images ?? []
  const images: Array<{ src: string; caption?: string }> =
    (practice.content as { images?: Array<{ src: string; caption?: string }> })?.images ?? [];

  const onPick = () => fileRef.current?.click();

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      // Upload via existing endpoint — adapt URL based on Step 1 findings.
      // Example pattern (FormData):
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/images/${encodeURIComponent(practice.id)}/upload`, {
        method: "POST", body: fd,
      });
      if (!r.ok) throw new Error(`upload failed: ${r.status}`);
      const { src } = await r.json();
      // Patch the element content with the new image entry
      const r2 = await fetch(`/api/elements/${encodeURIComponent(practice.id)}`);
      const el = await r2.json();
      el.content = el.content ?? {};
      el.content.images = [...(el.content.images ?? []), { src, caption: f.name }];
      el.metadata.updatedAt = new Date().toISOString();
      await fetch(`/api/elements/${encodeURIComponent(practice.id)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(el),
      });
      await hydrate();
    } catch (err) {
      alert(`上传失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="pw-mk">
      <div className="pw-mk__head">
        <span>效果图 ({images.length})</span>
        <button className="dpm-btn is-primary" onClick={onPick} disabled={uploading}>
          {uploading ? "上传中…" : "+ 上传"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onUpload} />
      </div>
      {images.length === 0 ? (
        <div className="pw-mk__empty">还没有效果图。点 +上传 加一张。</div>
      ) : (
        <div className="pw-mk__grid">
          {images.map((img, i) => (
            <button key={i} className="pw-mk__cell" onClick={() => setFullscreen(i)}>
              <img src={img.src} alt={img.caption ?? `mockup-${i}`} />
              {img.caption && <div className="pw-mk__caption">{img.caption}</div>}
            </button>
          ))}
        </div>
      )}
      {fullscreen !== null && images[fullscreen] && (
        <div className="pw-mk__fs" onClick={() => setFullscreen(null)}>
          <img src={images[fullscreen].src} alt={images[fullscreen].caption ?? ""} />
        </div>
      )}
    </div>
  );
}
```

Then in the workspace body:

```tsx
{tab === "mockups" && <MockupsTab practice={practice} />}
```

- [ ] **Step 3: Add CSS**

Append to `apps/web/src/views/PracticeWorkspace.css`:

```css
.pw-mk { display: flex; flex-direction: column; gap: 14px; }
.pw-mk__head {
  display: flex; align-items: center; gap: 14px;
  font-size: 13px; color: #e6b25a; font-weight: 600;
}
.pw-mk__empty { padding: 60px 20px; text-align: center; color: #6a4f1a; font-size: 12px; }
.pw-mk__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.pw-mk__cell {
  display: flex; flex-direction: column;
  border-radius: 8px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(217, 154, 62, .25);
  cursor: pointer; overflow: hidden;
  padding: 0; font-family: inherit;
}
.pw-mk__cell:hover { border-color: rgba(217, 154, 62, .6); }
.pw-mk__cell img { width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block; }
.pw-mk__caption {
  padding: 6px 10px; font-size: 11px; color: #a87526; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pw-mk__fs {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(0,0,0,.92);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.pw-mk__fs img { max-width: 95vw; max-height: 92vh; object-fit: contain; }
```

- [ ] **Step 4: Build + restart + verify**

```bash
pnpm --filter @ke/web build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
```

In Rich → 项目实战 → test practice → 效果图 → empty state. Click +上传 → pick a screenshot → after upload, image appears in grid. Click image → fullscreen overlay. Click backdrop → close.

If the upload endpoint URL guessed in Step 1 turns out different, adapt accordingly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/views/PracticeWorkspace.tsx apps/web/src/views/PracticeWorkspace.css
git commit -m "feat(practice): mockups tab — gallery + upload + fullscreen viewer"
```

---

## Task 11: Side drawer for editing sub-elements

**Role:** UI Developer

**Files:**
- Create: `apps/web/src/components/ChildElementDrawer.tsx`
- Create: `apps/web/src/components/ChildElementDrawer.css`
- Modify: `apps/web/src/views/PracticeWorkspace.tsx`

- [ ] **Step 1: Build the drawer**

Write `apps/web/src/components/ChildElementDrawer.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import "./ChildElementDrawer.css";

interface Props {
  elementId: string;
  onClose: () => void;
}

export function ChildElementDrawer({ elementId, onClose }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const hydrate = useStore(s => s.hydrate);
  const el = elements.get(elementId);

  const [title, setTitle] = useState(el?.title ?? "");
  const [subtitle, setSubtitle] = useState(el?.subtitle ?? "");
  const [contentText, setContentText] = useState(
    typeof el?.content === "string" ? el.content : JSON.stringify(el?.content ?? {}, null, 2),
  );
  const [status, setStatus] = useState<"todo" | "doing" | "done">(el?.status ?? "todo");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(el?.title ?? "");
    setSubtitle(el?.subtitle ?? "");
    setContentText(typeof el?.content === "string" ? el.content : JSON.stringify(el?.content ?? {}, null, 2));
    setStatus(el?.status ?? "todo");
  }, [el?.id]);

  if (!el) return null;

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/elements/${encodeURIComponent(el.id)}`);
      if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
      const full = await r.json();
      full.title = title.trim() || full.title;
      full.subtitle = subtitle;
      // Try to parse content as JSON; fallback to plain string
      try { full.content = JSON.parse(contentText); }
      catch { full.content = contentText; }
      if (el.type === "step") full.status = status;
      full.metadata = { ...full.metadata, updatedAt: new Date().toISOString() };
      const r2 = await fetch(`/api/elements/${encodeURIComponent(el.id)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(full),
      });
      if (!r2.ok) throw new Error(`save failed: ${r2.status}`);
      await hydrate();
      onClose();
    } catch (e) {
      alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`确认删除「${el.title}」？此操作不可撤销。`)) return;
    try {
      await fetch(`/api/elements/${encodeURIComponent(el.id)}`, { method: "DELETE" });
      await hydrate();
      onClose();
    } catch (e) {
      alert(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="ced-back" onClick={onClose}>
      <div className="ced-panel" onClick={e => e.stopPropagation()}>
        <div className="ced-head">
          <div>
            <div className="ced-type">{el.type}</div>
            <input className="ced-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <button className="ced-close" onClick={onClose}>×</button>
        </div>
        <label className="ced-label">副标题</label>
        <input className="ced-input" value={subtitle} onChange={e => setSubtitle(e.target.value)} />

        {el.type === "step" && (
          <>
            <label className="ced-label">状态</label>
            <div className="ced-status">
              {(["todo","doing","done"] as const).map(s => (
                <button key={s}
                  className={`ced-chip ${status === s ? "is-active" : ""}`}
                  onClick={() => setStatus(s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        <label className="ced-label">内容（JSON 或纯文本）</label>
        <textarea className="ced-content" rows={14} value={contentText}
          onChange={e => setContentText(e.target.value)} />

        <div className="ced-foot">
          <button className="ced-btn ced-btn--danger" onClick={() => void remove()}>删除</button>
          <div style={{ flex: 1 }} />
          <button className="ced-btn" onClick={onClose}>取消</button>
          <button className="ced-btn is-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Drawer CSS**

Write `apps/web/src/components/ChildElementDrawer.css`:

```css
.ced-back {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 900;
  display: flex; justify-content: flex-end;
}
.ced-panel {
  width: 520px; max-width: 95vw;
  height: 100%;
  background: #0a0604;
  border-left: 1px solid rgba(217, 154, 62, .5);
  padding: 22px 24px 18px;
  color: #e6b25a;
  font-family: inherit;
  display: flex; flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}
.ced-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
.ced-type {
  font-size: 10px; padding: 1px 8px; border-radius: 10px;
  background: rgba(217, 154, 62, .18); color: #d99a3e;
  display: inline-block; margin-bottom: 6px;
}
.ced-title {
  width: 100%; background: transparent; border: none;
  color: #e6b25a; font-size: 17px; font-weight: 700;
  outline: none; padding: 2px 0;
  font-family: inherit;
}
.ced-title:focus { border-bottom: 1px dashed rgba(217, 154, 62, .5); }
.ced-close {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: rgba(255,255,255,.08); color: #a87526; cursor: pointer; font-size: 16px;
}
.ced-label { font-size: 11px; color: #a87526; margin-top: 6px; }
.ced-input, .ced-content {
  width: 100%; padding: 8px 10px; border-radius: 6px;
  background: rgba(0,0,0,.4); border: 1px solid rgba(217, 154, 62, .25);
  color: #e6b25a; font-size: 12px; outline: none; font-family: inherit;
}
.ced-content { font-family: monospace; resize: vertical; }
.ced-status { display: flex; gap: 6px; }
.ced-chip {
  padding: 4px 12px; border-radius: 6px;
  background: transparent; border: 1px solid rgba(217, 154, 62, .25);
  color: #a87526; font-size: 11px; cursor: pointer; font-family: inherit;
}
.ced-chip.is-active {
  background: #d99a3e; color: #1a1208; border-color: #d99a3e; font-weight: 600;
}
.ced-foot {
  display: flex; gap: 8px; margin-top: 12px; padding-top: 10px;
  border-top: 1px solid rgba(217, 154, 62, .18);
}
.ced-btn {
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
  background: transparent; border: 1px solid rgba(217, 154, 62, .3);
  color: #a87526; font-family: inherit;
}
.ced-btn:hover { color: #e6b25a; border-color: rgba(217, 154, 62, .65); }
.ced-btn.is-primary { background: #d99a3e; color: #1a1208; border-color: #d99a3e; font-weight: 600; }
.ced-btn.is-primary:hover { background: #e6b25a; }
.ced-btn--danger { color: #ff9a8a; border-color: rgba(255,80,80,.3); }
.ced-btn--danger:hover { background: rgba(255,80,80,.12); border-color: rgba(255,80,80,.5); }
.ced-btn:disabled { opacity: .35; cursor: not-allowed; }
```

- [ ] **Step 3: Mount in PracticeWorkspace**

In `apps/web/src/views/PracticeWorkspace.tsx`, add the import:

```tsx
import { ChildElementDrawer } from "../components/ChildElementDrawer.js";
```

At the end of the workspace's returned JSX (before closing div):

```tsx
{openChildId && (
  <ChildElementDrawer
    elementId={openChildId}
    onClose={() => setOpenChildId(null)} />
)}
```

- [ ] **Step 4: Build + restart + verify**

```bash
pnpm --filter @ke/web build
pnpm --filter @ke/desktop package
pkill -9 -f "Rich Helper"; pkill -9 -f "Rich.app"; sleep 1
open /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich/apps/desktop/release/mac-arm64/Rich.app
```

In Rich → 项目实战 → 拆解 → click any sub-element title (concept / case / PRD / step) → drawer slides in from right. Edit title / subtitle / status (for step) / content. Save → drawer closes, change reflected in workspace.

Click 删除 in drawer → confirm → element gone.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ChildElementDrawer.tsx apps/web/src/components/ChildElementDrawer.css apps/web/src/views/PracticeWorkspace.tsx
git commit -m "feat(practice): child element drawer — edit/save/delete sub-elements"
```

---

## Task 12: End-to-end verification + cleanup

**Role:** Senior Software Engineer

**Files:** (read-only verification + final commit)

- [ ] **Step 1: Full pipeline smoke test via UI**

In Rich.app:

1. 点 项目实战 → 见列表
2. 用 MCP 建一个新 practice：
```bash
curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"practice_create","arguments":{"title":"端到端 E2E 验证","subtitle":"V1 全流程"}}}' | head -c 300
```
3. 焦点 Rich → 列表出现新卡 → 点进去 → 总览显示 0/0/0/0
4. 拆解 tab → 4 个分组都加 2 条（知识点/需求/PRD/任务）→ 总览数字更新
5. 任务 chip 改 doing → done → 总览进度条变 100%
6. PRD 分组点 🪄 → 输入额外要求 → 起草 → 编辑 → 确认 → PRD 数 +1
7. 效果图 → 上传一张截图 → 网格显示 → 点开全屏 → ESC 退出
8. 点任意子元 → drawer 打开 → 改内容 → 保存 → drawer 关
9. 列表页 → 卡片统计数正确

- [ ] **Step 2: Hermes CLI verification**

```bash
/Users/binkerking/.local/bin/hermes -z "你现在通过 Rich MCP：
1. practice_list 列出我所有项目
2. 找到刚才那个 'E2E 验证' 的项目，practice_get 它
3. 用 practice_add_child 加一个 step：'通过 Hermes 加的任务'
4. 用 practice_set_task_status 把它改成 doing
5. 用 4 行话告诉我每步结果。" 2>&1 | tail -20
```

Expected: Hermes 4 行报告 4 步都成功。

- [ ] **Step 3: Cleanup test data**

```bash
# Find + remove the E2E test practice
curl -s http://127.0.0.1:31515/api/elements | python3 -c "
import sys, json
els = json.load(sys.stdin)
test = [e for e in els if 'E2E' in e.get('title','') or 'MCP 测试' in e.get('title','')]
for t in test: print(t['id'])
" | while read id; do
  curl -s -X DELETE "http://127.0.0.1:31515/api/elements/$id" > /dev/null
  echo "deleted $id"
done
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 5: Final summary commit (optional — only if there are doc updates)**

```bash
git status
# If clean, skip. Otherwise:
git add -A
git commit -m "docs: 项目实战 V1 verification notes"
git push origin main
```

---

## After all tasks

V1 complete. 大斌哥 should be able to:

- 在 dock 切到 项目实战
- 看到列表 + 各项目统计
- 点进任意项目 → 3 tab 工作空间
- 在拆解 tab 加 4 类子元
- 任务用看板改状态
- 让 Rich 起草 PRD → 编辑 → 保存
- 上传效果图 → 看图
- 点子元 → drawer 编辑 → 保存
- 在 Hermes CLI 通过 MCP 工具完成上面任何动作

V2 范围（押后）：
- AI 生成效果图
- 把已有知识树元素**导入**成 practice 子元
- PRD/需求分析/任务的额外结构字段
- practice ↔ plan 自动联动
- 拖拽重排
- Project 模板

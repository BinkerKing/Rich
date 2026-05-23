# Stage 2: 计划数据层 + 单计划详情页 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破现有数据的前提下，加入 `Plan` 顶层抽象 + 单计划详情页（hero + 4 tab），让用户能手动创建并跟进多个计划。

**Architecture:** GreatMeState 单 blob 模型继续保留，向 state 加入 `plans: Plan[]`；`Goal`/`Task` 扩展可选字段 `planId/parentId/source/metric/archived`。所有纯函数（迁移、进度计算）落在 `packages/domain` 并加 vitest。UI 在 `apps/web` 新增 `PlanDetailView` + `NewPlanModal`，主入口仍是 `GreatMeView`，通过新增 `selectedPlanId` 状态切换"列表 / 详情"两种模式。

**Tech Stack:** TypeScript / React 18 / Zustand / Hono / Zod / SQLite（已有）/ vitest（packages/domain 已有）

**Reference Spec:** [docs/superpowers/specs/2026-05-23-plan-management-design.md](../specs/2026-05-23-plan-management-design.md)

---

## File Structure (will create / modify)

**Create:**
- `packages/domain/src/types/plan.ts` — Plan / extended Goal / extended Task 类型
- `packages/domain/src/plan.ts` — 纯函数：migrateLegacyGoals, computePlanProgress, planScopes
- `packages/domain/test/plan.test.ts` — vitest 单测
- `apps/web/src/components/NewPlanModal.tsx` — 新建计划弹窗
- `apps/web/src/components/NewPlanModal.css`
- `apps/web/src/views/PlanDetailView.tsx` — 单计划详情页（hero + 4 tab）
- `apps/web/src/views/PlanDetailView.css`

**Modify:**
- `apps/server/src/routes/greatMe.ts` — 扩展 zod schema（plans + 可选新字段）
- `apps/web/src/views/GreatMeView.tsx` — 加 Plan 类型、DEFAULT_STATE.plans、hydrate 时调 migrate、加 selectedPlanId 状态、路由到 PlanDetailView、HomeSection 添加计划卡片列表
- `apps/web/src/views/GreatMeView.css` — 计划卡片 + 计划详情页样式

**Migration safety:** state schema 加 plans 是 zod `.default([])`，goal/task 新字段都是 `.optional()`，旧 blob 100% 兼容。

---

## Task 1: 在 packages/domain 添加 Plan 类型

**Role:** Senior Software Engineer

**Files:**
- Create: `packages/domain/src/types/plan.ts`

- [ ] **Step 1.1: 新建类型文件**

```ts
// packages/domain/src/types/plan.ts
/**
 * 「计划管理」的顶层抽象：一个 Plan 是用户提的一个高层愿望（例："3 个月减 10 斤"），
 * 独立于年/月/周时间尺度。多个 Plan 并行；每个 Plan 下挂多层 Goal + 天级 Task。
 *
 * 数据层落在 GreatMeState.plans。所有字段都是可序列化的 JSON。
 */
export type PlanScope = "year" | "month" | "week" | "day";
export type PlanStatus = "active" | "archived" | "completed";
export type GoalSource = "user" | "ai" | "ai-confirmed";
export type TaskSource = "user" | "ai" | "ai-template";

export interface Plan {
  id: string;
  title: string;
  detail?: string;
  start: string;             // ISO date "2026-05-01"
  end: string;               // ISO date "2026-07-31"
  scopes: PlanScope[];       // 用到哪些层级，比如 ["month","week","day"] 跳过 year
  status: PlanStatus;
  source: "user" | "ai-decompose";
  createdAt: number;
  archivedAt?: number;
  /** 拆解溯源，可选 */
  aiTrace?: { messageId: string; conversationId: string; decomposedAt: number };
}

/** 量化指标。给 "跑 12km" 这种数值目标用，画曲线/算完成率用 */
export interface Metric {
  unit: string;
  target: number;
  actual?: number;
}

/** Goal/Task 上新增的可选字段，老数据全部为 undefined，行为不变 */
export interface PlanLinkage {
  planId?: string;
  parentId?: string;
}
```

- [ ] **Step 1.2: 在 domain index 导出**

打开 `packages/domain/src/index.ts`，确认末尾追加：

```ts
export * from "./types/plan.js";
```

如果 index.ts 还没有，新建一个并写入上面这一行 + 已有的 re-exports（先用 `cat packages/domain/src/index.ts` 看一下当前内容，把新行追加到末尾）。

- [ ] **Step 1.3: typecheck**

```bash
pnpm --filter @ke/domain typecheck
```

Expected: 无错误输出（only `> @ke/domain@0.0.1 typecheck` + `> tsc --noEmit`）

- [ ] **Step 1.4: Commit**

```bash
git add packages/domain/src/types/plan.ts packages/domain/src/index.ts
git commit -m "feat(domain): add Plan / Metric / PlanLinkage types for plan management"
```

---

## Task 2: 在 packages/domain 写 migrateLegacyGoals 纯函数（TDD）

**Role:** Senior Software Engineer

**Files:**
- Create: `packages/domain/src/plan.ts`
- Create: `packages/domain/test/plan.test.ts`

迁移逻辑：当 state 里有 goal 没有 planId 时，自动建立一个 id=`"unsorted"`、title="未分组" 的兜底 plan，把所有孤儿 goal 都挂上去。**幂等**：再跑一次不会重复建。

- [ ] **Step 2.1: 写失败测试**

```ts
// packages/domain/test/plan.test.ts
import { describe, it, expect } from "vitest";
import { migrateLegacyGoals } from "../src/plan.js";

interface MinState {
  plans?: Array<{ id: string; title: string; status: string }>;
  goals: Array<{ id: string; title: string; planId?: string }>;
}

describe("migrateLegacyGoals", () => {
  it("creates an unsorted plan and assigns orphan goals", () => {
    const before: MinState = {
      goals: [
        { id: "g1", title: "old goal A" },
        { id: "g2", title: "old goal B" },
      ],
    };
    const after = migrateLegacyGoals(before);
    expect(after.plans).toHaveLength(1);
    expect(after.plans?.[0].id).toBe("unsorted");
    expect(after.plans?.[0].title).toBe("未分组");
    expect(after.goals[0].planId).toBe("unsorted");
    expect(after.goals[1].planId).toBe("unsorted");
  });

  it("is idempotent: running twice yields same result", () => {
    const before: MinState = { goals: [{ id: "g1", title: "x" }] };
    const once = migrateLegacyGoals(before);
    const twice = migrateLegacyGoals(once);
    expect(twice.plans).toHaveLength(1);
    expect(twice.goals[0].planId).toBe("unsorted");
  });

  it("leaves already-tagged goals untouched", () => {
    const before: MinState = {
      plans: [{ id: "p-real", title: "减肥", status: "active" }],
      goals: [
        { id: "g1", title: "已挂", planId: "p-real" },
        { id: "g2", title: "孤儿" },
      ],
    };
    const after = migrateLegacyGoals(before);
    // p-real 保留 + 多了 unsorted
    expect(after.plans?.map(p => p.id).sort()).toEqual(["p-real", "unsorted"]);
    expect(after.goals.find(g => g.id === "g1")?.planId).toBe("p-real");
    expect(after.goals.find(g => g.id === "g2")?.planId).toBe("unsorted");
  });

  it("creates no unsorted plan when all goals already tagged", () => {
    const before: MinState = {
      plans: [{ id: "p-real", title: "x", status: "active" }],
      goals: [{ id: "g1", title: "x", planId: "p-real" }],
    };
    const after = migrateLegacyGoals(before);
    expect(after.plans).toEqual([{ id: "p-real", title: "x", status: "active" }]);
  });

  it("handles empty goals array safely", () => {
    const before: MinState = { goals: [] };
    const after = migrateLegacyGoals(before);
    expect(after.plans).toEqual([]);
    expect(after.goals).toEqual([]);
  });
});
```

- [ ] **Step 2.2: 跑测试确认失败**

```bash
pnpm --filter @ke/domain test
```

Expected: `Failed to resolve import "../src/plan.js"` 或 `migrateLegacyGoals is not a function`

- [ ] **Step 2.3: 写最小实现**

```ts
// packages/domain/src/plan.ts
/**
 * 「计划管理」相关的纯函数：迁移、进度计算、范围判定。
 * 都是 in/out 数据变换，不碰 IO，便于 vitest 单测。
 */
import type { Plan, PlanScope } from "./types/plan.js";

/** 兜底计划的固定 id，迁移和读取都用这个常量 */
export const UNSORTED_PLAN_ID = "unsorted";

interface GoalLike { id: string; planId?: string }
interface StateLike {
  plans?: Plan[];
  goals: GoalLike[];
}

/**
 * 把任何 goal.planId 缺失的旧数据，归到一个 id="unsorted" 的兜底 plan。
 * 幂等：state 里已经有 unsorted plan 就直接复用。
 * goals 全部已挂载时不会建 unsorted plan。
 */
export function migrateLegacyGoals<S extends StateLike>(state: S): S {
  const plans = [...(state.plans ?? [])];
  const orphans = state.goals.filter(g => !g.planId);

  if (orphans.length === 0) {
    return { ...state, plans };
  }

  const hasUnsorted = plans.some(p => p.id === UNSORTED_PLAN_ID);
  if (!hasUnsorted) {
    plans.push({
      id: UNSORTED_PLAN_ID,
      title: "未分组",
      start: "",
      end: "",
      scopes: ["year", "month", "week", "day"],
      status: "active",
      source: "user",
      createdAt: Date.now(),
    });
  }
  const goals = state.goals.map(g => g.planId ? g : { ...g, planId: UNSORTED_PLAN_ID });
  return { ...state, plans, goals };
}

/** 占位实现，下一个 task 才真正实现 */
export function computePlanProgress(_planId: string, _goals: GoalLike[]): number {
  return 0;
}

export function planScopes(start: string, end: string): PlanScope[] {
  if (!start || !end) return ["year", "month", "week", "day"];
  const startMs = Date.parse(start);
  const endMs   = Date.parse(end);
  const months  = Math.ceil((endMs - startMs) / (30 * 86400000));
  const scopes: PlanScope[] = ["day", "week"];
  if (months >= 2) scopes.push("month");
  if (months >= 12) scopes.unshift("year"); // 年度只有跨年才需要
  return scopes;
}
```

- [ ] **Step 2.4: 跑测试确认通过**

```bash
pnpm --filter @ke/domain test
```

Expected: `Test Files  1 passed (1)` + `Tests  5 passed (5)`

- [ ] **Step 2.5: Commit**

```bash
git add packages/domain/src/plan.ts packages/domain/test/plan.test.ts
git commit -m "feat(domain): migrateLegacyGoals + planScopes pure helpers with tests"
```

---

## Task 3: 在 packages/domain 实现 computePlanProgress（TDD）

**Role:** Senior Software Engineer

**Files:**
- Modify: `packages/domain/src/plan.ts`
- Modify: `packages/domain/test/plan.test.ts`

进度计算规则（v1）：
- 计划下所有 week-scope goal 的 progress 平均
- 如果没有 week goal，退化到 month-scope 平均
- 如果都没有，0%

- [ ] **Step 3.1: 写失败测试**

把这个 describe 块**追加**到 `packages/domain/test/plan.test.ts` 末尾：

```ts
describe("computePlanProgress", () => {
  const G = (id: string, planId: string, scope: "year"|"month"|"week", progress: number) =>
    ({ id, planId, scope, progress });

  it("returns 0 for plan with no goals", () => {
    expect(computePlanProgress("p1", [])).toBe(0);
  });

  it("averages week-scope goals when present", () => {
    const goals = [
      G("g1", "p1", "week", 80),
      G("g2", "p1", "week", 40),
      G("g3", "p1", "month", 100), // 忽略
    ];
    expect(computePlanProgress("p1", goals)).toBe(60);
  });

  it("falls back to month-scope when no week goals", () => {
    const goals = [
      G("g1", "p1", "month", 50),
      G("g2", "p1", "month", 70),
    ];
    expect(computePlanProgress("p1", goals)).toBe(60);
  });

  it("ignores goals from other plans", () => {
    const goals = [
      G("g1", "p1", "week", 100),
      G("g2", "p2", "week", 0),
    ];
    expect(computePlanProgress("p1", goals)).toBe(100);
  });

  it("returns rounded integer", () => {
    const goals = [
      G("g1", "p1", "week", 33),
      G("g2", "p1", "week", 34),
      G("g3", "p1", "week", 34),
    ];
    expect(computePlanProgress("p1", goals)).toBe(34); // (33+34+34)/3 = 33.67 → 34
  });
});
```

`computePlanProgress` 的导入语句在文件顶部，已经在 Task 2 里有了。如果没有，把它加进 import 列表。

`G` helper 返回的对象需要类型对齐。把测试文件顶部的 `GoalLike` 接口替换或加上 `scope` + `progress`：

```ts
interface MinState {
  plans?: Array<{ id: string; title: string; status: string }>;
  goals: Array<{ id: string; title: string; planId?: string; scope?: string; progress?: number }>;
}
```

- [ ] **Step 3.2: 跑测试确认失败**

```bash
pnpm --filter @ke/domain test
```

Expected: 新加的 5 个 case 全部 FAIL（占位 stub 永远返回 0，所以"all empty" 那条会过，其它 4 条 fail）

- [ ] **Step 3.3: 替换 computePlanProgress 实现**

在 `packages/domain/src/plan.ts` 把占位函数替换为：

```ts
interface ScopedGoal { id: string; planId?: string; scope: "year"|"month"|"week"; progress: number }

export function computePlanProgress(planId: string, goals: ScopedGoal[]): number {
  const mine = goals.filter(g => g.planId === planId);
  if (mine.length === 0) return 0;
  const byScope = (s: "year"|"month"|"week"): ScopedGoal[] => mine.filter(g => g.scope === s);
  const pick = byScope("week").length > 0 ? byScope("week")
             : byScope("month").length > 0 ? byScope("month")
             : byScope("year");
  if (pick.length === 0) return 0;
  const sum = pick.reduce((acc, g) => acc + g.progress, 0);
  return Math.round(sum / pick.length);
}
```

同时把原文件里的旧 `GoalLike` 接口扩展兼容（让 `migrateLegacyGoals` 的 GoalLike 不要求 scope/progress）：保留 `interface GoalLike { id: string; planId?: string }`，新建一个 `ScopedGoal` 用于 progress 函数。

- [ ] **Step 3.4: 跑测试确认通过**

```bash
pnpm --filter @ke/domain test
```

Expected: `Tests  10 passed (10)`

- [ ] **Step 3.5: Commit**

```bash
git add packages/domain/src/plan.ts packages/domain/test/plan.test.ts
git commit -m "feat(domain): computePlanProgress averaging by finest scope"
```

---

## Task 4: 扩展 server zod schema 接受 plans + 新字段

**Role:** Backend Engineer

**Files:**
- Modify: `apps/server/src/routes/greatMe.ts`

加 PlanSchema + 让 Goal/Task 新增可选字段。要保证旧 blob（无 plans 字段）依然能解析。

- [ ] **Step 4.1: 在 GoalSchema 加可选字段**

打开 `apps/server/src/routes/greatMe.ts`，把 `GoalSchema` 替换为：

```ts
const MetricSchema = z.object({
  unit: z.string().max(20),
  target: z.number(),
  actual: z.number().optional(),
});

const GoalSchema = z.object({
  id: z.string().min(1).max(80),
  scope: z.enum(["year", "month", "week"]),
  title: z.string().min(1).max(280),
  detail: z.string().max(800).default(""),
  phase: z.enum(["calibrate", "execute", "review", "close"]).default("execute"),
  due: z.string().max(20).default(""),
  progress: z.number().min(0).max(100).default(0),
  createdAt: z.number(),
  // === 新增（全部 optional 以保兼容） ===
  planId: z.string().max(80).optional(),
  parentId: z.string().max(80).optional(),
  source: z.enum(["user", "ai", "ai-confirmed"]).optional(),
  metric: MetricSchema.optional(),
});
```

- [ ] **Step 4.2: 在 TaskSchema 加可选字段**

替换 `TaskSchema` 为：

```ts
const TaskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(280),
  done: z.boolean().default(false),
  date: z.string().max(20).default(""),
  badge: z.string().max(20).default(""),
  goalId: z.string().max(80).default(""),
  note: z.string().max(400).default(""),
  // === 新增 ===
  source: z.enum(["user", "ai", "ai-template"]).optional(),
  metric: MetricSchema.optional(),
  archived: z.boolean().optional(),
});
```

- [ ] **Step 4.3: 加 PlanSchema**

在 `TaskSchema` 之后插入：

```ts
const PlanSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  detail: z.string().max(800).optional(),
  start: z.string().max(20).default(""),
  end: z.string().max(20).default(""),
  scopes: z.array(z.enum(["year","month","week","day"])).max(4).default(["month","week","day"]),
  status: z.enum(["active","archived","completed"]).default("active"),
  source: z.enum(["user","ai-decompose"]).default("user"),
  createdAt: z.number(),
  archivedAt: z.number().optional(),
  aiTrace: z.object({
    messageId: z.string().max(120),
    conversationId: z.string().max(120),
    decomposedAt: z.number(),
  }).optional(),
});
```

- [ ] **Step 4.4: 在 GreatMeStateSchema 加 plans**

替换 `GreatMeStateSchema` 中现有字段块（保留所有现有字段不动，只追加 plans 行）：

```ts
const GreatMeStateSchema = z.object({
  profile: ProfileSchema,
  plans: z.array(PlanSchema).max(50).default([]),  // ← 新增这一行
  goals: z.array(GoalSchema).max(200).default([]),
  tasks: z.array(TaskSchema).max(500).default([]),
  events: z.array(EventSchema).max(200).default([]),
  daily: z.array(DailyEntrySchema).max(366).default([]),
  reviews: z.array(ReviewSchema).max(200).default([]),
  ability: AbilitySchema,
  compounding: z.object({
    score: z.number().min(0).max(100).default(0),
    trend: z.array(z.number()).max(60).default([]),
    topAssets: z.array(z.string().max(120)).max(5).default([]),
    topBlockers: z.array(z.string().max(120)).max(5).default([]),
  }).default(() => ({ score: 0, trend: [], topAssets: [], topBlockers: [] })),
  conversations: z.array(ConversationSchema).max(50).default([]),
  activeSection: SectionId.default("home"),
  activeRange: RangeId.default("week"),
  soundOn: z.boolean().default(true),
});
```

- [ ] **Step 4.5: typecheck server**

```bash
pnpm --filter @ke/server typecheck
```

Expected: 无错误

- [ ] **Step 4.6: 跑现有 server 测试确认未破**

```bash
pnpm --filter @ke/server test 2>&1 | tail -10
```

Expected: 所有现有 test 仍 PASS。看到 great-me.test 的 case 全绿即可。

- [ ] **Step 4.7: Commit**

```bash
git add apps/server/src/routes/greatMe.ts
git commit -m "feat(server): extend GreatMeStateSchema with plans + optional Goal/Task fields"
```

---

## Task 5: 前端类型与 DEFAULT_STATE 同步

**Role:** Senior Software Engineer

**Files:**
- Modify: `apps/web/src/views/GreatMeView.tsx`

把前端 inline 的 interfaces 对齐，DEFAULT_STATE 加 plans: []。引入 @ke/domain 的 Plan 类型避免双声明。

- [ ] **Step 5.1: 添加 Plan 类型导入与本地接口扩展**

在 `apps/web/src/views/GreatMeView.tsx` 顶部 import 区块加：

```ts
import type { Plan } from "@ke/domain";
```

找到现有的 interface Goal 与 Task（约第 16-17 行），替换为：

```ts
interface Goal {
  id: string;
  scope: "year" | "month" | "week";
  title: string;
  detail: string;
  phase: Phase;
  due: string;
  progress: number;
  createdAt: number;
  /** Plan 归属。老数据可能没有；migrate 后会补齐 */
  planId?: string;
  parentId?: string;
  source?: "user" | "ai" | "ai-confirmed";
  metric?: { unit: string; target: number; actual?: number };
}
interface Task {
  id: string;
  title: string;
  done: boolean;
  date: string;
  badge: string;
  goalId: string;
  note: string;
  source?: "user" | "ai" | "ai-template";
  metric?: { unit: string; target: number; actual?: number };
  archived?: boolean;
}
```

- [ ] **Step 5.2: GreatMeState 加 plans 字段**

找到 `interface GreatMeState { ... }`（约第 26-33 行），加 `plans: Plan[];`：

```ts
interface GreatMeState {
  profile: Profile;
  plans: Plan[];
  goals: Goal[]; tasks: Task[]; events: EventItem[]; daily: Daily[]; reviews: Review[];
  ability: Ability;
  compounding: { score: number; trend: number[]; topAssets: string[]; topBlockers: string[] };
  conversations: Conversation[];
  activeSection: SectionId; activeRange: RangeId; soundOn: boolean;
}
```

- [ ] **Step 5.3: DEFAULT_STATE 加 plans: []**

找到 `const DEFAULT_STATE: GreatMeState = { ... }`（约第 35-42 行），把 `plans: []` 加在 `goals: []` 之前：

```ts
const DEFAULT_STATE: GreatMeState = {
  profile: { codename: "", city: "", mbti: "", background: "", hqPersonality: "nova", weekStart: 1 },
  plans: [],
  goals: [], tasks: [], events: [], daily: [], reviews: [],
  ability: { execution: 0, focus: 0, rhythm: 0, review: 0, recovery: 0, evidence: 0 },
  compounding: { score: 0, trend: [], topAssets: [], topBlockers: [] },
  conversations: [],
  activeSection: "home", activeRange: "week", soundOn: true,
};
```

- [ ] **Step 5.4: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/views/GreatMeView.tsx
git commit -m "feat(web): extend GreatMeState with plans + optional Goal/Task fields"
```

---

## Task 6: 在 hydrate 时调 migrateLegacyGoals

**Role:** Senior Software Engineer

**Files:**
- Modify: `apps/web/src/views/GreatMeView.tsx`

`GreatMeView` 组件加载时拉取后端 state，在落到 React state 之前先跑 migrate。

- [ ] **Step 6.1: 引入 migrate 函数**

在 import 区块（与 Task 5 的 `Plan` import 同行或下一行）扩展为：

```ts
import { migrateLegacyGoals } from "@ke/domain";
import type { Plan } from "@ke/domain";
```

- [ ] **Step 6.2: 在 hydrate effect 里调用 migrate**

找到 `GreatMeView` 组件里那段 `useEffect` 调用 `api.getGreatMeState`（约第 89-94 行），把它替换为：

```ts
useEffect(() => {
  api.getGreatMeState<GreatMeState>()
    .then(s => {
      if (s) {
        const merged = { ...DEFAULT_STATE, ...s };
        const migrated = migrateLegacyGoals(merged);
        setState(migrated as GreatMeState);
      }
    })
    .catch(err => console.warn("GreatMe load failed", err))
    .finally(() => setLoaded(true));
}, []);
```

- [ ] **Step 6.3: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误

- [ ] **Step 6.4: 手动验证：build + 启 Rich.app + 检查 state**

```bash
pnpm --filter @ke/web build && \
  pkill -f "Rich.app/Contents/MacOS/Rich"; sleep 1; \
  open "$(pwd)/apps/desktop/release/mac-arm64/Rich.app" && sleep 4 && \
  curl -s http://127.0.0.1:31515/api/great-me/state | \
    node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const s=JSON.parse(d).state;console.log("plans:",s.plans?.length,JSON.stringify(s.plans?.[0]?.title));console.log("goals with planId:",s.goals.filter(g=>g.planId).length,"/",s.goals.length);})'
```

Expected:
```
plans: 1 "未分组"
goals with planId: 9 / 9
```

（前提是 Task 5 之后 9 个 seed goal 还在数据库里）

- [ ] **Step 6.5: Commit**

```bash
git add apps/web/src/views/GreatMeView.tsx
git commit -m "feat(web): migrate legacy goals into an 'unsorted' plan on hydrate"
```

---

## Task 7: 新建计划弹窗（NewPlanModal）

**Role:** UI Developer

**Files:**
- Create: `apps/web/src/components/NewPlanModal.tsx`
- Create: `apps/web/src/components/NewPlanModal.css`

输入：标题 + 起止日期 + 单选(让 Rich 协助 / 手动)。提交时把 plan push 进 state.plans。

- [ ] **Step 7.1: 写组件**

```tsx
// apps/web/src/components/NewPlanModal.tsx
import { useMemo, useState, type ReactNode } from "react";
import { planScopes } from "@ke/domain";
import type { Plan } from "@ke/domain";
import "./NewPlanModal.css";

interface Props {
  onCreate: (plan: Omit<Plan, "id" | "createdAt">) => void;
  onCancel: () => void;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewPlanModal({ onCreate, onCancel }: Props): ReactNode {
  const today = useMemo(() => new Date(), []);
  const defaultStart = ymd(today);
  const defaultEnd = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 3);
    return ymd(d);
  }, [today]);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [mode, setMode] = useState<"ai" | "manual">("manual");

  const handleSubmit = (): void => {
    const t = title.trim();
    if (!t) return;
    onCreate({
      title: t,
      start,
      end,
      scopes: planScopes(start, end),
      status: "active",
      source: mode === "ai" ? "ai-decompose" : "user",
    });
  };

  return (
    <div className="np-back" onClick={onCancel}>
      <div className="np-modal" onClick={e => e.stopPropagation()}>
        <div className="np-modal__head">
          <div className="np-modal__title">新建计划</div>
          <button className="np-modal__close" onClick={onCancel}>×</button>
        </div>

        <label className="np-field">
          <span className="np-field__label">计划标题</span>
          <input className="np-field__input" autoFocus
            placeholder="例：3 个月减 10 斤 / 读完《思考快与慢》"
            value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleSubmit(); }} />
        </label>

        <div className="np-row">
          <label className="np-field np-field--half">
            <span className="np-field__label">开始</span>
            <input className="np-field__input" type="date"
              value={start} onChange={e => setStart(e.target.value)} />
          </label>
          <label className="np-field np-field--half">
            <span className="np-field__label">结束</span>
            <input className="np-field__input" type="date"
              value={end} onChange={e => setEnd(e.target.value)} />
          </label>
        </div>

        <div className="np-modes">
          <label className={`np-mode ${mode === "ai" ? "is-active" : ""}`}>
            <input type="radio" name="np-mode" value="ai"
              checked={mode === "ai"} onChange={() => setMode("ai")} />
            <div>
              <div className="np-mode__title">让 Rich 协助拆解</div>
              <div className="np-mode__sub">推荐 · 进入 HQ 对话，AI 帮你梳理月/周/日任务</div>
            </div>
          </label>
          <label className={`np-mode ${mode === "manual" ? "is-active" : ""}`}>
            <input type="radio" name="np-mode" value="manual"
              checked={mode === "manual"} onChange={() => setMode("manual")} />
            <div>
              <div className="np-mode__title">我自己手动添加</div>
              <div className="np-mode__sub">先建空架子，自己加目标和任务</div>
            </div>
          </label>
        </div>

        <div className="np-foot">
          <button className="np-btn" onClick={onCancel}>取消</button>
          <button className="np-btn is-primary" disabled={!title.trim()} onClick={handleSubmit}>
            {mode === "ai" ? "下一步 →" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2: 写 CSS（沿用 gm- 色 token）**

```css
/* apps/web/src/components/NewPlanModal.css */
.np-back {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.np-modal {
  background: #0a0604;
  border: 1px solid rgba(217,154,62,0.65);
  border-radius: 16px;
  padding: 22px 24px;
  width: 460px; max-width: 90vw;
  box-shadow: 0 0 0 1px rgba(217,154,62,0.4), 0 0 40px rgba(217,154,62,0.18);
  color: #e6b25a;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}
.np-modal__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.np-modal__title { font-size: 16px; font-weight: 700; color: #e6b25a; }
.np-modal__close {
  width: 26px; height: 26px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.08); color: #a87526; cursor: pointer; font-size: 16px;
}
.np-modal__close:hover { background: rgba(255,255,255,0.16); color: #e6b25a; }

.np-field { display: block; margin-bottom: 12px; }
.np-field--half { flex: 1; margin-bottom: 0; }
.np-field__label { display: block; font-size: 11px; color: #a87526; margin-bottom: 6px; }
.np-field__input {
  width: 100%; padding: 10px 12px; border-radius: 8px;
  background: rgba(0,0,0,0.4); border: 1px solid rgba(217,154,62,0.3);
  color: #e6b25a; font-size: 13px; outline: none; font-family: inherit;
}
.np-field__input:focus { border-color: #d99a3e; }

.np-row { display: flex; gap: 10px; margin-bottom: 12px; }

.np-modes { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.np-mode {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid rgba(217,154,62,0.3);
  cursor: pointer; transition: all 0.15s;
}
.np-mode:hover { border-color: rgba(217,154,62,0.65); }
.np-mode.is-active { border-color: #d99a3e; background: rgba(217,154,62,0.06); }
.np-mode input[type=radio] { margin-top: 3px; accent-color: #d99a3e; }
.np-mode__title { font-size: 13px; font-weight: 600; color: #e6b25a; }
.np-mode__sub { font-size: 11px; color: #a87526; margin-top: 2px; }

.np-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
.np-btn {
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
  background: transparent; border: 1px solid rgba(217,154,62,0.3); color: #a87526;
  font-family: inherit;
}
.np-btn:hover { color: #e6b25a; border-color: rgba(217,154,62,0.65); }
.np-btn.is-primary { background: #d99a3e; color: #1a1208; border-color: #d99a3e; font-weight: 600; }
.np-btn.is-primary:hover { background: #e6b25a; }
.np-btn:disabled { opacity: 0.35; cursor: not-allowed; }
```

- [ ] **Step 7.3: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/src/components/NewPlanModal.tsx apps/web/src/components/NewPlanModal.css
git commit -m "feat(web): NewPlanModal component (title + dates + ai/manual choice)"
```

---

## Task 8: PlanDetailView 骨架（hero + 4 tab 切换器）

**Role:** UI Developer

**Files:**
- Create: `apps/web/src/views/PlanDetailView.tsx`
- Create: `apps/web/src/views/PlanDetailView.css`

只搭骨架：hero 显示标题/进度/起止，下方 4 个 tab chip，body 暂时显示 placeholder。具体内容下个 task 填。

- [ ] **Step 8.1: 写骨架**

```tsx
// apps/web/src/views/PlanDetailView.tsx
import { useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { computePlanProgress } from "@ke/domain";
import type { Plan } from "@ke/domain";
import "./PlanDetailView.css";

interface Goal { id: string; scope: "year"|"month"|"week"; title: string; progress: number; planId?: string; createdAt: number; detail: string; phase: string; due: string }
interface Task { id: string; title: string; done: boolean; date: string; goalId: string; badge: string; note: string }
interface PartialState { plans: Plan[]; goals: Goal[]; tasks: Task[] }

type TabId = "overview" | "month" | "week" | "today";

interface Props<S extends PartialState> {
  plan: Plan;
  state: S;
  setState: Dispatch<SetStateAction<S>>;
  onBack: () => void;
}

export function PlanDetailView<S extends PartialState>({ plan, state, onBack }: Props<S>): ReactNode {
  const [tab, setTab] = useState<TabId>("today");
  const progress = useMemo(() => computePlanProgress(plan.id, state.goals as Parameters<typeof computePlanProgress>[1]), [plan.id, state.goals]);

  const planGoals = state.goals.filter(g => g.planId === plan.id);
  const planTasks = state.tasks.filter(t => planGoals.some(g => g.id === t.goalId));
  const todayTasks = planTasks.filter(t => t.date === new Date().toISOString().slice(0, 10));

  return (
    <div className="pd">
      <div className="pd__top">
        <button className="pd__back" onClick={onBack}>← 全部计划</button>
        <div className="pd__title">{plan.title}</div>
        <span className="pd__status">{plan.status === "active" ? "进行中" : plan.status === "completed" ? "已完成" : "已归档"}</span>
      </div>

      <div className="pd-hero">
        <div className="pd-hero__bar">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="pd-hero__meta">
          <span>{plan.start || "未设起"}</span>
          <span className="pd-hero__pct">{progress}%</span>
          <span>{plan.end || "未设止"}</span>
        </div>
      </div>

      <div className="pd-tabs">
        {(["overview","month","week","today"] as TabId[]).map(t => (
          <button key={t} className={`pd-tab ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" ? "总览" : t === "month" ? "月度" : t === "week" ? "周度" : "今日"}
          </button>
        ))}
      </div>

      <div className="pd-body">
        {tab === "overview" && (
          <div className="pd-empty">
            <div className="pd-empty__title">总览（待开发）</div>
            <div className="pd-empty__sub">这里以后会显示里程碑节点、跨月趋势、关联事件。</div>
            <div className="pd-empty__stats">月目标 {planGoals.filter(g => g.scope === "month").length} · 周目标 {planGoals.filter(g => g.scope === "week").length} · 今日任务 {todayTasks.length}</div>
          </div>
        )}
        {tab === "month" && (
          <div className="pd-empty">
            <div className="pd-empty__title">月度目标</div>
            <div className="pd-empty__sub">{planGoals.filter(g => g.scope === "month").length} 个月目标。Kanban 视图待接入。</div>
          </div>
        )}
        {tab === "week" && (
          <div className="pd-empty">
            <div className="pd-empty__title">周度目标</div>
            <div className="pd-empty__sub">{planGoals.filter(g => g.scope === "week").length} 个周目标。Kanban 视图待接入。</div>
          </div>
        )}
        {tab === "today" && (
          <div className="pd-empty">
            <div className="pd-empty__title">今日任务</div>
            <div className="pd-empty__sub">{todayTasks.length} 条。任务列表待接入。</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8.2: 写 CSS**

```css
/* apps/web/src/views/PlanDetailView.css */
.pd {
  display: flex; flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: #e6b25a;
}
.pd__top {
  display: flex; align-items: center; gap: 14px;
  padding: 4px 0 12px;
  border-bottom: 1px solid rgba(217,154,62,0.3);
  margin-bottom: 14px;
}
.pd__back {
  background: transparent; border: 1px solid rgba(217,154,62,0.3);
  color: #a87526; padding: 6px 12px; border-radius: 8px; cursor: pointer;
  font-size: 12px;
}
.pd__back:hover { color: #e6b25a; border-color: rgba(217,154,62,0.65); }
.pd__title { flex: 1; font-size: 18px; font-weight: 700; color: #e6b25a; }
.pd__status {
  padding: 4px 10px; border-radius: 4px; font-size: 11px;
  background: rgba(217,154,62,0.12); color: #e6b25a;
  border: 1px solid rgba(217,154,62,0.35);
}

.pd-hero {
  padding: 14px 18px;
  border-radius: 12px;
  background: #050302;
  border: 1px solid rgba(217,154,62,0.3);
  margin-bottom: 14px;
}
.pd-hero__bar {
  height: 8px; border-radius: 4px;
  background: rgba(255,255,255,0.06); overflow: hidden;
}
.pd-hero__bar > span {
  display: block; height: 100%;
  background: linear-gradient(90deg, #d99a3e, #e6b25a);
}
.pd-hero__meta {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 8px; font-size: 11px; color: #a87526;
}
.pd-hero__pct { font-size: 16px; font-weight: 700; color: #e6b25a; }

.pd-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
.pd-tab {
  padding: 6px 16px; border-radius: 999px; cursor: pointer;
  background: transparent; border: 1px solid rgba(217,154,62,0.3);
  color: #a87526; font-size: 12px; font-family: inherit;
}
.pd-tab:hover { color: #e6b25a; border-color: rgba(217,154,62,0.65); }
.pd-tab.is-active { background: #3a2408; color: #e6b25a; border-color: rgba(217,154,62,0.65); }

.pd-body {
  flex: 1 1 0; min-height: 0; overflow-y: auto;
  border-radius: 12px;
  background: #050302;
  border: 1px solid rgba(217,154,62,0.3);
  padding: 22px;
}
.pd-empty { text-align: center; padding: 60px 20px; }
.pd-empty__title { font-size: 14px; color: #e6b25a; font-weight: 600; }
.pd-empty__sub { font-size: 12px; color: #6e4c1a; margin-top: 8px; }
.pd-empty__stats { font-size: 11px; color: #a87526; margin-top: 18px; }
```

- [ ] **Step 8.3: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误

- [ ] **Step 8.4: Commit**

```bash
git add apps/web/src/views/PlanDetailView.tsx apps/web/src/views/PlanDetailView.css
git commit -m "feat(web): PlanDetailView skeleton with hero + 4-tab navigation"
```

---

## Task 9: GreatMeView 集成 — selectedPlanId 路由 + 计划卡片列表

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/views/GreatMeView.tsx`

加 `selectedPlanId` 状态：null = 现有 GreatMe（首页/目标管理/...），非空 = 渲染 PlanDetailView。HomeSection 的左列**额外**显示一个"我的计划"卡，列出 plans + 「+ 新建计划」按钮。

- [ ] **Step 9.1: 加 selectedPlanId 状态 + 模态状态**

在 `GreatMeView` 主组件里，已有 `const [state, setState] = useState<GreatMeState>(...)` 附近，追加：

```ts
const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
const [newPlanOpen, setNewPlanOpen] = useState(false);
```

- [ ] **Step 9.2: 引入 NewPlanModal + PlanDetailView**

在 `GreatMeView.tsx` 顶部加：

```ts
import { NewPlanModal } from "../components/NewPlanModal.js";
import { PlanDetailView } from "./PlanDetailView.js";
```

- [ ] **Step 9.3: 把 selectedPlan 路由插到 main 渲染分支**

在 `GreatMeView` 返回的 JSX 里，找到 `<div className="gm-app">` 块。在 `<aside className="gm-side">` 之后，原本是 `<div className="gm-main">`。在 main 内部最顶层判断 selectedPlanId：

把现有的 `<div className="gm-main">` 块替换为：

```tsx
<div className="gm-main">
  <div className="gm-section">
    {selectedPlanId ? (() => {
      const plan = state.plans.find(p => p.id === selectedPlanId);
      if (!plan) { setSelectedPlanId(null); return null; }
      return (
        <PlanDetailView
          plan={plan}
          state={state}
          setState={setState}
          onBack={() => setSelectedPlanId(null)} />
      );
    })() : (
      <>
        {state.activeSection === "home" && <HomeSection state={state} setState={setState} onPickPlan={setSelectedPlanId} onNewPlan={() => setNewPlanOpen(true)} />}
        {state.activeSection === "goals" && <GoalsSection state={state} setState={setState} />}
        {state.activeSection === "events" && <EventsSection state={state} setState={setState} />}
        {state.activeSection === "analytics" && <AnalyticsSection state={state} />}
        {state.activeSection === "weekly_review" && <WeeklyReviewSection state={state} setState={setState} />}
        {state.activeSection === "mission_control" && <MissionControlSection state={state} setState={setState} />}
        {state.activeSection === "settings" && <SettingsSection state={state} setState={setState} />}
      </>
    )}
  </div>
</div>

{newPlanOpen && (
  <NewPlanModal
    onCreate={p => {
      const newId = `plan-${Date.now().toString(36)}`;
      setState(prev => ({ ...prev, plans: [...prev.plans, { ...p, id: newId, createdAt: Date.now() }] }));
      setNewPlanOpen(false);
      setSelectedPlanId(newId);
    }}
    onCancel={() => setNewPlanOpen(false)} />
)}
```

注意：原 GreatMeView 渲染 7 个 section 的代码块要照搬进 else 分支，不要丢任何 section。

- [ ] **Step 9.4: 扩展 HomeSection props**

把 `interface SectionProps` 旁边或上方，加 HomeSection 专属 props：

找到 `function HomeSection({ state, setState }: SectionProps): ReactNode {` 这一行，把签名替换为：

```tsx
function HomeSection({ state, setState, onPickPlan, onNewPlan }: SectionProps & { onPickPlan: (id: string) => void; onNewPlan: () => void }): ReactNode {
```

- [ ] **Step 9.5: 在 HomeSection 左列加"我的计划"卡**

在 HomeSection 返回的 JSX 里，找到左列的开始位置（注释 `{/* === 左列：根据 scope 切换 ... === */}` 附近）。

在那一段最前面、`{scope === "month" ? ...` 这个三元的**外面、之前**加一段：

```tsx
{/* 我的计划卡 — 跨 scope 都显示 */}
<div className="gm-card gm-plans-card">
  <div className="gm-card__head">
    <div className="gm-card__title">我的计划</div>
    <button className="gm-chip" onClick={onNewPlan} title="新建计划">+ 新建</button>
  </div>
  {state.plans.filter(p => p.status === "active").length === 0 ? (
    <div className="gm-empty" style={{ padding: 12, fontSize: 12 }}>还没有计划。点上方 + 新建 来开始。</div>
  ) : (
    <div className="gm-plans-list">
      {state.plans.filter(p => p.status === "active").map(p => (
        <button key={p.id} className="gm-plans-item" onClick={() => onPickPlan(p.id)}>
          <span className="gm-plans-item__title">{p.title}</span>
          <span className="gm-plans-item__arrow">→</span>
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 9.6: 加配套 CSS**

把这段追加到 `apps/web/src/views/GreatMeView.css` 末尾：

```css
/* 我的计划卡 — 首页左列上半 */
.gm-plans-card { padding: 12px 14px; margin-bottom: 12px; }
.gm-plans-list { display: flex; flex-direction: column; gap: 6px; }
.gm-plans-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(217,154,62,0.06);
  border: 1px solid rgba(217,154,62,0.25);
  color: #e6b25a; cursor: pointer; font-family: inherit; font-size: 12px;
  transition: all 0.15s;
}
.gm-plans-item:hover { border-color: #d99a3e; background: rgba(217,154,62,0.12); }
.gm-plans-item__title { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gm-plans-item__arrow { color: #a87526; font-size: 12px; }
```

- [ ] **Step 9.7: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误（如果有，多半是 SectionProps 类型对其他 section 也强制要求了新 props——把 onPickPlan/onNewPlan 限定在 HomeSection 签名里，不要写进 SectionProps）

- [ ] **Step 9.8: 手动验证**

```bash
pnpm --filter @ke/web build && \
  pkill -f "Rich.app/Contents/MacOS/Rich"; sleep 1; \
  open "$(pwd)/apps/desktop/release/mac-arm64/Rich.app"
```

打开 Rich → 计划管理 → 首页 → 左列上方应出现「我的计划」卡，列出 1 个「未分组」+ N 个手动创建的计划。点任一计划进入详情页骨架。

- [ ] **Step 9.9: Commit**

```bash
git add apps/web/src/views/GreatMeView.tsx apps/web/src/views/GreatMeView.css
git commit -m "feat(web): wire NewPlanModal + PlanDetailView into GreatMeView with selectedPlanId routing"
```

---

## Task 10: PlanDetailView 「今日」tab 接入真实任务列表

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/views/PlanDetailView.tsx`
- Modify: `apps/web/src/views/PlanDetailView.css`

把今日 tab 从 placeholder 改成真任务列表（勾选、删除、显示挂的目标）。

- [ ] **Step 10.1: 在 PlanDetailView 增加 toggle / delete 回调**

在 PlanDetailView `Props` 接口里把 setState 用上，添加 helpers：

修改 `PlanDetailView.tsx` 主组件函数体，在 useState/useMemo 之后插入：

```ts
const toggleTask = (id: string): void => setState(prev => ({
  ...prev,
  tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t),
} as S));
const delTask = (id: string): void => setState(prev => ({
  ...prev,
  tasks: prev.tasks.filter(t => t.id !== id),
} as S));
```

注意：因 PartialState 是 generic，`as S` 是必要的类型强转。

- [ ] **Step 10.2: 替换今日 tab 的内容**

把原来的 `{tab === "today" && (<div className="pd-empty">...</div>)}` 整段替换为：

```tsx
{tab === "today" && (
  todayTasks.length === 0 ? (
    <div className="pd-empty">
      <div className="pd-empty__title">今日任务</div>
      <div className="pd-empty__sub">该计划下今天还没有具体任务。</div>
    </div>
  ) : (
    <div className="pd-today">
      {todayTasks.map(t => {
        const goal = planGoals.find(g => g.id === t.goalId);
        return (
          <div key={t.id} className={`pd-today-item ${t.done ? "is-done" : ""}`}>
            <button className={`pd-today-item__check ${t.done ? "is-done" : ""}`}
              onClick={() => toggleTask(t.id)}
              title={t.done ? "标记未完成" : "标记完成"}>
              {t.done ? "✓" : ""}
            </button>
            <span className="pd-today-item__title">{t.title}</span>
            {goal && (
              <span className="pd-today-item__goal">
                {goal.scope === "year" ? "年" : goal.scope === "month" ? "月" : "周"}·{goal.title.length > 10 ? goal.title.slice(0, 10) + "…" : goal.title}
              </span>
            )}
            <button className="pd-today-item__del" onClick={() => delTask(t.id)} title="删除">×</button>
          </div>
        );
      })}
    </div>
  )
)}
```

- [ ] **Step 10.3: 加配套 CSS**

把这段追加到 `apps/web/src/views/PlanDetailView.css` 末尾：

```css
.pd-today { display: flex; flex-direction: column; gap: 6px; }
.pd-today-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(217,154,62,0.18);
}
.pd-today-item.is-done .pd-today-item__title { opacity: 0.5; text-decoration: line-through; }
.pd-today-item__check {
  width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid #d99a3e; background: transparent;
  color: #1a1208; font-size: 11px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0; padding: 0;
}
.pd-today-item__check.is-done { background: #d99a3e; }
.pd-today-item__title { flex: 1; font-size: 13px; color: #e6b25a; }
.pd-today-item__goal {
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
  background: rgba(217,154,62,0.1);
  border: 1px solid rgba(217,154,62,0.3);
  color: #e6b25a; flex-shrink: 0;
}
.pd-today-item__del {
  background: transparent; border: none; color: #6e4c1a;
  cursor: pointer; font-size: 14px; padding: 0 4px;
}
.pd-today-item__del:hover { color: #d96a5b; }
```

- [ ] **Step 10.4: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误

- [ ] **Step 10.5: 手动验证**

```bash
pnpm --filter @ke/web build && \
  pkill -f "Rich.app/Contents/MacOS/Rich"; sleep 1; \
  open "$(pwd)/apps/desktop/release/mac-arm64/Rich.app"
```

Rich → 计划管理 → 首页 → 我的计划 → 点「未分组」→ 切到「今日」tab → 应显示 14 条今日任务（基于现有 seed 数据），勾选 / 删除应实时响应。

- [ ] **Step 10.6: Commit**

```bash
git add apps/web/src/views/PlanDetailView.tsx apps/web/src/views/PlanDetailView.css
git commit -m "feat(web): PlanDetailView today tab — real task list with toggle/delete"
```

---

## Task 11: 月度 / 周度 tab 接入 kanban 视图

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/views/PlanDetailView.tsx`
- Modify: `apps/web/src/views/PlanDetailView.css`

把月度 / 周度 tab 从 placeholder 改成 3 列 kanban（计划中 / 正在进行 / 已完成），筛 plan 下对应 scope 的 goal。

- [ ] **Step 11.1: 写 kanban 渲染**

在 PlanDetailView 组件里增加一个内部 helper（return JSX 之前）：

```ts
const renderKanban = (scope: "month"|"week"): ReactNode => {
  const scoped = planGoals.filter(g => g.scope === scope);
  const planned = scoped.filter(g => g.progress === 0);
  const active  = scoped.filter(g => g.progress > 0 && g.progress < 100);
  const done    = scoped.filter(g => g.progress >= 100);
  const col = (title: string, list: Goal[]) => (
    <div className="pd-kanban-col">
      <div className="pd-kanban-col__head">
        <span className="pd-kanban-col__title">{title}</span>
        <span className="pd-kanban-col__count">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div className="pd-empty" style={{ padding: 24, fontSize: 12 }}>暂无</div>
      ) : list.map(g => (
        <div key={g.id} className="pd-kanban-card">
          <div className="pd-kanban-card__title">{g.title}</div>
          <div className="pd-kanban-card__bar"><span style={{ width: `${g.progress}%` }} /></div>
          <div className="pd-kanban-card__pct">{g.progress}%</div>
        </div>
      ))}
    </div>
  );
  return (
    <div className="pd-kanban">
      {col("计划中", planned)}
      {col("正在进行", active)}
      {col("已完成", done)}
    </div>
  );
};
```

- [ ] **Step 11.2: 把 月度 / 周度 tab 替换为 kanban**

替换原来的 `{tab === "month" && ...}` 和 `{tab === "week" && ...}` 两段：

```tsx
{tab === "month" && renderKanban("month")}
{tab === "week"  && renderKanban("week")}
```

- [ ] **Step 11.3: 加 kanban CSS**

追加到 `apps/web/src/views/PlanDetailView.css` 末尾：

```css
.pd-kanban {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  height: 100%;
}
.pd-kanban-col {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(217,154,62,0.18);
  border-radius: 10px;
  padding: 10px;
  display: flex; flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
}
.pd-kanban-col__head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 4px;
}
.pd-kanban-col__title { font-size: 12px; font-weight: 600; color: #e6b25a; }
.pd-kanban-col__count {
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
  background: rgba(217,154,62,0.15); color: #e6b25a;
}
.pd-kanban-card {
  background: rgba(217,154,62,0.04);
  border: 1px solid rgba(217,154,62,0.25);
  border-radius: 8px;
  padding: 8px 10px;
}
.pd-kanban-card__title { font-size: 12px; color: #e6b25a; margin-bottom: 6px; }
.pd-kanban-card__bar {
  height: 4px; border-radius: 2px;
  background: rgba(255,255,255,0.08); overflow: hidden;
}
.pd-kanban-card__bar > span {
  display: block; height: 100%;
  background: linear-gradient(90deg, #d99a3e, #e6b25a);
}
.pd-kanban-card__pct { font-size: 10px; color: #a87526; margin-top: 4px; text-align: right; }
```

- [ ] **Step 11.4: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误

- [ ] **Step 11.5: 手动验证**

build + restart 同 Task 10。在 PlanDetailView 切「月度」/「周度」tab — 应看到 3 列 kanban，「未分组」计划下应有 3 个月度 goal + 4 个周度 goal（基于现有 seed）。

- [ ] **Step 11.6: Commit**

```bash
git add apps/web/src/views/PlanDetailView.tsx apps/web/src/views/PlanDetailView.css
git commit -m "feat(web): PlanDetailView month/week tabs as 3-col kanban"
```

---

## Task 12: 总览 tab 简版统计

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/views/PlanDetailView.tsx`

把总览 tab 从 placeholder 改成几个简单 KPI 块（目标数 / 任务完成率 / 距离截止）。深度可视化（里程碑节点、趋势）留到 Stage 3+ 再做。

- [ ] **Step 12.1: 替换总览 tab**

替换原来 `{tab === "overview" && (<div className="pd-empty">...</div>)}` 段为：

```tsx
{tab === "overview" && (
  <div className="pd-overview">
    <div className="pd-kpi">
      <div className="pd-kpi__num">{planGoals.length}</div>
      <div className="pd-kpi__label">计划下目标数</div>
    </div>
    <div className="pd-kpi">
      <div className="pd-kpi__num">{planTasks.filter(t => t.done).length} / {planTasks.length}</div>
      <div className="pd-kpi__label">任务完成数</div>
    </div>
    <div className="pd-kpi">
      <div className="pd-kpi__num">
        {(() => {
          if (!plan.end) return "—";
          const d = (Date.parse(plan.end) - Date.now()) / 86400000;
          if (d < 0) return "已过期";
          return `${Math.ceil(d)} 天`;
        })()}
      </div>
      <div className="pd-kpi__label">距离截止</div>
    </div>
    <div className="pd-kpi">
      <div className="pd-kpi__num">{progress}%</div>
      <div className="pd-kpi__label">整体进度</div>
    </div>
  </div>
)}
```

- [ ] **Step 12.2: 加 KPI CSS**

追加到 `apps/web/src/views/PlanDetailView.css` 末尾：

```css
.pd-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.pd-kpi {
  padding: 22px 14px; border-radius: 10px;
  background: rgba(217,154,62,0.04);
  border: 1px solid rgba(217,154,62,0.25);
  text-align: center;
}
.pd-kpi__num { font-size: 24px; font-weight: 700; color: #e6b25a; }
.pd-kpi__label { font-size: 11px; color: #a87526; margin-top: 4px; }
```

- [ ] **Step 12.3: typecheck**

```bash
pnpm --filter @ke/web typecheck
```

Expected: 无错误

- [ ] **Step 12.4: Commit**

```bash
git add apps/web/src/views/PlanDetailView.tsx apps/web/src/views/PlanDetailView.css
git commit -m "feat(web): PlanDetailView overview tab with 4 KPI tiles"
```

---

## Task 13: 端到端冒烟 + 同步到 Rich.app

**Role:** Senior Software Engineer

**Files:** 无

完整跑一遍 user flow，确保 Stage 2 兑现了 spec 的 S2/S4 故事。

- [ ] **Step 13.1: 构建 + 重启 Rich.app**

```bash
pnpm --filter @ke/web build && \
  pkill -f "Rich.app/Contents/MacOS/Rich"; sleep 1; \
  open "$(pwd)/apps/desktop/release/mac-arm64/Rich.app" && sleep 3 && \
  curl -s -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:31515/api/health
```

Expected: `health=200`

- [ ] **Step 13.2: 用户故事 S2（手动建计划）冒烟**

在 Rich 里：
1. 顶部菜单 → 计划管理
2. 侧栏 → 首页
3. 左列上方「我的计划」卡 → + 新建
4. 弹窗：填 "测试计划 A" / 起 2026-05-23 / 止 2026-08-23 / 我自己手动
5. 点"创建"
6. 应自动跳进新计划的详情页（hero 显示 "测试计划 A" + 0% + 起止日期）
7. 切今日 / 月度 / 周度 / 总览 tab — 都应渲染（空态或空 kanban）
8. 点"← 全部计划" — 回首页

Verify all 6 expected behaviors checked manually.

- [ ] **Step 13.3: 用户故事 S4（深钻"未分组"plan）冒烟**

1. 我的计划 → 点「未分组」
2. 今日 tab 应显示 14 条任务（含勾选 / 删除）
3. 月度 tab 应显示 3 个 month goal 在三栏分布
4. 周度 tab 应显示 4 个 week goal 分布
5. 总览 tab 应显示 4 个 KPI（目标数 9 / 任务完成 ≥2 / 距离截止"—" / 整体 ≈80%）

Verify all 5 checks.

- [ ] **Step 13.4: 数据回归验证**

确认旧 daily / events / 4 槽日记没动：
- 切回首页（点"← 全部计划"如还在详情页）
- 周度 tab 下的 4 个日记栏目应能点开弹窗
- 历史 daily 数据应存在（victoryBlocker 等）

- [ ] **Step 13.5: 跑一遍全部 test**

```bash
pnpm --filter @ke/domain test && pnpm --filter @ke/server test
```

Expected: 全部绿

- [ ] **Step 13.6: 写收尾 commit + 更新 spec 文档**

打开 [docs/superpowers/specs/2026-05-23-plan-management-design.md](../specs/2026-05-23-plan-management-design.md) 的 "7. 实施分阶段" 一节，把 Stage 2 的 4 个 checkbox 全部勾上 `- [x]`。

```bash
git add docs/superpowers/specs/2026-05-23-plan-management-design.md
git commit -m "docs: mark Stage 2 tasks as completed in design spec"
```

---

## 完成判定

Stage 2 视为完成时：

- ✅ 旧数据库的 9 个 goal 自动归到「未分组」plan，零丢失
- ✅ 用户可以手动新建多个计划
- ✅ 点任一计划可深钻进 PlanDetailView，4 个 tab 都能切
- ✅ 今日 tab 能勾选 / 删除任务
- ✅ 月度 / 周度 tab 能看到该 plan 下的 goal kanban
- ✅ 总览 tab 显示 4 个核心 KPI
- ✅ 所有 domain test 与 server test 通过

## 后续（不在 Stage 2 范围）

- Stage 3：AI 拆解（decompose mode、预览面板）
- Stage 4：跨计划仪表盘首页（多卡 + 跨计划今日合并）
- Stage 5：报告 / 复盘 mode
- 锦上添花：goals 上挂目标的 UI（让用户能把 goal 从「未分组」搬到具体计划）、kanban 卡片的 hover edit、Metric 量化字段录入

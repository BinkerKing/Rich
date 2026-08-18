# 健康顾问 · 重设计 spec

> 替代「健康档案」V0.1。数据录入全靠 Rich（对话），UI 不再放手动表单。
> 2026-05-25

## 一、Why

- V0.1 把视图当输入框：5 个 quick-log 表单 + 流水列表。这是「数据库录入界面」，不是「顾问」。
- 用户实际操作链是：跟 Rich 聊 → Rich 写入数据 → 用户看视图 = 想看 **当下身体状态 + 顾问意见 + 走势 + 今日该做什么**。
- 数据越积越多时，流水账没用。需要按主题、按层级、按时间窗口聚合。

## 二、新视图骨架（单 Dashboard tab + ⚙ 设置 tab）

```
🎯 当前目标 banner      ← 1 行，进度条
💡 Rich 今日建议        ← 1 段话 + 几个 action chip
📊 KPI 4 卡              ← 体重 / 卡路里 / 训练 / 睡眠
📋 今日计划              ← 训练 + 饮食 双栏（带勾选）
📈 本周走势 sparkline    ← 4 项各一条
📅 本月走势              ← 大图（V0.2 留位）
▼ 最近更新（折叠）       ← Rich 录的流水，默认收
```

设置 tab 内容：静态档案表单 / 苹果接入说明 / 周计划编辑器（保留原 PlanTab）。

## 三、数据契约

新增 3 个 state key（沿用 `state` 表，单 JSON blob，无新表）：

| key                              | 内容                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| `health.current_goal`            | `{ kind, target, startedAt, dueAt, motivation }`              |
| `health.today_plan.YYYY-MM-DD`   | `{ date, workout:[…], meals:[…], hydrationMl, sleepTarget }` |
| `health.coach_note.YYYY-MM-DD`   | `{ date, note, actions:[{label, kind}] }`                     |

GET / PUT 三套 REST：`/api/health/goal`、`/api/health/today-plan?date=…`、`/api/health/coach-note?date=…`

V0.1 不强制 Rich 调用；先让前端 UI 跑起来，AI 写入是下一批。

## 四、文件改动清单

**前端**
- `apps/web/src/lib/appCatalog.ts` — 「健康档案」→「健康顾问」，desc 改
- `apps/web/src/views/HealthView.tsx` —
  - 重命名 header 文案
  - `Tab` 类型从 5 个改为 2 个：`"dashboard" | "settings"`
  - 默认 tab = `dashboard`
  - `LogsTab` 删除（5 个 quick log 不再出现在主视图）
  - 新建 `DashboardTab`，分 6 个子组件：`GoalBanner` / `CoachNote` / `KPIRow` / `TodayPlan` / `WeekSparklines` / `RecentEntriesFolded`
  - 新建 `SettingsTab`，包 ProfileTab + AppleHealthTab + 原 PlanTab（周计划编辑）
- `apps/web/src/api/healthClient.ts` — 加 `getGoal/setGoal/getTodayPlan/setTodayPlan/getCoachNote/setCoachNote`
- `apps/web/src/views/HealthView.css` — 加 dashboard 网格布局 + sparkline 样式

**后端**
- `apps/server/src/routes/health.ts` — 加 6 个 endpoint
- `apps/server/src/repos/HealthRepo.ts` — 加 6 个方法
- `apps/server/src/repos/PostgresHealthRepo.ts` — 实现，存 `state` 表

**类型**
- `packages/domain/src/types/health.ts` — `HealthGoal` / `TodayPlan` / `CoachNote`

## 五、非目标 / 留给后续

- AI 自动生成今日计划（V0.2）
- Rich 通过对话写入 today_plan / coach_note 的链路（V0.2）
- 月度走势真正的图表（V0.1 留占位，先放 sparkline）
- 拆分到独立组件文件 / 大重构（V0.1 在同一个 HealthView.tsx 里加新函数即可）

## 六、风险

- 用户当前没有 goal/today_plan 数据 → 三个区块要有「未设置」空态 + CTA「跟 Rich 聊聊定一个」
- 删 LogsTab 后，dev 调试无法手动写体重/睡眠 → 留 `?devlogs=1` query 把旧表单挂出来，方便短期排查

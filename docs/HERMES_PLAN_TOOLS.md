# Hermes 控制计划管理 — MCP 工具完整索引

Rich 的 MCP 服务在 `http://127.0.0.1:31515/mcp` 暴露 17 个跟"计划管理"
相关的工具，让 Hermes（或任何 MCP 客户端：Claude Desktop、Codex、Cursor）
直接驱动 大斌哥 的 plan / goal / task 数据流。

Hermes 已经在 `~/.hermes/config.yaml` 配置好 `mcp_servers.rich`，每次会话
自动 list_tools；所以这些工具开箱即用，无需额外配置。

---

## 数据模型（30 秒认知）

```
Plan (计划)
  └── Goal (目标, scope = year | month | week, 可层级嵌套)
        └── Task (任务, 必有 date, 可选挂 goalId)
```

- 一个 plan 拆成多层 goals（年→月→周），最末层 goal 下挂多个 day-task
- `progress` 是**实时算出来**的：task 完成度 → 周目标 → 月目标 → 年目标 → plan
- `task.goalId` 为空 = "孤儿任务"，不计入任何 plan 进度

---

## 工具索引

### 🔍 读取 (5)

| 工具 | 用途 | 何时调用 |
|---|---|---|
| **plan_list** | 列出所有计划 + health + 本周完成度 | 对话开始时；用户问"我有哪些计划在跑" |
| **plan_get** | 单个计划的完整树（plan + 所有 goals + 所有 tasks） | 要深入分析某个计划前 |
| **goal_list** | 列出 goals，支持 planId/scope/parentId 过滤 | 找特定层级的目标 |
| **task_list** | 列出 tasks，支持 date/planId/goalId/done 过滤 | "今天有什么"、"哪些逾期"、"X 目标下的任务" |
| **analytics_summary** | 一次性拿到 KPIs + 4 类卡点（逾期、长期未推进、空目标、孤儿任务） | 用户问"我整体情况怎样" |

### ✏️ 写入 (10)

| 工具 | 用途 | 何时调用 |
|---|---|---|
| **plan_create** | 建空计划（不含 goals/tasks） | 用户说"建个新计划叫 X"，但不想 AI 拆解 |
| **plan_update** | 改 plan title/dates/status | 用户说"把 X 计划改名" / "归档掉 Y" |
| **plan_delete** | 删除计划 + 级联删 goals + tasks | 用户**明确**说"删除这个计划"（破坏性） |
| **goal_create** | 新建目标，可挂 planId/parentId | 用户说"在 X 计划下加个周目标" |
| **goal_update** | 改 goal title/due/parent/progress | 用户说"把第 3 周目标推到下周" |
| **goal_delete** | 删除目标 + 级联删子目标 + 子任务 | 极少用，破坏性 |
| **task_create** | 新建任务，建议挂 goalId | "帮我加个今天的任务 X"；不挂目标也行 |
| **task_update** | 改 task title/date/goalId/note | "把 X 任务推到明天" |
| **task_complete** | ✅ 标记 done / undone | **最常用**：用户说"我做完了 X" 时立刻调 |
| **task_delete** | 永久删任务 | 极少用；优先 update 改日期 |

### 🪄 AI 助力 (2)

| 工具 | 用途 | 耗时 |
|---|---|---|
| **plan_decompose** | 接受意图（"我想 3 个月减 10 斤"）→ Hermes 自己拆 → 写入完整 plan 树 | 30-90s |
| **analyze_progress** | 拉数据 + 让 Hermes 给可执行的推进策略（核心判断/卡点/推进办法/优先任务） | 15-30s |

---

## 常见对话场景 → 工具组合

### 场景 1：用户问"我今天做啥？"
```
1. task_list({ date: "today" })
   → 看到今天的任务列表，每条带 planTitle/goalTitle
2. 若空：task_list({ date: "overdue" }) 看看有没有逾期可以补做的
3. 用自然语言回答，列出 3-5 条最重要的
```

### 场景 2：用户说"我做完了 X"
```
1. task_list({ date: "today" }) 拿到 task id（按 title 模糊匹配）
2. task_complete({ id, done: true })
3. 回复"标记完成 ✓，本周还剩 N 条"
4. 可选：task_list({ planId, done: false }) 看同计划还剩什么
```

### 场景 3：用户说"帮我做个 X 的计划"
```
1. plan_decompose({ intent: "X" })  # AI 自动拆树
2. 回复"已建好，里面 N 个目标 M 个任务，理由是 ..."
3. 用户审阅后可以让你 plan_update / goal_update / task_update 调整
```

### 场景 4：用户说"我感觉很卡，帮我看看"
```
1. analytics_summary({})  # 拿到 KPIs + blockers
2. 如果数据丰富：analyze_progress({})  # AI 给策略
3. 把 keyInsight 用自然语言转述，列出 priorityTasks
4. 如果用户同意：依次 task_create / task_update 把建议落地
```

### 场景 5：用户说"昨天的没做完"
```
1. task_list({ date: "overdue" })
2. 跟用户确认哪些要推到今天 / 哪些已经过时不需要做
3. 对要继续的：task_update({ id, date: <today> })
4. 对不需要的：task_delete or task_update({ done: true }) 看用户意图
```

### 场景 6：用户说"X 计划进展怎么样"
```
1. plan_get({ id: <X> })  # 拿到完整树 + health
2. 用 health.status 描述（healthy / behind / critical）+ progress vs timeProgress 解释为什么
3. 列出 stuck goals / overdue tasks 如果有
4. 给 1-2 条具体推进建议
```

---

## 重要规则

1. **改动之前先列表**。要改某个 task，先 task_list 拿到 id；要改 goal，先 goal_list。
   工具不接受 "title" 当 id，必须用真实 id。
2. **task_complete 是最高频动作**。用户说"做完了" / "完成了" / "OK 了" 都触发它。
3. **plan_decompose 写库是真写**，会出现在 大斌哥 的 UI 里。所以不要为了"看看 AI 怎么拆"就乱调。
4. **删除是破坏性的**。除非用户明确说"删除"，否则用 status='archived' (plan_update) 或者
   只改日期 (task_update) 代替。
5. **agent claim 已经在 improvement 工具上有了**，plan 工具暂时没有 claim 机制 ——
   假设同一时刻只有一个 Hermes 实例在动它（多机用户写入会被 UI 的 version-lock 兜底）。
6. **version 锁不暴露给 MCP**。读 + 写之间如果 UI 改了，你的写覆盖。冲突概率低，
   但要警惕：长链路操作之前最好快速 plan_get 再做改动，确保是最新状态。

---

## 调试 / 测试

直接 curl MCP 端点：

```bash
curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"plan_list","arguments":{}}}'
```

`tools/list` 拿到所有工具的 schema + description：

```bash
curl -s -X POST http://127.0.0.1:31515/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 已验证的端到端流程（2026-05-24）

```
plan_list → analytics_summary → task_list(today) →
plan_create → goal_create → task_create×2 → task_complete →
plan_get (verify progress=50%) → goal_list (dynP=50%) →
plan_delete (cascade -1 goal -2 tasks) →
plan_decompose(intent="...") → 23s → 2 weeks/4 tasks →
analyze_progress → 18s → 3 blockers + 3 actions + 3 priorities

✅ 全部通过
```

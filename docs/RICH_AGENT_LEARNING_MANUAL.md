# Rich Agent 学习手册

这份文档是后台「AI 学习手册」的长文版。给 Hermes、Mac Mini 上的 Agent、Codex 或其他 MCP 客户端使用。

## Agent 工作流

1. 识别用户任务对应的 Rich 页面。
2. 不熟悉模块时先调用 `get_rich_system_manual`，读取页面、场景、手册、CLI/MCP 索引。
3. 读取相关上下文，不猜数据结构。
4. 选择 MCP / API / CLI 执行。
5. 需要输出给用户时，先套 AI 语料模板。
6. 如果用户指出表达或操作方式不对，把经验写回语料模板或系统改造任务。

## 页面与工具

| 页面 | 场景 | 推荐工具 |
| --- | --- | --- |
| 首页 | 自然语言入口、全局任务 | `get_rich_system_manual`, `corpus_list`, `corpus_prompt`, `invoke_toolbox_tool` |
| 知识树 | 知识元 CRUD、关系、路径 | `list_topics`, `get_element`, `get_subtree`, `create_element`, `update_element`, `refine`, `expand`, `extend` |
| AI 早报 | 早报生成、Skill 推荐、信息摘要 | `pnpm corpus prompt information-briefing`, `get_element`, `update_section_blocks` |
| 导图 PPT | 文稿转导图、PPT 展示图 | `/api/mindmaps`, `get_subtree`, `update_element` |
| 计划管理 | 计划、目标、任务、复盘、批量清理 | 优先 MCP：`plan_list`, `plan_get`, `task_list`, `task_complete`, `plan_decompose`, `analyze_progress`；服务离线/批量维护/排障时用 CLI：`pnpm --filter @ke/server run plan -- ...` |
| 项目实战 | 实战项目、PRD、开发任务 | `practice_list`, `practice_get`, `practice_create`, `practice_add_child`, `draft_prd`, `draft_child`, `adjust_child` |
| 工具箱 | 小工具、锁屏、延迟动作 | `list_toolbox_tools`, `invoke_toolbox_tool` |
| 后台 | 监控、语料、学习手册、改造任务 | `get_rich_system_manual`, `pnpm corpus ...`, `corpus_upsert`, `create_improvement` |

## CLI

### 语料模板 CLI

```bash
pnpm corpus list
pnpm corpus get system-status-report
pnpm corpus prompt system-status-report
pnpm corpus patch system-status-report --field mustInclude --value "总体状态、关键指标、异常、风险、下一步动作"
pnpm corpus upsert --file template.json
```

### 计划管理 CLI

计划管理数据存放在 GreatMe state 的 `plans/goals/tasks`，当前运行环境可能是 Postgres，不要默认改本地 SQLite。CLI 会按 `KE_STORAGE` 选择后端：

```bash
# 查询
pnpm --filter @ke/server run plan -- list plans --status all --json
pnpm --filter @ke/server run plan -- list year --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list month --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list week --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list day --date today --json

# 增改
pnpm --filter @ke/server run plan -- create plan --title "我的计划" --start 2026-05-25 --end 2026-08-25
pnpm --filter @ke/server run plan -- create month --plan-id <planId> --title "五月目标" --due 2026-05-31
pnpm --filter @ke/server run plan -- create day --goal-id <goalId> --title "今天行动" --date 2026-05-25
pnpm --filter @ke/server run plan -- update day --id <taskId> --done true

# 删除/清理：破坏性命令必须显式 --yes
pnpm --filter @ke/server run plan -- delete plan --id <planId> --yes
pnpm --filter @ke/server run plan -- clear all --yes --json
```

Agent 清理“计划管理脏数据”时必须先备份完整 GreatMe blob，只清空 `plans/goals/tasks`，保留 `profile/events/daily/reviews/ability/compounding/conversations` 等非计划数据，并在写回后验证三类计数为 0。

## 重要约束

- Rich 的内容块必须使用支持的 `block.style`。不要写 `style=list`。
- 推荐列表优先用 `dot-list` 或 `markdown`。
- 项目实战不是独立数据层，它复用 elements + child relations。
- 计划管理通过 GreatMe state 管理，任务完成必须写回 state；MCP 用 `task_complete`，CLI 用 `update day --done true`。
- 批量维护计划数据时优先用计划管理 CLI，不要手写 SQL 改 `plans/goals/tasks`，除非 CLI 无法覆盖且已先备份。
- 语料模板存在服务端数据层。Postgres 模式下，多台机器共享同一套模板。

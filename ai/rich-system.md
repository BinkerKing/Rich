# Rich Agent 系统手册（MCP 2.0）

这份手册供 Hermes、Codex 和其他 Agent 使用。Rich 是信息与业务规范平台；对话 Agent 负责理解意图，Rich MCP 负责读写、任务账本、验收与经验，外部执行 Agent 负责真正干活。

## 首要决策顺序

1. 目标或对象不确定时，先读：用 `rich_context_search` 或 `rich_context_get_overview`。
2. 用户要一个完整结果时，优先使用一个场景工具，不要拼接多个原子写入。
3. 用户明确指定对象和精确变化时，使用对应资源 `manage` 工具。
4. 写入必须提供唯一 `context.requestId`；试运行用 `options.dryRun=true`；破坏性动作必须明确确认并传 `options.confirmDestructive=true`。
5. 只有范围、产物和验收标准明确，且确实需要外部执行时，才准备执行团队或调用 `rich_work_delegate`。
6. 项目没有可用执行团队时，先规划团队，向用户展示复用和创建项；用户确认后才能应用计划。
7. 委派后用 Rich 任务 ID 跟踪；完成后先验收，再把可复用经验沉淀到 Rich。

完整参数与示例见 `docs/RICH_MCP_V2_CATALOG.md`。

## 六类场景

| 场景 | 用户意图 | 首选工具 |
| --- | --- | --- |
| 查询 | 查资料、找记录、看总体情况 | `rich_context_search`、`rich_context_get_overview` |
| 收集 | 将结论保存成知识；将整段对话整理到项目结构 | `rich_knowledge_capture`、`rich_project_organize_conversation` |
| 管理 | 精确读取或修改已知资源 | `rich_knowledge_manage`、`rich_project_manage`、`rich_dictionary_manage`、`rich_planning_manage`、`rich_practice_manage`、`rich_automation_manage` |
| 规划 | 分析项目方案，或规划可复用的执行团队但不创建外部资源 | `rich_project_analyze_and_plan`、`rich_execution_team_plan` |
| 团队 | 用户确认后创建或调整项目执行团队 | `rich_execution_team_apply` |
| 委派 | 把明确、可执行的工作交给外部 Agent | `rich_work_delegate`、`rich_work_get_status`、`rich_work_list`、`rich_work_cancel` |
| 验收 | 接受/退回 Agent 结果，沉淀经验 | `rich_work_review_result`、`rich_learning_capture` |

## MCP 工作规则

### 先读再写

- 只给关键词或描述时，不要猜 ID；先搜索。
- 更新、删除、取消前先获取目标当前状态。
- 用户说“先分析”“不要执行”时，只能规划，不能委派或写入。

### 写入安全

- 每个真实写调用使用新的稳定 `requestId`；重试同一调用时复用它。
- 同一 `requestId` 不得用于不同输入。
- 不确定写入结果时先 dry-run。
- 删除、取消任务、整体替换计划状态属于破坏性操作，必须获得用户明确授权。
- 成功响应必须检查 `verification.status`；不能只看 `ok`。

### 委派与跟踪

`rich_work_delegate` 把工作交给 Rich 项目已经绑定的默认执行团队。Hermes 不指定具体 Agent；Squad Leader 根据 Issue、成员角色和能力选择实际执行者。返回两个不同标识：Multica Issue ID 用于后端同步；Rich 任务 ID 用于本平台查询、看板、验收和经验关联。

推荐流程：

```text
明确目标与验收标准
  → 检查项目是否已有合适执行团队
  → 没有时 rich_execution_team_plan
  → 向用户展示：复用的 Project/Agent、拟创建的 Leader/Agent/Squad
  → 用户明确确认
  → rich_execution_team_apply（confirmed=true）
  → rich_work_delegate
  → rich_work_get_status / rich_work_list
  → rich_work_review_result
  → rich_learning_capture
```

团队规划默认优先复用已有 Agent。能力缺失时，计划中必须给出新成员的名字、职责、Runtime、模型和指令。专职“Rich 调度员”只负责任务拆解、选人、跟踪和复核，不直接实现任务。同一个 Agent 可以加入多个 Squad，但每个 Squad 的角色可以不同。

Rich 项目按需映射到 Multica Project：只有第一次需要外部执行时才准备资源。`rich_work_delegate` 必须提供 Rich `projectId`、说明、验收标准和能力要求；项目尚未应用团队计划时会返回 `CONFLICT`。Multica CLI 缺失、版本不兼容或环境不可用时返回 `DEPENDENCY_UNAVAILABLE` 或可重试失败，不得绕过它创建一个看似运行中的假任务。

Rich 保存业务目标、验收与总结；Multica 看板保存 Issue、Squad 分派、成员 Run、评论和详细日志。不要把完整 Multica 日志复制回 Rich，也不要让 Hermes 直接生成原始 Multica CLI 命令。

Rich“项目代办”页是 Multica Project 的实时投影与交互入口。页面中的状态、顺序、评论、负责人、Run 和其他任务数据必须以 Multica 返回值为准；失败时保留上次成功快照并报告错误，禁止回退成 Rich 本地 Todo。项目经理通过 Rich MCP 维护项目说明、规范、健康和结论时，这些 Rich 业务数据仍由 Rich 保存，不应反向复制成 Multica Issue 字段。

## MCP 与 CLI 的边界

- MCP 是给模型看的场景化工具面，负责选择、结构化输入、安全与统一结果。
- CLI 是给本机 shell/自动化脚本使用的命令入口，覆盖 HTTP/SSE 和离线维护。
- MCP 不等于 CLI，也不要求每条 CLI 命令都暴露成 MCP 工具。
- Agent 在对话中优先使用 MCP；需要操作尚未纳入 MCP 的按钮、文件或离线计划数据时，使用 CLI。

常用 CLI：

```bash
pnpm rich -- health
pnpm rich -- elements list
pnpm rich -- elements patch <id> --json '{"title":"新标题"}'
pnpm rich -- api GET /api/admin/engine
pnpm rich -- sse POST /api/ai/expand --json '{"elementId":"<id>","count":3}'
pnpm --filter @ke/server run plan -- list plans --status all --json
```

CLI 按钮覆盖见 `docs/RICH_CLI_COVERAGE.md`。

## 项目与业务规范

- 项目说明、工作流、场景、环境、部署、监控、代码版本、待办和文件夹统一通过 `rich_project_manage` 精确管理。
- 一段对话同时产生摘要、决定和待办时，使用 `rich_project_organize_conversation`。
- 数据字典系统、表、字段的读取和精确更新使用 `rich_dictionary_manage`。
- Mapping 规则仍必须遵守 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md`；MCP 2.0 当前未暴露的 Mapping 专项操作使用 Rich CLI/API。
- 维护字段逻辑 JSON、场景口径 JSON 或临时表前，必须先读 `docs/PROJECT_MANAGEMENT_MAINTENANCE_MANUAL.md`；它们是 SQL 生成和验证使用的受控结构，不能用自由文本、备注或未经发布的新键替代。
- GreatMe 计划整体状态可通过 `rich_planning_manage` 读取或确认后替换；日常细粒度计划命令继续使用 plan CLI。

## AI 引擎和上下文

Rich 聊天上下文由服务端持久化，长对话使用“长期摘要 + 最近消息 + 当前输入”。不要把浏览器临时消息当作唯一事实来源。

场景模型由 `RICH_AI_<SCENARIO>_MODEL` 和后台 `/api/admin/engine` 管理。密钥只能存放在环境变量或本机密钥配置中，不得写入任务、文档、聊天历史或 Git。

非聊天 AI 操作必须显式提供项目、元素、手册或规则上下文；上下文不足时返回待确认问题，不得凭空补齐。

# Rich 项目管理 MCP 2.0 手册

这份手册说明 Agent 如何通过 MCP 2.0 使用 Rich「项目管理」。完整 Schema 和示例由 `docs/RICH_MCP_V2_CATALOG.md` 提供。

## 如何选工具

| 意图 | 工具 |
| --- | --- |
| 只知道关键词，跨知识和项目找资料 | `rich_context_search` |
| 看一个项目有哪些模块和资料 | `rich_context_get_overview` |
| 把一轮对话拆成摘要、决定和待办 | `rich_project_organize_conversation` |
| 结合项目资料分析风险、依赖和步骤，不执行 | `rich_project_analyze_and_plan` |
| 精确读取、新建、更新或删除项目条目 | `rich_project_manage` |
| 管理数据字典系统、表和字段 | `rich_dictionary_manage` |
| 管理测试任务、用例、执行、证据、问题、复测与报告 | `rich_test_center_manage` |
| 管理项目自动化计划定义 | `rich_automation_manage` |
| 把明确开发工作交给外部 Agent | `rich_work_delegate` |

## 项目模块

`rich_project_manage` 使用下列 `moduleKey`：

| key | 页面 |
| --- | --- |
| `description` | 项目说明 |
| `dictionary` | 数据字典相关项目条目 |
| `automation` | 数据自动化相关项目条目 |
| `workflow` | 作业流程 |
| `scenarios` | 场景手册和决定 |
| `environments` | 环境配置 |
| `deploymentSteps` | 部署步骤 |
| `monitoring` | 监控预警 |
| `codeVersions` | 代码版本 |
| `todos` | 项目待办 |
| `folder` | 文件夹 |

支持的动作：

- `summary`：读取项目汇总。
- `search`：在项目中搜索。
- `list`：列出模块条目。
- `create_item`：创建已明确的单个条目。
- `update_item`：精确更新已知条目。
- `delete_item`：确认后删除已知条目。

复杂 UI 原始结构通常保存在 `content.original`。更新前先读取，合并用户要求的字段，不得覆盖未知字段。

## 对话整理

当一次讨论同时产生项目背景、决定和行动项时，使用一个 `rich_project_organize_conversation` 调用。它会分别写入：

- 对话摘要 → `description`
- 已确认决定 → `scenarios`
- 行动项 → `todos`

多条记录写入若部分失败，响应会返回 `TASK_FAILED`、已创建的 `refs/createdIds` 和失败条目。只重试失败部分，不能重放整个对话造成重复。

## 数据字典

`rich_dictionary_manage` 支持：

- `list_systems`
- `list_tables`
- `list_fields`
- `get_field`
- `update_system`
- `update_table`
- `update_field`

更新前必须先定位系统内 ID。字段类型、码值、格式或 Mapping 逻辑不确定时，不得猜测。

MCP 2.0 当前没有暴露 Mapping 场景、规则、血缘和整改的全部原子操作。这些操作继续遵守 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md`，并通过 Rich CLI/API 完成；不要退回调用已删除的 MCP v1 工具。

## 测试中心

`rich_test_center_manage` 以测试用例为主线。测试任务定义范围；用例保存目标和步骤；每次执行创建独立历史；证据、问题、讨论和复测均回溯至指定用例或执行。它支持：

- 读取：`list_tasks`、`list_cases`、`list_runs`、`list_issues`、`get_report`。
- 写入：`create_task`、`create_case`、`create_cases`、`add_case_step`、`start_run`、`finish_run`、`finish_run_step`、`add_evidence`、`create_issue`、`update_issue`、`add_discussion`、`start_retest`。

写入必须带 `context.requestId`；网络重试复用同一 ID。批量用例创建使用 `create_cases` 的 `input.cases`，每条用例仍需 `code`、`title`、`objective`、`type`（`data` 或 `functional`）和 `priority`。问题只有进入 `fixed` 后才允许 `start_retest`；它会从问题的源用例创建一条新执行记录，并把问题标为 `retest`，不会覆盖失败历史。

示例：

```json
{
  "action": "create_case",
  "projectId": "project-rich",
  "input": {
    "code": "TC-001",
    "title": "金额汇总校验",
    "objective": "验证源明细与汇总金额一致",
    "type": "data",
    "priority": "high"
  },
  "context": { "requestId": "tc-001-create" }
}
```

## 写安全

```json
{
  "context": { "requestId": "project-update-unique-id" },
  "options": { "dryRun": false, "confirmDestructive": false }
}
```

- 每次新写入使用新的 `requestId`；网络重试复用原 ID。
- 删除前先读取目标，再取得用户明确确认并设置 `confirmDestructive=true`。
- 不确定影响时设置 `dryRun=true`，dry-run 不需要 requestId。
- 检查 `ok` 之外，还要检查 `verification.status`、`changes` 和 `refs`。

## 从规划到 Agent 执行

```text
rich_context_search / rich_context_get_overview
  → rich_project_analyze_and_plan
  → 用户确认范围与验收标准
  → rich_work_delegate
  → rich_work_get_status
  → rich_work_review_result
  → rich_learning_capture
```

Rich 任务 ID 是平台内跟踪和验收主键。外部任务 ID 只用于 Multica/Codex 等适配器同步。未配置委派适配器时，`rich_work_delegate` 返回 `DEPENDENCY_UNAVAILABLE`，不会创建虚假任务。

## Multica 项目工作台

项目应用中的“项目代办”是绑定 Multica Project 的实时工作台，不再读写 Rich 本地 Todo 副本。Multica 是 Issue、状态、排序、负责人、评论、Timeline、Run、执行消息、附件、Pull Request、属性、标签、元数据、订阅者和 Usage 的唯一事实源。

- 看板前台激活时每 5 秒同步，窗口在后台时每 30 秒同步，重新获得焦点后立即同步。
- 创建、编辑、拖动、评论、指派、取消和重跑都直接回写 Multica，成功后立即重新读取。
- CLI 或 Profile 暂时不可用时，Rich 保留上次成功内容并显示错误及重试入口，不把失败显示成空任务。
- “小队”面板展示 Project、Squad、Leader、成员、模型、Runtime、成员 MCP 和目录资源；只有配置了 Rich MCP 的成员可以维护 Rich 项目资料。
- 任务详情采用 Multica 的主内容、时间线和右侧属性栏结构，界面保留 `Powered by Multica` 归属。

Hermes 仍优先使用 `rich_execution_team_plan`、`rich_execution_team_apply` 和 `rich_work_delegate`。Rich CLI 提供同一套服务的人工和自动化入口；前台不直接执行原始 Multica CLI，也不持有 Workspace/Profile 配置。

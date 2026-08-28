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

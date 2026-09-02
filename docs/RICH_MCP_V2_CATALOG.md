# Rich MCP 2.0 工具目录

> 此文件由 `pnpm --filter @ke/server mcp:docs` 生成，请勿手工编辑。

工具数：24；输入 Schema：20546 bytes。所有工具返回统一的 `{ ok, action, data/error, refs, changes, verification, warnings }` 信封。

## `rich_automation_manage`

- 场景：`manage`
- 用于：List, get, create, update, or delete project automation plans. Execution is handled by a separate scenario/task flow.
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=true，幂等=true
- 输入：`action`（必填）、`projectId`（必填）、`id`、`input`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Plan writes are verified through getPlan or listPlans.
- 示例：

```json
{
  "action": "list_plans",
  "projectId": "project-rich"
}
```

## `rich_context_get_overview`

- 场景：`query`
- 用于：Get a compact overview of the Rich knowledge base and an optional project's modules and dictionary counts.
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`projectId`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Counts are computed from current repository reads.
- 示例：

```json
{
  "projectId": "project-rich"
}
```

## `rich_context_search`

- 场景：`query`
- 用于：Search Rich knowledge and, when projectId is supplied, project-management records. Use for finding or understanding information without changing it.
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`query`（必填）、`projectId`、`sources`、`limit`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Results are returned from the current knowledge and project repositories without writes.
- 示例：

```json
{
  "query": "MCP",
  "projectId": "project-rich"
}
```

## `rich_deliverable_history_get`

- 场景：`query`
- 用于：读取当前交付物此前 AI 任务的结论、产物引用和人工复核状态。
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`taskId`（必填）
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Returns only prior tasks belonging to the same project and deliverable.
- 示例：

```json
{
  "taskId": "task-id"
}
```

## `rich_dictionary_manage`

- 场景：`manage`
- 用于：List project dictionary systems, tables, or fields and update a known system, table, or field with write verification.
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`action`（必填）、`projectId`（必填）、`id`、`systemId`、`tableId`、`input`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Writes are verified by reading the updated dictionary entity from the repository.
- 示例：

```json
{
  "action": "list_tables",
  "projectId": "project-rich"
}
```

## `rich_execution_team_apply`

- 场景：`manage`
- 用于：在用户确认后应用已持久化的执行团队计划，复用或创建项目、成员和小队，并保存稳定映射。
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`planId`（必填）、`confirmed`（必填）、`context`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reads the saved binding after apply and verifies its project and default squad IDs.
- 示例：

```json
{
  "planId": "team-plan-1",
  "confirmed": true,
  "context": {
    "requestId": "team-apply-1"
  }
}
```

## `rich_execution_team_plan`

- 场景：`plan`
- 用于：分析 Rich 项目的执行需求，优先复用现有成员，并提出需要创建或调整的项目执行团队计划；不会创建外部资源。
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`projectId`（必填）、`projectName`（必填）、`goal`（必填）、`projectDescription`、`workingDirectory`、`requiredCapabilities`（必填）、`context`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Persists the proposed plan and returns its stable plan ID; no external resource is created.
- 示例：

```json
{
  "projectId": "rich",
  "projectName": "Rich",
  "goal": "实现任务委派能力",
  "workingDirectory": "/workspace/Rich",
  "requiredCapabilities": [
    {
      "key": "development",
      "description": "TypeScript 开发和验证",
      "proposedName": "Rich 开发",
      "role": "负责实现与测试",
      "preferredAgentName": "Rich 开发",
      "runtimeProvider": "codex"
    }
  ],
  "context": {
    "requestId": "team-plan-1"
  }
}
```

## `rich_knowledge_capture`

- 场景：`capture`
- 用于：把对话中的事实、想法、决定、需求或经验整理成可追溯的 Rich 知识记录。
- 不用于：只需临时回答、不需要写入 Rich，或目标记录需要精确更新而不是新建时。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`title`（必填）、`kind`（必填）、`summary`（必填）、`details`、`tags`、`source`（必填）、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reads the created knowledge record back by ID.
- 示例：

```json
{
  "title": "采用场景型 MCP",
  "kind": "decision",
  "summary": "减少原子工具数量。",
  "source": {
    "conversationId": "chat-1"
  },
  "context": {
    "requestId": "capture-1"
  }
}
```

## `rich_knowledge_manage`

- 场景：`manage`
- 用于：Read a specific knowledge record or list filtered knowledge records. Use precise actions after the target resource is known.
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=true，幂等=true
- 输入：`action`（必填）、`id`、`type`、`tag`、`input`、`limit`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：The returned item IDs come directly from the knowledge repository.
- 示例：

```json
{
  "action": "get",
  "id": "knowledge-mcp"
}
```

## `rich_learning_capture`

- 场景：`capture`
- 用于：把 Agent 任务中可复用的做法、陷阱和验证方式沉淀为 Rich 知识，并保留来源任务引用。
- 不用于：只需临时回答、不需要写入 Rich，或目标记录需要精确更新而不是新建时。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`taskId`（必填）、`title`（必填）、`learning`（必填）、`applicability`、`tags`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reads the learning record back and keeps a source work-task reference.
- 示例：

```json
{
  "taskId": "task-id",
  "title": "重建 SQLite 原生模块",
  "learning": "切换 Node 后执行 rebuild。",
  "context": {
    "requestId": "learning-1"
  }
}
```

## `rich_planning_manage`

- 场景：`manage`
- 用于：Read Rich planning state or replace the complete state when an exact new state is explicitly provided.
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=true，幂等=true
- 输入：`action`（必填）、`input`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Replacement is verified by reading the full planning state back.
- 示例：

```json
{
  "action": "get_state"
}
```

## `rich_practice_manage`

- 场景：`manage`
- 用于：List, get, create, or update Rich practice-project records. Detailed child orchestration remains a scenario workflow.
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`action`（必填）、`id`、`input`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Writes are verified by reading the practice element back.
- 示例：

```json
{
  "action": "list"
}
```

## `rich_project_analyze_and_plan`

- 场景：`plan`
- 用于：读取 Rich 知识和指定项目的相关信息，形成目标、上下文缺口、风险和可验证执行步骤；不写入项目。
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`goal`（必填）、`projectId`、`constraints`、`desiredOutcome`、`context`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reports which current Rich records were read and does not perform writes.
- 示例：

```json
{
  "projectId": "rich",
  "goal": "使用 Multica CLI 委派 Agent",
  "constraints": [
    "保留人工验收"
  ]
}
```

## `rich_project_manage`

- 场景：`manage`
- 用于：Read a project summary, search project records, or list one project module. Use when the project and desired resource operation are explicit.
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=true，幂等=true
- 输入：`action`（必填）、`projectId`（必填）、`id`、`query`、`moduleKey`、`parentId`、`limit`、`input`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Project data is read directly from the project-management repository.
- 示例：

```json
{
  "action": "summary",
  "projectId": "project-rich"
}
```

## `rich_project_organize_conversation`

- 场景：`capture`
- 用于：一次把对话摘要、已确认决定和待办分别整理到 Rich 项目的适当信息结构中。
- 不用于：只需临时回答、不需要写入 Rich，或目标记录需要精确更新而不是新建时。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`projectId`（必填）、`conversation`（必填）、`decisions`、`todos`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reads all created project records back from their modules.
- 示例：

```json
{
  "projectId": "rich",
  "conversation": {
    "id": "chat-1",
    "summary": "确认 MCP 2.0 方案"
  },
  "decisions": [
    {
      "title": "按场景组织工具"
    }
  ],
  "todos": [
    {
      "title": "实现委派端口"
    }
  ],
  "context": {
    "requestId": "organize-1"
  }
}
```

## `rich_task_context_get`

- 场景：`query`
- 用于：读取指定 Agent 交付物任务创建时冻结的要求、记录和材料目录。
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`taskId`（必填）
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Returns only the snapshot persisted on the running task.
- 示例：

```json
{
  "taskId": "task-id"
}
```

## `rich_task_material_read`

- 场景：`query`
- 用于：读取当前任务快照中明确列出的一个材料文件。不能读取快照以外的路径。
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`taskId`（必填）、`relativePath`（必填）、`maxChars`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Returns content only for a file listed in the active task snapshot.
- 示例：

```json
{
  "taskId": "task-id",
  "relativePath": "07-交付/report/baseline.md"
}
```

## `rich_task_reference_read`

- 场景：`query`
- 用于：读取当前任务冻结记录中明确写出的单个文件引用。目录和未声明的路径不会开放。
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`taskId`（必填）、`recordId`（必填）、`maxChars`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Returns a file only when its path is explicitly present in the selected frozen record.
- 示例：

```json
{
  "taskId": "task-id",
  "recordId": "record-id"
}
```

## `rich_task_report_result`

- 场景：`manage`
- 用于：写入 Agent 对交付物分析任务的摘要和证据，并将任务提交给人工复核。
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`taskId`（必填）、`summary`（必填）、`evidence`、`reportMarkdown`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reads the completed task and confirms it requires human review.
- 示例：

```json
{
  "taskId": "task-id",
  "summary": "分析完成",
  "evidence": [
    "source.xlsx"
  ]
}
```

## `rich_work_cancel`

- 场景：`manage`
- 用于：取消 Rich 工作任务。若存在外部 Agent 任务，会先取消外部任务，再更新本地状态。
- 不用于：目标对象尚未定位；此时先使用查询工具。
- 安全属性：只读=false，破坏性=true，幂等=true
- 输入：`taskId`（必填）、`reason`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reads the task back and verifies that it is cancelled.
- 示例：

```json
{
  "taskId": "task-id",
  "context": {
    "requestId": "cancel-1"
  },
  "options": {
    "confirmDestructive": true
  }
}
```

## `rich_work_delegate`

- 场景：`delegate`
- 用于：把目标、验收标准和 Rich 上下文交给项目默认执行团队，由团队负责人选人，并在 Rich 建立可跟踪任务。
- 不用于：目标仍不清楚、只需要方案，或任务不能由外部 Agent 实际执行时。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`projectId`（必填）、`title`（必填）、`instructions`（必填）、`acceptanceCriteria`、`requiredCapabilities`、`workingDirectory`、`contextRefs`、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Creates a local Rich task only after external delegation succeeds, then reads it back.
- 示例：

```json
{
  "projectId": "rich",
  "title": "实现 MCP 任务看板",
  "instructions": "按设计实现并运行测试",
  "acceptanceCriteria": [
    "服务端测试通过"
  ],
  "requiredCapabilities": [
    "development"
  ],
  "context": {
    "requestId": "delegate-1"
  }
}
```

## `rich_work_get_status`

- 场景：`query`
- 用于：按 Rich 本地任务 ID 查询 Agent 工作状态、进度、结果与外部任务关联。
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`taskId`（必填）
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Returns the task persisted in Rich.
- 示例：

```json
{
  "taskId": "task-id"
}
```

## `rich_work_list`

- 场景：`query`
- 用于：列出 Rich 工作看板中的任务，可按状态筛选。
- 不用于：用户已明确要求写入、删除或委派实际工作时。
- 安全属性：只读=true，破坏性=false，幂等=true
- 输入：`status`、`limit`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Returns tasks persisted in Rich ordered by latest update.
- 示例：

```json
{
  "status": "running"
}
```

## `rich_work_review_result`

- 场景：`review`
- 用于：根据产物和验证结果，记录对已完成 Agent 任务的接受、拒绝或人工复核决定。
- 不用于：任务尚未完成，或还没有产物与验证证据时。
- 安全属性：只读=false，破坏性=false，幂等=true
- 输入：`taskId`（必填）、`decision`（必填）、`notes`（必填）、`context`、`options`
- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。
- 验证：Reads the review decision back from the persistent Rich task.
- 示例：

```json
{
  "taskId": "task-id",
  "decision": "accepted",
  "notes": "验收通过",
  "context": {
    "requestId": "review-1"
  }
}
```

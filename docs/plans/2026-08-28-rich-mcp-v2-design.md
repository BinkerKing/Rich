# Rich MCP 2.0 设计

**日期：** 2026-08-28  
**状态：** 已确认，待实施

## 1. 背景与结论

Rich 是用户的信息与业务工作平台，Hermes 是 Rich 内的对话入口。Hermes 负责理解意图、整合信息和选择工具；真正需要较强执行能力的工作，未来可以交给 Codex、Multica 管理的 Agent 或其他执行器。

本次工作的核心不是把 Multica 嵌入 Rich，也不是把 CLI 包装成越多越好的 MCP 工具，而是先把 Rich 自己的 MCP 规范化，使 AI 能稳定地：

1. 查询和理解 Rich 中的信息；
2. 把对话内容整理进正确的 Rich 数据结构；
3. 管理 Rich 的业务对象；
4. 创建、跟踪、验收外部 Agent 的工作；
5. 把结果和经验沉淀回 Rich。

Multica 后续作为一个可替换的任务执行与编排后端，通过适配器接入。它的 CLI 可以被 Agent 直接调用，其看板也可以继续作为执行后台；Rich 不需要复制 Multica 的实现。

## 2. 当前问题

当前 MCP 已覆盖知识、项目管理、计划、实践和自动化等领域，但暴露约 136 个工具。主要问题不是“能力不够”，而是能力的组织方式不适合模型使用：

- 工具按底层单一操作增长，选择空间过大；
- 相近的 create、update、list、search 工具描述和参数重叠；
- 完成一个用户场景需要多次工具选择和多轮拼装；
- 不同工具的返回结构、错误、确认和验证方式不统一；
- 异步任务保存在进程内存中，服务重启后无法继续跟踪；
- 文档与真实工具清单容易漂移；
- Hermes 的提示词需要记住大量工具细节，而不是理解少量稳定场景；
- 尚未形成稳定的外部 Agent 委派、监控、验收和经验回流边界。

## 3. 目标与非目标

### 3.1 目标

- MCP 工具总量控制在 40 个以内；
- 高频业务按场景提供工具，低频精确操作通过资源级 manage 工具兜底；
- 所有工具遵守统一的命名、参数、响应、错误、幂等、确认和验证约定；
- 建立可持久化的任务模型；
- 为 Multica、Codex 等执行器定义可替换的委派接口；
- 从注册表生成工具清单、Hermes 使用手册和测试目录；
- 不改变 Rich 现有页面和 HTTP API 行为；
- 不兼容旧 MCP，Hermes 按 MCP 2.0 重新学习。

### 3.2 非目标

- 本阶段不在 Rich 内重做 Multica 看板或 Agent 调度器；
- 本阶段不要求接通某个特定外部 Agent；
- 不把所有 CLI 命令逐个包装成 MCP 工具；
- 不借机重构 Rich 的现有业务模块、页面或 HTTP API；
- 不保留旧 MCP 工具名或旧参数的兼容层。

## 4. 核心设计原则

### 4.1 场景优先，资源兜底

MCP 2.0 采用混合设计：

- **场景工具**面向用户目标，一次完成一个高频工作流；
- **资源工具**面向明确对象，使用统一 action 参数完成低频或精确操作；
- 场景工具只编排已有领域服务，不复制业务规则；
- HTTP API、MCP 和未来 CLI 共享同一服务层，而不是互相套壳调用。

例如，“把这段对话整理到项目中”应优先调用 `rich_project_organize_conversation`，而不是让模型连续选择项目、创建笔记、创建待办、补充标签并建立引用。只有用户明确要求修改某一个待办字段时，才使用 `rich_project_manage`。

### 4.2 MCP 与 CLI 的边界

- MCP 是给模型看的结构化工具协议，重点是可发现、可选择、参数约束和结构化结果；
- CLI 是给人或具备终端能力的 Agent 使用的命令入口，重点是脚本化、组合和本机执行；
- MCP 可以在实现内部调用 CLI，但这不是必需关系；
- 对 Rich 内部能力，优先让 MCP 与 HTTP API 复用领域服务；
- 对 Multica 这类外部系统，可以由执行 Agent 直接调用 CLI，也可以由 Rich 的委派适配器调用 CLI。

## 5. 场景模型

MCP 2.0 按六类用户场景组织。

| 场景 | 目标 | 典型工具 |
| --- | --- | --- |
| 查询理解 | 找到并综合 Rich 中的信息 | `rich_context_search`、`rich_context_get_overview` |
| 信息整理 | 把对话或材料放进正确结构 | `rich_knowledge_capture`、`rich_project_organize_conversation` |
| 精确管理 | 对明确资源执行 CRUD 或状态变更 | `rich_project_manage`、`rich_dictionary_manage` |
| 分析规划 | 基于现有信息形成分析、计划与下一步 | `rich_project_analyze_and_plan` |
| 工作执行 | 把可执行任务交给最合适的 Agent 并跟踪 | `rich_work_delegate`、`rich_work_get_status` |
| 验收沉淀 | 审核结果、回写产物、沉淀经验 | `rich_work_review_result`、`rich_learning_capture` |

首版工具预算建议：

- 导航与查询：5–7 个；
- 知识与项目：8–10 个；
- 字典、计划、实践、自动化：10–12 个；
- 场景工具：6–8 个；
- 任务与系统：4–5 个。

总数必须小于或等于 40。新增工具必须说明为何不能由现有场景或 manage action 覆盖。

## 6. 架构

```text
用户
  │
  ▼
Rich 对话入口 / Hermes
  │  意图识别、工具选择、结果说明
  ▼
Rich MCP 2.0
  ├── 场景工具 ─────────┐
  ├── 资源工具 ─────────┤
  └── 任务工具 ─────────┤
                        ▼
                 Rich 领域服务 / Repo
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
          Rich 数据库       WorkDelegationPort
                                  │
                       ┌──────────┼──────────┐
                       ▼          ▼          ▼
                    Multica     Codex      其他 Agent
```

建议目录：

```text
apps/server/src/mcp-v2/
├── registry/
│   ├── types.ts
│   ├── toolRegistry.ts
│   ├── response.ts
│   └── errors.ts
├── resources/
│   ├── contextTools.ts
│   ├── knowledgeTools.ts
│   ├── projectTools.ts
│   ├── dictionaryTools.ts
│   ├── planningTools.ts
│   ├── practiceTools.ts
│   └── automationTools.ts
├── scenarios/
│   ├── captureInformation.ts
│   ├── organizeIntoProject.ts
│   ├── analyzeAndPlan.ts
│   ├── delegateWork.ts
│   ├── reviewWorkResult.ts
│   └── captureLearning.ts
├── delegation/
│   ├── WorkDelegationPort.ts
│   └── UnavailableDelegationAdapter.ts
├── tasks/
│   └── persistentTaskService.ts
└── server.ts
```

## 7. 统一工具契约

### 7.1 命名

工具统一采用：

```text
rich_<domain>_<action-or-scene>
```

名称表达用户意图，不表达传输或数据库实现。例如使用 `rich_work_delegate`，不使用 `rich_multica_cli_run`。

### 7.2 输入

资源级 manage 工具采用统一外壳：

```ts
type RichManageInput<TAction extends string, TInput> = {
  action: TAction;
  id?: string;
  input?: TInput;
  context?: {
    conversationId?: string;
    requestId?: string;
    reason?: string;
  };
  options?: {
    dryRun?: boolean;
    confirmDestructive?: boolean;
  };
};
```

场景工具可以有场景专用参数，但必须保留相同的 `context` 和 `options` 语义。

### 7.3 输出

所有工具返回相同信封：

```ts
type RichToolResponse<T> = {
  ok: boolean;
  action: string;
  data?: T;
  refs?: Array<{ type: string; id: string; label?: string }>;
  changes?: Array<{ operation: string; resource: string; id?: string }>;
  verification?: { status: "verified" | "skipped" | "failed"; details?: string };
  warnings?: string[];
  error?: {
    code: RichErrorCode;
    message: string;
    retryable: boolean;
    details?: unknown;
  };
};
```

模型不应依赖工具返回的自然语言段落判断是否成功。自然语言只用于补充说明，关键状态必须结构化。

### 7.4 错误代码

首版固定以下错误代码：

- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFIRMATION_REQUIRED`
- `CONFLICT`
- `PERMISSION_DENIED`
- `DEPENDENCY_UNAVAILABLE`
- `TASK_FAILED`
- `INTERNAL_ERROR`

错误必须说明是否可重试。未知异常在边界处转换为 `INTERNAL_ERROR`，详细堆栈只进入服务日志。

### 7.5 工具注解

每个工具在注册表中声明：

- `readOnly`：是否只读；
- `destructive`：是否可能删除、覆盖或产生不可逆影响；
- `idempotent`：相同请求是否可安全重试；
- `category`：所属场景；
- `examples`：至少一个正例；
- `verification`：写入后的验证方式。

这些元数据同时用于 MCP 描述、文档生成和契约测试。

## 8. 写操作安全与效率

### 8.1 幂等

- 写工具接收 `context.requestId`；
- 同一工具、同一 requestId、同一输入只执行一次并返回原结果；
- 同一 requestId 对应不同输入时返回 `CONFLICT`；
- 幂等记录必须持久化，不能只存在进程内存。

### 8.2 预演与确认

- 支持的写工具接受 `options.dryRun`，返回计划变更但不落库；
- destructive 工具缺少 `confirmDestructive: true` 时返回 `CONFIRMATION_REQUIRED`；
- destructive 不能依赖提示词中的“用户应该知道”来绕过确认。

### 8.3 写后验证

- 写工具成功后重新读取关键资源；
- 返回 `changes` 与 `verification`；
- 验证失败时不能伪装成完全成功，应返回失败或明确警告；
- 场景工具中的部分成功必须列出已完成和未完成的步骤。

## 9. 持久化任务与外部执行

### 9.1 Rich 任务模型

异步任务至少保存：

- Rich task ID；
- 类型、标题和原始请求；
- 状态：`queued | running | waiting_input | succeeded | failed | cancelled`；
- 执行后端和外部 task ID；
- 创建、开始、更新时间和结束时间；
- 进度摘要、结果引用和错误；
- conversationId、requestId 和发起人上下文。

服务重启后，`rich_work_get_status` 仍必须能够查询任务。Rich task ID 是对 Hermes 稳定的主键，Multica 或 Codex 的 ID 只作为外部引用。

### 9.2 委派接口

```ts
interface WorkDelegationPort {
  delegate(request: DelegationRequest): Promise<DelegatedWork>;
  getStatus(externalTaskId: string): Promise<DelegatedWorkStatus>;
  cancel(externalTaskId: string): Promise<void>;
}
```

MCP 只依赖该接口。首版未配置执行器时应明确返回 `DEPENDENCY_UNAVAILABLE`，不能制造“已委派”的假状态。未来的 `MulticaCliAdapter` 负责命令调用、输出解析和外部 ID 映射。

### 9.3 验收与沉淀

委派完成不等于业务完成：

1. 外部执行器返回产物和验证证据；
2. `rich_work_review_result` 根据任务验收标准记录接受、退回或需要人工检查；
3. 接受的结果回写 Rich 中对应的项目、计划、知识或改进记录；
4. `rich_learning_capture` 沉淀可复用经验，并保留来源任务引用。

## 10. 注册表、文档和 Hermes 学习

工具只能通过统一注册表进入 MCP 2.0。注册表是以下内容的单一事实来源：

- MCP `tools/list` 与 `tools/call`；
- 工具清单文档；
- Hermes 场景手册；
- 工具数量和 schema 体积报告；
- 契约测试目录；
- 50 条工具选择基准用例的候选集合。

生成文档必须进入版本控制，并由测试检查是否与注册表一致。Hermes 的系统说明按“何时使用哪个场景工具、何时退回资源工具、怎样确认写入”编写，不再逐个堆叠全部底层操作。

## 11. 测试与成功指标

### 11.1 测试层次

- **注册表测试：** 命名、数量、注解、schema 和重复注册；
- **资源工具测试：** 查询、CRUD、幂等、dry-run、确认和写后验证；
- **场景测试：** 从用户目标到最终业务结果，而非只断言调用次数；
- **任务测试：** 重启后可查询、状态迁移、外部 ID 映射和失败恢复；
- **传输测试：** `/mcp` 的 `tools/list` 与代表性 `tools/call`；
- **工具选择基准：** 至少 50 条真实中文提示，检查目标工具和不应选择的工具。

工具选择基准分为两层：确定性的预期映射测试进入常规 CI；真实 Hermes 模型评测由显式环境变量开启，避免网络和模型波动造成 CI 假失败。

### 11.2 验收指标

- MCP 工具数量不超过 40；
- 工具 schema 总体积相对当前基线下降至少 60%；
- 高频场景平均不超过 3 次 MCP 调用；
- 50 条工具选择基准准确率至少 90%；
- 相同 requestId 不产生重复写入；
- destructive 写入全部需要明确确认；
- 服务重启后任务状态仍可查询；
- Rich 现有页面和 HTTP API 回归测试保持通过。

## 12. 迁移策略

本次不做兼容迁移，采用可验证的原子切换：

1. 冻结当前工具清单、schema 体积和 50 条提示基线；
2. 建立 MCP 2.0 注册表与统一契约；
3. 迁移只读资源工具；
4. 迁移写资源工具和幂等机制；
5. 实现场景工具；
6. 建立持久化任务和委派接口；
7. 生成工具文档并更新 Hermes 说明；
8. 将 `/mcp` 一次性切换到 MCP 2.0；
9. 运行回归与选择基准；
10. 删除旧 MCP 注册代码和失效文档。

切换前新旧实现可以在代码中并存，但线上 `/mcp` 只暴露一套。切换后不保留旧名称别名，防止工具数量再次膨胀。

## 13. 风险与控制

| 风险 | 控制方式 |
| --- | --- |
| 场景工具变成新的巨型万能工具 | 每个场景必须有清晰结果边界；复杂度下沉到已有服务；schema 与分支数进入评审 |
| manage action 过多导致选择困难 | action 只用于同一资源的同类操作；跨资源流程必须进入场景工具 |
| Hermes 仍选错工具 | 用真实中文提示维护 50+ 条选择基准；根据混淆矩阵调整名称和描述 |
| 场景写入部分成功 | 返回逐项 changes、warnings 和 verification；需要补偿的步骤形成任务 |
| 外部 Agent 不可用 | 委派适配器显式报告依赖不可用；Rich 本地信息能力保持可用 |
| 任务状态与外部系统漂移 | Rich 保存本地主记录；按需同步外部状态并记录最后同步时间 |
| 文档与实现漂移 | 从注册表生成文档，并用 CI 漂移测试阻止合并 |
| 无鉴权的远程 MCP 暴露写能力 | 保持本机边界；若允许远程访问，必须先补认证、授权和审计，不由提示词代替 |

## 14. 已确认决策

- MCP 2.0 按场景组织，不按每个单一功能无限拆分；
- 保留资源级 manage 工具作为精确操作兜底；
- 不兼容旧 MCP，Hermes 重新学习；
- 现在就定义委派、监控、验收和沉淀接口；
- Multica 是可替换执行后端，不是 Rich 的必要内嵌模块；
- 现有 Rich 页面和 HTTP API 不因 MCP 2.0 改变。

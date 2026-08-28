# Rich Multica CLI Adapter Design

## Goal

让 Hermes 通过 Rich 的场景化 MCP 工具规划执行团队、按需准备 Multica Project/Squad/Agent、把工作委派给 Squad，并在 Rich 中持续跟踪、验收和总结结果。Multica 负责详细的 Agent 调度与执行看板，Rich 保留业务语义和高层任务状态。

## Confirmed decisions

- 使用 Multica CLI，不在首版直接调用 HTTP API。
- Hermes 不执行原始 CLI，只调用 Rich 的平台无关场景工具。
- Rich 项目第一次需要外部执行时，才按需创建 Multica Project。
- 优先复用已有 Agent；能力缺失时，由 Rich 提议名字、职责、Runtime、模型和指令，用户确认后创建。
- 使用专职的“Rich 调度员”作为默认 Squad Leader。Leader 只负责拆解、选人、跟踪和复核，不直接执行。
- 首版支持查询、创建、更新、同步、派活、跟踪和取消；不支持自动删除或归档 Project、Squad、Agent。
- 一个 Agent 可以加入多个 Squad，并在不同 Squad 中拥有不同角色。

## Architecture and boundaries

Multica 实现集中在 `apps/server/src/mcp-v2/delegation/multica/`。模块外只做必要的依赖注入、MCP 工具注册和持久化接线，Multica 命令、输出结构、状态和 UUID 不得泄漏到 Rich 业务模块。

```text
用户对话
  -> Hermes 意图判断
  -> Rich 场景化 MCP 工具
  -> Multica 管理服务 / WorkDelegationPort
  -> Multica CLI
  -> Multica Cloud、Squad、执行 Agent
```

模块职责：

- `MulticaCommandRunner`：通过参数数组执行 CLI、stdin 传长文本、校验 JSON、限制超时和输出大小。
- `MulticaExecutableDiscovery`：按显式环境变量、PATH、Desktop 内置 CLI 的顺序发现可执行文件并校验版本。
- `MulticaAdministrationService`：读取资源、生成团队计划、应用已确认计划、同步绑定。
- `MulticaCliAdapter`：实现 `WorkDelegationPort`，创建 Issue、聚合状态、取消活动 Runs。
- `MulticaBindingRepo`：保存 Rich Project ID 到 Multica Project/Squad/Agent UUID 的稳定映射。

## Resource lifecycle

Rich 项目创建时不触碰 Multica。第一次出现外部执行需求时：

1. 查询绑定，没有 Multica Project 时在计划中提出创建。
2. 按能力检查现有 Agent，优先复用，缺失时提出新建。
3. 检查可用 Squad；没有时提出使用专职“Rich 调度员”创建默认 Squad。
4. 用户确认计划后，按 Project、Leader、Agent、Squad、成员角色的依赖顺序应用并逐项校验。
5. 保存精确 UUID；后续同步只补齐缺失状态，不删除 Multica 中的人工资源。
6. 创建 Issue，关联 Project，指派给 Squad，由 Squad Leader 选择实际执行成员。

信息放置规则：项目目录和资料属于 Project Resource；跨项目能力属于 Agent Instructions；团队协作和选人规则属于 Squad Instructions；当前目标和验收标准属于 Issue。

## Scenario tools

- `rich_execution_team_plan`：只读分析，返回复用和创建计划并持久化 `planId`。
- `rich_execution_team_apply`：应用用户已确认的 `planId`，创建或更新资源并保存绑定。
- `rich_work_delegate`：改为 Squad 模式，接收 Rich Project ID、目标、说明、验收标准、能力要求、工作目录和上下文引用；不再由 Hermes 指定具体 Agent。
- `rich_work_get_status`、`rich_work_list`、`rich_work_cancel`、`rich_work_review_result`、`rich_work_capture_learning` 继续承担查询、取消、验收和经验沉淀。

已有可用默认 Squad 且无需新增成员时，可以直接委派；需要创建外部资源时必须先 plan、由用户确认、再 apply。

## Persistence

Rich 保存：

```text
Rich Project ID
  -> Multica Project UUID
  -> default Squad UUID
  -> known Squad UUIDs
  -> Agent UUID, capability keys, Squad role
```

团队计划必须持久化，包含不可变请求摘要、建议变更、创建时间和应用状态。`apply` 使用 `planId` 和 MCP `requestId` 保证幂等。Multica 名称不保证唯一，因此已绑定资源始终以 UUID 为准；名称仅用于首次发现候选和展示。

## Task tracking

一个 Rich 工作任务对应一个 Multica Issue，Issue UUID 写入 `externalTaskId`。Squad 可能产生多个 Runs，因此 Run UUID 不能作为 Rich 主外键。

状态映射：

- `deferred`、`queued`、`dispatched` -> `queued`
- `waiting_local_directory` 或明确等待外部输入 -> `waiting_input`
- 存在活动 Run -> `running`
- Issue 进入复核阶段 -> `waiting_input`
- Issue 完成且无活动 Run -> `succeeded`
- Issue 最终失败 -> `failed`
- Issue 取消 -> `cancelled`

查询状态时读取 Issue 和所有 Runs，返回聚合状态及简短进度。活动任务由轻量同步器定期刷新，用户查询和验收前即时刷新；服务重启后恢复未结束任务。取消时列出 Issue 的所有活动 Runs 并逐个取消。

Rich 保存目标、验收标准、高层状态和最终总结；Multica 保存成员分派、评论、Runs 和详细日志。首版不复制完整日志或评论。

## CLI safety and errors

CLI 发现顺序：

1. `RICH_MULTICA_CLI_PATH`
2. PATH 中的 `multica`
3. `/Applications/Multica.app/Contents/Resources/app.asar.unpacked/resources/bin/multica`

默认复用 Multica Desktop 当前 Profile 和 Workspace，允许环境变量覆盖。Rich 不读取、保存、修改或打印 Token、Profile 或 daemon 状态。所有命令使用 `spawn(executable, args, { shell: false })`；描述通过 stdin；日志只记录脱敏后的命令名称、退出码和摘要。

首版支持 CLI `>=0.4.35 <0.5.0`。调用必须有超时、最大输出限制和运行时 JSON 校验。错误转换为 Rich 的 `DEPENDENCY_UNAVAILABLE`、`VALIDATION_ERROR` 或可重试的 `TASK_FAILED`。创建成功但绑定写入失败时，下次通过查询和候选对账恢复，不盲目重复创建。

## Testing and rollout

- CLI discovery、参数构造、stdin、超时、输出限制、版本校验使用单元测试。
- 所有 JSON 响应通过固定 fixtures 和运行时 schema 测试，不依赖真实 Multica Cloud。
- 状态聚合覆盖 Leader + 多成员 Runs、重试、等待输入、失败和取消。
- 管理服务覆盖复用优先、缺能力建人、跨 Squad 复用、幂等 apply 和恢复对账。
- MCP 场景测试覆盖 plan -> confirmation -> apply -> delegate -> status -> cancel。
- 可选 live smoke test 只能在 `RICH_MULTICA_LIVE_TEST=1` 时运行，默认测试不得创建外部资源。
- 完成后运行 Server 全量测试与类型检查、Web 类型检查与构建，并按用户偏好重建、发布和重启 Rich Desktop，只保留最新版应用。

## Non-goals

- 不实现 Multica HTTP API Adapter。
- 不让 Hermes 学习或生成原始 Multica CLI。
- 不自动删除或归档外部资源。
- 不复制 Multica 完整日志、评论或看板到 Rich。
- 不在首版实现复杂的自动扩缩容、成本优化或跨 Workspace 调度。

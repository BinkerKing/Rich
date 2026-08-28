# Rich Multica 项目执行工作台设计

日期：2026-08-28

## 1. 目标

让 Rich 通过自身 CLI 和场景化服务完成 Multica Project、Agent、Squad 与 Issue 的创建、绑定、委派和跟踪，并在 Rich 的“项目代办”模块中完整展示和操作当前 Rich 项目所绑定的 Multica 信息。

首个真实验收项目为 Rich 项目 `vtb-二代safe`，名称 `【VTB】二代SAFE`，目录：

`/Users/binkerking/Documents/Ai-WorkSpace/Projects/【VTB】二代SAFE`

Multica 是任务、状态、评论、执行记录和排序的唯一事实源。Rich 不再为已绑定项目维护一套可以独立分叉的本地 Todo 主数据。

## 2. 已确认的产品边界

- Rich 保留项目导航、业务规范和知识结构。
- Multica 负责 Project、Squad、Agent、Issue、Run、评论、Timeline 和详细执行信息。
- Rich 项目代办展示当前绑定 Multica Project 的全部可达信息，并将用户操作回写 Multica。
- 第一轮 VTB 任务只允许分析，不允许修改 VTB 源码。
- 项目经理可以通过 Rich MCP 更新项目说明、项目代办与项目健康记录。
- BA、开发和测试只读项目目录与 Rich 项目资料。
- 四名成员统一使用 `gpt-5.6-terra`，使用在线的 Codex Runtime。
- 项目经理同时担任 Squad Leader，不创建第五名通用调度 Agent。
- 与当前 Rich 项目无关的 Multica Project、Workspace Chat、Autopilot 和其他全局对象不进入该项目看板。

## 3. Multica 源码与许可证约束

视觉与交互以本机 Multica 源码 `/Users/binkerking/Documents/Ai-WorkSpace/Multica` 为依据，重点参考：

- `packages/views/issues/components/board-view.tsx`
- `packages/views/issues/components/board-column.tsx`
- `packages/views/issues/components/board-card.tsx`
- `packages/views/issues/components/issue-detail.tsx`
- `packages/views/issues/components/execution-log-section.tsx`
- `packages/views/issues/components/comment-card.tsx`
- `packages/views/issues/components/pull-request-list.tsx`
- `packages/views/issues/components/issue-usage-dialog.tsx`
- `packages/ui/styles/tokens.css`
- `packages/ui/styles/base.css`

Multica License 对派生 UI 有品牌与归属要求。因此：

- Rich 不直接复制整套 Multica React 组件和框架依赖，而是在 Rich 内按相同信息层级与交互规则重写适配组件。
- 项目代办模块明确显示 `Powered by Multica`、Multica 名称和指向 Multica 项目的入口。
- Rich 文档保留 Multica 归属与仓库链接。
- 若未来对外商业分发，必须重新审查 Multica License 的商业许可与品牌条款；本设计只覆盖当前内部使用。

## 4. 方案选择

### 4.1 采用：服务端实时投影

Rich Server 通过现有安全的 `MulticaCommandPort` 调用 Multica CLI，向 Web 提供 Rich 业务语义的 REST API。UI 不直接执行 CLI，也不接触 Profile、Workspace ID 或 Multica Token。

Rich 只持久化：

- Rich Project ID 到 Multica Project UUID 的绑定；
- 默认 Squad 与 Agent UUID；
- Rich MCP 服务器 UUID；
- Rich 工作任务到 Multica Issue UUID 的绑定；
- 最后同步时间、游标和错误摘要。

Issue、评论、Run、Timeline、PR、附件和用量不复制为 Rich 业务记录。

### 4.2 不采用：本地影子 Todo

把 Multica Issue 复制进 `project_management_items/todos` 会形成双主、冲突合并和陈旧评论，因此不采用。

### 4.3 不采用：嵌入 Multica 页面

iframe 或整页嵌入不能融合 Rich 项目导航、权限和项目规范，也无法稳定控制本地 Desktop 路由，因此不采用。

## 5. 模块边界

所有 Multica 契约继续集中在 `apps/server/src/mcp-v2/delegation/multica/`，新增以下独立单元：

- `MulticaProjectWorkbenchService`：读取当前绑定项目的看板、Issue 详情、团队与执行信息，执行受控回写。
- `MulticaProjectWorkbenchSchemas`：解析所有 CLI JSON 边界，不把未校验 JSON 交给 UI。
- `MulticaProjectWorkbenchRoutes`：在 `/api/projects/:projectId/multica` 下暴露项目级 REST API。
- `MulticaProjectWorkbenchSync`：活动页面短轮询、后台慢轮询、焦点恢复刷新和错误退避。

现有单元调整：

- `MulticaAdministrationService` 支持由指定能力成员担任 Leader，取消硬编码的第五名 `Rich 调度员`。
- 本地目录资源支持 `in_place` 与 `worktree`。VTB 目录不是 Git 仓库，首轮只读任务使用 `in_place`。
- `MulticaProjectBinding` 保存 Leader、成员、Rich MCP Server 和执行模式。
- `MulticaCliAdapter` 继续负责 Rich 工作任务与 Multica Issue 的稳定映射。

## 6. Rich CLI

`scripts/rich-cli.mjs` 增加业务语义命令：

```text
rich multica team plan <projectId> --file request.json
rich multica team apply <planId> --confirmed
rich multica work delegate <projectId> --file request.json
rich multica work status <richTaskId>
rich multica project sync <projectId>
```

CLI 调用 Rich Server，不直接拼装或执行 Multica 原生命令。Server 复用与 Hermes MCP 相同的管理服务、幂等规则和绑定仓库。

`team plan` 只读；`team apply` 和 `work delegate` 是显式写操作。`--confirmed` 只用于应用已经返回给用户的计划。

## 7. VTB 团队

Multica Project：`【VTB】二代SAFE`

Squad：`VTB SAFE 研析小队`

| 姓名 | 角色 | 模型 | 权限 |
|---|---|---|---|
| 沈砚 | 项目经理、Squad Leader | `gpt-5.6-terra` | 只读 VTB 目录；使用 Rich MCP；维护 Rich 项目说明、项目代办和健康记录；拆解、委派、汇总 |
| 苏澄 | BA | `gpt-5.6-terra` | 只读 VTB 目录与 Rich 项目信息；分析业务范围、规则和待确认问题 |
| 陆骁 | 开发 | `gpt-5.6-terra` | 只读 VTB 目录与 Rich 项目信息；分析技术结构、依赖、构建与变更边界 |
| 林检 | 测试 | `gpt-5.6-terra` | 只读 VTB 目录与 Rich 项目信息；分析测试资产、验证入口、风险和验收策略 |

只有沈砚绑定 Rich MCP。若 Workspace 中不存在 Rich MCP Server，Rich 通过 stdin 创建：

```json
{
  "url": "http://127.0.0.1:31515/mcp"
}
```

创建后只分配给沈砚。Rich 不读取或复制任何 MCP 密钥。

## 8. 首轮真实任务

父 Issue 标题：`熟悉【VTB】二代SAFE项目并建立项目认知基线`

父 Issue 指派给 `VTB SAFE 研析小队`。沈砚负责在 Multica 内按角色创建和分派子 Issue，成员完成后由沈砚汇总。

任务约束：

- 只读目录和资料；禁止修改、删除、提交或部署 VTB 源码。
- 读取 Rich 中该项目的项目说明、数据字典、作业流程、场景手册、环境配置、部署步骤、监控预警、代码版本、项目代办和文件夹信息。
- 不把完整文件内容或敏感信息复制到评论；只保存必要摘要和证据引用。

验收产物：

1. 项目目录结构、关键入口和资料分布说明。
2. 项目管理规则与信息缺口清单。
3. BA 的业务范围、对象、流程与待确认问题。
4. 开发的技术架构、构建方式、依赖和安全变更边界。
5. 测试的测试资产、环境、验证入口、风险和验收策略。
6. 沈砚通过 Rich MCP 更新项目说明，并建立后续项目代办和项目健康记录。
7. Multica 父 Issue 中提供汇总结论、证据链接和下一步建议。

## 9. 看板视觉与行为

项目代办内部遵循 Multica 看板源码，而不是重新设计：

- Board Column 宽度固定为 280px；横向滚动；列头、隐藏列和空状态遵循 Multica 行为。
- Board Card 使用语义 `surface` 背景、0.5px 边框、轻阴影、8px 圆角和 Multica 的信息密度。
- 状态列从 Multica 状态目录动态生成，不在 Rich 固定写死五列。
- 卡片展示 identifier、标题、优先级、负责人、标签、父子进度、Agent 工作状态和必要日期。
- 拖动跨列先更新 Multica status；同列拖动调用 Multica reorder。
- 乐观更新只用于可预测的状态、负责人和排序，并且失败时回滚后重新拉取。
- 筛选、显示设置和当前选择属于前端视图状态；Issue 数据始终来自服务端投影。

## 10. Issue 详情

详情遵循 Multica `IssueDetail` 的真实结构，不采用自创标签页：

- 中央主内容：标题、描述、父 Issue、子 Issue/阶段、活动与评论时间线、评论输入。
- 可调整的右侧栏：属性、负责人、状态、优先级、项目、日期、标签、自定义属性、父 Issue、PR、Execution Log、创建/更新时间、Token Usage。
- 小屏使用右侧 Sheet；桌面宽屏使用可调整 Panel。
- 评论线程支持回复、解决、展开已解决线程和深链接定位。
- Timeline 合并评论与状态/优先级/指派/日期/执行活动。
- Execution Log 按 Run 折叠，Run Messages 增量加载；大量日志不进入首屏响应。

## 11. 完整信息覆盖

### 11.1 项目与团队

- Project 详情、状态和资源；
- Squad 详情、Leader、成员和角色；
- Agent 详情、状态、模型、Runtime 和 MCP 分配；
- Runtime 状态与项目执行目录。

### 11.2 Issue 主数据

- 标题、描述、identifier、状态、状态类别、优先级、位置；
- 项目、负责人类型与负责人；
- 父 Issue、子 Issue、阶段、开始日期和截止日期；
- 标签、自定义属性、元数据和订阅者；
- 创建、更新与当前执行摘要。

### 11.3 协作与执行

- 评论线程、回复和解决状态；
- Timeline；
- Runs、Run Messages 和错误；
- Pull Requests、结果引用、附件和 Token Usage。

## 12. API 行为

只暴露项目级、绑定感知的 API，不提供任意 CLI 透传：

- `GET /api/projects/:projectId/multica/board`
- `GET /api/projects/:projectId/multica/team`
- `GET /api/projects/:projectId/multica/issues/:issueId`
- `GET /api/projects/:projectId/multica/issues/:issueId/timeline`
- `GET /api/projects/:projectId/multica/issues/:issueId/runs`
- `GET /api/projects/:projectId/multica/issues/:issueId/runs/:runId/messages`
- `GET /api/projects/:projectId/multica/issues/:issueId/pull-requests`
- `GET /api/projects/:projectId/multica/issues/:issueId/usage`
- `PATCH /api/projects/:projectId/multica/issues/:issueId`
- `POST /api/projects/:projectId/multica/issues`
- `POST /api/projects/:projectId/multica/issues/:issueId/comments`
- 项目级 status、reorder、assign、rerun、cancel、label、property、metadata 和 subscriber 动作端点。

每个请求必须先通过 Rich Project ID 找到绑定，再校验响应 schema。URL 中的 Multica Issue ID 必须属于已绑定 Project。

## 13. 同步策略

- 看板打开且窗口聚焦：每 5 秒刷新 Issue 列表和团队活动摘要。
- 窗口失焦：每 30 秒刷新。
- 创建、更新、拖动、评论、取消或重跑后立即刷新受影响资源。
- Issue 详情按需加载 Timeline、Runs、PR 和 Usage；Run Messages 使用 sequence 增量读取。
- CLI 不可用、Profile 不可用或 Multica 超时时，保留当前屏幕内容并显示最后成功同步时间与重试按钮。
- 不把失败伪装成空列表，也不降级写入本地 Todo。

## 14. 错误与安全

- 所有命令继续使用 `spawn(..., { shell: false })` 和参数数组。
- 长描述、评论和 MCP 配置通过 stdin 传递。
- 限制超时和输出大小；日志中不打印 Token、MCP 配置内容或完整任务描述。
- 用户写操作需要明确项目绑定；跨项目 Issue ID 返回 404/冲突。
- 首轮任务的 Agent Instructions 明确禁止修改 VTB 源码。
- VTB 目录不是 Git 仓库，使用 `in_place` 资源；该任务只读，允许多个成员并行分析。

## 15. 测试与验收

### 15.1 自动化测试

- Multica CLI JSON schema 与异常响应测试；
- Project/Squad/Agent/Leader/MCP 创建与复用幂等测试；
- 看板状态目录、排序和状态回写测试；
- Issue 详情完整字段、Timeline、Runs、Messages、PR 和 Usage 测试；
- 评论、指派、取消和重跑回写测试；
- 项目归属校验和跨项目拒绝测试；
- Rich CLI 语义命令测试；
- React 看板卡片、拖放回滚、详情侧栏、错误与空状态测试。

### 15.2 真实闭环验收

1. 使用 Rich CLI 规划团队，只读展示将创建/复用的资源。
2. 应用计划，创建 VTB Project、四名 Agent、Squad、目录资源和 Rich MCP 分配。
3. 使用 Rich CLI 发布首轮父 Issue。
4. 确认 Multica 启动 Squad Leader Run，并产生子任务/评论/活动。
5. 在 Rich 看板看到同一批 Issue、状态、负责人、评论、Timeline 和 Runs。
6. 在 Rich 拖动一张卡片或添加测试评论，确认 Multica 立即出现相同变化。
7. 确认项目经理能通过 Rich MCP 更新 VTB 项目管理数据，其他成员没有该 MCP。
8. 确认 VTB 目录没有产生文件修改。
9. 完成测试、类型检查、Web 构建和 Desktop 打包。
10. 替换并重启 `/Applications/Rich.app`，只保留最新版本。

## 16. 完成标准

- 用户只通过 Rich CLI 和 Rich UI 即可完成团队创建、任务发布、状态查看和常用交互。
- Rich 中可以到达当前绑定项目的全部 Multica 项目、团队、Issue 与执行信息。
- Multica 与 Rich 看板不存在双主状态或本地假任务。
- UI 的信息层级、列/卡片尺寸、详情结构和交互反馈与 Multica 源码一致。
- VTB 真实分析任务运行，四人角色、模型、Leader、MCP 权限与只读边界符合本设计。
- 自动化测试和真实闭环验证均有新鲜证据。

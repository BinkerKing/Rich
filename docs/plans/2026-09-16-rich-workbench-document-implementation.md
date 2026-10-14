# Rich 工作台文档独立应用 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新建“工作台文档”应用：用轻量文档流组织卡片，复用 Rich 专业组件，并让绑定的 Codex session 通过受控 CLI/MCP 更新内容。

**Architecture:** 新应用拥有独立文档卡片树、服务、路由、仓储和 MCP 工具，不复用现有 `taskWorkbench` 的计划步骤模型。AI 的空标题骨架和用户接受的更新包立即服务端保存；用户手工编辑只存在本地统一草稿，点击保存才生效，并会被后续 AI 正式写入覆盖。

**Tech Stack:** TypeScript、React 18、TipTap、Hono、Zod、SQLite/PostgreSQL、Rich MCP v2、现有流程图与脑图应用、Rich 通用 UI 组件库与设计 token。

---

## 约束

- 新 AppView 为 `workbenchDocument`，名称“工作台文档”；旧 `taskWorkbench`、数据和 API 一律保留，不迁移。
- 新数据使用 `workbench_documents` 和 `workbench_document_versions`，不存入 `workbench_tasks` 或项目 Element。
- 每次正式保存后，仅保留当前版本和最近 3 个历史快照；实际删除第 4 个及更早快照。
- 普通正文无来源、证据、Agent 标签要求；流程图、脑图等功能卡只保存必要实体绑定。
- 不做自由画布、多用户协作、Notion 数据库/公式或专业图编辑器复制品。
- 新页面必须复用 Rich 既有设计 token 与通用控件；对话、输入、附件、流式状态、错误和 proposal 确认等可泛化 UI 必须沉淀为 Rich 通用组件，禁止复制第二套聊天界面。
- 复用的布局壳必须区分可选的“业务导航器”和“内容快速定位器”：前者负责切换实体/节点，后者只在当前实体详情内定位标题。两者不能共用状态、数据契约或命名。

## 可复用协作工作区决策

采用两层组合式壳，而非把工作台文档模型泛化成未来知识库模型。顶层 `CollaborativeWorkspaceShell` 只管理左右分栏、响应式行为、焦点与通用视觉组件；左侧 `InformationWorkspaceShell` 管理信息展示区的内部插槽；右侧 `CodexConversationPanel` 是独立的对话壳。业务通过插槽注入：

```text
CollaborativeWorkspaceShell
├─ information (左侧信息展示壳)
│  └─ InformationWorkspaceShell
│     ├─ navigator?       业务导航器：切换任务、知识节点或其他实体
│     ├─ contentLocator?  内容快速定位器：跳转当前实体详情内的章节/卡片
│     └─ main             当前实体的正文、画布或详情
└─ conversation (右侧独立对话壳)
   └─ CodexConversationPanel
```

顶层始终只有“左信息展示 + 右对话”两区；工作台文档首版向左侧信息壳传入 `navigator = null`，只使用卡片树驱动的 `contentLocator` 和文档流。未来知识库向同一个信息壳传入知识节点导航器，以及由当前节点详情标题驱动的内容快速定位器。`navigator` 改变当前实体；`contentLocator` 只滚动/聚焦当前实体内的内容。壳不读取卡片、知识节点、草稿、版本或 proposal 数据，也不决定 session 的业务上下文。

节点导航器和详情目录是左侧信息壳的内部布局，可独立收起；节点导航器收起后仍保留打开/切换入口，详情目录收起后不影响正文阅读。右侧对话壳始终是单独区域。窄屏时，顶层仍以内容优先：右侧对话壳进入抽屉；信息壳内部的节点导航器可再进入其自身抽屉，详情目录则可随正文显示或收起。不得把节点树误作为详情目录，也不得让详情目录承担实体切换。

壳采用 React 组合插槽，而非按应用 ID 写条件分支或建立过早的插件注册系统。目标接口应接近：

```tsx
<CollaborativeWorkspaceShell
  information={<InformationWorkspaceShell
    navigator={optionalNodeNavigator}
    locator={optionalDetailLocator}
    main={<DomainDetail />}
  />}
  conversation={<CodexConversationPanel {...conversationProps} />}
/>
```

`navigator`、`locator`、`main` 和 `conversation` 都是可替换组件；壳只提供区域容器、可见性、尺寸、滚动和响应式规则。工作台文档注入 `WorkspaceLocator + DocumentCanvas`，知识库注入 `KnowledgeNodeNavigator + KnowledgeDetailLocator + KnowledgeDetail`。业务组件的查询、选中状态、拖拽、版本、权限和 Agent 上下文均留在各自应用，不能渗入公用壳。

右侧 `CodexConversationPanel` 是 Rich 公用会话壳，不是工作台专属组件。它统一承载会话标题栏、消息列表、流式状态、输入框、附件投放、错误/空状态和窄屏抽屉行为；业务应用以 props/slots 传入 `conversationId`、上下文摘要、顶部操作区和 proposal 等会话内业务组件。视觉可配置项只允许受控的 `tone`、`density`、`accent`、`header`、`composer` 和 `sidebarActions`，并映射到 Rich 设计 token/CSS variables；不得让调用方传入任意散乱 CSS、重写消息布局或复制一套颜色体系。这样工作台、知识库及未来任何需要对话的页面共享同一套会话行为与基础样式，同时可使用 Rich 允许的主题色变体。

会话壳内部还必须包含公用的 `ConversationMessageRenderer` 和受控内容块注册表。消息按语义渲染为用户消息、Agent 回复、Rich 程序提示、工具活动、状态/错误、附件、提议确认卡、结构化表格、图片和功能组件预览；不得把业务页面拼出的 HTML 当作消息内容。每个块都携带显示状态，例如 `streaming`、`running`、`awaiting_confirmation`、`succeeded`、`failed`、`cancelled`，由公用渲染器统一处理逐字流入、执行中动画、状态色、可展开详情、完成/失败过渡与无障碍 live region。业务应用可以注册受控的领域内容块（如“工作台更新提议”或“知识库节点引用”），但只能提供数据和动作回调，不能重写基础消息排版与状态机。

### Task 1: 建立领域模型和卡片树操作

**Files:**

- Create: `packages/domain/src/types/workbenchDocument.ts`
- Create: `packages/domain/src/logic/workbenchDocument.ts`
- Create: `packages/domain/test/workbenchDocument.test.ts`
- Modify: `packages/domain/src/index.ts`

**Step 1: Write the failing test**

测试 `displayNumber`、`insertCard`、`moveCard`、`removeCard`、`validateDocument`：编号来自父子关系与排序而非 ID；移动重排两个父级；缺失父级与循环层级失败；删除删除完整子树。

```ts
it("derives numbers from hierarchy rather than ids", () => {
  const document = fixture([heading("goal"), text("scope", "goal")]);
  expect(displayNumber(document, "scope")).toBe("1.1");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/domain test -- workbenchDocument.test.ts`

Expected: FAIL，因为模型尚不存在。

**Step 3: Write minimal implementation**

定义 `WorkbenchDocument`（`id`、`conversationId`、标题、版本、卡片数组、时间）和判别联合 `WorkbenchCard`。首版类型为 `heading`、`rich_text`、`list`、`module`、`flowchart`、`mindmap`、`image`、`file`、`link`。每卡有稳定 `id`、`parentId?`、`order`、`title?`、`content` 和 `properties`。

流程图/脑图属性必须验证 `{ provider, entityId }`；模块属性必须是结构化值。编号不得持久化。所有跨层级操作通过纯函数重排 `order`，禁止 UI 手写树逻辑。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/domain test -- workbenchDocument.test.ts && pnpm --filter @ke/domain typecheck`

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/domain/src/types/workbenchDocument.ts packages/domain/src/logic/workbenchDocument.ts packages/domain/src/index.ts packages/domain/test/workbenchDocument.test.ts
git commit -m "feat: add workbench document card model"
```

### Task 2: 建立预制模块目录、仓储和三版本策略

**Files:**

- Create: `apps/server/src/workbench-document/moduleCatalog.ts`
- Create: `apps/server/src/workbench-document/repository.ts`
- Create: `apps/server/src/repos/SqliteWorkbenchDocumentRepo.ts`
- Create: `apps/server/src/repos/PostgresWorkbenchDocumentRepo.ts`
- Create: `apps/server/test/workbench-document-repository.test.ts`
- Create: `apps/server/test/workbench-document-module-catalog.test.ts`
- Modify: `apps/server/src/db/projectManagementSchema.ts`
- Modify: `apps/server/src/db/sqlite.ts`

**Step 1: Write the failing tests**

覆盖预制 `question_list`：固定字段、合法状态和必填问题标题；未知模块或状态失败。覆盖 SQLite 创建、读回、乐观版本冲突，以及连续保存到版本 6 后历史严格为 `[6, 5, 4]`。

```ts
for (let version = 2; version <= 6; version++) await repo.save({ ...doc, version }, version - 1);
expect((await repo.history(doc.id)).map(item => item.version)).toEqual([6, 5, 4]);
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ke/server test -- workbench-document-repository.test.ts workbench-document-module-catalog.test.ts`

Expected: FAIL。

**Step 3: Write minimal implementation**

模块目录只开放 BRD 已确认的“问题清单”；服务端读取目录给 Agent，Agent 选择模块但不能发送任意列定义或 HTML。

新增：

```sql
CREATE TABLE IF NOT EXISTS workbench_documents (id TEXT PRIMARY KEY, version INTEGER NOT NULL, document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbench_document_versions (
  document_id TEXT NOT NULL, version INTEGER NOT NULL, document TEXT NOT NULL,
  PRIMARY KEY (document_id, version)
);
```

SQLite 与 PostgreSQL 在同一事务中更新当前文档、插入快照、删除旧快照。仓储读回必须经领域 schema 解析，损坏 JSON 不得直接输出给 UI。

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ke/server test -- workbench-document-repository.test.ts workbench-document-module-catalog.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add apps/server/src/workbench-document apps/server/src/repos/SqliteWorkbenchDocumentRepo.ts apps/server/src/repos/PostgresWorkbenchDocumentRepo.ts apps/server/src/db/projectManagementSchema.ts apps/server/src/db/sqlite.ts apps/server/test/workbench-document-repository.test.ts apps/server/test/workbench-document-module-catalog.test.ts
git commit -m "feat: persist workbench documents and modules"
```

### Task 3: 实现服务端受控写入与 AI 更新包

**Files:**

- Create: `apps/server/src/workbench-document/schema.ts`
- Create: `apps/server/src/workbench-document/service.ts`
- Create: `apps/server/test/workbench-document-service.test.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Write the failing test**

测试空文档创建；`outline` 仅可自动保存空标题；实质 `propose` 不改正式文档；`acceptProposal` 原子写入“观点 + 流程图绑定”；未知绑定、非法模块和版本冲突失败；成功写入发布 `workbench-document.changed`。

```ts
const proposal = await service.propose(id, version, proposalWithTextAndFlowchart());
expect((await service.get(id)).cards).toEqual([]);
await service.acceptProposal(id, proposal.id);
expect((await service.get(id)).cards.map(card => card.type)).toEqual(["rich_text", "flowchart"]);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server test -- workbench-document-service.test.ts`

Expected: FAIL。

**Step 3: Write minimal implementation**

服务只处理结构化 `insert`、`update`、`move`、`remove`、`bind` 操作。`outline` 只允许空 `heading`，立即保存；不能借此写正文或组件。`propose` 保存用户可读 `summary` 与操作到待确认存储；`acceptProposal` 重新检查版本、目标、模块和绑定实体，然后一次应用全部操作。`rejectProposal` 不建版本。

以窄接口注入 FlowchartsRepo 和脑图查询能力，避免服务依赖 React 或路由。装配 SQLite/PostgreSQL 仓储，并向 SSE 发布独立事件。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server test -- workbench-document-service.test.ts && pnpm --filter @ke/server typecheck`

Expected: PASS。

**Step 5: Commit**

```bash
git add apps/server/src/workbench-document/schema.ts apps/server/src/workbench-document/service.ts apps/server/src/index.ts apps/server/test/workbench-document-service.test.ts
git commit -m "feat: add controlled workbench document updates"
```

### Task 4: 暴露 REST、MCP 与 CLI 边界

**Files:**

- Create: `apps/server/src/routes/workbenchDocuments.ts`
- Create: `apps/server/src/mcp-v2/resources/workbenchDocumentTools.ts`
- Create: `apps/server/test/workbench-document-routes.test.ts`
- Create: `apps/server/test/workbench-document-mcp.test.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/mcp-v2/server.ts`
- Modify: `scripts/rich-cli.mjs`

**Step 1: Write the failing tests**

覆盖 `GET/POST /api/workbench-documents`、文档读取/历史、`outline`、`proposals`、接受提议、`manual-save` 与拒绝提议。MCP 测试必须证明 Agent 只可 `list/get/modules/outline/propose`，不能接受提议或伪造用户确认。

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ke/server test -- workbench-document-routes.test.ts workbench-document-mcp.test.ts`

Expected: FAIL。

**Step 3: Write minimal implementation**

注册 `rich_workbench_document`，复用现有 `executeSafeWrite`、幂等 requestId 与操作审计。CLI 增加：

```text
workbench-document list
workbench-document get <documentId>
workbench-document modules
workbench-document outline <documentId> --file outline.json
workbench-document propose <documentId> --file proposal.json
```

CLI/MCP 均调用 REST/服务层，绝不直连数据库。`acceptProposal` 和 `manual-save` 只由 Rich UI 调用；所有更新均需当前 `expectedVersion`。

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ke/server test -- workbench-document-routes.test.ts workbench-document-mcp.test.ts && pnpm --filter @ke/server typecheck`

Expected: PASS。

**Step 5: Commit**

```bash
git add apps/server/src/routes/workbenchDocuments.ts apps/server/src/mcp-v2/resources/workbenchDocumentTools.ts apps/server/src/index.ts apps/server/src/mcp-v2/server.ts scripts/rich-cli.mjs apps/server/test/workbench-document-routes.test.ts apps/server/test/workbench-document-mcp.test.ts
git commit -m "feat: expose workbench document api and mcp"
```

### Task 5: 注册独立应用与文档流草稿编辑器

**Files:**

- Create: `apps/web/src/views/WorkbenchDocumentView.tsx`
- Create: `apps/web/src/components/collaborative-workspace/CollaborativeWorkspaceShell.tsx`
- Create: `apps/web/src/components/collaborative-workspace/InformationWorkspaceShell.tsx`
- Create: `apps/web/src/views/workbench-document/api.ts`
- Create: `apps/web/src/views/workbench-document/DocumentCanvas.tsx`
- Create: `apps/web/src/components/collaborative-workspace/WorkspaceLocator.tsx`
- Create: `apps/web/src/views/workbench-document/documentDraft.ts`
- Create: `apps/web/src/views/workbench-document/documentTree.ts`
- Create: `apps/web/src/views/workbench-document/WorkbenchDocumentView.css`
- Create: `apps/web/src/views/workbench-document/documentTree.test.ts`
- Create: `apps/web/src/views/workbench-document/DocumentCanvas.test.tsx`
- Create: `apps/web/src/components/codex-conversation/`（从现有对话界面抽取的通用受控组件）
- Create: `apps/web/src/components/codex-conversation/CodexConversationPanel.test.tsx`
- Create: `apps/web/src/components/codex-conversation/ConversationMessageRenderer.tsx`
- Create: `apps/web/src/components/codex-conversation/conversationBlocks.ts`
- Create: `apps/web/src/components/codex-conversation/ConversationMessageRenderer.test.tsx`
- Modify: `apps/web/src/state/store.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/appCatalog.ts`
- Modify: `apps/web/src/views/AppLauncherView.tsx`
- Modify: `apps/web/src/api/client.ts`

**Step 1: Write failing tests**

测试应用中心有 `workbenchDocument` 且旧 `taskWorkbench` 仍存在；`CollaborativeWorkspaceShell` 始终只渲染左信息壳和右对话壳；`InformationWorkspaceShell` 在没有业务导航器时不保留空栏、在传入业务导航器和内容快速定位器时按内部插槽渲染；大纲编号/折叠/移动；手工编辑只产生本地 dirty draft，整份保存才调用 API，放弃恢复正式版本。

```ts
const changed = editCard(startDraft(saved), "idea", { content: richText("修改") });
expect(changed.dirty).toBe(true);
expect(discardDraft(changed).document).toEqual(saved);
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ke/web test -- documentTree.test.ts DocumentCanvas.test.tsx`

Expected: FAIL。

**Step 3: Write minimal implementation**

先实现 `CollaborativeWorkspaceShell`：它只提供必需的左信息壳和右对话壳，并负责两栏宽度、窄屏对话抽屉、独立滚动与焦点管理。`InformationWorkspaceShell` 再提供可选 `navigator`、可选 `contentLocator` 和必需 `main` 插槽。不要让任一壳拥有卡片或节点状态。新增 AppView 和 App Launcher 条目，不替换“任务”。空状态不生成模板。工作台文档传入 `navigator = null`，左信息壳内部为可收起的内容快速定位器 + 文档流，右侧为会话壳。快速定位器只根据当前内容树显示编号、标题、折叠与当前阅读位置，点击滚动定位对应正文；它不是应用菜单或跨应用导航。未来知识库才会向左信息壳传入节点导航器，并同时使用当前节点详情的内容快速定位器。使用已有 TipTap 依赖编辑标题、富文本和清单；禁止 `dangerouslySetInnerHTML` 和任意 HTML 作为模型。普通内容块无边框，悬停显示拖拽与操作；组件块由下一任务渲染边框。

先审计现有 Rich 控件和主题变量，再以它们为唯一视觉来源：不得为新应用另造按钮、输入框、菜单、消息气泡、加载/错误提示的样式体系。将可跨页面复用的受控会话面板、消息列表、输入/附件区与状态提示放入 `apps/web/src/components/codex-conversation/`；原有会话入口和新右栏后续都改为组合这些组件。为通用组件补充键盘、禁用、加载、错误和窄屏测试。

为 `CodexConversationPanel` 补充受控外观 API（`tone`、`density`、`accent`）及 `header`、`composer`、`sidebarActions` 插槽测试：验证它们只改变 token 驱动的外观或预留区域，不改变消息、流式、附件和错误处理的统一行为。颜色必须从 Rich token 调色板选择，不能由业务页面传入任意十六进制值。

将消息内容抽为 `ConversationMessageRenderer` 和判别联合的 `ConversationBlock`：至少覆盖文本/Markdown、附件、工具活动、状态/错误、提议确认卡、表格、图片和功能组件预览。测试流式文本追加、工具从运行到成功/失败的视觉状态、等待确认卡的动作、折叠详情、键盘焦点和 live region；确保业务领域块只能通过受控注册表传入数据与回调，不能注入任意 HTML 或覆盖基础消息样式。

本地 `documentDraft` 是唯一手工编辑状态。顶部提供“保存工作台”“放弃修改”，无单卡保存。收到 `workbench-document.changed` 且服务端版本更新时，直接丢弃本地草稿、重新载入正式文档并显示短提示，不做合并或确认弹窗。

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ke/web test -- documentTree.test.ts DocumentCanvas.test.tsx && pnpm --filter @ke/web build`

Expected: PASS。

**Step 5: Commit**

```bash
git add apps/web/src/views/WorkbenchDocumentView.tsx apps/web/src/components/collaborative-workspace apps/web/src/views/workbench-document apps/web/src/state/store.ts apps/web/src/App.tsx apps/web/src/lib/appCatalog.ts apps/web/src/views/AppLauncherView.tsx apps/web/src/api/client.ts
git commit -m "feat: add workbench document application"
```

### Task 6: 组件卡片、右侧 Rich 会话与最终验收

**Files:**

- Create: `apps/web/src/views/workbench-document/cards/ModuleCard.tsx`
- Create: `apps/web/src/views/workbench-document/cards/FlowchartCard.tsx`
- Create: `apps/web/src/views/workbench-document/cards/MindmapCard.tsx`
- Create: `apps/web/src/views/workbench-document/cards/EmbedCard.tsx`
- Create: `apps/web/src/views/workbench-document/cards/ComponentCard.css`
- Create: `apps/web/src/views/workbench-document/WorkbenchConversationPanel.tsx`
- Create: `apps/web/src/views/workbench-document/ProposalNotice.tsx`
- Create: `apps/web/src/views/workbench-document/ComponentCard.test.tsx`
- Create: `apps/web/src/views/workbench-document/WorkbenchConversationPanel.test.tsx`
- Create: `apps/web/src/views/workbench-document/WorkbenchDocumentView.visual.test.tsx`
- Create: `apps/server/test/workbench-document.e2e.test.ts`
- Modify: `apps/web/src/views/workbench-document/DocumentCanvas.tsx`
- Modify: `apps/web/src/views/WorkbenchDocumentView.tsx`
- Modify: `apps/web/src/views/FlowchartsView.tsx`
- Modify: `apps/web/src/views/MindmapView.tsx`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx`
- Modify: `apps/server/src/ai/prompts/chatSystem.ts`
- Modify: `docs/TASK_WORKBENCH.md`

**Step 1: Write failing tests**

测试问题清单有带边框模块；流程图卡读取绑定实体、只读预览并能跳转既有流程图应用；失效绑定显示“不可用”但不删除卡片；右栏只显示 proposal 的简短意图，接受后刷新卡片树，拒绝不改文档。

端到端测试：创建空文档 → 自动两级标题 → 提议“观点 + 流程图” → 用户接受 → 用户编辑未保存 → 新 AI 写入覆盖草稿 → 历史最多 3 条。

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ke/web test -- ComponentCard.test.tsx WorkbenchConversationPanel.test.tsx && pnpm --filter @ke/server test -- workbench-document.e2e.test.ts`

Expected: FAIL。

**Step 3: Write minimal implementation**

`ModuleCard` 渲染 `question_list` 的固定列、行与状态，所有手工编辑进入工作台草稿。流程图卡只读加载 `/api/flowcharts/:id`，提供“打开编辑器”并切入现有 `flowcharts` 视图/焦点；脑图同理复用现有查询与打开能力，绝不复制专业数据。图片、文件、链接以带边框最小嵌入卡展示。

右栏复用 Task 5 抽取的 Rich 通用会话组件、现有 Deliverable Codex 会话通道和附件能力；若现有组件只能浮层，原入口也改为使用共享内容组件，禁止复制聊天协议或视觉样式。`ProposalNotice` 只负责工作台业务回调，视觉上使用通用卡片、按钮和状态组件。更新 `chatSystem.ts`：session 先读正式文档与模块目录；空骨架使用 `outline`；所有实质更新使用 `propose`，禁止伪造用户确认或直写数据。

补充视觉回归测试：验证普通文本块无组件边框、流程图/表格等组件块有容器；工作台按钮、输入、确认卡、空状态与现有 Rich token/class 组合一致。人工验收必须在目标桌面宽度与窄屏宽度下检查排版、按钮密度、层级、滚动及所有 hover/focus/disabled/loading 状态。

更新 `docs/TASK_WORKBENCH.md`，明确“任务工作台”与“工作台文档”是两个应用，并写明统一手工保存、AI 更新优先和三版本限制。

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @ke/domain test
pnpm --filter @ke/server test
pnpm --filter @ke/web test
pnpm --filter @ke/server typecheck
pnpm --filter @ke/web build
git diff --check
```

Expected: 全部 PASS，`git diff --check` 无输出。

**Step 5: Manual acceptance**

在本地 Rich 中确认：新旧两个应用并存；新文档无模板；正文块轻量无边框、组件块有边框；右栏可接受“观点 + 流程图”更新；流程图编辑后预览更新；未保存手工草稿会被 AI 正式写入覆盖；历史不超过 3 个版本。另在桌面与窄屏逐项检查页面层级、排版、按钮、空/错/加载状态、键盘焦点和对话组件风格均与 Rich 一致。

**Step 6: Commit**

```bash
git add apps/web/src/views/workbench-document apps/web/src/views/WorkbenchDocumentView.tsx apps/web/src/views/FlowchartsView.tsx apps/web/src/views/MindmapView.tsx apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx apps/server/src/ai/prompts/chatSystem.ts apps/server/test/workbench-document.e2e.test.ts docs/TASK_WORKBENCH.md
git commit -m "feat: complete workbench document application"
```

# Task Workbench Implementation Plan

按步骤实施并记录验证证据。

**Goal:** 实现绑定 Codex 对话、以计划为主线的通用任务工作台，保存需求、步骤及成果并通过 MCP/CLI 更新。

**Architecture:** 独立任务聚合与版本历史，SQLite/PostgreSQL CAS 写入；REST、MCP、CLI 共用服务。复用现有 Codex 对话运行时和窗口；工作台只读展示与明确操作按钮，不增加聊天编辑器。当前工作区存在大量用户未提交改动，因此只增量接入并保留它们，不通过干净 worktree 丢掉最新会话能力。

**Tech Stack:** TypeScript, React, Hono, Zod, better-sqlite3, pg, Vitest。

---

### 1. 需求与模型
- 文档：本计划与 `2026-09-05-task-workbench-prd.md`。
- 新增 `packages/domain/src/types/workbench.ts`，定义任务、步骤、记录、资源和指令。
- 明确任务模式自动适配，通用回退；Mapping 专用同步后续接入。

### 2. 存储和业务规则
- 新增 `apps/server/src/task-workbench/{schema.ts,repository.ts,service.ts}`。
- 数据库初始化新增任务及版本表；新增 SQLite/PostgreSQL repository。
- 写测试覆盖重启读取、原子版本变更、旧版本拒绝、循环父子关系、完成依据、确认失效。
- 运行：`pnpm --filter @ke/server exec vitest run test/task-workbench.test.ts`。

### 3. 对话绑定与指令
- 新增 `apps/server/src/task-workbench/commands.ts`、`routes/taskWorkbench.ts`。
- 校验 active 对话，按绑定对话向 AgentConversationService 发送真实提示词；持久化指令状态。
- 通用 Codex 上下文不依赖交付物；任务模式启动指令提供当前对话 ID 和工具契约。
- 测试：指令预览/执行范围、忙碌/失效会话、去重、失败不伪造完成。

### 4. MCP 和 CLI
- 新增 `mcp-v2/resources/workbenchTools.ts`，向 registry 注入可用 service；独立工具避免混淆现有 AI 执行任务。
- CLI 增加 workbench list/get/create/update/plan/step/record/resource。
- 写回必须携带预期版本；调用后回读并发出变化事件。
- 测试 MCP 实际调用及 CLI 请求映射。

### 5. 页面及聊天入口
- 新增 `apps/web/src/views/task-workbench/{TaskWorkbench.tsx,TaskWorkbench.css}`。
- 原 practice 页面增加历史入口；导航显示“任务工作台”。
- 扩展 Codex launcher 显式打开指定会话；任务模式任意页面可用；原交付物模式保留。
- 页面显示真实任务、需求和计划确认、层级步骤、记录、材料和产物、命令状态与历史。
- 沿用确认的三栏视觉，步骤详情无输入框。执行、细化、优化都走指令 API。

### 6. 验证与交付
- 运行 server/web/domain 类型检查与受影响的 Vitest；浏览器验证列表/详情/历史/错误态和布局。
- 不用真实 AI 代替可重复的测试，不向用户真实对话发送测试提示词。
- 如构建阻塞来自原有工作区问题，区分记录，不能覆盖无关改动。
- 更新本计划的实际完成记录与限制；按用户本地偏好构建并更新 `/Applications/Rich.app`，不保留备份应用。

## 实施记录

- 播放与自动跟随已实现：顶部播放键，右侧步骤记录/材料与成果页签；后台逐步执行、前置条件阻塞停止、无完成写回停止、错误停止、子步骤完成汇总、最终交付核验。运行时转发真实命令/文件/工具活动，保存指令日志与当前步骤。43 项相关服务及运行时测试、工作区类型检查通过；隔离浏览器验证第一步到第二步自动跟随、停止后保持焦点及页签切换。已更新 Rich 并验证播放键和默认记录页签，未启动用户真实任务。

- 步骤确认项已实现：选择/文本答案、前置与执行中分类、父步骤条件继承、条件未满足时执行拦截、问题变更清除答复、关键答案变更重审。MCP/CLI 支持 checkpoint/answer；页面新增梳理按钮。18 项相关服务测试及工作区类型检查通过，隔离浏览器验证选择、文本保存及否定答案不放行；已更新 Rich 并验证真实步骤确认区。未向真实任务写入测试确认项或替用户作答。

- 材料扩展：新增 file/link/information 形式与文字内容，兼容已有资源；更新 MCP、任务提示与界面。支持展开信息、复制引用和打开已有本地文件/目录，取消页面下载操作。相关 16 项测试通过、工作区类型检查通过。已打包更新桌面版，实际点击报告引用后在 Sublime Text 打开原始路径，未生成下载副本。

- 2026-09-05：PRD 与实施计划建立，开始实现。
- 已完成 1–5：任务模型与双存储适配、版本校验和历史、对话绑定与指令回执、MCP/CLI 写回、任务页面和历史入口。
- 服务端相关 6 个测试文件共 20 项通过；Codex 前端相关 22 项通过；整个工作区类型检查通过。Electron 测试线程池曾异常退出，改用 forks 单进程后完整通过。
- 浏览器使用独立临时 SQLite 和模拟 Codex 验证三栏详情、子计划、进展记录、版本记录、指令回写、绑定对话与无中心聊天输入框；CLI 读取与写入也已在该隔离服务验证。测试数据没有写入用户数据库，临时页面和服务脚本已移除。
- 首版按通用任务范围实施。真实 Codex 完整交付、PostgreSQL 实库和 Mapping 专用字典同步尚未验收；后者不属于本次已完成能力。
- 使用与工具说明：`docs/TASK_WORKBENCH.md`。
- 桌面版已构建、更新并重启 `/Applications/Rich.app`；安装前确认没有正在执行的 Codex 回合。安装包与目标 app.asar SHA-256 一致，重启后真实服务 `/api/workbench` 返回空任务列表，未混入测试数据。已删除生成的重复 `.app`，保留唯一安装应用。
- 原生桌面 UI 已验证：⌘7 打开任务工作台，显示真实空状态、「旧应用开发」与「在 Codex 中发起任务」入口。

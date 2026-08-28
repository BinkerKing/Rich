# Rich 系统学习手册

这份手册写给 Hermes / Codex / 其他 Agent。目标是让 Agent 知道 Rich 的页面、场景、数据入口、CLI 与 MCP 工具，避免只聊天不落库。

## 使用原则

1. 先判断任务属于哪个页面模块。
2. 不熟悉模块时，先调用 `get_rich_system_manual` 读取本手册。
3. 涉及 Rich 数据变更时，优先使用 MCP / API / CLI，不要只给文字建议。
4. 表达风格先查 AI 语料模板：`corpus_list` → `corpus_prompt`。
5. 不确定结构时先读：`get_element` / `get_subtree` / `practice_get` / `plan_get`。
6. 发现 Rich 缺能力时，用 `create_improvement` 记录系统改造任务。
7. 对应 Rich 按钮的操作，先查 `docs/RICH_CLI_COVERAGE.md`。按钮只要涉及后端数据、AI 生成、上传、工具调用或删除，都必须能通过 MCP / CLI 执行；纯 UI 展开、筛选、弹窗开关不需要 CLI。
8. AI 调用先看场景。Rich 使用统一 AI 场景路由，配置在环境变量 `RICH_AI_<SCENARIO>_MODEL`，状态在 `/api/admin/engine`。不要假设所有能力都走 Hermes 或 Codex。
9. Rich 聊天上下文由服务端负责。Agent 不要依赖浏览器临时消息作为唯一上下文；长对话会被压缩成摘要并随最近消息一起注入模型。
10. 非聊天 AI 操作必须把项目、元素、计划、手册、Mapping 规则等上下文显式传入。不要因为用户曾经聊过某件事，就假设当前接口自动知道。

## 模块索引

| 页面 | 场景 | 手册 | CLI / MCP |
| --- | --- | --- | --- |
| 首页 / 全局输入框 | 用户直接下达任务、查询状态、触发动作 | 判断是聊天、数据操作还是自动化；涉及落库时用工具 | `get_rich_system_manual`; `pnpm rich -- chat stream --json ...`; `pnpm corpus list <场景>`; `corpus_prompt`; `corpus_upsert` |
| 知识树 | 管理概念、主题、关系、学习路径 | 先读上下文；新增用元素和关系；列表块不要用 `style=list` | `list_topics`; `get_element`; `get_subtree`; `create_element`; `update_element`; `refine`; `expand`; CLI: `pnpm rich -- elements ...` |
| AI 早报 | 生成 AI 新闻、补热门 Skill、沉淀应用建议 | 信息汇报类先套 `information-briefing`；推荐块用 `dot-list` 或 `markdown` | `pnpm corpus prompt information-briefing`; `update_section_blocks`; `pnpm rich -- ai news-generate-daily --json ...` |
| 导图 PPT | 文稿转导图、管理 PPT 展示图 | PPT 是 element-backed；不要另建孤立数据 | `pnpm rich -- mindmaps list`; `pnpm rich -- mindmaps attach --json ...`; `get_subtree` |
| 计划管理 | 目标拆解、每日任务、周复盘、推进建议、批量清理 | 先看计划状态；完成任务用 `task_complete`；新目标用 `plan_decompose`；后台维护或服务离线时用计划管理 CLI | MCP: `plan_list`; `plan_get`; `task_list`; `task_complete`; `plan_decompose`; `analyze_progress`。CLI: `pnpm --filter @ke/server run plan -- ...` |
| 项目管理 | 数据字典、作业流程、场景手册、环境配置、部署步骤、监控预警、代码版本、项目代办、文件夹 | 先读 `docs/PROJECT_MANAGEMENT_MCP_MANUAL.md`；数据字典 / Mapping 再读 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md`；Mapping 必须按场景 title、口径、字段 Mapping 表、涉及字段、逻辑维护 | MCP: `project_management_summary`; `project_management_search`; `project_management_list_items`; `project_management_create_item`; `project_management_update_item`; `project_management_delete_item`; `project_management_reorder_items`; `project_todo_summary`; `project_todo_list`; `project_todo_get`; `project_todo_create`; `project_todo_update`; `project_todo_delete`; `project_dictionary_search_fields`; `project_dictionary_get_field`; `project_dictionary_resolve_field_refs`; `project_dictionary_create_rectification` |
| 项目实战 | 实战项目、PRD、开发任务、整改建议 | practice → group → typed children；新增子项优先传 group id | `practice_list`; `practice_get`; `practice_create`; `practice_add_child`; `draft_prd`; `draft_child`; CLI `pnpm rich -- ai guided-practice --json ...` |
| 工具箱 | 锁屏、延迟执行、小工具调用 | 先列工具 schema，再调用 | `list_toolbox_tools`; `invoke_toolbox_tool`; `pnpm rich -- toolbox ...` |
| 后台 | 语料、学习手册、系统改造任务 | 语料解决“怎么说”，学习手册解决“怎么用 Rich” | `get_rich_system_manual`; `pnpm corpus ...`; `pnpm rich -- improvements ...`; `create_improvement`; `claim_improvement`; `update_improvement` |

## AI 引擎与模型路由

Rich 的 AI 入口按场景选择模型。后台 AI 引擎监控可以直接切换场景模型，设置会落到 `data/ai-engine-settings.json`；密钥仍只允许在环境变量或 `~/.rich-ai.env`。

| 场景 | 默认模型 | 用途 |
| --- | --- | --- |
| `chat` | `hermes` | 首页聊天、快捷聊天，已支持服务端上下文落库 |
| `agent-task` | `hermes` | 需要操作 Rich、调用 MCP、执行多步骤任务 |
| `content` | `hermes` | AI 早报、汇报、文案和结构化内容产出 |
| `analysis` | `hermes` | 进度分析、信息分析、数据分析 |
| `document` | `hermes` | 文档理解、摘要和材料整理 |
| `coding` | `codex` | 代码分析、实现、调试 |
| `mindmap` / `image` | `codex` | 导图生成和图片生成队列 |

可以通过环境变量覆盖：

```bash
RICH_AI_CHAT_MODEL=bailian
RICH_AI_ANALYSIS_MODEL=bailian
RICH_AI_CODING_MODEL=codex
```

百炼 / DashScope 这类 OpenAI 兼容模型只允许通过本机环境变量配置密钥，例如 `~/.rich-ai.env`。不要把 API Key、Token Plan 命令或任何密钥写入 Git、手册、PRD、任务描述或聊天历史。

### 聊天上下文

首页聊天和快捷聊天使用同一个服务端上下文层：

- 原始消息落在 `chat_conversations` / `chat_messages`。
- 长期上下文摘要落在 `chat_conversation_summaries`，这是派生数据，不替代原始消息。
- 每次模型调用会组合“长期摘要 + 最近消息 + 当前输入”。
- 摘要刷新使用 `analysis` 场景路由，因此可以切到 Hermes、Bailian 或未来其他模型。

Agent 执行跨轮任务时，应优先读取聊天历史或调用相关 Rich 数据接口确认状态，不要把一次模型响应当作完整事实来源。

### 结构化 AI 操作上下文

`/api/ai/*` 这类接口不是普通聊天。Rich 会给每个结构化 AI 操作补一段统一上下文，说明当前 operation、scenario、事实来源和输出约束。

Agent 规则：

- 需要操作 Rich 数据时，先读对应数据，再把数据放入接口请求。
- 需要风格模板时，先读 `corpus_prompt`，把模板作为上下文传入。
- 需要项目管理 Mapping 规则时，先读 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md`。
- 如果上下文不足，返回待确认问题或创建系统改造任务，不要凭空补齐。

## 统一 Rich CLI

`pnpm rich -- ...` 是所有后端按钮操作的统一 CLI 入口。语义命令覆盖常用按钮，`api` / `sse` 是兜底：

```bash
pnpm rich -- health
pnpm rich -- elements list
pnpm rich -- elements patch <id> --json '{"title":"新标题"}'
pnpm rich -- mindmaps retry-cover <elementId> --json '{"deckRootId":"<deckRootId>","hint":"更科技感"}'
pnpm rich -- toolbox invoke --json '{"tool":"lock_screen","args":{}}'
pnpm rich -- api GET /api/admin/engine
pnpm rich -- sse POST /api/ai/expand --json '{"elementId":"<id>","count":3}'
```

按钮覆盖表：`docs/RICH_CLI_COVERAGE.md`。

## 语料模板

```bash
pnpm corpus list
pnpm corpus get system-status-report
pnpm corpus prompt system-status-report
pnpm corpus patch system-status-report --field styleGuide --value "先给结论，再给风险，最后给下一步动作。"
```

Hermes 收到用户对表达方式的反馈时，应更新语料模板，而不是只在当前对话里临时改。

## 项目管理 MCP / 数据字典 / Mapping

处理项目管理里的作业流程、场景手册、环境配置、部署步骤、监控预警、代码版本、项目代办、文件夹时，优先使用 `project_management_*` MCP 工具。完整工具说明见 `docs/PROJECT_MANAGEMENT_MCP_MANUAL.md`。

处理数据字典、字段设计、Mapping 场景、码值说明、字段血缘前，必须先读 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md`。这份文档是用户正在沉淀的 Mapping 模版规则，后续用户提出的新要求应先写入该手册，再决定是否固化成 UI、数据库结构或 CLI。

## 计划管理 CLI

计划管理数据来自 GreatMe state 的 `plans/goals/tasks`。Agent 需要批量查询、清理 seed/demo 脏数据、或 MCP 服务不可用时，使用服务端 CLI，不要临时拼 SQL。

```bash
pnpm --filter @ke/server run plan -- list plans --status all --json
pnpm --filter @ke/server run plan -- list year --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list month --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list week --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list day --date today --json

pnpm --filter @ke/server run plan -- create plan --title "我的计划" --start 2026-05-25 --end 2026-08-25
pnpm --filter @ke/server run plan -- create month --plan-id <planId> --title "五月目标" --due 2026-05-31
pnpm --filter @ke/server run plan -- create day --goal-id <goalId> --title "今天行动" --date 2026-05-25
pnpm --filter @ke/server run plan -- update day --id <taskId> --done true

pnpm --filter @ke/server run plan -- delete plan --id <planId> --yes
pnpm --filter @ke/server run plan -- clear all --yes --json
```

破坏性清理前必须备份完整 GreatMe blob。清理脏计划只动 `plans/goals/tasks`，保留 profile、events、daily、reviews 等非计划数据。Postgres 模式下必须通过 `KE_STORAGE=postgres` 和运行环境里的数据库变量连接当前真实后端。

## 常见决策

- 用户说“帮我做一个计划”：用 `plan_decompose`。
- 用户说“我做完了 X”：用 `task_complete`。
- 用户说“给这个项目补 PRD”：用 `practice_get` 后再 `draft_prd`。
- 用户说“新建项目 / 只有一个想法 / 帮我明确需求”：先走引导式立项。每一轮用 Hermes 分析：
  `pnpm rich -- ai guided-practice --json '{"stage":"goal","userInput":"...","draft":{},"messages":[],"model":"hermes"}'`。
  Hermes 返回 `reply / draftPatch / nextStage / openQuestions` 后，必须保留完整对话；最终创建 practice、PRD v1.0、执行计划 v1.0，并将任务绑定 `prdVersion` / `planVersion`。
- 用户说“AI 早报里加热门 Skill”：读早报元素，使用 `dot-list` 或 `markdown` 更新 section。
- 用户说“以后都这样说”：用 `corpus_upsert` 或 `pnpm corpus patch`。

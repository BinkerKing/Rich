# Rich 系统学习手册

这份手册写给 Hermes / Codex / 其他 Agent。目标是让 Agent 知道 Rich 的页面、场景、数据入口、CLI 与 MCP 工具，避免只聊天不落库。

## 使用原则

1. 先判断任务属于哪个页面模块。
2. 不熟悉模块时，先调用 `get_rich_system_manual` 读取本手册。
3. 涉及 Rich 数据变更时，优先使用 MCP / API / CLI，不要只给文字建议。
4. 表达风格先查 AI 语料模板：`corpus_list` → `corpus_prompt`。
5. 不确定结构时先读：`get_element` / `get_subtree` / `practice_get` / `plan_get`。
6. 发现 Rich 缺能力时，用 `create_improvement` 记录系统改造任务。

## 模块索引

| 页面 | 场景 | 手册 | CLI / MCP |
| --- | --- | --- | --- |
| 首页 / 全局输入框 | 用户直接下达任务、查询状态、触发动作 | 判断是聊天、数据操作还是自动化；涉及落库时用工具 | `get_rich_system_manual`; `pnpm corpus list <场景>`; `corpus_prompt`; `corpus_upsert` |
| 知识树 | 管理概念、主题、关系、学习路径 | 先读上下文；新增用元素和关系；列表块不要用 `style=list` | `list_topics`; `get_element`; `get_subtree`; `create_element`; `update_element`; `refine`; `expand` |
| AI 早报 | 生成 AI 新闻、补热门 Skill、沉淀应用建议 | 信息汇报类先套 `information-briefing`；推荐块用 `dot-list` 或 `markdown` | `pnpm corpus prompt information-briefing`; `update_section_blocks` |
| 导图 PPT | 文稿转导图、管理 PPT 展示图 | PPT 是 element-backed；不要另建孤立数据 | `GET /api/mindmaps`; `POST /api/mindmaps/attach`; `get_subtree` |
| 计划管理 | 目标拆解、每日任务、周复盘、推进建议 | 先看计划状态；完成任务用 `task_mark_done`；新目标用 `plan_decompose` | `plan_list`; `plan_get`; `task_list`; `task_mark_done`; `plan_decompose`; `analyze_progress` |
| 项目实战 | 实战项目、PRD、开发任务、整改建议 | practice → group → typed children；新增子项优先传 group id | `practice_list`; `practice_get`; `practice_create`; `practice_add_child`; `draft_prd`; `draft_child` |
| 工具箱 | 锁屏、延迟执行、小工具调用 | 先列工具 schema，再调用 | `list_toolbox_tools`; `invoke_toolbox_tool` |
| 后台 | 语料、学习手册、系统改造任务 | 语料解决“怎么说”，学习手册解决“怎么用 Rich” | `get_rich_system_manual`; `pnpm corpus ...`; `create_improvement`; `claim_improvement`; `update_improvement` |

## 语料模板

```bash
pnpm corpus list
pnpm corpus get system-status-report
pnpm corpus prompt system-status-report
pnpm corpus patch system-status-report --field styleGuide --value "先给结论，再给风险，最后给下一步动作。"
```

Hermes 收到用户对表达方式的反馈时，应更新语料模板，而不是只在当前对话里临时改。

## 常见决策

- 用户说“帮我做一个计划”：用 `plan_decompose`。
- 用户说“我做完了 X”：用 `task_mark_done`。
- 用户说“给这个项目补 PRD”：用 `practice_get` 后再 `draft_prd`。
- 用户说“AI 早报里加热门 Skill”：读早报元素，使用 `dot-list` 或 `markdown` 更新 section。
- 用户说“以后都这样说”：用 `corpus_upsert` 或 `pnpm corpus patch`。

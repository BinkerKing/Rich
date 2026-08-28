# Rich CLI 与 MCP 2.0 覆盖边界

Rich 的可操作入口分两层：

| 入口 | 面向对象 | 作用 |
| --- | --- | --- |
| MCP 2.0 `/mcp` | Hermes、Codex 等模型 | 提供少量场景化工具、参数校验、写安全、任务跟踪和统一结果 |
| Rich CLI | 人、shell、定时脚本、外部 Agent | 调用 Rich HTTP/SSE、上传文件、执行离线维护和未纳入 MCP 的细粒度操作 |

MCP 不是 CLI 的包装清单，也不追求把每个按钮或 API 都变成模型工具。完整 MCP 工具见 `docs/RICH_MCP_V2_CATALOG.md`。

## MCP 2.0 覆盖

- 全局检索和概览：`rich_context_search`、`rich_context_get_overview`
- 对话信息沉淀：`rich_knowledge_capture`、`rich_project_organize_conversation`
- 精确资源管理：knowledge、project、dictionary、planning、practice、automation 六个 `rich_*_manage`
- 分析规划：`rich_project_analyze_and_plan`
- Agent 工作账本：`rich_work_delegate`、`rich_work_get_status`、`rich_work_list`、`rich_work_cancel`
- 验收与经验：`rich_work_review_result`、`rich_learning_capture`

## CLI 覆盖

统一在线入口：

```bash
pnpm rich -- health
pnpm rich -- api <METHOD> /api/<path> --json '{"body":"when needed"}'
pnpm rich -- sse POST /api/<stream-path> --json '{"body":"when needed"}'
pnpm rich -- upload /api/<path> --file <path>
```

主要语义命令：

| 区域 | CLI 示例 |
| --- | --- |
| 聊天与历史 | `pnpm rich -- chat stream --json ...`；`pnpm rich -- api GET /api/chat/conversations` |
| 知识元素 | `pnpm rich -- elements list|get|create|patch|delete ...` |
| 关系与排序 | `pnpm rich -- elements move ...`；`pnpm rich -- relations reorder ...` |
| 导图 | `pnpm rich -- mindmaps list|get|attach|generate|retry-cover ...` |
| AI 操作 | `pnpm rich -- ai refine|expand|news-generate-daily|guided-practice ...` |
| 附件 | `pnpm rich -- chat-attachments upload ...`；`pnpm rich -- attachments upload ...` |
| 工具箱 | `pnpm rich -- toolbox tools|invoke|cancel ...` |
| 后台 | `pnpm rich -- admin engine|ops|signals|manuals` |
| 语料 | `pnpm corpus ...` 或 `pnpm rich -- corpus ...` |
| 系统改进 | `pnpm rich -- improvements ...` |
| 离线计划 | `pnpm --filter @ke/server run plan -- ...` |

## 选择规则

1. 对话中的知识、项目、规划、委派和验收优先使用 MCP 2.0。
2. shell 自动化、上传、SSE、离线维护和 MCP 未覆盖的精细业务操作使用 CLI。
3. 新增后端按钮即使尚无语义命令，也必须能通过通用 `api`/`sse`/`upload` CLI 操作。
4. 纯 UI 行为不需要 CLI：切换标签、开关弹窗、筛选、滚动、预览和保存前的本地编辑。
5. 写入后必须读取验证；CLI 和 MCP 都遵守同一规则。

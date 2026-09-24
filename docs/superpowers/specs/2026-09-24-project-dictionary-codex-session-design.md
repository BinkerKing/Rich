# 项目数据字典 Codex Session 设计

## 目标

为每个项目的数据字典绑定一个长期可复用的 Codex Session；入口位于数据字典左侧树顶部。旧绑定会话归档后，下一次打开必须创建新的 Session。

## 边界

数据字典是独立资源域，不复用交付物或流程图的会话路由、持久化表、仓储接口或上下文服务。仅复用通用的聊天记录、Codex 运行时和会话抽屉 UI。

## 数据与接口

新增 `project_dictionary_codex_conversations`，一行对应一个数据字典会话，含项目 ID、Rich conversation ID、Codex thread ID、状态、绑定标记与时间戳。数据库约束保证同一项目至多一个 `active + is_bound` 绑定。

新增独立路由 `/api/project-dictionary-codex/:projectId/conversations`：

- `GET` 列出该项目的活跃字典会话。
- `POST /ensure-bound` 复用活跃绑定；无绑定或绑定已归档时，新建 Rich 对话和全新的 Codex Session。
- `POST /archive-bound` 归档当前绑定并停止其运行时。

会话标题固定为 `<项目名称> · 数据字典 · Codex`，由服务端读取项目标题生成，前端不提交标题。

## Codex 上下文

上下文 scope 为 `dictionary:<projectId>`，只提供项目 ID 与“先使用 `rich_dictionary_manage` 读取最新字典数据”的操作约束。允许的 MCP 工具为 `rich_dictionary_manage`、`rich_project_files_get` 与 `rich_project_file_read`。不会读取交付物、流程图或单张表的固定快照。

## 前端

数据字典树顶部增加无背景的对话框图标。点击后调用专用 ensure API，并把返回的会话 ID 交给现有会话抽屉。抽屉增加 `dictionary` 资源类型，使用字典专用列表路由与“项目数据字典”位置文案；只提供通用任务模式。

## 验收

1. 第一次点击为项目创建名为“项目名 · 数据字典 · Codex”的绑定会话与新 Codex Session。
2. 再次点击复用该活跃会话。
3. 归档后再次点击创建新的绑定会话与新 Codex Session。
4. 数据字典上下文只能使用字典相关 MCP 能力。
5. 图标在给定位置出现并打开该项目的字典对话。

# Rich Agent 学习手册

这份文档是后台「AI 学习手册」的长文版。给 Hermes、Mac Mini 上的 Agent、Codex 或其他 MCP 客户端使用。

## Agent 工作流

1. 识别用户任务对应的 Rich 页面。
2. 不熟悉模块时先调用 `get_rich_system_manual`，读取页面、场景、手册、CLI/MCP 索引。
3. 读取相关上下文，不猜数据结构。
4. 选择 MCP / API / CLI 执行。
5. 需要输出给用户时，先套 AI 语料模板。
6. 如果用户指出表达或操作方式不对，把经验写回语料模板或系统改造任务。
7. 如果任务对应一个 Rich 按钮，先查 `docs/RICH_CLI_COVERAGE.md` 的按钮覆盖表，确认该按钮对应的 MCP / CLI。

## 页面与工具

| 页面 | 场景 | 推荐工具 |
| --- | --- | --- |
| 首页 | 自然语言入口、全局任务 | `get_rich_system_manual`, `corpus_list`, `corpus_prompt`, `invoke_toolbox_tool` |
| 知识树 | 知识元 CRUD、关系、路径 | `list_topics`, `get_element`, `get_subtree`, `create_element`, `update_element`, `refine`, `expand`, `extend` |
| AI 早报 | 早报生成、Skill 推荐、信息摘要 | `pnpm corpus prompt information-briefing`, `get_element`, `update_section_blocks` |
| 导图 PPT | 文稿转导图、PPT 展示图 | `/api/mindmaps`, `get_subtree`, `update_element` |
| 计划管理 | 计划、目标、任务、复盘、批量清理 | 优先 MCP：`plan_list`, `plan_get`, `task_list`, `task_complete`, `plan_decompose`, `analyze_progress`；服务离线/批量维护/排障时用 CLI：`pnpm --filter @ke/server run plan -- ...` |
| 项目管理 | 数据字典、作业流程、场景手册、环境配置、部署步骤、监控预警、代码版本、项目代办、文件夹 | 先读 `docs/PROJECT_MANAGEMENT_MCP_MANUAL.md`；数据字典 / Mapping 再读 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md`；优先 MCP：`project_management_summary`, `project_management_search`, `project_management_list_items`, `project_management_create_item`, `project_management_update_item`, `project_management_reorder_items`, `project_dictionary_search_fields`, `project_dictionary_get_field` |
| 项目实战 | 实战项目、PRD、开发任务 | `practice_list`, `practice_get`, `practice_create`, `practice_add_child`, `draft_prd`, `draft_child`, `adjust_child` |
| 健康顾问 | 苹果健康同步、健康原始数据、训练/体重/睡眠/饮食复盘 | `pnpm rich -- api GET /api/health/timeline`, `pnpm rich -- api GET /api/health/intake/status`, `docs/APPLE_HEALTH_METRICS.md` |
| 工具箱 | 小工具、锁屏、延迟动作 | `list_toolbox_tools`, `invoke_toolbox_tool` |
| 后台 | 监控、语料、学习手册、改造任务 | `get_rich_system_manual`, `pnpm corpus ...`, `corpus_upsert`, `create_improvement` |

## CLI

### 统一 Rich CLI

所有后端 API / SSE 操作都有统一 CLI 兜底入口。新按钮只要调用 `/api/...`，Agent 就可以通过这里执行，不必等单独脚本：

```bash
pnpm rich -- health
pnpm rich -- api GET /api/elements
pnpm rich -- api PATCH /api/elements/<id> --json '{"title":"新标题"}'
pnpm rich -- sse POST /api/ai/refine --json '{"elementId":"<id>","model":"codex"}'
```

常用语义化命令：

```bash
pnpm rich -- elements list
pnpm rich -- elements create --json '{"title":"新元","type":"topic","parentId":"<optional>"}'
pnpm rich -- elements patch <id> --json '{"difficulty":"mid"}'
pnpm rich -- mindmaps attach --json '{"elementId":"<id>"}'
pnpm rich -- toolbox invoke --json '{"tool":"lock_screen","args":{}}'
pnpm rich -- improvements create --json '{"title":"补一个能力","description":"...","priority":"medium"}'
```

按钮级覆盖表见 `docs/RICH_CLI_COVERAGE.md`。纯 UI 按钮，如打开弹窗、切换 tab、筛选、收起展开，不要求 CLI；真正的数据写入要通过 MCP / CLI / API 完成。

### 语料模板 CLI

```bash
pnpm corpus list
pnpm corpus get system-status-report
pnpm corpus prompt system-status-report
pnpm corpus patch system-status-report --field mustInclude --value "总体状态、关键指标、异常、风险、下一步动作"
pnpm corpus upsert --file template.json
```

### 计划管理 CLI

计划管理数据存放在 GreatMe state 的 `plans/goals/tasks`，当前运行环境可能是 Postgres，不要默认改本地 SQLite。CLI 会按 `KE_STORAGE` 选择后端：

```bash
# 查询
pnpm --filter @ke/server run plan -- list plans --status all --json
pnpm --filter @ke/server run plan -- list year --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list month --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list week --plan-id <planId> --json
pnpm --filter @ke/server run plan -- list day --date today --json

# 增改
pnpm --filter @ke/server run plan -- create plan --title "我的计划" --start 2026-05-25 --end 2026-08-25
pnpm --filter @ke/server run plan -- create month --plan-id <planId> --title "五月目标" --due 2026-05-31
pnpm --filter @ke/server run plan -- create day --goal-id <goalId> --title "今天行动" --date 2026-05-25
pnpm --filter @ke/server run plan -- update day --id <taskId> --done true

# 删除/清理：破坏性命令必须显式 --yes
pnpm --filter @ke/server run plan -- delete plan --id <planId> --yes
pnpm --filter @ke/server run plan -- clear all --yes --json
```

Agent 清理“计划管理脏数据”时必须先备份完整 GreatMe blob，只清空 `plans/goals/tasks`，保留 `profile/events/daily/reviews/ability/compounding/conversations` 等非计划数据，并在写回后验证三类计数为 0。

### 健康数据 CLI / SQL

苹果健康接入有三层数据：原始层 `health_raw_import`、标准化样本层 `health_metric_sample`、每日汇总层 `health_daily_activity_summary`。体重、训练、睡眠、饮食、心情仍走 `health_weight_log` / `health_workout_log` / `health_sleep_log` / `health_meal_log` / `health_mood_log`。不要因为前端没展示就判断“没入库”，先查结构化层，再查原始层。

```bash
pnpm rich -- api GET /api/health/intake/status
pnpm rich -- api GET /api/health/timeline
```

需要直接排查 Health Auto Export REST 数据时，先读取云库配置，再查原始指标：

```bash
set -a
source ~/.rich-cloud-postgres.env
set +a

psql "$RICH_DB_URL" -P pager=off -c "
SELECT payload->>'metric' AS metric, payload->>'unit' AS unit, count(*)
FROM health_raw_import
WHERE source = 'health-auto-export-rest'
  AND kind = 'metric'
GROUP BY 1,2
ORDER BY count DESC;
"
```

日常分析优先查每日汇总：

```bash
psql "$RICH_DB_URL" -P pager=off -c "
SELECT *
FROM health_daily_activity_summary
ORDER BY summary_date DESC
LIMIT 14;
"
```

需要看细粒度样本时查：

```bash
psql "$RICH_DB_URL" -P pager=off -c "
SELECT recorded_at, metric, value, unit, category
FROM health_metric_sample
WHERE metric = 'walking_speed'
ORDER BY recorded_at DESC
LIMIT 20;
"
```

解释苹果健康字段前必须先看 `docs/APPLE_HEALTH_METRICS.md`。当前 `step_count`、`walking_running_distance`、`flights_climbed` 按天求和；`walking_speed`、`walking_step_length`、`walking_double_support_percentage`、`walking_asymmetry_percentage`、`headphone_audio_exposure` 按天求平均或最大值，已经进入结构化表。

## 重要约束

- Rich 的内容块必须使用支持的 `block.style`。不要写 `style=list`。
- 推荐列表优先用 `dot-list` 或 `markdown`。
- 项目实战不是独立数据层，它复用 elements + child relations。
- 计划管理通过 GreatMe state 管理，任务完成必须写回 state；MCP 用 `task_complete`，CLI 用 `update day --done true`。
- 批量维护计划数据时优先用计划管理 CLI，不要手写 SQL 改 `plans/goals/tasks`，除非 CLI 无法覆盖且已先备份。
- 语料模板存在服务端数据层。Postgres 模式下，多台机器共享同一套模板。
- 项目管理通用内容必须通过 `project_management_*` MCP 工具读写；复杂内容优先保留在 `content.original`，更新时只改用户要求的字段。
- 项目管理数据字典 / Mapping 必须遵守 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md` 和数据字典模板版本库中的当前 `published` 版本。用户提出新的 Mapping 模版偏好时，先创建模板变更记录、更新草案规则并发布，再考虑改 UI、数据库或 CLI；不得绕开已发布模板自行定义字段、码值或动作。

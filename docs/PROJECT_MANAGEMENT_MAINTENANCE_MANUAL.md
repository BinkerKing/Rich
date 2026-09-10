# Rich 项目管理与数据字典维护手册

本手册面向项目管理员、数据字典维护人员和 Agent，说明日常维护的操作边界。它不替代 [数据字典 Mapping 规则手册](PROJECT_DICTIONARY_MAPPING_RULES.md)：后者定义业务与模板规则；本手册定义维护时如何安全地变更、验证和追溯。

## 1. 维护对象与事实来源

| 对象 | 维护入口 | 事实来源 | 禁止做法 |
| --- | --- | --- | --- |
| 项目说明、流程、场景、环境、部署、监控、版本、待办、文件夹 | `rich_project_manage` | 项目条目及其 `content.original` | 用不完整 PATCH 覆盖未知原始字段 |
| 系统、表、字段 | `rich_dictionary_manage` | 已发布模板和可追溯证据 | 通过字段名猜测中文名、口径或来源 |
| 字段 Mapping、场景口径、临时表 | 数据字典 Mapping 界面或 Rich CLI/API | 已发布模板、SQL/过程/代码等证据 | 把 JSON、SQL 或临时依赖混写进备注 |
| 模板与整改 | 模板版本库、整改与变更记录 | 当前唯一的 `published` 版本 | 直接修改已发布版本或用一次整改改全局规则 |

维护前先确认项目、系统、目标表和场景；读取现有对象后只改用户指定的字段。新写入使用新的 request ID；网络重试复用原 request ID。删除、覆盖、`truncate_insert` 或实体表结构变更必须先核对目标并取得明确确认。

## 2. 三类受控硬编码

下列内容不是可自由编辑的说明文字，而是由解析器、SQL 生成和验证流程消费的受控结构。任何新增键、枚举或语义变更，先创建模板变更记录，发布新模板后再录入；不要以“兼容旧数据”为由自行扩展。

### 2.1 字段逻辑 JSON

每条字段 Mapping 仅描述一个目标字段如何出现在 `SELECT` 中。JSON 保存在字段 Mapping 的逻辑字段；`converted_sql` 是由逻辑生成的 SQL 片段缓存/审计结果，不能反向替代 JSON。

```json
{"op":"direct","source":"Customer.customer_id"}
{"op":"literal","value":"T"}
{"op":"case","when":[{"if":{"source":"Account.status","eq":"1"},"then":"A"}],"else":"I"}
{"op":"cast","source":"Trade.amount","to":"DECIMAL(18,2)"}
```

- 顶层必须是 JSON 对象并带 `op`；字段引用必须来自当前场景可用的表或临时表，且能绑定字段元时必须绑定。
- 使用已支持的固定动作：如 `direct`、`literal`、`null`、`param`、`case`、`cast`、`split_part`、`concat`、算术、`code_mapping`、`group_aggregate`、`relative_date_boundary` 等。条件只使用 `eq`、`ne`、`gt`、`gte`、`lt`、`lte`、`like`、`in`、`not_in`、`and`、`or`、`not`。
- `sql` / `expr` 是受控兜底：当前自动抽取不会执行它们。确需使用时，记录证据、保留人工复核，并创建动作模板改进项；状态不得伪装成可自动转换的 `complete`。
- JSON 无法解析或校验失败时，保持原文并标记“规则不标准”；不得由维护人员或 Agent 猜测改写。业务解释、证据缺口和人工确认写入 `remark`，不写入 JSON。

### 2.2 场景口径 JSON

口径属于一个 Mapping 场景，负责记录级取数范围（`FROM`、`JOIN`、`WHERE`、分组、排序、条数），不承担任何目标字段表达式。场景切换时，口径和字段 Mapping 必须同时切换。

```json
{
  "op": "dataset",
  "from": {"table": "Customer", "alias": "c"},
  "joins": [{"type": "left", "table": "Account", "alias": "a", "on": {"source": "c.customer_id", "eq": {"source": "a.customer_id"}}}],
  "where": {"and": [{"source": "c.status", "eq": "1"}]},
  "group_by": ["c.customer_id"],
  "order_by": [{"source": "c.created_at", "direction": "desc"}],
  "limit": 100,
  "remark": "仅取有效客户。"
}
```

- 顶层 `op` 固定为 `dataset`；`from.table`、每个 `joins[].table`、别名、条件字段必须能解析到当前项目的表元或同一目标表维护的临时表。
- 字段逻辑引用的来源表必须在该场景的 `from` 或 `joins` 中出现。口径只描述范围，不能把 `SELECT` 字段表达式、字段默认值或字段级 CASE 塞进 `where`/`remark`。
- `group_by`、`order_by`、`limit` 仅在证据明确时填写。口径失效时停止生成/执行，修复 JSON 或将场景及其字段规则标为 `blocked`，不能退回为无来源的自由文本。

### 2.3 临时表

临时表是单个目标表 Mapping 的过程内依赖，保存于 `pm_mapping_temp_tables`，字段保存于 `pm_mapping_temp_fields`；它不是正式表元、实体同步表或长期业务数据表。只有确实需要将复杂的公共 SQL 结果供多个字段或后续语句复用时才创建。

| 属性 | 硬约束 |
| --- | --- |
| `table_name` | 仅字母、数字、下划线或 `$`，且不能以数字开头；名称在该目标表的临时表集合中唯一 |
| `converted_sql` | 首选且必须为可执行的 `SELECT` 或 `WITH` 查询；为空时才读取 `logic_text`，两者都不合格即不可执行 |
| `fields` | 按 `sort_order` 维护字段名、类型/长度、逻辑和 SQL；被字段逻辑引用的临时字段必须存在 |
| `sort_order` | 按依赖顺序；被引用的临时表必须先创建，禁止循环依赖 |
| `scenario_id` | 绑定场景时仅供该场景使用；未绑定时仍必须确认不会污染其他场景 |

运行时，SQL Server 使用 `#<table_name>` 并在创建前 `DROP TABLE IF EXISTS`；PostgreSQL 使用过程内 `CREATE TEMP TABLE ... ON COMMIT DROP`。因此不得在临时表 SQL 中手写 `CREATE/DROP/TRUNCATE`、提交事务、写生产表或依赖跨过程保留的数据。运行/验证失败时先检查临时表 SQL、名称、字段引用、排序和运行参数；不要通过修改目标字段 Mapping 来掩盖临时表错误。

## 3. 标准维护流程

1. **取证与定位**：记录文件、DDL、SQL/过程、代码、接口规范或业务确认。证据不足创建待确认或整改，不写正式属性。
2. **变更设计**：明确影响的系统、表、场景、字段、JSON、临时表和下游自动化；模板外的结构先走模板变更。
3. **小范围更新**：先更新口径或临时表依赖，再更新字段逻辑；每个 JSON 做语法、字段引用和场景边界检查。
4. **验证**：验证口径 SQL、临时表建表 SQL、每个可自动抽取字段的表达式以及完整生成 SQL。检查场景切换、字段检索、涉及字段和 SQL 展示。
5. **记录与发布**：写明证据、变更原因、验证结果和未解决风险。模板变更必须经历 `draft → review → published`，旧版改为 `superseded`；历史数据是否迁移单独记录。

## 4. 运行与故障处置

数据自动化只编排数据字典已有的 SQL 验证、实体表同步、抽取准备和取数步骤，不维护 Mapping 语义。每次运行保存开始/结束时间、状态、错误和受影响行数；失败错误中的 `table_id` 是回到数据字典修复的定位依据。

- **JSON 规则不标准**：保留原文、标为 `blocked`，补齐受控键或走模板扩展；不以自由 SQL 覆盖。
- **口径引用找不到表/字段**：先修复表元或临时表定义、别名和场景绑定，再验证；不把引用改成相近名称。
- **临时表无法创建**：确认查询以 `SELECT`/`WITH` 开头、运行参数已提供、依赖顺序正确；检查方言差异后重试验证。
- **实体表结构漂移**：状态置为 `drifted`，记录字段差异；未经明确确认不得覆盖既有实体表。生产环境默认禁用建表与测试数据写入。

## 5. 周期性检查清单

- 每次 Mapping 变更：检查 JSON、场景/字段/临时表引用、生成 SQL 和证据记录。
- 每周：检查 `blocked`、`manual_only`、`drifted`、开放整改、未绑定字段和失败自动化运行。
- 每次模板发布：确认只有一个 `published` 版本、变更记录与整改证据互相可追溯，并列出历史迁移范围。
- 每次实体同步或测试数据写入：确认非生产环境、目标库、写入模式、行数和失败明细；`truncate_insert` 必须再次确认。

## 6. 关联手册

- 业务规则、模板治理、动作和口径完整定义：[项目管理数据字典 Mapping 规则手册](PROJECT_DICTIONARY_MAPPING_RULES.md)
- Agent/MCP 操作和写入安全：[Rich 项目管理 MCP 2.0 手册](PROJECT_MANAGEMENT_MCP_MANUAL.md)
- 数据自动化边界：[项目管理：数据自动化架构](PROJECT_DATA_AUTOMATION_ARCHITECTURE.md)

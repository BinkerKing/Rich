# 项目管理 MCP 使用手册

这份手册写给 Hermes、Codex、Mac Mini Agent 和其他 MCP 客户端。目标是让 AI 可以稳定操作 Rich「项目管理」应用，而不是只在聊天里给建议。

## 使用原则

1. 先查再改：任何修改、删除、排序前，先用 `project_management_summary`、`project_management_search` 或对应 list/get 工具确认对象 ID。
2. 保留结构：模块数据的 UI 原始结构通常放在 `content.original`。更新时只改用户要求的字段，不要重写未知字段。
3. 数据字典先读规则：处理字段设计、Mapping、码值、涉及字段前，必须先读 `docs/PROJECT_DICTIONARY_MAPPING_RULES.md`。
4. 字段引用要解析：写 Mapping 前，先用 `project_dictionary_resolve_field_refs` 把文本字段引用解析成系统内字段元。
5. 不确定就建整改：字段类型、码值、格式、Mapping 逻辑无法确认时，用 `project_dictionary_create_rectification` 记录整改要求，不要凭空补。
6. 删除要用户明确确认：`project_management_delete_item` 只在用户明确要求删除某个对象时使用。

## 模块 Key

| module_key | 页面 | 典型内容 |
| --- | --- | --- |
| `dictionary` | 数据字典 | 系统、表元、字段元、Mapping、码值、整改 |
| `workflow` | 作业流程 | 流程节点、涉及服务器、定时任务、场景、注意事项 |
| `scenarios` | 场景手册 | 场景分组、目标、步骤、截图、富文本说明 |
| `environments` | 环境配置 | 环境、服务器、连接、凭证、模块关系 |
| `deploymentSteps` | 部署步骤 | 版本、Sheet/Title、部署内容、Checklist、关联服务器 |
| `monitoring` | 监控预警 | 监控模块、指标、预警、处置说明 |
| `codeVersions` | 代码版本 | 应用清单、版本号、发布时间、升级内容 |
| `todos` | 项目代办 | 待办、负责人、优先级、状态、截止时间 |
| `folder` | 文件夹 | 项目目录结构、文件清单 |

## 通用工具

### `project_management_summary`

查询一个项目的模块数量和数据字典数量。

```json
{
  "project_id": "capital-bank-ybt"
}
```

### `project_management_search`

跨项目管理所有模块搜索。适合用户只给关键词时定位对象。

```json
{
  "project_id": "capital-bank-ybt",
  "query": "新增冗余字段",
  "limit": 20
}
```

### `project_management_list_items`

查询某个模块下的结构化条目。

```json
{
  "project_id": "capital-bank-ybt",
  "module_key": "scenarios"
}
```

有父子层级时传 `parent_id`：

```json
{
  "project_id": "capital-bank-ybt",
  "module_key": "deploymentSteps",
  "parent_id": "pm-item-xxx"
}
```

### `project_management_create_item`

新增模块条目。复杂 UI 数据优先写入 `content.original`。

```json
{
  "project_id": "capital-bank-ybt",
  "module_key": "workflow",
  "title": "源系统抽数",
  "subtitle": "每日批量抽取源系统数据",
  "content": {
    "original": {
      "summary": "抽数前确认源系统批量完成。",
      "servers": [],
      "tasks": [],
      "scenarios": []
    }
  }
}
```

### `project_management_update_item`

修改模块条目。只传要改的字段。

```json
{
  "project_id": "capital-bank-ybt",
  "item_id": "pm-item-xxx",
  "title": "自动下发：加载任务+填报任务"
}
```

如果要改复杂内容，先读取原对象，把 `content.original` 合并后再提交：

```json
{
  "project_id": "capital-bank-ybt",
  "item_id": "pm-item-xxx",
  "content": {
    "original": {
      "title": "可信区-手动跑批",
      "steps": []
    }
  }
}
```

### `project_management_delete_item`

删除模块条目。必须先确认 ID。

```json
{
  "project_id": "capital-bank-ybt",
  "item_id": "pm-item-xxx"
}
```

### `project_management_reorder_items`

调整模块排序。传当前作用域下完整的排序后 ID 列表。

```json
{
  "project_id": "capital-bank-ybt",
  "module_key": "workflow",
  "item_ids": ["pm-1", "pm-3", "pm-2"]
}
```

## 项目代办工具

代办有专用 MCP，支持看板状态、负责人、优先级、截止日和说明。规划或分派前先看总览；修改、删除前先查对应代办 ID。

### `project_todo_summary`

返回总代办数，以及待办/进行中/已完成、高优先级、未分配负责人、已设截止日的数量。

```json
{ "project_id": "capital-bank-ybt" }
```

### `project_todo_list` / `project_todo_get`

按状态或负责人列出代办，或按 ID 读取单个代办。

```json
{ "project_id": "capital-bank-ybt", "status": "doing", "owner": "Rich" }
```

### `project_todo_create`

```json
{
  "project_id": "capital-bank-ybt",
  "title": "核对抽取结果",
  "status": "todo",
  "owner": "Rich",
  "priority": "高",
  "due_at": "2026-08-30",
  "description": "对比临时表和目标表数据。"
}
```

### `project_todo_update` / `project_todo_delete`

更新时只传需要修改的字段；`owner`、`priority`、`due_at`、`description` 传 `null` 可清空。删除必须获得用户明确确认。

```json
{ "project_id": "capital-bank-ybt", "todo_id": "pm-item-xxx", "status": "done" }
```

## 数据字典工具

### `project_dictionary_list_systems`

查询库/系统清单。

```json
{
  "project_id": "capital-bank-ybt"
}
```

### `project_dictionary_list_tables`

查询表元清单。可按 system 过滤。

```json
{
  "project_id": "capital-bank-ybt",
  "system_id": "sys-ybt"
}
```

### `project_dictionary_list_fields`

查询某张表的字段元。

```json
{
  "project_id": "capital-bank-ybt",
  "table_id": "table-blzccz"
}
```

### `project_dictionary_search_fields`

搜索字段元。用户问“哪个字段表示处置本金金额”时优先用它。

```json
{
  "project_id": "capital-bank-ybt",
  "query": "处置本金金额",
  "limit": 30
}
```

### `project_dictionary_get_field`

查询单个字段完整属性，包含类型、长度、格式、字段说明、码值、Mapping、备注等。

```json
{
  "project_id": "capital-bank-ybt",
  "field_id": "field-xxx"
}
```

### `project_dictionary_resolve_field_refs`

把 Mapping 文本里的字段引用解析成字段元。

```json
{
  "project_id": "capital-bank-ybt",
  "refs": [
    "YBT.BLZCCZ.G080009",
    "BLZCCZ.G080009",
    "处置本金金额"
  ]
}
```

### `project_dictionary_list_mapping_rules`

查询一张表下的 Mapping 元规则，返回规则本身、涉及字段和标准动作链。

```json
{
  "project_id": "capital-bank-ybt",
  "table_id": "table-blzccz"
}
```

### `project_dictionary_get_mapping_rule`

查询单个 Mapping 元规则详情。

```json
{
  "project_id": "capital-bank-ybt",
  "mapping_rule_id": "mapping-xxx"
}
```

### `project_dictionary_update_mapping_rule`

修改 Mapping 元规则的状态、逻辑说明、转换 SQL、备注、绑定字段或 raw 元信息。

```json
{
  "project_id": "capital-bank-ybt",
  "mapping_rule_id": "mapping-xxx",
  "status": "complete",
  "logic_text": "直取涉及字段 source_1，并做金额精度处理。",
  "converted_sql": "ROUND(source_1, 2)",
  "remark": "已可转换 SQL"
}
```

### `project_dictionary_update_mapping_action`

修改 Mapping 标准动作。动作可以是直取、默认值、条件判断、关联、格式处理、求和、拼接、截取、空值处理等。

```json
{
  "project_id": "capital-bank-ybt",
  "action_id": "action-xxx",
  "action_type": "format",
  "expression_text": "ROUND(source_1, 2)",
  "source_field_ids": ["source-1"]
}
```

### `project_dictionary_replace_mapping_actions`

整体替换某条 Mapping 规则下的动作链。使用前必须先读 `project_dictionary_get_mapping_rule`，然后提交完整动作列表。

```json
{
  "project_id": "capital-bank-ybt",
  "mapping_rule_id": "mapping-xxx",
  "actions": [
    {
      "action_type": "direct",
      "expression_text": "source_1",
      "source_field_ids": ["source-1"],
      "sort_order": 0
    },
    {
      "action_type": "format",
      "expression_text": "ROUND(source_1, 2)",
      "source_field_ids": ["source-1"],
      "sort_order": 1
    }
  ]
}
```

### `project_dictionary_replace_mapping_source_fields`

整体替换某条 Mapping 规则的涉及字段。能解析到 Rich 字段元时写 `field_id`；外部字段或暂未解析字段保留 `ref_path`。

```json
{
  "project_id": "capital-bank-ybt",
  "mapping_rule_id": "mapping-xxx",
  "source_fields": [
    {
      "field_id": "field-source-1",
      "ref_path": "CRM.BRG_CRM_BASE_INFO.AMOUNT",
      "alias": "source_1",
      "role": "amount"
    }
  ]
}
```

### `project_dictionary_validate_mapping_table`

校验一张表的 Mapping 完整性：是否有涉及字段、是否有逻辑或动作、完成状态是否有 SQL、是否存在无法转换状态。

```json
{
  "project_id": "capital-bank-ybt",
  "table_id": "table-blzccz"
}
```

### `project_dictionary_create_rectification`

新增数据字典整改要求。适合发现字段类型、格式、码值、Mapping 逻辑不符合规范。

```json
{
  "project_id": "capital-bank-ybt",
  "entity_type": "field",
  "entity_id": "field-xxx",
  "property_key": "fieldType",
  "requirement": "字段类型需要统一为数据库类型 decimal，不使用 n。长度为 20,2。",
  "created_by": "hermes"
}
```

### `project_dictionary_update_rectification`

更新整改状态。

```json
{
  "project_id": "capital-bank-ybt",
  "rectification_id": "rect-xxx",
  "status": "fixed",
  "resolution_note": "已将字段类型调整为 decimal，并补充格式规则。"
}
```

## Mapping 操作规则

Mapping 不是普通文本。AI 维护 Mapping 时必须遵守下面的结构：

1. 表元下面按业务场景拆成多个场景 Title。
2. 每个场景包含口径说明。
3. 每个场景下有字段 Mapping 列表。
4. Mapping 元必须能关联涉及字段元。
5. 逻辑表达中要引用涉及字段元，而不是重复写死字段名。
6. 逻辑动作优先使用标准动作：直取、默认值、条件判断、关联、格式处理、求和、拼接、截取、空值处理。
7. 如果逻辑能稳定转换 SQL，状态为完成，并保存转换后的 SQL。
8. 如果逻辑过于复杂，无法被标准动作描述，状态为无法转换，并保留人工说明。

## 推荐工作流

### 修改场景手册

1. `project_management_search` 搜场景名称。
2. `project_management_list_items` 读取分组或场景条目。
3. 合并 `content.original`。
4. `project_management_update_item` 写回。

### 补充环境配置

1. `project_management_list_items` 读取 `environments`。
2. 找到环境、服务器或连接条目。
3. 新增时用 `project_management_create_item`，内容放 `content.original`。
4. 修改时只 patch 目标字段。

### 检查字段元

1. `project_dictionary_search_fields` 定位字段。
2. `project_dictionary_get_field` 查看完整属性。
3. 如需调整且没有专用字段写接口，先用 `project_dictionary_create_rectification` 记录整改。

## 当前边界

- 通用项目管理模块已经支持 MCP 查看、新增、修改、删除、排序。
- 数据字典当前 MCP 支持查询、搜索、字段引用解析、整改记录，以及 Mapping 元规则/动作/涉及字段的读写和校验。
- 字段元、表元、码值元的直接写接口需要随着元模型稳定后继续扩展，避免在规则未定时把脏结构写入数据库。

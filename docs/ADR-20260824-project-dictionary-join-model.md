# ADR：数据字典 Join 作为领域模型

## 决策

数据字典的 `caliber` 使用结构化数据集规则表达 `from`、`joins`、`where`、排序和取最新策略。Join 是规则的一部分，不再由字段 Mapping 逻辑、前端 SQL 预览或后端 SQL 校验各自猜测。

共享的规则类型与解析器放在 `@ke/domain`；后端只负责把规则解析为目标数据库 SQL，前端只负责编辑、预览和显示同一规则。当前兼容既有 `table.caliber` JSON 和原有 HTTP 接口。

## 原因

`Op_name` 依赖 `Customer.enName` 的校验失败证明：只有字段引用而没有 Join 定义时，SQL 引擎无法确定 `TransactionTab` 到 `Customer` 的关联路径。把 Join 放在字段备注或 SQL 字符串中，会造成前后端解析不一致，也无法可靠测试。

## 后果

- 优点：关联路径可校验、可预览、可单测，未来 PostgreSQL、MySQL、SQL Server、Oracle 可共用规则模型。
- 约束：新增跨表字段引用前，必须在同一 `caliber` 中声明 Join；历史规则未补齐前仍会得到明确的“关联字段元不存在”诊断。
- 不在本次变更中：自动推断 Join、修改现网业务映射数据、为未实现数据库启用执行。

# VTB SAFE 二代按表归属 ETL 改造设计

## 目标

将二代 SAFE 的 PostgreSQL 实现重构为“每张表一个归属存储过程”的可核对链路。二代过程复刻一代 Java 程序对同名贴源、中间和目标表的实际结果，而不自行创造业务口径。

验收顺序固定为：贴源层、同名中间表、目标表业务字段。一代表中间表与二代对应中间表必须逐字段一致；目标表仅比较可自动确定的业务字段，审批、人工维护、审计与编号类字段单独列为边界。

## 不变量

- 不修改二代产品/报表表结构。
- 不直接写产品结果表修数。
- 同一业务日期重导行为以一代实际程序为准。
- Customer 为 88 字段全量主数据：全量快照、增量新增和页面补录规则均以一代为准。
- `safe_account`、`safe_balance` 是纯自动中间表，无页面人工维护。
- 一个归属过程只写一张业务表；通用函数可复用；总编排过程只调用归属过程，不直接写业务表。
- 固定版本包、Mapping 和已部署过程必须具有相同的版本和校验记录。

## 表归属与依赖

```text
CIF2 -> cif_tab -> customer
AIF2 + customer -> safe_account
BLN2 + transaction_tab + safe_account -> safe_balance
safe_account -> T_SAFE_ACCCA
safe_account + safe_balance -> T_SAFE_ACCCB

transaction_tab + customer -> CFACA / CFACB / CFADA / CFADB
CFACA / CFACB / CFADA / CFADB -> CFA 目标表

transaction_tab + customer (+ account mapping) -> BOP stage
transaction_tab + customer -> FAEBaseInfo -> FAEManage
```

Customer、四张 CFA 中间表、BOP stage、FAEBaseInfo、FAEManage 已有物理中间表逻辑；需先纳入固定发布包并拆分其混合写表过程。`safe_account` 和 `safe_balance` 已有物理表，但尚无归属刷新过程，是本次改造优先项。

## 过程边界

每张表建立或保留唯一归属过程，例如：

- `usp_vtb_refresh_customer_from_cif` -> `customer`（增量；全量快照入口另行受控）
- `usp_vtb_refresh_safe_account` -> `safe_account`
- `usp_vtb_refresh_safe_balance` -> `safe_balance`
- `usp_vtb_refresh_cfaca_tab` -> `cfaca_tab`
- `usp_vtb_refresh_cfacb_tab` -> `cfacb_tab`
- `usp_vtb_refresh_cfada_tab` -> `cfada_tab`
- `usp_vtb_refresh_cfa_db_tab` -> `cfadb_tab`
- `usp_vtb_build_t_safe_accca` -> `t_safe_accca`
- `usp_vtb_build_t_safe_acccb` -> `t_safe_acccb`

现有的 `usp_vtb_safe2_extract_acc` 与 `usp_vtb_refresh_cfa_intermediate` 不再作为多表写入实现；切换期间可保留为仅调用表归属过程的兼容编排入口。

## 一代证据与二代实现

每张表必须记录：

1. 一代 Java Service/Action、方法、调用入口和实际写表证据；
2. 二代唯一归属过程、源码文件、过程定义哈希和发布版本；
3. 一代/二代字段映射、字段表达式、人工或审批边界；
4. 用既有双跑测试日期得到的行数、主键和字段级差异结论。

Customer、账户和余额的重导、状态、默认值、主键生成与历史保留策略不得由二代自行假设，必须先由一代程序证据确认。

## Mapping 与代码绑定

Rich 数据字典对每张表维护唯一过程绑定。表级 External SQL 保存完整归属过程；场景级 External SQL 保存该过程的场景条件；字段级 External SQL 保存对应的实际 SELECT/赋值表达式、源码定位和版本。

每次发布生成表—过程—哈希—Mapping 版本清单。代码哈希变化但 Mapping 未同步时，标记“待核对”；Mapping 无对应归属过程时，不能标记“已验证”。

## 验证策略

先写会失败的回归断言，再实现过程。每一表至少覆盖：

- 同一业务日期重导；
- 一代/二代中间表逐字段对账；
- 下游目标表业务字段对账；
- 已有基线日期和高风险样本（NRA、余额收支方向、跨日、Customer 补录、CFA 还本付息）。

新旧二代在切换前使用相同测试文件并行运行。只有“旧二代 = 新二代 = 一代”的已确认业务字段才能切换；一代已知差异按一代证据修正后另行验收。

## 实施范围

第一批：冻结基线、补齐一代程序证据、Customer/CFA 发布包完整性、`safe_account`、`safe_balance`、ACCCA、ACCCB 及其编排和回归。

第二批：EXD、BOP 的账户依赖迁移；其余多表写入过程按同一规则拆分。

# VTB SAFE 一代 PostgreSQL 存储过程留档与差异说明

## 目的与范围

本文留档“VTB SAFE 一代逻辑与数据字典逻辑比对”任务中已经同步到 Rich 数据字典的 PostgreSQL 外部 SQL。

仅包含 VTB 一代实际自动链路：四类文本源数据、FAL 三类 Excel 源数据、ACC、BOP 前置阶段、CFA、EXD、FAL 与 JSH。`RKJshtab`、CFAB/CFAE/CFAF、EXDA A-M/P-R、SAC JP/JR 等标准 SAFE 或一代 VTB 主入口未涉及对象，不在本文和外部 SQL 的范围内。

完整 SQL 过程体保存在下列受版本管理文件中；Rich 中的表级/场景级 `external_sql` 由同步脚本从这些文件提取，避免文档、代码和数据字典出现三个不一致的副本。

- [VTB 源数据加载过程](/Users/binkerking/Documents/Ai-WorkSpace/Rich/apps/server/scripts/sql/vtb-source-load-procedures.sql)
- [VTB 结果表级过程（自动生成）](/Users/binkerking/Documents/Ai-WorkSpace/Rich/apps/server/scripts/sql/vtb-table-process-procedures.sql)
- [VTB 表级过程生成器](/Users/binkerking/Documents/Ai-WorkSpace/Rich/apps/server/scripts/generate-vtb-table-process-procedures.ts)
- [VTB PostgreSQL 报表加工过程](/Users/binkerking/Documents/Riking-Project/8-VBT/04-环境与部署/项目部署/sql/vtb_ods_postgres_setup.sql)
- [Rich 外部 SQL 同步脚本](/Users/binkerking/Documents/Ai-WorkSpace/Rich/apps/server/scripts/sync-vtb-external-sql.ts)
- [表与过程的归属清单](/Users/binkerking/Documents/Ai-WorkSpace/Rich/apps/server/src/modules/project-dictionary/safe/vtbExternalSql.ts)

## 已留档的存储过程

| 阶段 | PostgreSQL 过程 | 数据字典表 |
| --- | --- | --- |
| CIF 源文件 | `usp_vtb_load_cif_tab` | `CifTab` |
| AIF 源文件 | `usp_vtb_load_aif_tab` | `AifTab` |
| BLN 源文件 | `usp_vtb_load_bln_tab` | `BlnTab` |
| TRN 源文件 | `usp_vtb_load_transaction_tab` | `TransactionTab` |
| FAL Excel 三类来源 | `vtb_parse_fal_date`、`vtb_fal_month_diff`、`usp_vtb_load_fal_warehouse` | `fal_warehouse` |
| 导入后副作用 | `usp_vtb_process_import_side_effects` | `BlnTab` 等 VTB 导入中间数据 |
| 账户 | `usp_vtb_safe2_extract_acc`、`usp_vtb_validate_acccb_balance` | `Customer`、`safe_account`、`safe_balance`、`T_SAFE_ACCCA`、`T_SAFE_ACCCB` |
| BOP | `usp_vtb_safe2_extract_bop_stage` | `BopTransaction`、`T_SAFE_BOPA` 至 `T_SAFE_BOPF`、`T_SAFE_BOPA_G`、`T_SAFE_BOPB_H` |
| EXD | `usp_vtb_safe2_extract_exd_stage`、`usp_vtb_safe2_extract_exd_contracts`、`usp_vtb_safe2_extract_exd` | `T_SAFE_EXDA_N`、`T_SAFE_EXDA_S` |
| CFA | `usp_vtb_safe2_extract_cfa` | `CFACATab`、`CFACBTab`、`CFADATab`、`CFADBTab`、`T_SAFE_CFAC_A/B`、`T_SAFE_CFAD_A/B`、`T_SAFE_CFADA_FOGUCODEINFO` |
| FAL 报表 | `usp_vtb_safe2_extract_fal` | `T_SAFE_FAL_Z02`、`T_SAFE_FALD_02`、`T_SAFE_FALD_0501`、`T_SAFE_FALD_09`、`T_SAFE_FALF_01` |
| JSH | `usp_vtb_safe2_extract_jsh` | `FAEBaseInfo`、`FAEManage`、`T_SAFE_JSHD`、`T_SAFE_JSHE`、`T_SAFE_JSHD_F`、`T_SAFE_JSHE_G` |

## VTB 专属表级执行顺序

所有可自动落表的结果过程已拆为“一过程只写一张业务表”。过程之间仅通过前置表读取数据；调用者按以下顺序执行即可保持一代依赖关系。

```sql
CALL vtb.usp_vtb_load_cif_tab(p_cif_lines);
CALL vtb.usp_vtb_load_aif_tab(p_aif_lines);
CALL vtb.usp_vtb_load_bln_tab(p_bln_lines);
CALL vtb.usp_vtb_load_transaction_tab(p_trn_lines);
CALL vtb.usp_vtb_load_fal_warehouse(p_business_date, p_fal_files, p_customers);

CALL vtb.usp_vtb_process_import_side_effects(p_business_date);
CALL vtb.usp_vtb_table_t_safe_accca(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_acccb(p_business_date, ...);
CALL vtb.usp_vtb_validate_acccb_balance(p_business_date, ...);
CALL vtb.usp_vtb_safe2_extract_bop_stage(p_business_date);
CALL vtb.usp_vtb_table_t_safe_exda_n(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_exda_s(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_cfac_a(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_cfac_b(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_cfada_fogucodeinfo(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_cfad_a(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_cfad_b(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_fal_z02(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_fald_02(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_fald_0501(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_fald_09(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_falf_01(p_business_date, ...);
CALL vtb.usp_vtb_table_fae_base_info(p_business_date, ...);
CALL vtb.usp_vtb_table_fae_manage(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_jshd(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_jshe(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_jshd_f(p_business_date, ...);
CALL vtb.usp_vtb_table_t_safe_jshe_g(p_business_date, ...);
```

`T_SAFE_CFADA_FOGUCODEINFO` 必须早于 `T_SAFE_CFAD_A`：其清理 SQL 依赖当日 `CFAD_A` 主表，用于先清理旧明细再重建主表。`FAEBaseInfo → FAEManage → JSHD/JSHE → JSHD_F/JSHE_G` 也必须保持该顺序。

不要调用 `usp_vtb_safe2_process_all` 作为 VTB 专属总入口：该历史脚本会顺带调用 CFAB/CFAE 等标准 SAFE 链路，超出本任务范围。

## 无法无损拆分为自动过程的表

| 表 | 原因 | 外部 SQL 处理 |
| --- | --- | --- |
| `Customer`、`safe_account`、`safe_balance` | 一代 VTB 自动入口读取这些主数据；并不通过本次 VTB 源文件自动创建它们。实际自动输出分别是 ACCCA/ACCCB。 | 写入原因说明，不伪造插入过程。 |
| `CFACATab`、`CFACBTab`、`CFADATab`、`CFADBTab` | 由一代 `cfaVTBImportService` 导入链路形成；现有 PostgreSQL 参考脚本只有其后的报表提取逻辑，缺少可无损转换的导入体。 | 写入原因说明，等待该服务的完整源实现/样例。 |
| `T_SAFE_BOPA` 至 `T_SAFE_BOPF`、`T_SAFE_BOPA_G`、`T_SAFE_BOPB_H` | 一代自动逻辑只写 `BopTransaction` 待判定阶段；最终 BOP 分类依赖人工判定。 | 写入原因说明，不虚构自动落表过程。 |

## 与一代逻辑的差异与保留边界

### 已按一代保留的行为

| 项目 | 保留方式 |
| --- | --- |
| CIF | 跳过短行；全表清空；第 18 个分隔字段不写入 `customer_code`，与 Java 原赋值缺口一致。 |
| AIF | 仅保留 `40%` 且排除 `409%` 的本行账户。 |
| BLN | 按首个有效行的业务日期删除当日数据；`RUR` 转 `RUB`。 |
| TRN | 保留一代 40 字段/50 字段边界；`USD` 先赋 1 后可被 `@` 汇率覆盖；`RUB` 取倒数并保留 8 位；`ref_no` 不由 `usage` 补造。 |
| FAL | 保留 `dis*`、`mm*`、`loan*` 的字段索引、日期筛选、360/365 计息、月末余额、D02/D09/D0601 分流及客户英文名 `startsWith` 匹配。多文件输入仅处理最后一个文件，复刻一代循环中覆盖 `resultList` 的行为。 |
| BOP | 一代自动逻辑仅形成待判定 BOP 中间数据；A-F 与 G/H 最终分类不自动虚构。 |
| JSH | 保留同参号配对、04 结汇生成 JSHD、03 售汇生成 JSHE、仅 JSHD 满足用途条件时生成 FAEManage 的逻辑。 |

### 有意的实现差异（不改变业务结果）

| 差异 | 原因与处理 |
| --- | --- |
| 文件解码 | 一代 Java 直接以 `Unicode` 读取文本、通过 Excel 组件读工作簿；PostgreSQL 过程接收已解码的 `text[]` 或 Excel 单元格 JSON。这是 I/O 适配层差异，字段、筛选和计算留在过程内。 |
| FAL 客户资料 | 一代从 `Customer` 实体读取 `enName`、`countryCode`、`parn`；当前 `vtb_ods.customer` 旧表缺少后两字段，因此过程以 `p_customers` JSON 显式传入这三个字段，保留一代匹配和比例规则。 |
| 过程语言 | SQL Server / Java 实现改写为 `plpgsql`，使用 `CREATE OR REPLACE PROCEDURE/FUNCTION`、`numeric`、`jsonb` 和 PostgreSQL 日期函数；外部 SQL 中不保留 SQL Server 可执行语法。 |

### 当前环境前置条件（不是逻辑差异）

当前本地 `vtb_ods` 为旧表结构。它缺少 `bop_transaction_stage.source_side`、`fae_base_info.rptno` 等新版 VTB PostgreSQL 脚本要求的字段，因此 BOP/JSH 过程可以创建，但在旧库上实际写入会被结构缺口阻断。

解决方式是先执行 [VTB PostgreSQL 报表加工过程](/Users/binkerking/Documents/Riking-Project/8-VBT/04-环境与部署/项目部署/sql/vtb_ods_postgres_setup.sql) 中对应的新版表结构迁移，再执行本文的过程顺序；不应为了让旧测试库临时通过而删减一代字段或降低过程逻辑。

## 验证记录

- Rich 数据字典：41/41 个 VTB 表、47/47 个关联场景已写入外部 SQL。
- 测试任务“VTB SAFE 一代逻辑与数据字典逻辑比对”：42 条用例均为草稿（未开始）。
- `usp_vtb_load_cif_tab`、`usp_vtb_load_aif_tab`、`usp_vtb_load_bln_tab`、`usp_vtb_load_transaction_tab` 已以合成输入在回滚事务中验证。
- FAL 的 F01、D02/D09 分流已以合成 Excel 单元格 JSON 在回滚事务中验证。
- 外部 SQL 已检查，不包含 `dbo.`、`GETDATE`、`TRY_CONVERT`、`TOP n` 等 SQL Server 可执行语法。
- 用例覆盖提示：`T_SAFE_CFADA_FOGUCODEINFO` 当前只被“CFA DA”总用例间接覆盖；SAC JP/JR 为一代 VTB 范围外用例，未同步外部 SQL。

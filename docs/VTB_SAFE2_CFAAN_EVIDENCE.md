# VTB 二代 SAFE CFAAN 数据字典取证说明

## 适用范围

本文记录 `[VTB] 二代SAFE` 当前已回写到 Rich 数据字典的 CFAAN 纵向链路，作为后续补充、整改和 AI 填报的证据边界。

## 证据优先级

1. 本机 `vtb_ods.vtb`：物理表、字段顺序、字段类型、长度，以及 `usp_vtb_safe2_extract_exd*` 存储过程。
2. 《金融机构外汇业务数据采集规范（1.4版）》：报表/报文业务含义、格式、校验与码值。
3. 一代 SAFE 真实库与 Java：`fbdsALL.dbo.RKAiftab`、`RKCiftab`、`RKTrntab` 的表结构，以及 `SAFEDataImportServiceImpl` 的导入赋值代码。用于建立一代贴源标准，并与二代文件工作表做差异对照。
4. OneGen 源文件到贴源层整理：`/Users/binkerking/Documents/Riking-Project/8-VBT/项目部署/sql/VTB_OneGen_Source_To_Stage_Field_Mapping_CN.md`，用于补充 `AIF2.TXT`、`BLN2.TXT`、`CIF2.TXT`、`TRN2.TXT`、`REPORT.TXT` 到 `AifTab`、`BlnTab`、`CifTab`、`TransactionTab` 的字段级入库关系。

不得以一代 Java 的字段或逻辑替代二代物理结构；二代过程没有覆盖的部分必须标注为待确认。

## 已确认分层

| 层级 | Rich 系统 | 已确认对象 | 依据 |
| --- | --- | --- | --- |
| 源数据层 | `SAFE_SOURCE` | `AIF2.TXT`、`BLN2.TXT`、`CIF2.TXT`、`TRN2.TXT` | 已保存源文件字段元数据；字段顺序、分隔符与入库关联 |
| 贴源层（一代标准） | `SAFE_STAGE` | `RKAiftab`、`RKCiftab`、`RKTrntab` | 一代 `fbdsALL.dbo` 真实物理表与一代导入代码 |
| 贴源层（OneGen 入库链路） | `SAFE_STAGE` | `AifTab`、`BlnTab`、`CifTab`、`TransactionTab` | OneGen 源文件到贴源层整理文档；字段类型和物理约束未由该文档证明，保持待确认 |
| 中间层 | `SAFE_MIDDLE` | `aif_tab`、`bln_tab`、`cif_tab`、`transaction_tab`、`cfaa_tab`、`cfaas_tab`、`cfaam`、`cfaas` | `vtb_ods.vtb` 物理表与二代过程 |
| 报表层 | `SAFE_CFA` | `cfaan` | `vtb_ods.vtb` 物理表；发文补充字段业务意义 |
| 报文层 | `SAFE_MESSAGE` | `t_safe_exda_n`、`t_safe_exda_s` | `vtb_ods.vtb` 物理表、二代过程、发文 |

## CFAAN / EXDAN 已确认链路

二代过程 `vtb.usp_vtb_safe2_extract_exd_contracts` 明确：

```sql
FROM vtb.cfaa_tab t
WHERE t.data_type = 'AN'
  AND t.value_date::date = p_business_date
```

该过程把 `cfaa_tab` 的 AN 数据写入 `t_safe_exda_n`。Rich 已将其可直接表达的字段 Mapping 标记为 `completed`，并保留转换 SQL。包括直取、默认值、条件判断和格式处理。

`cfaas_tab` 的 AN 余额数据经二代 `usp_vtb_safe2_extract_exd_stage` 汇入 `cfaas`，再由 `usp_vtb_safe2_extract_exd` 写入 `t_safe_exda_s`。

## 一代贴源与二代文件工作表差异

一代和二代不是同一套物理表，Rich 不能通过“改名”将二代结构伪装成一代结构。因此字典中同时保留两组元，并建立一代到二代的对照关联：

| 一代贴源标准 | 二代文件工作表 | 已核验差异 |
| --- | --- | --- |
| `RKAiftab`（56 字段） | `aif_tab`（13）+ `bln_tab`（10） | 一代把账户与余额字段合并；二代拆分为两张文件解析工作表。 |
| `RKCiftab`（32 字段） | `cif_tab`（25） | 客户核心字段有对应关系，但字段命名和部分属性不同。 |
| `RKTrntab`（71 字段） | `transaction_tab`（53） | 交易核心字段有对应关系，但字段集合、命名和类型不同。 |

一代 `RKDealsdc` 是一代代码单独导入的合约/交易数据表，不属于已确认的 AIF2、BLN2、CIF2、TRN2 四个文件入库对应范围，因此没有被放入本次贴源层。

已被一代导入赋值代码明确说明的字段，Rich 填入中文名称和说明；只有物理表存在、但当前未找到可靠中文说明的字段保持中文名为空，并标记为“一代物理列事实”。

## OneGen 源文件到贴源层链路

Rich 已按 OneGen 整理文档同步源文件和贴源字段：

| 源文件 | OneGen 贴源表 | 字段关系 |
| --- | --- | --- |
| `AIF2.TXT` | `AifTab` | 12 个源文件字段写入 12 个贴源字段；`AifTab.id` 为数据库生成 |
| `BLN2.TXT` | `BlnTab` | 5 个源文件字段写入 5 个贴源字段；`id` 和 4 个折算余额字段为自动/非文件字段 |
| `CIF2.TXT` | `CifTab` | 24 个源文件字段中 23 个写入贴源字段；第 18 字段“客户代码”一代不取，`CifTab.customerCode` 固定置空 |
| `TRN2.TXT` / `TRN2.txt` | `TransactionTab` | 50 个源文件字段写入 50 个贴源字段；`id`、`rate`、`refNo` 为自动/派生/待确认字段 |
| `REPORT.TXT` | 无 | 只参与文件名匹配和 5 文件数量校验，未发现独立业务贴源表 |

公共文件规则：Java 使用 `Charset.forName("Unicode")` 读取，即 UTF-16；分隔符为 `|`；拆分方式为 `split("\\|", -1)`，保留尾部空字段。

OneGen 链路只证明源文件字段序号、Java 下标、目标贴源字段和入库逻辑，不证明二代 `vtb_ods.vtb` 物理字段类型、长度、二代 ETL SQL 或监管报送口径。

## 发文补充范围

发文已用于补充 EXDAN/EXDAS 的字段名称、格式、校验和已明确的码值：

- 操作类型：`A` 新建、`C` 修改、`D` 删除。
- 是否类标识：`Y` / `N`。
- 非居民机构存款业务类别：`1` 存款、`2` 账户金。
- 原始期限：`1` 一年及以下（含活期或不定期）、`2` 一年以上。

发文仅提到但未列明全量枚举的代码表，不得臆造码值；当前仅在字段校验说明中引用对应代码表。

## 待确认项

1. `whjcstage` 当前无表、视图或存储过程，不能作为二代 SAFE 物理结构证据。
2. 二代 `cfaa_tab/cfaas_tab` 从四张贴源表构造的完整 ETL/过程尚未发现。此段在 Rich 中标为 `cannot_convert`，并引用一代 `CfaanMetroExtractServiceImpl` 作为候选业务证据，不能视为二代等价 SQL。
3. 源文件中文字段名称仅保留已核验的值；未核验字段保持空白，不以英文名冒充中文名。
4. `TransactionTab.refNo` 的最终赋值来源待确认。当前 OneGen 文档说明 `parseTxtFile` 未直接调用 `setRefNo`，但后续 JSH 查询依赖该字段。
5. `REPORT.TXT` 的业务意义待确认。当前仅确认它参与文件完整性校验。

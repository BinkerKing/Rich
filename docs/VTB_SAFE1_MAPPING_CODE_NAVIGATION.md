# VTB 一代 SAFE Mapping 代码导航

## 1. 文档目的

本导航面向继续分析 VTB 一代 SAFE 的 AI。目标是从一代 Java/Hibernate 实现还原**业务等价的二代 ETL Mapping**：

`接口文件 -> 贴源表 -> 中间/前置表 -> 报表正式表 -> XML 报文`

一代的 Java 代码是业务逻辑主依据；二代尚未定稿的存储过程或 SQL 仅可作辅助比对，不能反过来覆盖一代行为。

## 2. 代码根目录与阅读顺序

代码根目录：

`/Users/binkerking/Documents/Riking-Project/8-VBT/06-版本管理/SVN源码/SVN/FBDS/代码/fbds_vtb/src/net/riking`

推荐阅读顺序：

1. `business/service/impl/DataImportServiceImpl.java`：VTB 文件导入与报表提取总入口。
2. `business/service/impl/CfaVTBImportServiceImpl.java`：`TransactionTab` 加工 CFA 四张前置表的核心代码。
3. `aboq/service/impl/FaeBaseInfoServiceImpl.java`：JSH 结售汇基础信息、用途明细及 XML 报文逻辑。
4. `business/service/impl/CustomerImportServiceImpl.java`、`AccountImportServiceImpl.java`、`BalanceImportServiceImpl.java`：ACC 主数据/账户/余额正式表加工。
5. `business/service/impl/DataExtractVtbFalServiceImpl.java`、`FalObtainFromExdImpl.java`：FAL 报表分流与 EXD 取数过程调用。
6. 每个目标实体的 `model/*.java`、`model/*.hbm.xml`、对应 `dao/*Dao.java`：字段类型、列名、查询键和去重/取历史规则。

## 3. 总入口与实际运行顺序

### 3.1 文件入库

入口：`business/service/impl/DataImportServiceImpl.java`

| 方法 | 行号 | 作用 |
| --- | ---: | --- |
| `importVTBData(Date importDate)` | 1829 | 导入总入口；要求源目录内恰有 5 个文件，逐个解析。 |
| `parseTxtFile(File file)` | 2500 | TXT 字段拆解、贴源表清理及入库。 |
| `converVtbBopTransaction(...)` | 2709 | 交易贴源记录转 BOP 前置数据。 |
| `extractVTBData(...)` | 2796 | 根据报表编码分流 ACC/JSH/CFA/FAL 的正式报表加工。 |

`importVTBData` 的顺序：

1. 调用 `parseTxtFile` 导入源文件。
2. 调用 `cfaVTBImportService.importCFATab(importDate)` 生成 CFA 前置表。
3. 调用一代数据库过程 `proc_processData(importDate)`。
4. 成功后将源文件移入历史目录。

### 3.2 源文件与贴源表

`parseTxtFile` 按文件名前缀处理：

| 文件 | 贴源实体 | 关键行为 |
| --- | --- | --- |
| `CIF2.TXT` | `CifTab` | 每次导入前 `truncate table CifTab`。 |
| `AIF2.TXT` | `AifTab` | 仅保留 `isAccountIdFlag()` 为真的账户。 |
| `BLN2.TXT` | `BlnTab` | 按业务日先删除再插入；`RUR` 规范化为 `RUB`。 |
| `TRN2.TXT` | `TransactionTab` | 按交易日先删除再插入；长度大于 41 时才有 BOP/用途扩展字段。 |

`TRN2.TXT` 的字段位置、业务字段命名、导入时默认值，必须以 `parseTxtFile` 中 `traTab.setXxx(traTabStr[n])` 为准。不要用字段英文名排序推导文件顺序。

## 4. 模块分流地图

`extractVTBData(fileTypes, extractDate, flag, fileType)` 中的正则决定处理模块：

| 模块 | 触发编码 | 实际服务 | 核心输入 |
| --- | --- | --- |
| ACC | `ACCCA` / `ACCCB` | Customer、Account、Balance Import Service | `CifTab`、`AifTab`、`BlnTab` |
| JSH | `JSHD` / `JSHE` / `JSHF` / `JSHG` | `FaeBaseInfoServiceImpl.importFAEBaseInfoData` | `TransactionTab`、`Customer`、`UseType`、`TxCode` |
| CFA | `CFA...` | `cfaMetroExtractService.extractCfaData` | CFA 前置表及标准 CFA 处理链路 |
| FAL | `FAL...` | `DataExtractVtbFalServiceImpl.extractFalData` | EXD/CFA 等正式业务表、存储过程 |

注意：`BopTransaction` 在文件导入阶段由 `converVtbBopTransaction` 生成；它不是 `extractVTBData` 中单独通过正则触发的 VTB 分支。

## 5. CFA：必须优先分析的 VTB 前置加工

核心类：`business/service/impl/CfaVTBImportServiceImpl.java`

入口：`importCFATab(Date importDate)`，第 87 行。

输入为 `transactionTabDao.getTransactionTabByDate(yyyyMMdd)`。代码遍历当日 `TransactionTab`，输出四张前置表：

| 前置表 | 代码实体 | 典型交易场景 | 关键依赖 |
| --- | --- | --- | --- |
| 国内外汇贷款签约 | `CFACATab` | `usage` 以 `LOAN ISSUE` 开头、非 CNY | `Customer`、当前登录机构 |
| 国内外汇贷款变动 | `CFACBTab` | 提款、还本、付息 | `CFACA` 是否已有签约、历史 `CFACB` 余额 |
| 外保内贷签约 | `CFADATab` | `LOAN ISSUE` 且客户不在 DA 配置名单 | `Customer`、当前登录机构、`cfaCnumFilter.properties:DA` |
| 外保内贷变动 | `CFADBTab` | 提款、还本、付息 | `CFADA` 是否已有签约、历史 `CFADB` 余额 |

### 5.1 CFA 重要语义

- `usage` 必须包含 `LD`，合同/业务号是从首次 `LD` 位置截取 13 位，而不是当前前置表的 `DealNo` 自引用。
- `trn.isOppositersAccountIDFlag()` 是 Java 帮助判断，二代 Mapping 要展开成等价账号前缀条件，不能把这个 Java 布尔方法当数据库字段。
- `CFACB`/`CFADB` 的“期初余额”来自历史正式表查询；需要读取相应 DAO 的查询条件，不能简单以 `报表.变动日期 < 参数日期` 直接 Join，否则会导致一对多重复。
- `cfaCnumFilter.properties:DA` 是一代配置文件中的客户清单，不是数据库表字段。二代应显式配置为参数/清单，或建码表后用可追踪关联表示。
- `Customer` 是主数据表，关联键应以代码为准（如 `TransactionTab.customerCode = Customer.bankCustomerCode`）；先检查实体和 HBM，不能臆造 `Customer.customerCode`。

## 6. ACC：客户、账户与余额

| 目的 | 服务类 | 入口方法 |
| --- | --- | --- |
| 客户主数据 | `business/service/impl/CustomerImportServiceImpl.java` | `importVTBCustomerData()`，287 行 |
| 账户数据 | `business/service/impl/AccountImportServiceImpl.java` | `importVTBAccountData(Date)`，591 行 |
| 余额数据 | `business/service/impl/BalanceImportServiceImpl.java` | `importVTBBalanceData(Date)`，597 行 |

分析 `Customer` 时要区分：

- `CifTab`：本次文件导入的客户贴源数据。
- `Customer`：主数据/全量客户表，由客户导入逻辑维护，可被 CFA/JSH 等下游关联。
- 需要从 `CustomerImportDao.importVTBCustomerData(...)`、其 SQL 配置及实体映射确认“已存在更新/不存在新增”的精确条件；不能只根据表名推断。

## 7. JSH：FAEBaseInfo / FAEManage

核心类：`aboq/service/impl/FaeBaseInfoServiceImpl.java`

| 方法 | 行号 | 作用 |
| --- | ---: | --- |
| `importFAEBaseInfoData(Date)` | 488 | 由交易记录及配对历史记录识别结汇/购汇。 |
| `setFAEBaseInfos(...)` | 672 | 逐字段赋值：币种、账户、金额、客户、汇率、状态等。 |
| `createElementJSHD(...)` | 164 | 生成结汇 XML 报文节点。 |
| `createElementJSHE(...)` | 323 | 生成购汇 XML 报文节点。 |

核心来源：T 日交易 `t` 与同业务号的历史配对交易 `p`。

### 7.1 必须保留的行为细节

- 配对查询来自 `TransactionTabDao`：同 `refNo`、不同记录、交易日期不晚于当前日期，并取最近日期记录。
- 原 Java 在同一最近日期存在多笔配对交易时缺少稳定排序；二代应在口径中明确确定性规则，例如“日期倒序、ID 升序取一条”，并注明这是为避免一对多而做的技术确定化。
- 结汇与购汇方向由 `transactionType`、`paymentFlag`、本方/对方账号的前缀判断共同决定；要把 Java 帮助方法完整展开。
- `FAEManage` 仅在结汇且 `useType` 非空时创建；`UseType` 与 `TxCode` 是码表查询，不应写为自由文本 SQL 或伪字段。
- 一代对非空但未命中 `TxCode` 的行为会在取列表首项时失败；二代必须明确选择“阻断并报错”或等价校验，不能悄悄置空。
- JSH 最终是 XML 报文；报文层不应被当成可被上游 Join 的落库表。

## 8. BOP：交易前置数据

核心方法：`DataImportServiceImpl.converVtbBopTransaction(...)`，2709 行。

该方法在 `TRN2.TXT` 导入 `TransactionTab` 前运行，读取客户主数据映射并构造 `BopTransaction`。继续分析时应：

1. 逐段检查 `if (tran.isAccountIdFlag())` 及其分支。
2. 对照 `BopTransaction` 实体/HBM 确认最终字段和物理列。
3. 区分“文件字段直接取值”“客户主数据补充”“固定值/默认值”“BOP 码值转换”。

## 9. FAL 与 EXD

| 类 | 关键方法/位置 | 作用 |
| --- | --- | --- |
| `DataExtractVtbFalServiceImpl` | `extractFalData(...)`，106 行 | 按 FAL 编码分流处理。 |
| 同上 | 882 行 | 调用 `usp_obtainFalFromExd(?,?,?,?)`。 |
| `FalObtainFromExdImpl` | 43 行 | 封装调用同一存储过程。 |

VTB 分支目前可直接确认的 FAL 编码映射：

| 触发编码 | 报表代码 |
| --- | --- |
| `FALZB` | `Z02` |
| `FALDB` | `D02` |
| `FALDE` | `D0501` |
| `FALFA` | `F01` |
| `FALDK` | `D09` |

FAL 不能只看 `usp_obtainFalFromExd`。先从 `extractFalData` 的每个分支找到其正式表写入、调用的 DAO/SQL 和前置来源，再确定 EXD/CFA 到 FAL 的具体依赖。

## 10. 报表层与报文层的分析边界

1. Mapping 的数据源最多到**报表正式表**；XML 报文不是可关联的数据表。
2. `createElement...` 方法用于确认报表字段如何映射为 XML 节点，不反向作为报表取数来源。
3. 二代报表若用 EXD 正式表替代一代 `CFAAN`/`CFAAS`，应在数据流中明确这是“表结构替换”，而非断言一代没有对应业务逻辑。
4. 标准报表逻辑与 VTB 实际启用报表必须区分：不涉及/未启用的表标记为“不使用”，不能伪造 Mapping。

## 11. 二代 Mapping 填报规则

### 11.1 口径（场景）

- 只写 `FROM`、`JOIN`、`ON`、`WHERE`、去重/取最新等行级集合逻辑。
- 使用真实数据表、真实字段、真实别名。
- 前置条件和业务场景说明写在口径备注，不要重复写入每个字段备注。
- 若需要“取同业务号最近历史记录”，必须使用标准的 `select_latest` / LATERAL 等价能力；不可用仅日期小于条件替代。

### 11.2 字段 Mapping

- 每个场景必须覆盖目标表的全部字段，不多不少。
- 字段逻辑只描述该字段来源或转换：直取、常量、置空、日期解析、码值映射、COALESCE、CASE、绝对值/类型转换、运行时上下文、数据库生成等。
- 能表达为标准动作时不要使用 `sql` 动作；如标准动作缺失，应记录缺失动作需求，而不是写模糊的手工逻辑。
- 目标表字段不能作为自己字段的上游来源；应展开回真正输入字段或已在口径中关联的上游表字段。
- `COALESCE` 应使用对应的标准动作，不要为了规避能力改写为不必要的 `CASE WHEN`。
- 字段备注只写字段级业务说明、原一代行为、异常/边界；不要重复存放标准 JSON 或场景前置条件。

### 11.3 SQL 验证

- 运行时上下文（当前机构代码、当前机构名称等）需要在生成/验证 SQL 时注入参数，不能输出裸中文文本或 `:参数` 直接交给 PostgreSQL 执行。
- SQL 验证错误先判断：标准 JSON 写法错误、字段/表元数据不全、动作编译器不支持、还是运行时参数未注入。
- 转换出的 SQL 是验证产物；Mapping 的权威来源仍是标准 JSON 逻辑与真实一代语义。

## 12. 建议的单表分析工作流

1. 找到目标实体的创建点和 `setXxx` 赋值点。
2. 记录主循环输入、所有查询/关联、if 条件和异常分支。
3. 打开 HBM/实体确认字段类型、长度、列名；不可把“Java 未赋值”误写成“类型未知”。
4. 将行级筛选、关联和历史取数写入口径。
5. 将每一个 setter 转为一个标准字段动作；未调用 setter 的字段才是置空或数据库生成。
6. 通过 DAO 查询确认关联键和历史记录唯一性，避免“日期小于”造成重复。
7. 填写字段备注：保留一代行为、默认值理由、异常/配置依赖。
8. 验证场景字段数量、关联字段是否真实存在、标准 JSON 是否可编译 SQL。

## 13. 本导航的已知边界

- 这是 VTB 一代代码的导航，不是最终二代存储过程设计文档。
- `proc_processData`、`usp_obtainFalFromExd` 等数据库过程的完整定义需另行定位数据库脚本后才能完成逐字段还原。
- 标准 CFA 处理链路位于 `cfaMetroExtractService` 及其依赖中；VTB 前置逻辑在 `CfaVTBImportServiceImpl`，两者都需要分析，不能只看其中一个。
- 所有“码表/配置文件”都应进入数据字典：需要明确是物理码表、项目参数、运行时上下文，还是一代仅有的 properties 配置。

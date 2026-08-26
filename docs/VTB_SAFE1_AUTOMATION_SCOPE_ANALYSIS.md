# VTB 一代 SAFE 自动化范围与 Mapping 依据

更新时间：2026-08-26

## 结论

本次按 RICH-2 明确的 27 张自动化目标复核一代 VTB Java/Hibernate、已取回的 SQL Server 过程、二代 ODS 迁移资料和 Rich 数据字典。当前可分为：

- 14 张已在 Rich 维护字段级 Mapping：ACC 2 张、JSH 3 张、CFA 4 张、FAL 5 张。
- 11 张已有一代/ODS 代码证据，但字段级 Mapping 尚未回写 Rich：BOP 8 张、EXD 2 张、JSH 购汇管理信息 1 张。
- 2 张属于本次新确认的二代自动化范围：SAC-JP/JR。二代 SAFE 应用存在表和字段模型，但一代 VTB 主入口没有 SAC 加工链路，因此不能从一代代码反推出其上游 Mapping。

Rich 中 `has_mapping` 以实际存在 Mapping 场景为准；仅有目标表字段或自动化范围标记不算 Mapping 完成。

## 自动化范围覆盖矩阵

| 模块 | 接口 | 二代目标表 | 当前依据 | Rich Mapping 状态 | 后续动作 |
| --- | --- | --- | --- | --- | --- |
| BOP | A | `T_SAFE_BOPA` | `TransactionTab -> BopTransaction` 已还原；最终 BOPA-F 分类依赖人工/业务规则 | 缺失 | 确认分类规则后补主表 Mapping |
| BOP | B | `T_SAFE_BOPB` | 同上 | 缺失 | 同上 |
| BOP | C | `T_SAFE_BOPC` | 同上 | 缺失 | 同上 |
| BOP | D | `T_SAFE_BOPD` | 同上 | 缺失 | 同上 |
| BOP | E | `T_SAFE_BOPE` | 同上 | 缺失 | 同上 |
| BOP | F | `T_SAFE_BOPF` | 同上 | 缺失 | 同上 |
| BOP | G | `T_SAFE_BOPA_G` | BOPA 申报附表及 XML/校验代码可确认目标结构，自动生成来源未确认 | 缺失 | 明确申报信息来源及基础表关联 |
| BOP | H | `T_SAFE_BOPB_H` | BOPB 申报附表及 XML/校验代码可确认目标结构，自动生成来源未确认 | 缺失 | 明确申报信息来源及基础表关联 |
| ACC | CA | `T_SAFE_ACCCA` | `CifTab/AifTab -> Customer/Account -> ACCCA` | 已维护 | 继续处理已登记的一代疑似缺陷 |
| ACC | CB | `T_SAFE_ACCCB` | `BlnTab/Account/Balance -> ACCCB`，包含余额连续性校验 | 已维护 | 继续处理业务确认项 |
| JSH | D | `T_SAFE_JSHD` | `TransactionTab + 配对交易 + Customer -> FAEBaseInfo` | 已维护 | 保留多配对记录确定化说明 |
| JSH | E | `T_SAFE_JSHE` | 同上，按交易方向区分购汇 | 已维护 | 确认一代 `LCYCCY` 疑似问题 |
| JSH | F | `T_SAFE_JSHD_F` | `FAEManage + UseType + TxCode` | 已维护 | 未命中码表应阻断，不静默置空 |
| JSH | G | `T_SAFE_JSHE_G` | 一代目标/报文结构存在，但当前自动生成来源未得到证明 | 缺失 | 确认购汇管理信息来源 |
| CFA | CA | `T_SAFE_CFAC_A` | `TransactionTab -> CFACATab -> CFACA` | 已维护 | 保留 DA 客户过滤配置 |
| CFA | CB | `T_SAFE_CFAC_B` | `TransactionTab + 历史 CFACB -> CFACBTab -> CFACB` | 已维护 | 历史余额必须取唯一最近记录 |
| CFA | DA | `T_SAFE_CFAD_A` | `TransactionTab -> CFADATab -> CFADA` | 已维护 | 空客户处理待业务决定 |
| CFA | DB | `T_SAFE_CFAD_B` | `TransactionTab + 历史 CFADB -> CFADBTab -> CFADB` | 已维护 | 付息不减本金按一代保留并标疑问 |
| FAL | ZB | `T_SAFE_FAL_Z02` | VTB 白名单 `FALZB -> Z02`；上月数据滚动 | 已维护 | 无 |
| FAL | DB | `T_SAFE_FALD_02` | VTB 白名单 `FALDB -> D02`；Excel/仓库数据与上月余额 | 已维护 | 无 |
| FAL | DE | `T_SAFE_FALD_0501` | `EXDA_L/M/N + EXDA_S + 上月 D0501`；一代 `usp_obtainFalFromExd` | 已维护 | 一代疑似缺陷是否纠偏待确认 |
| FAL | DJ | `T_SAFE_FALD_09` | `FalWarehouse` 逐源行生成，不按币种汇总 | 已维护 | 无 |
| FAL | FA | `T_SAFE_FALF_01` | VTB 白名单 `FALFA -> F01`；Excel/仓库数据与上月余额 | 已维护 | 无 |
| EXD | AN | `T_SAFE_EXDA_N` | `CFAAN/CFAA* -> EXDA_N`；二代 ODS 已实现并回归 | 缺失 | 将既有 ODS Mapping 回写 Rich |
| EXD | AS | `T_SAFE_EXDA_S` | 合同余额/变动形成余额表；二代 ODS 已实现并回归 | 缺失 | 将既有 ODS Mapping 回写 Rich |
| SAC | JP | `T_SAFE_SAC_JP` | 二代 SAFE `Sacjp` 实体、应用字段字典；一代 VTB 主入口无 SAC | 缺失（新增范围） | 取得源系统字段、筛选条件和触发频率 |
| SAC | JR | `T_SAFE_SAC_JR` | 二代 SAFE `Sacjr` 实体、应用字段字典；一代 VTB 主入口无 SAC | 缺失（新增范围） | 取得源系统字段、筛选条件和触发频率 |

## 一代主处理链

```text
CIF2/AIF2/BLN2/TRN2
  -> CifTab/AifTab/BlnTab/TransactionTab
  -> Customer/Account/Balance、BopTransaction、CFA 前置表、FAEBaseInfo/FAEManage
  -> ACC/CFA/JSH/BOP 正式表
  -> EXD/FAL 派生表
  -> XML 报文
```

`DataImportServiceImpl.importVTBData` 在源文件入库后依次调用 `CfaVTBImportServiceImpl.importCFATab` 和 `proc_processData`。`proc_processData` 负责 `RUR -> RUB`、BOP 客户号回填和 RCPMIS 2105/2121 加工，不负责把 BOP 待判定记录自动分类为 BOPA-F。

## 关键证据边界

- 一代源码根目录：`/Users/binkerking/Documents/Riking-Project/8-VBT/06-版本管理/SVN源码/SVN/FBDS/代码/fbds_vtb`。
- 总入口：`DataImportServiceImpl.importVTBData`、`parseTxtFile`、`extractVTBData`、`converVtbBopTransaction`。
- CFA：`CfaVTBImportServiceImpl.importCFATab` 与 `CfaMetroExtractServiceImpl.extractCfaData` 必须同时分析。
- JSH：`FaeBaseInfoServiceImpl.importFAEBaseInfoData`；配对记录按 `refNo`、非自身、日期不晚于当前交易取最近记录。
- FAL：`DataExtractVtbFalServiceImpl` 的 VTB 白名单只有 Z02、D02、D0501、D09、F01；不能把通用 FAL 页面全部报表纳入 VTB 自动化。
- EXD/FAL D0501：一代 `usp_obtainFalFromExd` 已证明来源包含 CFAAL/CFAAM/CFAAN 与 CFAAS，不是单一合同表。
- SAC JP/JR：二代部署包存在 `T_SAFE_SAC_JP/T_SAFE_SAC_JR`、`Sacjp/Sacjr` 实体及应用字段配置；一代 VTB `extractVTBData` 未触发 SAC。它们应视为二代新增需求，等待业务源映射，不应伪造一代来源。

## 必须业务确认的 Mapping 前置条件

1. BOP stage 到 A-F 六类基础表的分类规则，以及 G/H 申报信息是否自动生成或人工补录。
2. `T_SAFE_JSHE_G` 的自动来源、与 `T_SAFE_JSHE` 的关联键及码表规则。
3. SAC-JP/JR 的源系统/源文件、交易筛选条件、阈值口径、调度频率、增量键和重跑策略。
4. EXD AN/AS 采用现有 ODS 复刻口径，还是按二代业务规则纠偏；确认后再将字段 Mapping 标记为正式。

## 验证口径

- 目标字段数必须与 Rich 表元一致，每个场景不多不少。
- 历史记录/余额关联必须确定化取唯一记录，禁止只写日期小于条件导致一对多。
- Java 帮助方法必须展开为可执行条件；properties 配置必须进入参数或码表。
- XML 节点只用于验证报文映射，不作为上游数据表。
- 一代疑似缺陷必须同时保留“原样复刻”和“二代修正建议”，由业务决定。

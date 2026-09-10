# VTB SAFE 原阻塞项重启执行计划

## 执行判定

只要 SAFE1.3 的 Java、存储过程或一代可读取配置能够还原规则，二代就必须补齐数据模型、Mapping、抽数/生成过程和测试。二代当前没有上游表、字段或生成器表达能力，不构成业务阻塞。

仅在下列证据均不存在时，才登记为需要业务确认：一代代码规则、一代存储过程规则、一代配置值或可追溯的历史配置数据。

## 已重启范围

| 组别 | 子任务 | 一代实现依据 | 二代处理目标 |
| --- | --- | --- | --- |
| ACC | Account、Balance、ACC CA、ACC CB | `BaseAccDataExtractServiceImpl`、`BaseAif`、`AccountTypeMapping` | 建立 BaseAif/账户类型映射/生命周期模型，生成 ACC 两表。 |
| JSH | JSH D、JSH E、JSH F、JSH G | `DataExtractMetroNewJshServiceImpl`、`FaeManageServiceImpl` | 建立 RKJshtab/RKAiftab 贴源模型及交易编码映射，再生成四表。 |
| BOP | BOP A--F | `BopTransServiceImpl` | 建立人工分流字段、客户和账户属性承接及六类输出/重跑语义。 |
| FAL | FalWarehouse、Z02、D02、D0501、D09、F01 | `DataExtractVtbFalServiceImpl`、`FalWarehouse` | 建仓表与状态字段，补齐按月重提保护、强制重提和各表加工。 |
| SAC | SAC JP、SAC JR | SAFE1.3 `PROC_SAFE_SAC_JP/JR` | 以一代过程重建窗口、配对、阈值、去重及重跑语义。 |

## 每项闭环标准

1. 数据字典中可见上游、临时/中间和目标实体及字段逻辑。
2. 规则从一代代码或过程逐字段追溯，不以静态默认值替代一代分支。
3. SQL 验证通过，生成的存储过程可以创建并执行。
4. 在 `vtb_ods` 以覆盖新增、更新、已审核、已发送、关闭、异常和重跑的造数验证结果。

## 当前先后顺序

1. Account/Balance/ACC：其结果又是多处账户相关规则的基础。
2. JSH D/E/F/G 与 BOP A--F：补齐贴源和码表承接。
3. FAL 仓表和生命周期：扩展生成器所需表达能力后逐报表落地。
4. SAC JP/JR：按一代存储过程重建时间窗口与保留语义。

## 生命周期实现约束

优先使用 Rich 数据字典既有的临时查询表、运行参数和 `extractionClearWhere` 生成机制：临时查询表负责把一代的新增、更新、保护和关户分支归并为候选集；目标表只删除同业务日、未审核且可重提的记录，再插入候选集。这样生成过程、界面口径和 SQL 验证共用同一份配置。

除非某项一代规则无法由该机制表达，不新增一次性生成脚本，也不把报表专用 SQL 写死到应用代码。

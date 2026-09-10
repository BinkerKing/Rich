# FalWarehouse 共享仓建模验证

一代依据：`FalWarehouse.java`、`FalImportSBIServiceImpl.saveFalWarehouse`、`DataExtractVtbFalServiceImpl.initData/extractD02/extractF01/extractD09`。

FalWarehouse 是 FAL 的共享中间仓，不是独立上报表。键性使用维度包括 FAL 表号、机构、业务日期和参考号；D02/F01 逐行消费并关联上期记录，D09 按币种汇总消费。

二代已建立 `vtb-onegen-middle-falwarehouse`，登记 23 个一代模型字段。物理表 `vtb.fal_warehouse` 原有 22 列，已补齐一代 `enName` 对应的 `en_name` 列；当前字典和物理表均为 23 列。下游 D02、F01、D09 生成过程已用该实体完成验证。

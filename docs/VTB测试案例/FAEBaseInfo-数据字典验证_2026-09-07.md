# FAEBaseInfo 数据字典验证

一代依据为 `FaeBaseInfoServiceImpl` 及相关结售汇提取逻辑。已回读两个场景：JSH 结汇与购汇均按原始 `refNo` 精确关联，在同一 `refNo` 中取不晚于主交易的最近日期全部候选；自动申报号为空，零金额导致 Java 逐行除法异常而不落行。

验证：多场景 Mapping SQL 和实体结构通过，成功创建 `vtb.fae_base_info_extract_test_data(dataDate)`。回滚事务构造结汇主交易（CNY 700）及前一日关联外币交易（USD 100），输出 `buscode=FAE-REF-1`、结汇标志 1、客户类型 D、证件代码 ENC-FAE、外币账号/金额 USD 100、人民币金额 CNY 700、汇率 7.00000000、RepNo 为空，与一代一致。事务已回滚。

保留差异：一代保护已确认/已发送记录不更新；通用过程全表 DELETE 无法表达该保护，属于过程生命周期待闭环项。

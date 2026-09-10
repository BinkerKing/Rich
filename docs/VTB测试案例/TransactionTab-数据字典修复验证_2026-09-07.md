# TransactionTab 数据字典核验与验证

一代依据为 `DataImportServiceImpl.parseTxtFile` 与 `TransactionTab.java`。`TRN2.TXT` 使用 UTF-16 与 `split("|", -1)`，基础列为 1–40；扩展列实际会读取至第 50 列，故安全输入必须至少 50 列。首次有效记录的 `transactionDate` 是一代重入删除范围。

当前 53 个字段的文件位置、扩展字段、`refNo` 与汇率规则已逐项回读。`refNo` 的一代顺序为 FXCBC、FXCSC、RBS 依次覆盖，因此最终优先级为 RBS > FXCSC > FXCBC；USD 汇率固定 1，RUB 对 `paymentDirection` 中 `@` 后的汇率取倒数并保留 8 位。

验证：Mapping SQL、实体结构、`vtb.transaction_tab_extract_test_data()` 创建均通过。在可回滚事务插入完整 50 列样例，覆盖 RUB、三种关联标记及扩展 BOP 字段；结果保留 `trade_amount=200000.1234`、`ref_no=RBSABCDEFGH`、`rate=0.01426056`，且 `use_type`、`usedetail`、BOP 字段及申请人均正确映射。事务已回滚。

保留差异：生成过程固定全表 DELETE；一代只删除首条有效记录对应的交易日，且不足 50 列的一代会越界失败。这两项属于当前通用过程/文件接入能力差异，不能静默改变一代行为。

# BopTransaction 数据字典核验与验证

一代依据为 `DataImportServiceImpl.converVtbBopTransaction` 与 `BopTransaction.hbm.xml`。每笔 TransactionTab 最多产生两条前置记录：本方账号及对方账号分别满足 `40*` 且非 `409*` 时各生成一条。

已核对两个场景：本方场景客户号取交易客户号、对手名称直接取交易对手；对方场景客户号不赋值、对手名称取启用 Customer 的英文名。两场景均保留交易日期、金额、BOP 编码/备注/预付款/申请人；BOP 金额为空时置 0，支付方式固定 `T`，借贷方向按一代收付标志转换。

验证：100 条 Mapping 规则均已验证，SQL 多场景校验、实体结构及 `vtb.bop_transaction_stage_extract_test_data()` 创建均通过。在可回滚事务构造一笔本方与对方账号均合格的交易，过程输出两条记录：本方记录 `cnum=BOP-CUST`、`op_name=交易对手名`、`drcr=C`；对方记录 `cnum=NULL`、`op_name=BOP Customer`、`drcr=D`；空 `amount_for_bop` 被写为 0、第二金额为 50.5、`pay_method=T`，符合一代。事务已回滚。

保留差异：一代按导入日期清理 BOP 前置记录，通用过程目前固定全表 DELETE；该重跑生命周期待生成能力闭环。

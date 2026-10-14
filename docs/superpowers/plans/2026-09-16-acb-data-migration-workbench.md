# 东方汇理查控数据迁移工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不接触生产库的前提下，为公安查控、法院查控两类表建立可验证的一代至三代迁移工作台。

**Architecture:** 以参数化 SQL 模板、迁移台账和验收证据组成可审计闭环。数据库方言与表结构未确认前，所有对象名均为占位符，生产执行被待确认项阻断。

**Tech Stack:** Markdown、受控 SQL 执行器、源/目标数据库的已确认方言。

---

### Task 1: 完成迁移前置确认

**Files:**
- Modify: `docs/migrations/acb-product-v1-to-v3/README.md`

- [ ] 收集两类表的字段映射、主键策略、脱敏规则、源/目标数据库类型和停机窗口。
- [ ] 由业务、数据、运维负责人签字确认范围、差异容忍度与回滚决策人。
- [ ] 将确认值替换到受控副本；不得在文档或日志中保存凭据。

### Task 2: 演练全量、增量和回滚

**Files:**
- Use: `docs/migrations/acb-product-v1-to-v3/sql/01_full_load.sql`
- Use: `docs/migrations/acb-product-v1-to-v3/sql/02_incremental_repair.sql`
- Use: `docs/migrations/acb-product-v1-to-v3/sql/03_validation.sql`
- Use: `docs/migrations/acb-product-v1-to-v3/sql/04_rollback.sql`

- [ ] 在隔离演练库建立迁移台账和唯一约束，运行全量模板并记录 `RUN_ID`。
- [ ] 制造新增、更新、删除和重复执行场景，运行增量/补数与校验模板。
- [ ] 执行回滚模板，证明仅撤销本 RUN_ID 的数据。

### Task 3: 生产窗口执行与验收

- [ ] 取得停机窗口与放行审批，冻结源端写入并登记最终水位线。
- [ ] 依次执行全量、最终增量、校验；差异未关闭即执行回滚，不切换业务。
- [ ] 归档映射版本、运行日志、校验结果、差异处置与验收签字。

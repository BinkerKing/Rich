# VTB SAFE 二代阶段 0/1 按表归属 ETL 改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变已验收目标表业务字段结果的前提下，以一代 Java 程序实际结果为权威，补齐二代账户/余额中间层并将二代写表逻辑改为每表唯一归属存储过程。

**Architecture:** 一代 Java Service/Action 负责定义表结果；二代 PostgreSQL 为每张贴源表、中间表和目标表提供唯一写入过程。先固定一代/二代基线和字段对账，再建立 `safe_account`、`safe_balance`，最后让 ACC 目标过程只读取中间表。总编排过程仅调用表过程，Rich 保存表—过程—字段表达式—版本哈希绑定。

**Tech Stack:** PostgreSQL PL/pgSQL、psql、Bash、既有 SAFE 双跑基线、Rich PostgreSQL 数据字典、TypeScript/tsx。

---

## 文件与职责

- Create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/69_capture_table_owner_baseline.sql` — 只读导出阶段 0 的过程、表结构、行数、哈希和依赖证据。
- Create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/46-20261009-一代程序与二代表归属证据.md` — 一代 Service/Action 与二代归属过程的逐表证据矩阵。
- Create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/70_test_safe_account_balance_table_owners.sql` — 先行失败的账户/余额中间层及 ACC 只读中间层断言。
- Create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/71_refactor_safe_account_balance_table_owners.sql` — `safe_account`、`safe_balance`、ACCCA、ACCCB 的唯一归属过程与兼容编排。
- Create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/72_test_safe_account_balance_dualrun.sql` — 既有测试日期的中间表、目标业务字段、新旧二代一致性断言。
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/34_run_safe2_regression.sh` — 将新测试纳入最后执行，失败即退出。
- Modify: `/Users/binkerking/Documents/Ai-WorkSpace/Rich/apps/server/scripts/sync-vtb-safe2-code-evidence.ts` — 只同步唯一归属过程，并校验一个过程不写多张业务表。
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/` 下的新发布目录 — 固化本次过程、版本说明、哈希与 Mapping 快照；不改历史 `v1.0.1`。
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/15-当前开发进度总览_20261008.md`、`33-验收证据矩阵_20261008.md`、`测试文件/SAFE双跑基线_20260901起/验收记录.md` — 记录过程归属、测试范围与结论。

## Task 1: 阶段 0 基线冻结与表归属清单

**Files:**
- Create: `sql/69_capture_table_owner_baseline.sql`
- Create: `46-20261009-一代程序与二代表归属证据.md`

- [ ] **Step 1: 写入只读基线采集 SQL**

创建 `69_capture_table_owner_baseline.sql`，其输出必须包含以下五类证据：

```sql
SELECT c.relname AS table_name,
       a.attnum AS ordinal_position,
       a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname = 'vtb'
  AND c.relname IN ('customer', 'safe_account', 'safe_balance',
                    'cfaca_tab', 'cfacb_tab', 'cfada_tab', 'cfadb_tab',
                    'bop_transaction_stage', 'fae_base_info', 'fae_manage',
                    't_safe_accca', 't_safe_acccb')
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;
```

再输出这些表的行数、主键/索引、`usp_vtb%` 过程完整定义、过程 SHA-256，以及过程读/写表清单。脚本中不得出现 `INSERT`、`UPDATE`、`DELETE`、`CALL` 或 DDL。

- [ ] **Step 2: 运行基线采集，确认其只读**

Run:

```bash
psql -X -v ON_ERROR_STOP=1 \
  'postgresql://binkerking@localhost/vtb_ods?host=/tmp&port=5432' \
  -f '/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/69_capture_table_owner_baseline.sql'
```

Expected: 输出 Customer、账户、余额、CFA、BOP、FAE、ACC 的表结构与过程证据；数据库对象和业务行数不发生变化。

- [ ] **Step 3: 编写一代程序—二代表证据矩阵**

在 `46-20261009-一代程序与二代表归属证据.md` 建立每表一行的矩阵。每行必须包含：一代 Java Service/Action、实际一代表、二代物理表、二代归属过程、二代调用顺序、对账主键、自动业务字段、人工/审批排除字段、证据文件或反编译类路径。

矩阵首批固定覆盖：`Customer`、`Account`/`safe_account`、`Balance`/`safe_balance`、四张 CFA 中间表、`BopTransaction`、`FAEBaseInfo`、`FAEManage`、`T_SAFE_ACCCA`、`T_SAFE_ACCCB`。

- [ ] **Step 4: 从一代实际程序提取账户与余额行为**

使用一代应用包中的类、运行日志、已有一代测试记录和一代库数据，记录以下不能猜测的事实：Account/Balance 的写入、更新、删除、状态、主键、同日重导、历史保留、客户取值、NRA、收支方向和调用顺序。若某项没有证据，矩阵状态必须写为“待一代证据”，不得写入二代实现。

- [ ] **Step 5: 提交阶段 0 证据**

```bash
git -C /Users/binkerking/Documents/Ai-WorkSpace/Rich add docs/superpowers/plans/2026-10-09-vtb-safe2-stage0-stage1-table-owner.md
git -C /Users/binkerking/Documents/Ai-WorkSpace/Rich commit -m 'docs: plan SAFE2 table-owner stage 0 and 1'
```

将 VTB SQL 和证据文档按其所在仓库的既有版本管理规则提交或固化；不得混入 Rich 工作区已有未提交文件。

## Task 2: 账户与余额中间层失败测试

**Files:**
- Create: `sql/70_test_safe_account_balance_table_owners.sql`

- [ ] **Step 1: 写入失败断言**

测试先检查两个过程尚不存在或尚未满足唯一归属定义：

```sql
DO $$
BEGIN
  IF to_regprocedure('vtb.usp_vtb_refresh_safe_account(date,numeric,character varying,character varying)') IS NULL THEN
    RAISE EXCEPTION 'missing table-owner procedure usp_vtb_refresh_safe_account';
  END IF;
  IF to_regprocedure('vtb.usp_vtb_refresh_safe_balance(date,numeric,character varying)') IS NULL THEN
    RAISE EXCEPTION 'missing table-owner procedure usp_vtb_refresh_safe_balance';
  END IF;
END;
$$;
```

随后在现有 2026-09-01、2026-09-04、2026-10-09 基线数据上断言：过程重跑后 `safe_account`、`safe_balance` 有对应业务日期数据；ACCCA/ACCCB 过程定义不包含 `FROM vtb.aif_tab`、`FROM vtb.bln_tab` 或 `FROM vtb.transaction_tab`；Customer 缺失时账户过程抛出明确异常。

- [ ] **Step 2: 运行测试并确认失败原因正确**

Run:

```bash
psql -X -v ON_ERROR_STOP=1 \
  'postgresql://binkerking@localhost/vtb_ods?host=/tmp&port=5432' \
  -f '/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/70_test_safe_account_balance_table_owners.sql'
```

Expected: 在当前实现上失败，并明确指出缺少账户/余额归属过程或 ACC 仍直接读取贴源表；不得因为测试数据缺失、SQL 拼写或连接问题失败。

## Task 3: 实现 Customer、账户、余额、ACC 的表归属过程

**Files:**
- Create: `sql/71_refactor_safe_account_balance_table_owners.sql`

- [ ] **Step 1: 实现 `usp_vtb_refresh_safe_account`，且只写 `safe_account`**

过程签名固定为：

```sql
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_refresh_safe_account(
    IN p_business_date date,
    IN p_branch_id numeric,
    IN p_branch_code varchar,
    IN p_safe_branch_code varchar
)
```

实现前只采用 Task 1 已确认的一代行为。过程必须从 `aif_tab` 与已启用 `customer` 取数，写入 `safe_account`，并将账户类型映射、NRA 条件、客户编码、客户名称和业务日期固化。过程不得写 `t_safe_accca`、`safe_balance` 或任何产品表；不允许使用当天 `cif_tab` 回退客户主数据。

- [ ] **Step 2: 实现 `usp_vtb_refresh_safe_balance`，且只写 `safe_balance`**

过程签名固定为：

```sql
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_refresh_safe_balance(
    IN p_business_date date,
    IN p_branch_id numeric,
    IN p_branch_code varchar
)
```

过程必须只按 Task 1 已确认的一代 Balance 逻辑，从 `bln_tab`、`transaction_tab` 与 `safe_account` 生成余额、贷方、借方和账户关联。过程不得写 `t_safe_acccb`、`safe_account` 或产品表。

- [ ] **Step 3: 拆分 ACC 目标过程**

创建以下两个过程，并将旧 `usp_vtb_safe2_extract_acc` 改为仅按顺序调用它们：

```sql
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_build_t_safe_accca(
    IN p_business_date date,
    IN p_branch_id numeric,
    IN p_branch_code varchar,
    IN p_branch_name varchar,
    IN p_safe_branch_code varchar,
    IN p_safe_branch_name varchar
);

CREATE OR REPLACE PROCEDURE vtb.usp_vtb_build_t_safe_acccb(
    IN p_business_date date,
    IN p_branch_id numeric,
    IN p_branch_code varchar,
    IN p_branch_name varchar,
    IN p_safe_branch_code varchar,
    IN p_safe_branch_name varchar
);
```

`usp_vtb_build_t_safe_accca` 只写 `t_safe_accca` 且只读 `safe_account`；`usp_vtb_build_t_safe_acccb` 只写 `t_safe_acccb` 且只读 `safe_account`、`safe_balance`、已生成 ACCCA。保留现有字段表达式和一代状态语义，不直接更新或补写历史产品结果。

- [ ] **Step 4: 修改总编排顺序**

在 `usp_vtb_safe2_process_all` 的 ACC 分支按以下顺序调用：

```sql
CALL vtb.usp_vtb_refresh_customer_from_cif(p_business_date);
CALL vtb.usp_vtb_refresh_safe_account(p_business_date, p_branch_id, p_branch_code, p_safe_branch_code);
CALL vtb.usp_vtb_refresh_safe_balance(p_business_date, p_branch_id, p_branch_code);
CALL vtb.usp_vtb_build_t_safe_accca(p_business_date, p_branch_id, p_branch_code, p_branch_name, p_safe_branch_code, p_safe_branch_name);
CALL vtb.usp_vtb_build_t_safe_acccb(p_business_date, p_branch_id, p_branch_code, p_branch_name, p_safe_branch_code, p_safe_branch_name);
```

若一代证据表明 Customer 增量只能在特定一代 Action 后执行，则总编排不得擅自调用 Customer 增量过程，改为仅验证 Customer 已存在并报错。

- [ ] **Step 5: 重跑 Task 2 测试并确认通过**

Run the same command from Task 2.

Expected: 两个中间层过程存在、每个过程只写其归属表、ACC 目标过程不再直接读取 AIF/BLN/Transaction 贴源表、Customer 缺失得到预期错误。

- [ ] **Step 6: 提交二代 SQL 改造**

提交仅包含 `71_refactor_safe_account_balance_table_owners.sql` 和已通过的 `70_test_safe_account_balance_table_owners.sql`；提交信息：

```bash
git commit -m 'feat: add SAFE2 account and balance table owners'
```

## Task 4: 既有测试数据回归与一代对账

**Files:**
- Create: `sql/72_test_safe_account_balance_dualrun.sql`
- Modify: `sql/34_run_safe2_regression.sh`
- Modify: `15-当前开发进度总览_20261008.md`
- Modify: `33-验收证据矩阵_20261008.md`
- Modify: `测试文件/SAFE双跑基线_20260901起/验收记录.md`

- [ ] **Step 1: 写入中间层与目标表断言**

`72_test_safe_account_balance_dualrun.sql` 逐个业务日期运行 2026-09-01、2026-09-04、2026-10-09。每个日期输出并断言：

```sql
SELECT business_date, account_no, currency_code, customer_no, en_code, en_name,
       account_type, account_limit_type, account_limit
FROM vtb.safe_account
WHERE business_date = :business_date
ORDER BY account_no, currency_code;

SELECT deal_date, account_no, currency_code, balance, credit, debit
FROM vtb.safe_balance
WHERE deal_date = :business_date
ORDER BY account_no, currency_code;
```

随后按账号、币种、业务日期比较新旧二代 ACCCA/ACCCB 的业务字段，并调用现有一代/二代核对脚本对同源一代 `Account`、`Balance`、ACCCA、ACCCB 数据执行字段级比较。审计、审批、人工维护字段不得进入自动相等断言。

- [ ] **Step 2: 运行新回归，确认初次结果**

Run:

```bash
psql -X -v ON_ERROR_STOP=1 \
  'postgresql://binkerking@localhost/vtb_ods?host=/tmp&port=5432' \
  -f '/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/72_test_safe_account_balance_dualrun.sql'
```

Expected: 任一中间表或目标业务字段差异立即失败并输出业务日期、主键、字段名、一代值、二代值；全部一致时输出每个日期的通过摘要。

- [ ] **Step 3: 将测试加入总回归入口**

在 `34_run_safe2_regression.sh` 的最后一个已有 SQL 测试后添加：

```bash
psql -X -v ON_ERROR_STOP=1 "$db_url" \
  -f "$script_dir/72_test_safe_account_balance_dualrun.sql"
```

保持 `set -euo pipefail`，确保该测试失败时整个回归返回非零。

- [ ] **Step 4: 运行完整二代回归**

Run:

```bash
cd '/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发'
bash sql/34_run_safe2_regression.sh
```

Expected: 既有 Customer、ACC、JSH、BOP、CFA、EXD、FAL、SAC 测试保持通过；新增账户/余额中间层测试通过。

- [ ] **Step 5: 记录验收结论**

在三个验收文档记录每个业务日期的中间表行数、字段比较结果、目标表业务字段比较结果、已排除字段和证据路径。任何不一致必须保留为未关闭差异，不得改写结果表掩盖差异。

- [ ] **Step 6: 提交测试与证据**

```bash
git commit -m 'test: verify SAFE2 account balance intermediate dual run'
```

## Task 5: Rich Mapping—代码强绑定与新版本固化

**Files:**
- Modify: `/Users/binkerking/Documents/Ai-WorkSpace/Rich/apps/server/scripts/sync-vtb-safe2-code-evidence.ts`
- Create: 新发布版本目录中的过程 SQL、`VERSION.md`、`CHECKSUMS.sha256`、Mapping 快照

- [ ] **Step 1: 为归属过程加入单表写入校验**

扩展 `sync-vtb-safe2-code-evidence.ts`：解析每个过程的 `INSERT INTO`、`UPDATE`、`DELETE FROM` 目标。除 `process_log` 外，一个过程出现两个或更多业务写表目标时，脚本必须以非零状态退出，并打印过程名和表名。

- [ ] **Step 2: 写入失败测试并确认失败**

在脚本的最小测试输入中提供一个同时写 `vtb.safe_account` 与 `vtb.t_safe_accca` 的过程定义，断言输出：

```text
table-owner violation: <procedure> writes safe_account, t_safe_accca
```

先运行测试，确认旧解析逻辑未拒绝该输入。

- [ ] **Step 3: 实现校验并确认测试通过**

实现后重新运行测试；再对当前新过程包运行同步预演。Expected: 所有表归属过程通过；编排过程仅包含 `CALL`；Rich 的表级、场景级和字段级 External SQL 待更新数符合本次发布范围。

- [ ] **Step 4: 同步 Rich 并验证绑定**

Run:

```bash
cd /Users/binkerking/Documents/Ai-WorkSpace/Rich
pnpm --filter @ke/server exec tsx scripts/sync-vtb-safe2-code-evidence.ts
pnpm --filter @ke/server exec tsx scripts/sync-vtb-safe2-code-evidence.ts --dry-run
```

Expected: 第二次预演的表、场景、字段更新数均为 0；Customer、safe_account、safe_balance、ACCCA、ACCCB 的 External SQL 指向唯一归属过程及对应字段表达式。

- [ ] **Step 5: 建立新二代发布版本**

从已验证 SQL 创建新版本目录；包含 Customer/CFA 漏收的已部署过程、账户/余额过程、ACC 目标过程、编排过程、版本说明、过程 SHA-256 清单和 Rich Mapping 快照。不得修改 `v1.0.1_2026-10-08` 历史版本。

- [ ] **Step 6: 提交 Rich 绑定脚本和发布证据**

```bash
git -C /Users/binkerking/Documents/Ai-WorkSpace/Rich add apps/server/scripts/sync-vtb-safe2-code-evidence.ts
git -C /Users/binkerking/Documents/Ai-WorkSpace/Rich commit -m 'feat: enforce SAFE2 table-owner mapping bindings'
```

## 自检

- [ ] 阶段 0 证据覆盖 Customer、Account、Balance、CFA、BOP、FAE 和 ACC。
- [ ] 阶段 1 未修改任何产品/报表表结构。
- [ ] 每个新增/拆分过程先有失败测试，再有最小实现。
- [ ] 中间表和目标表都使用既有测试日期验证。
- [ ] Rich Mapping 的过程、字段 SQL、版本和哈希与发布包一致。

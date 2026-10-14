# VTB SAFE2 Dual-Run Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete reproducible, same-source SAFE1/SAFE2 verification for 20260901—20260905 without altering SAFE2 product/report table structures.

**Architecture:** SAFE1 remains the reference system: its UI/API import, extraction and existing approval Actions create the reference results. SAFE2 accepts the same files only through `*_TXT` raw tables, then runs raw → stage → intermediate → product procedures. Every comparison normalizes technical columns and the agreed blank semantics before comparing business keys and fields.

**Tech Stack:** SQL Server `fbds_vtb` in Docker, PostgreSQL `vtb_ods.vtb`, existing SAFE1 Tomcat Actions, Bash, Node.js test-data loader, SQL and Markdown evidence.

---

### Task 1: Rebuild and verify the Customer baseline

**Files:**
- Create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/22_refresh_customer_snapshot_from_onegen.sh`
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/07-Customer主数据快照与增量规则.md`
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/15-当前开发进度总览_20261008.md`

**Step 1: Read both schemas and constraints.**

Run: inspect the 88 columns, Customer counts, and PostgreSQL foreign keys.

Expected: no foreign key references block a transactional snapshot replacement.

**Step 2: Write the snapshot script.**

The script must export `dbo.Customer` as JSON, map `ctid` to `customer_ctid`, preserve null versus empty string, load a PostgreSQL temporary staging table, reject empty/duplicate source data, then replace `vtb.customer` inside one transaction.

**Step 3: Syntax-check and execute with a password supplied only in the process environment.**

Run: `bash -n sql/22_refresh_customer_snapshot_from_onegen.sh`, then execute with `ONEGEN_SQL_PASSWORD`.

Expected: staging and target counts both equal current SAFE1 `Customer` count.

**Step 4: Compare all rows and fields.**

Export both sides as canonical JSON sorted by `Id`; normalize only fractional timestamp trailing zero formatting; compare all 88 fields.

Expected: 1,215 rows on both sides and an identical canonical SHA-256 hash.

**Step 5: Record the evidence.**

Expected: Customer is not a blocker for subsequent CFA/JSH runs.

### Task 2: Complete the 20260901 CFA intermediate and product-layer evidence

**Files:**
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/13-20260901二代装载与对账执行记录.md`
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/15-当前开发进度总览_20261008.md`
- Modify or create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/23_*_cfa_20260901_reconciliation.sql`

**Step 1: Define canonical business keys and excluded columns.**

Use `DealNo`/`deal_no`, business date and change date; exclude identities, audit timestamps and `sys_*` columns. Normalize `NULL`, empty string and single space as business empty.

**Step 2: Write a failing reconciliation query.**

It must show two directional anti-joins and field-level differences for CA, CB, DA and DB.

**Step 3: Run against the current 20260901 records.**

Expected: document exact differences rather than masking them with a target-table update.

**Step 4: Freeze the SAFE1-to-SAFE2 review-status mapping.**

Confirm how SAFE1 `LuConfirmStatus=101002` corresponds to the SAFE2 product fields before invoking `usp_vtb_safe2_extract_cfa`.

**Step 5: Run SAFE2 CFA extraction and compare product tables.**

Expected: a field-level conclusion for `CFACA/B/DA/DB ↔ t_safe_cfac_a/b,t_safe_cfad_a/b`, or a documented blocker.

### Task 3: Run 20260902 principal/interest repayment dual-run

**Files:**
- Input: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/测试文件/SAFE双跑基线_20260901起/daily/20260902/import_source/`
- Input: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/测试文件/SAFE双跑基线_20260901起/daily/20260902/utf8_source/`
- Modify/create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/24_*_cfa_repayment.sql`
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/测试文件/SAFE双跑基线_20260901起/验收记录.md`

**Step 1: User imports the five 20260902 files and extracts CFACA/CFACB/CFADA/CFADB.**

Expected: two CB and two DB changes; zero new CA/DA; the internal-counterparty transaction is excluded. Do not approve new records yet.

**Step 2: Load the equivalent UTF-8 files to SAFE2.**

Run: `node load_day.mjs 20260902` from the baseline folder.

Expected: raw rows are replaced only for `sys_business_date=2026-09-02`; other business dates remain.

**Step 3: Add the minimal historical-contract lookup required by repayment and interest.**

Read the approved 20260901 SAFE2 formal contract using the agreed date/status precedence. Do not alter `t_safe_*` table definitions.

**Step 4: Compare CB/DB field by field.**

Expected: principal repayment 30,000 USD, interest 3,200.50 USD, and no internal-account record.

**Step 5: Ask the user for approval only if the comparison passes.**

Expected: approval uses existing SAFE1 Action interfaces, never a direct SQL status update.

### Task 4: Run 20260903 JSH E and BOP dual-run

**Files:**
- Input: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/测试文件/SAFE双跑基线_20260901起/daily/20260903/`
- Modify/create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/25_*_jsh_bop_reconciliation.sql`

**Step 1: User imports 20260903 and extracts JSH D/E plus the required BOP source results.**

**Step 2: Load 20260903 into SAFE2 and run JSH/BOP processes.**

**Step 3: Resolve the real JSH source model from evidence.**

Choose `transaction_tab` or `rkjsh/rkaiftab` only after checking the actual SAFE1 extraction source for the positive E case.

**Step 4: Compare both JSH directions and BOP self/opposite-account branches.**

Expected: no product structure changes; report any model gap as a blocker.

### Task 5: Run 20260904 and 20260905 regression batches

**Files:**
- Input: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/测试文件/SAFE双跑基线_20260901起/daily/20260904/`
- Input: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/测试文件/SAFE双跑基线_20260901起/daily/20260905/`
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/测试文件/SAFE双跑基线_20260901起/验收记录.md`

**Step 1: User runs the 20260904 import plus ACCCA/ACCCB extraction.**

Expected: Customer only inserts if absent; an existing Customer is not overwritten.

**Step 2: Run `node load_day.mjs 20260904` twice.**

Expected: stable source/stage/result counts on repeat execution.

**Step 3: User runs the 20260905 import and necessary extracts.**

**Step 4: Run the SAFE2 blank/negative-case checks.**

Expected: NULL, empty string and one blank compare as empty; CNY/internal/no-code exclusions do not yield false report rows.

### Task 6: Unblock CFAAN/CFAAS and FAL only after source evidence is available

**Files:**
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/15-当前开发进度总览_20261008.md`
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/16-后续双跑协作计划_20261008.md`

**Step 1: Identify a real source record that produces CFAAN/CFAAS in SAFE1.**

**Step 2: Identify the FAL raw table and deployed loader.**

**Step 3: Create source-derived scenarios, then repeat the raw → stage → intermediate → product comparison workflow.**

Expected: no result-table supplementation and no inferred source rules.

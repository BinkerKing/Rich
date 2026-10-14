# VTB 一代 SAFE Mapping 总册实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 整合 VTB 一代 SAFE 的 Mapping、源码规则和验收边界，形成一份可定位、可更新、可审计的 Markdown 总册。

**Architecture:** 总册只保存裁决结论、模块链路、字段规则摘要、状态和来源索引；字段逐列明细仍以现有三份 Excel Mapping 为权威附件。每条规则以“规则编号 + 状态 + 依据”维护，避免复制多套字段 Mapping。

**Tech Stack:** Markdown、现有 Excel Mapping、SQL Server 一代存储过程与 Java Action 源码、既有双跑验收记录。

---

### Task 1: 确定权威输入与版本口径

**Files:**
- Read: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/BA梳理Mapping文档/Mappings-ACC_JSH_BOP.xlsx`
- Read: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/BA梳理Mapping文档/Mappings-CFA_EXD.xlsx`
- Read: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/BA梳理Mapping文档/Mappings-FAL_SAC.xlsx`
- Read: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/FBDS_VTB_DATA_MAPPING.md`
- Read: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/40-20261009-续办交接摘要.md`

- [x] **Step 1: 列出三份 Excel 的工作表、表头、行数和对象覆盖范围。**

  Expected: 每个模块可定位至工作簿、工作表与字段明细行，不把分析结果目录中的版本当作权威 Mapping。

- [x] **Step 2: 以一代过程/Action 作为歧义裁决依据，标识 Mapping 明确、源码补充、人工维护三种来源。**

  Expected: 规则来源可区分，不将二代增强写成一代原逻辑。

### Task 2: 建立总册的维护骨架

**Files:**
- Create: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/41-一代SAFE-Mapping总册_20261009.md`

- [x] **Step 1: 创建文档元数据、读者说明、状态图例和裁决顺序。**

  Include: 文档范围、最后更新日期、维护规则、`已核验`/`待同源验收`/`待开发`/`阻塞` 状态定义，以及 Mapping→一代过程/Action→人工维护的裁决顺序。

- [x] **Step 2: 创建全链路总览和模块状态总表。**

  Include: `AIF2/BLN2/CIF2/TRN2 → 一代贴源/中间表 → 一代过程或 Action → 一代结果` 链路，并覆盖 Customer、ACC、JSH、BOP、CFA、EXD、FAL、SAC。

- [x] **Step 3: 为每个模块使用同一章节模板。**

  Template: 业务目的、输入/输出、关键业务键、筛选和排除、字段逻辑摘要、人工/审批边界、当前状态、证据与原始 Mapping 定位。

### Task 3: 汇总模块规则与字段逻辑

**Files:**
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/41-一代SAFE-Mapping总册_20261009.md`

- [x] **Step 1: 汇总 Customer、ACC、JSH 与 BOP。**

  Include: CIF 入库和 Customer 增量时机、ACC 生命周期与方向、JSH D/E/G 的审核前置、BOP 仅止于数据池及排除规则。

- [x] **Step 2: 汇总 CFA 与 EXD。**

  Include: CA/CB/DA/DB、AN/AS、AM/AL 的来源、自动字段与人工维护字段、原审批 Action 约束；将 CFAAN/CFAAS 审批后链路标为阻塞，不虚构处理规则。

- [x] **Step 3: 汇总 FAL 与 SAC。**

  Include: D02/D09/F01/D0501 的范围边界与正式源层缺口；SAC JP/JR 的工作日、阈值、时间窗、PF01/PF02 和负金额排除，并标记一代同源字段级验收未关闭。

### Task 4: 补齐跨模块约束与可维护索引

**Files:**
- Modify: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/41-一代SAFE-Mapping总册_20261009.md`

- [x] **Step 1: 添加统一数据口径。**

  Include: 空字符串/NULL/单空格、同一业务日期覆盖重导、不可直接补产品结果表、Customer 主数据快照与增量边界。

- [x] **Step 2: 添加“人工维护与审批边界”汇总表。**

  Include: CFACA、CFACB、CFADA、CFADB 的已知人工字段；所有审批只能走既有 Action，禁止 SQL 改状态或编号。

- [x] **Step 3: 添加来源索引和变更日志模板。**

  Include: 原始 Mapping 文件、源码对象、验收文档和证据脚本的可点击路径；变更日志列出日期、规则编号、变更内容、来源、核验状态。

### Task 5: 内容与链接校验

**Files:**
- Test: `/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/41-一代SAFE-Mapping总册_20261009.md`

- [x] **Step 1: 检查标题层级、目录锚点、表格列数和内部链接。**

  Run: `rg -n '^(#|\|)|\]\(' '/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/41-一代SAFE-Mapping总册_20261009.md'`

  Expected: 各模块具有统一的二级标题，来源链接均可定位至已有文件。

- [x] **Step 2: 核对状态表与当前摘要一致。**

  Run: 人工逐项对照 `40-20261009-续办交接摘要.md`、`33-验收证据矩阵_20261008.md` 与总册状态表。

  Expected: SAC 为“二代加工回归通过、同源待验收”；BOP 为“数据池通过、最终分类未授权”；所有外部前置明确为阻塞。

- [x] **Step 3: 检查占位内容和不允许的结论。**

  Run: `rg -n -i 'TODO|TBD|待补|已通过' '/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/41-一代SAFE-Mapping总册_20261009.md'`

  Expected: 没有无来源的“已通过”结论；必要的未关闭项均具体说明其前置条件。

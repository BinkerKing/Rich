# VTB 场景化双跑测试 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在正确配置的 VTB 一代测试环境中，以可重放的场景数据完成一代 SAFE 与二代 `vtb_ods` 报表业务数据双跑。

**Architecture:** 每个测试场景使用独立批次、冻结五文件、必要历史种子及一代/二代快照。比较器仅核对贴源中间表和目标报表业务字段，不涉及 `vtb_safe2` 应用同步或 XML；所有差异按 R1-R4 裁决。

**Tech Stack:** 一代 FBDS/Tomcat HTTP 动作、SQL Server 测试库、PostgreSQL `vtb_ods` 隔离库、SQL、CSV/Markdown 证据台账。

---

### Task 1: 准备可执行的一代 VTB 测试环境

**Files:**
- Modify: `.../48-VTB场景化双跑测试用例集_2026-09-07.md`
- Modify: `.../46-一二代双跑执行就绪性核查_2026-09-06.md`

**Step 1: 只读确认测试账号的机构代码为 `310000167001`。**

**Step 2: 读取一代源目录、历史目录及目标表初始状态，保存 `precondition.md`。**

**Step 3: 若不满足，停止并记录 `BLOCKED`；不得在未获确认时改造非测试环境。**

**Step 4: 运行预检，预期：可认证、VTB 导入分支可达、目录可恢复。**

### Task 2: 实施 TC01-TC05

**Files:**
- Create: `.../测试数据/scenarios/VTB-TC01` 至 `VTB-TC05`
- Create: `.../双跑结果/VTB-TC01` 至 `VTB-TC05`
- Modify: `.../48-VTB场景化双跑测试用例集_2026-09-07.md`

**Step 1: 为每例生成五文件和 `source_manifest.csv`。**

**Step 2: 在一代和隔离 `vtb_ods` 运行相同业务日。**

**Step 3: 导出 L1/L2 快照并写 `compare_<table>.csv`。**

**Step 4: 仅当全部 R1 字段一致时标记 PASS；否则标记 FAIL/BLOCKED/R2/R3/R4。**

### Task 3: 实施 TC06-TC11

**Files:**
- Create: `.../测试数据/scenarios/VTB-TC06` 至 `VTB-TC11`
- Create: `.../双跑结果/VTB-TC06` 至 `VTB-TC11`
- Modify: `.../48-VTB场景化双跑测试用例集_2026-09-07.md`

**Step 1: 为 BOP、FAL、EXD、异常、历史重跑和范围排除建立独立可重放数据。**

**Step 2: 先运行每例的有效对照行，再运行异常/排除行。**

**Step 3: 对 R4 验证不生成；对 R2/R3 单列裁决，不计入一代等价通过。**

**Step 4: 汇总全部 42 个对象的覆盖及未关闭差异。**

### Task 4: 交付验证

**Files:**
- Modify: `.../45-VTB一二代双跑测试与造数方案_2026-09-06.md`
- Modify: `.../46-一二代双跑执行就绪性核查_2026-09-06.md`
- Modify: `.../48-VTB场景化双跑测试用例集_2026-09-07.md`

**Step 1: 检查每个用例都有源清单、前置条件、两端快照、比较结果和恢复记录。**

**Step 2: 运行覆盖审计，预期：42 个对象都有至少一个状态明确的覆盖用例。**

**Step 3: 将 p6 仅在 R1 无 FAIL 且所有未决项有明确裁决时标记完成。**

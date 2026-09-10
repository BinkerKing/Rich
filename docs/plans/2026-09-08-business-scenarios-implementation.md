# 业务场景 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在项目数据字典中新增项目级“业务场景”，以一个存储过程为中心关联多个数据表，并支持按已配置数据库进行 SQL 格式化与手动校验。

**Architecture:** 新增业务场景主表和场景—数据表关联表；场景绑定一个已配置的数据字典系统，因此数据库类型与连接从该系统继承。完整 SQL 是权威内容；校验结果绑定 SQL 指纹，SQL 保存后自动失效。现有表内 Mapping 场景保持不变。

**Tech Stack:** TypeScript、Hono、SQLite/PostgreSQL、React、Vitest、现有 project-dictionary 数据库连接能力。

---

### Task 1: 定义领域契约与持久化

**Files:**
- Modify: `apps/server/src/repos/ProjectManagementRepo.ts`
- Modify: `apps/server/src/db/projectManagementSchema.ts`
- Modify: `apps/server/src/repos/SqliteProjectManagementRepo.ts`
- Modify: `apps/server/src/repos/PostgresProjectManagementRepo.ts`
- Test: `apps/server/test/projectBusinessScenarios.test.ts`

**Step 1: Write the failing test**

创建场景、关联多个表、更新 SQL 后校验状态失效，以及按表反查场景。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server test -- projectBusinessScenarios.test.ts`

Expected: FAIL，因为 repository 尚未提供业务场景 API。

**Step 3: Write minimal implementation**

增加 `pm_business_scenarios`、`pm_business_scenario_tables`，以及两种 repository 的 CRUD、关联表替换与查询方法。保存 SQL 时清空校验状态与 SQL 指纹。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server test -- projectBusinessScenarios.test.ts`

Expected: PASS。

### Task 2: 暴露 HTTP API 与 SQL 格式化/校验服务

**Files:**
- Modify: `apps/server/src/routes/projectManagement.ts`
- Create: `apps/server/src/modules/project-dictionary/business-scenarios/sqlService.ts`
- Test: `apps/server/test/projectBusinessScenarioRoutes.test.ts`

**Step 1: Write the failing test**

覆盖场景 CRUD、关联表更新、按表查询、格式化 SQL、以及 PostgreSQL/SQL Server 的手动校验请求。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server test -- projectBusinessScenarioRoutes.test.ts`

Expected: FAIL，因为路由和服务不存在。

**Step 3: Write minimal implementation**

路由只允许通过已配置系统获取方言与连接；格式化按方言处理关键字和缩进；校验仅执行安全的事务包裹/语法验证，返回并持久化当前 SQL 指纹对应的结果。MySQL/Oracle 返回明确的“尚未接入校验”提示。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server test -- projectBusinessScenarioRoutes.test.ts`

Expected: PASS。

### Task 3: 新增数据字典业务场景工作区

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/project-management/DictionaryWorkspace.tsx`
- Create: `apps/web/src/views/project-management/dictionary/BusinessScenariosWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/dictionary/DictionaryComponents.tsx`
- Test: `apps/web/src/views/project-management/dictionary/BusinessScenariosWorkspace.test.tsx`

**Step 1: Write the failing test**

覆盖入口、数据库选择、多个关联表、SQL 格式化直接替换编辑器文本、保存后状态变为待校验、手动校验结果展示及表详情的反向关联。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/web test -- BusinessScenariosWorkspace.test.tsx`

Expected: FAIL，因为业务场景界面不存在。

**Step 3: Write minimal implementation**

把“业务场景”加入数据字典内导航；详情页显示完整 SQL、过程名称、外部位置、测试数据库、关联表与校验结果。格式化按钮直接更新编辑器内容，校验仅由用户点击触发。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/web test -- BusinessScenariosWorkspace.test.tsx`

Expected: PASS。

### Task 4: 全量验证

**Files:**
- Verify: 以上改动文件

**Step 1: Run focused tests**

Run: `pnpm --filter @ke/server test -- projectBusinessScenarios.test.ts projectBusinessScenarioRoutes.test.ts && pnpm --filter @ke/web test -- BusinessScenariosWorkspace.test.tsx`

Expected: PASS。

**Step 2: Run type checks**

Run: `pnpm --filter @ke/server typecheck && pnpm --filter @ke/web typecheck`

Expected: PASS。

**Step 3: Review scoped diff**

Run: `git diff --check -- <business-scenario files>`

Expected: no whitespace errors.

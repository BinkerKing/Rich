# 项目管理搜索与定位 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让项目管理全局搜索能返回可执行的导航目标，并完成“数据字典字段”和“文件夹文件”两个端到端定位样板。

**Architecture:** 后端继续以 `pm_search_index` 为统一索引，搜索结果新增与存储无关的 `destination` 描述（页面、实体、上下文）。前端搜索框只分发目标；工作区统一切换页面；各页面通过可组合的定位状态展开父级、选择目标、滚动并高亮。以后新页面只需注册结果映射与页面定位器。

**Tech Stack:** TypeScript、Hono、SQLite/PostgreSQL、React、Vitest。

---

### Task 1: 定义导航契约与映射器

**Files:**
- Modify: `apps/server/src/repos/ProjectManagementRepo.ts`
- Create: `apps/web/src/views/project-management/searchNavigation.ts`
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/server/test/project-management-search.test.ts`

**Step 1: Write the failing test**

验证数据字段索引记录映射为 dictionary 目标（含 `tableId`、`systemId`、`fieldId`），文件夹记录映射为 folder 目标（含 `path`）。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server test -- project-management-search.test.ts`

Expected: FAIL because the destination contract and mapper do not yet exist.

**Step 3: Write minimal implementation**

在共享搜索结果类型中添加 `destination`，通过纯函数按 `entityType` 映射目标；未知类型安全回退到对应模块页。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server test -- project-management-search.test.ts`

Expected: PASS.

### Task 2: 让两个数据库仓库返回可定位的搜索结果

**Files:**
- Modify: `apps/server/src/repos/SqliteProjectManagementRepo.ts`
- Modify: `apps/server/src/repos/PostgresProjectManagementRepo.ts`
- Test: `apps/server/test/project-management-search.test.ts`

**Step 1: Write failing fixture tests**

为字段、文件夹条目的 `pm_search_index` 行建立测试，断言结果中含完整 destination。

**Step 2: Implement**

在仓库转换行时解析索引元数据，填充 destination；不改变现有排序、限额或模糊检索逻辑。

**Step 3: Verify**

Run: `pnpm --filter @ke/server test -- project-management-search.test.ts`

Expected: PASS.

### Task 3: 搜索框分发目标而非仅切页

**Files:**
- Modify: `apps/web/src/views/project-management/ProjectManagementNavigation.tsx`
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Test: `apps/web/src/views/project-management/ProjectDescriptionSection.test.ts` (or dedicated navigation test)

**Step 1: Write failing test**

断言点击结果向工作区传递完整 destination，工作区切换目标页面并保留定位状态。

**Step 2: Implement**

将 `onJump(section)` 改为 `onNavigate(destination)`；工作区用单一 `searchTarget` 状态向对应 section 传递目标。

**Step 3: Verify**

Run: `pnpm --filter @ke/web test -- ProjectDescriptionSection.test.ts`

Expected: PASS.

### Task 4: 数据字典字段端到端定位样板

**Files:**
- Modify: dictionary workspace component under `apps/web/src/views/project-management/`
- Modify: `apps/web/src/views/ProjectsView.css` only if a reusable focus treatment is missing
- Test: relevant dictionary component test

**Step 1: Write failing test**

给定 field destination，验证其所属系统和表会打开，字段详情/行被选择，并给定位元素打上可识别的聚焦标记。

**Step 2: Implement**

复用已有本地工作区状态：写入 selected system/table 和展开状态；加载完成后滚动 field 行到视口中间，并短暂高亮。无效 field 时保留在表页并显示安全空状态。

**Step 3: Verify**

Run: `pnpm --filter @ke/web test -- <dictionary-test>`

Expected: PASS.

### Task 5: 文件夹文件端到端定位样板

**Files:**
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Modify: `apps/web/src/views/ProjectsView.css` only if needed
- Test: focused-folder helper test or component test

**Step 1: Write failing test**

给定 folder destination，验证父目录加入展开集合、目标路径成为 selected/focused path。

**Step 2: Implement**

将搜索目标传给 `FolderSection`；复用现有 `FolderTree` 的 `focusPath`、展开和 `scrollIntoView` 行为，确保扫描记录未加载时在加载完成后再定位。

**Step 3: Verify**

Run: `pnpm --filter @ke/web test -- <folder-test>`

Expected: PASS.

### Task 6: 回归验证

**Files:** None

**Step 1: Typecheck**

Run: `pnpm --filter @ke/server typecheck && pnpm --filter @ke/web typecheck`

Expected: PASS.

**Step 2: Run focused tests**

Run: `pnpm --filter @ke/server test -- project-management-search.test.ts && pnpm --filter @ke/web test -- <navigation-and-dictionary-tests>`

Expected: PASS.

**Step 3: Browser verification**

Search a known field name and a known file name; verify the correct page opens, its ancestor context expands, and the destination receives a visible focus treatment.

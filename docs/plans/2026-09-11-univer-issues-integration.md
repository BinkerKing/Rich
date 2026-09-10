# Univer Issues Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the issue-list `ConfigurableDataGrid` with an embedded Univer Sheets editor that preserves Rich issue records and enables spreadsheet formatting.

**Architecture:** Keep Rich as the source of truth for issue records and keep the existing issue-table selector. A new `UniverIssueSheet` adapts `TestCenterIssue` rows into a workbook, renders the Univer ribbon, and writes direct cell edits for supported issue fields through the existing API. The existing React data grid remains in place for the test-center workspace, avoiding unrelated migration.

**Tech Stack:** React 18, TypeScript, Vite, Univer Sheets presets, existing Rich REST client and Vitest/static source tests.

---

### Task 1: Add the minimal Univer Sheets preset dependencies

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Write the failing integration-source test**

Create `apps/web/src/components/UniverIssueSheet.test.ts` asserting that the component registers `UniverSheetsCorePreset` and creates a workbook.

**Step 2: Run the test to verify it fails**

Run: `node --test apps/web/src/components/UniverIssueSheet.test.ts`

Expected: FAIL because the component does not exist.

**Step 3: Install the required preset packages**

Run: `pnpm --filter @ke/web add @univerjs/presets @univerjs/preset-sheets-core`

**Step 4: Verify dependency resolution**

Run: `pnpm --filter @ke/web typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/components/UniverIssueSheet.test.ts
git commit -m "build: add univer sheets preset"
```

### Task 2: Build the workbook adapter and editor lifecycle

**Files:**
- Create: `apps/web/src/components/UniverIssueSheet.tsx`
- Create: `apps/web/src/components/UniverIssueSheet.css`
- Modify: `apps/web/src/components/UniverIssueSheet.test.ts`

**Step 1: Add failing source tests**

Assert that the component:
- creates the workbook from issue rows;
- imports Univer CSS;
- disposes its instance on React unmount; and
- publishes edits of supported cells through an `onIssueChange` callback.

**Step 2: Run the test to verify it fails**

Run: `node --test apps/web/src/components/UniverIssueSheet.test.ts`

Expected: FAIL on the missing assertions.

**Step 3: Implement the smallest adapter**

Add a component that creates one workbook with the fields `问题`、`问题说明`、`负责人`、`状态`、`外部记录`、`更新时间`; registers the core preset in a contained element; and maps cell edits back to only the mutable Rich issue fields.

**Step 4: Run focused checks**

Run: `node --test apps/web/src/components/UniverIssueSheet.test.ts && pnpm --filter @ke/web typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/UniverIssueSheet.tsx apps/web/src/components/UniverIssueSheet.css apps/web/src/components/UniverIssueSheet.test.ts
git commit -m "feat: add univer issue sheet editor"
```

### Task 3: Replace only the issue-table editor

**Files:**
- Modify: `apps/web/src/views/project-management/issues/IssuesWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/issues/IssuesWorkspace.css`
- Modify: `apps/web/src/views/project-management/issues/IssuesWorkspace.test.ts`

**Step 1: Add a failing view test**

Assert that the active issue-table route renders `UniverIssueSheet`, retains the existing table name/template controls, and no longer renders `ConfigurableDataGrid` in that view.

**Step 2: Run the test to verify it fails**

Run: `node --test apps/web/src/views/project-management/issues/IssuesWorkspace.test.ts`

Expected: FAIL because the old grid is still rendered.

**Step 3: Implement the narrow replacement**

Keep table creation/list selection and existing issue API calls. Replace the active-grid JSX with `UniverIssueSheet`, make the workspace a contained editor surface, and surface failed saves through the existing error state.

**Step 4: Run focused checks**

Run: `node --test apps/web/src/views/project-management/issues/IssuesWorkspace.test.ts apps/web/src/components/UniverIssueSheet.test.ts && pnpm --filter @ke/web typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/views/project-management/issues/IssuesWorkspace.tsx apps/web/src/views/project-management/issues/IssuesWorkspace.css apps/web/src/views/project-management/issues/IssuesWorkspace.test.ts
git commit -m "feat: use univer for issue tables"
```

### Task 4: Verify the packaged desktop flow

**Files:**
- No source changes expected.

**Step 1: Run all relevant web tests and production typecheck**

Run: `pnpm --filter @ke/web typecheck && node --test apps/web/src/components/UniverIssueSheet.test.ts apps/web/src/views/project-management/issues/IssuesWorkspace.test.ts`

Expected: PASS.

**Step 2: Build the desktop application**

Run: `pnpm --filter @ke/desktop package`

Expected: exit 0.

**Step 3: Publish and restart the local app**

Run: `pkill -x Rich || true && rsync -a --delete apps/desktop/release/mac-arm64/Rich.app/ /Applications/Rich.app/ && open -a /Applications/Rich.app`

**Step 4: Manually verify**

Open a project’s 问题清单, open an issue table, confirm the Univer ribbon and spreadsheet appear, and edit a title cell to verify the Rich API update path.

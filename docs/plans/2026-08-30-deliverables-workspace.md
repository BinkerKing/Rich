# 交付物工作区 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在项目管理顶层新增独立的“交付物”菜单，管理交付件的说明、过程记录、本地输出文件与可选版本历史。

**Architecture:** 正式交付物继续复用 `pm_module_items`，使用既有 `deliverables` 模块键；每条顶层记录就是一个交付物。结构化状态保存在条目 `content` 中，文件实际存入项目 `localFolder` 下的 `07-交付/<交付物目录>/`，服务器只接受相对路径并验证其不越出项目目录。项目计划里的“交付物”仍是任务动态类型，不迁移、不删除，也不再承担正式文件版本管理。

**Tech Stack:** React + TypeScript、Hono、现有 ProjectManagementRepo、现有项目目录安全接口、现有 `ProjectRichTextEditor`、Electron 桌面端。

---

## Confirmed product rules

- 项目工作区顶部菜单新增同级“交付物”；移除项目计划内部原有的“交付物与验收”占位页。
- 页面以可展开的交付物记录列表呈现；展开记录下方占满菜单以下的可用工作区，并随窗口尺寸自适应。
- 工作区固定为两栏：左侧为默认预览的“交付物需求说明”；右侧上方为更高的“交付物要求记录”，右侧下方为较小的“交付物版本”。三个面板均内部滚动，页面本身不随记录内容无限拉长。
- 文件位置默认创建于项目本地目录的 `07-交付/<安全化的交付物名称>/`。项目未配置本地目录时，仍允许维护文字数据，但文件上传、打开与访达操作禁用并提示先配置目录。
- 版本策略：`只保留最新` 上传同一逻辑文件时保留当前文件与一条当前记录；`版本控制` 每次上传建立不可变版本记录。删除文件/版本必须二次确认。
- 版本操作只有：`打开`（系统默认程序）、`访达`（定位到文件/所在目录）、`删除`。不提供查看、下载、回滚。

## Data contract

`pm_module_items.module_key = "deliverables"` 的顶层条目使用如下最小内容；所有数组均容错为 `[]`，缺失字段使用默认值：

```ts
type DeliverableContent = {
  recordType: "deliverable";
  status: "draft" | "preparing" | "ready" | "accepted";
  folderPath: string; // 相对项目 localFolder，例如 07-交付/UAT-20260806
  versionPolicy: "latest" | "versioned";
  descriptionHtml: string;
  records: Array<{
    id: string;
    kind: "requirement" | "status" | "change";
    text: string;
    createdAt: string;
    author?: string;
  }>;
  versions: Array<{
    id: string;
    fileName: string;
    relativePath: string;
    size: number;
    createdAt: string;
    note?: string;
  }>;
};
```

## Task 1: Establish deliverable domain normalization and unit tests

**Files:**
- Create: `apps/web/src/views/project-management/deliverables/DeliverablesModel.ts`
- Create: `apps/web/src/views/project-management/deliverables/DeliverablesModel.test.ts`

**Step 1: Write failing tests** for default content, malformed stored content, record insertion ordering, and the two version policies.

```ts
assert.equal(normalizeDeliverableContent({}).versionPolicy, "latest");
assert.equal(addVersion(latestContent, upload).versions.length, 1);
assert.equal(addVersion(versionedContent, upload).versions.length, 2);
```

**Step 2: Run the focused test**

Run: `pnpm --filter @ke/web test -- DeliverablesModel.test.ts`

Expected: FAIL because the model does not exist.

**Step 3: Implement only typed parsing and pure transforms.** Keep filesystem operations, React state, and API calls out of this module.

**Step 4: Run the focused test again.**

Expected: PASS.

## Task 2: Add safe project-folder endpoints for deliverable output files

**Files:**
- Modify: `apps/server/src/routes/projects.ts`
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/server/src/routes/projects.deliverables.test.ts`

**Step 1: Write failing route tests** with a temporary project root. Cover: creating a relative deliverable folder, multipart upload into that folder, traversal rejection, opening/revealing only files inside the project root, and deletion of one explicit file only.

**Step 2: Implement minimal server routes under `/api/projects/:id/folder/`.**

- `POST deliverables/create-folder` accepts `{ relativePath }`, validates a non-empty relative path under `07-交付`, and creates it with `mkdir`.
- `POST deliverables/upload` accepts one file plus `{ relativeDirectory }`, validates both target pieces, writes without overwriting an unrelated file, and returns `{ fileName, relativePath, size }`.
- Reuse existing `open` and `reveal` behavior by resolving a scanned folder entry after refresh; add a narrow file-delete route only if entry-based deletion cannot address a just-uploaded item without a full scan.

**Step 3: Add matching API client methods** (`createDeliverableFolder`, `uploadDeliverableFile`, and any narrow open/reveal/delete helper required by the route contract). No direct renderer filesystem access.

**Step 4: Run route tests.**

Run: `pnpm --filter @ke/server test -- projects.deliverables.test.ts`

Expected: PASS, including traversal rejection.

## Task 3: Put the independent menu and workspace on the project shell

**Files:**
- Modify: `apps/web/src/views/project-management/ProjectManagementNavigation.tsx`
- Modify: `apps/web/src/views/project-management/index.ts`
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/delivery/DeliveryWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/ProjectDescriptionSection.test.ts` or create `DeliverablesWorkspace.test.ts`

**Step 1: Write failing source-level tests** that assert the `deliverables` navigation item exists beside `deliveryPlan`, the project shell renders `DeliverablesWorkspace`, and the nested project-plan page no longer declares a `deliverables` tab.

**Step 2: Add the navigation item and render branch.** Export the new workspace through the project-management barrel. Preserve user menu ordering/localStorage normalization by using the existing `ProjectManagementSection` union; it already contains `deliverables`.

**Step 3: Remove only the obsolete nested placeholder/tab.** Do not change `DeliveryActivityKind = "deliverable"` or historical task activities.

**Step 4: Run the focused UI source tests.**

Run: `pnpm --filter @ke/web test -- DeliverablesWorkspace.test.ts ProjectDescriptionSection.test.ts`

Expected: PASS.

## Task 4: Build the deliverable list, fixed-height two-column workspace, and editing flows

**Files:**
- Create: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Create: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`
- Modify: `apps/web/src/views/ProjectsView.css`

**Step 1: Write failing component/source tests** for:

- list creation and one expanded item at a time;
- description preview by default and `ProjectRichTextEditor` only in edit mode;
- add record composer (`要求` / `状态` / `修改`);
- policy selector in the same toolbar as file location and Finder button;
- visible `打开` / `访达` / `删除` actions only;
- grid classes that set `min-height: 0` and `overflow: auto` on all three panels.

**Step 2: Implement list state and persistence.** Read all `deliverables` module items, normalize their content, create a record with a default folder path but do not create the physical directory until the user invokes file work. Save title, status, description, records, policy, and versions through existing generic module-item APIs.

**Step 3: Implement the workspace interactions.**

- Description: explicit `编辑 / 取消 / 保存`; preview with `dangerouslySetInnerHTML` only after saved HTML is sanitized by the existing editor contract.
- Records: append a timestamped typed row only if text is non-empty; retain latest first for immediate visibility.
- Files: creating/uploading first ensures the default directory; after upload, apply the selected pure version policy, persist metadata, then refresh folder entries before enabling `打开`/`访达`.
- Delete: show a native confirmation naming the exact file, delete the physical file first, then remove its metadata only on success.

**Step 4: Add responsive CSS.** Use a desktop two-column grid and a narrow-screen single-column fallback. On desktop, give the right `records` panel more height than `versions`; all three panels must use `min-height: 0` plus internal `overflow: auto`.

**Step 5: Run focused tests and the web build.**

Run: `pnpm --filter @ke/web test -- DeliverablesModel.test.ts DeliverablesWorkspace.test.ts && pnpm --filter @ke/web run build`

Expected: PASS and a successful TypeScript/Vite build.

## Task 5: Integrate file actions and verify end-to-end on desktop

**Files:**
- Modify only files identified by the preceding test failures.

**Step 1: Create a disposable local test project** with `content.localFolder` pointing at a temporary directory; do not use an existing user project.

**Step 2: Exercise the user flow manually.**

1. Create a deliverable and verify default preview layout.
2. Edit/save description; close/reopen and confirm persisted preview.
3. Add requirement, status, and change records; confirm panel scrolls internally.
4. Upload a file with `只保留最新`, replace it, and confirm only current metadata/file remains.
5. Switch to `版本控制`, upload twice, and confirm two version rows exist.
6. Verify `打开` opens with the OS default app, `访达` reveals it, and `删除` requires confirmation and removes the chosen file only.
7. Resize the window and verify the two-column desktop layout and narrow-screen single-column fallback.

**Step 3: Run full relevant checks.**

Run: `pnpm --filter @ke/web run build && pnpm --filter @ke/desktop package && git diff --check`

Expected: all commands exit 0; existing Vite chunk-size warning may remain non-blocking.

**Step 4: Publish desktop app using the established Rich replacement flow.** Stop the running Rich process, replace `/Applications/Rich.app` with `apps/desktop/release/mac-arm64/Rich.app`, reopen it, verify its process, and remove only the temporary previous app copy.

## Acceptance criteria

- “交付物”是项目管理顶层同级菜单；项目计划内部不再出现正式交付物页面。
- 每个交付物是一条可展开记录，且展开工作区按已确认的左右布局自适应窗口并内部滚动。
- 富文本说明默认预览；记录可录入要求/状态/修改；文件目录默认位于项目目录的 `07-交付`。
- `只保留最新` 与 `版本控制` 都有可测试、确定的文件和元数据行为。
- 版本操作仅显示并实现 `打开`、`访达`、`删除`，所有路径操作防止越界。
- 不破坏项目计划活动中的交付物类型、今日动态或待办清单。

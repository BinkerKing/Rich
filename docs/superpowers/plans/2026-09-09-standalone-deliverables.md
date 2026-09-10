# Standalone Deliverables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make deliverables independent Rich assets with one shared UI, while projects store ordered references and every reused deliverable continues to use its one bound directory.

**Architecture:** Add a dedicated `deliverables` repository and `/api/deliverables` CRUD API. Independently created deliverables store their fixed absolute `folderPath`; their file API resolves every operation beneath that directory. A project stores `deliverableIds` beside `flowchartIds`; binding and unbinding change only that list. `DeliverablesWorkspace` receives a data source mode, so the Rich application and a project render identical markup and CSS. Existing project-module deliverables remain readable as a compatibility fallback until explicitly migrated.

**Tech Stack:** TypeScript, Hono, SQLite/PostgreSQL, React 18, Vitest/node:test.

---

### Task 1: Dedicated deliverable persistence and API

**Files:**
- Create: `apps/server/src/repos/DeliverablesRepo.ts`
- Create: `apps/server/src/repos/SqliteDeliverablesRepo.ts`
- Create: `apps/server/src/repos/PostgresDeliverablesRepo.ts`
- Create: `apps/server/src/routes/deliverables.ts`
- Modify: `apps/server/src/db/projectManagementSchema.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/test/deliverables.test.ts`

- [ ] **Step 1: Write a failing repository test.** Create an in-memory SQLite database, apply `SQLITE_PROJECT_MANAGEMENT_SCHEMA`, create `{ title: "验收报告", content: { recordType: "deliverable", folderPath: "07-交付/UAT" } }`, and assert the generated ID, round-trip content, update, and deletion.
- [ ] **Step 2: Run `pnpm --filter @ke/server test -- deliverables.test.ts` and confirm it fails because no `deliverables` table/repository exists.**
- [ ] **Step 3: Add `deliverables(id, title, content_json, created_at, updated_at)` schema definitions for SQLite and PostgreSQL, then implement the three repository interfaces using UUIDs and JSON serialization.**
- [ ] **Step 4: Add `/api/deliverables` list/create and `/:id` get/patch/delete routes. Require a trimmed title, object-shaped content, and an absolute `folderPath` for creation; add file list/create/upload/open/delete operations that resolve only beneath that fixed folder. Return 404 for missing IDs. Wire the repository and route in `index.ts`.**
- [ ] **Step 5: Re-run the focused server test and confirm it passes.**

### Task 2: Project reference contract and shared client API

**Files:**
- Modify: `packages/domain/src/types/project.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Test: `apps/web/src/views/ProjectWorkspace.test.ts`

- [ ] **Step 1: Write a failing source contract test requiring `deliverableIds` on project content, a `saveDeliverableIds` callback, and `DeliverablesWorkspace` receiving `deliverableIds` plus that callback.**
- [ ] **Step 2: Run the source contract test and confirm it fails for the missing reference contract.**
- [ ] **Step 3: Add optional `deliverableIds?: string[]` to `ProjectContent`; add client `listDeliverables`, `createDeliverable`, `updateDeliverable`, and `deleteDeliverable` calls; persist the ordered ID list through the existing element patch.**
- [ ] **Step 4: Re-run the focused source contract test and confirm it passes.**

### Task 3: One deliverables workspace for application and projects

**Files:**
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Create: `apps/web/src/views/DeliverablesView.tsx`
- Modify: `apps/web/src/state/store.ts`
- Modify: `apps/web/src/lib/appCatalog.ts`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

- [ ] **Step 1: Write a failing source contract test requiring a `standalone` mode, use of `api.listDeliverables`, `api.createDeliverable`, and `api.updateDeliverable`, plus an application `DeliverablesView` that renders the same workspace.**
- [ ] **Step 2: Run the test with `node --import tsx --test ...DeliverablesWorkspace.test.ts` and confirm it fails for the missing standalone contract.**
- [ ] **Step 3: In `DeliverablesWorkspace`, choose standalone items from `/api/deliverables`, project items from the project’s `deliverableIds`, and legacy module items only if a project has no references. Map the standalone record shape to the existing view item shape.**
- [ ] **Step 4: Route create/save through the standalone API when using references or the Rich application. Project-plan generated deliverables create one standalone asset and append its ID; stale generated items only unbind. Deleting from a project unbinds, while deleting in Rich removes the global asset.**
- [ ] **Step 5: Create `DeliverablesView`, register the `deliverables` `AppView`, launcher card, and app switch. Re-run the focused source contract test and confirm it passes.**

### Task 4: Verification

**Files:**
- No product-code files beyond Tasks 1-3.

- [ ] **Step 1: Run `pnpm --filter @ke/server test -- deliverables.test.ts flowcharts.test.ts`, `pnpm --filter @ke/server typecheck`, `pnpm --filter @ke/web typecheck`, and `pnpm --filter @ke/web build`.**
- [ ] **Step 2: Inspect `git diff --check` and the final diff; ensure every production change directly supports independent deliverables or shared project/application UI.**

# Deliverable File Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save and edit one independent note for each file in the deliverables file list.

**Architecture:** Extend the existing `fileMeta` JSON data embedded in each deliverable item with an optional `note` field. The React file row reads and writes that field through the existing module-item save API, so no database or server-route change is required. A double-clicked note becomes a focused text input; blur or Cmd/Ctrl+Enter saves, Escape cancels.

**Tech Stack:** React 18, TypeScript, Node test runner, existing project-management module-item API.

---

### Task 1: Persist file notes in deliverable metadata

**Files:**
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesModel.test.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesModel.ts`

- [ ] **Step 1: Write the failing model test**

Add a test that calls `updateDeliverableFileMeta(normalizeDeliverableContent({}), "07-交付/UAT/过程材料.xlsx", { note: "等待业务确认" })` and expects `fileMeta` to retain the same relative path, default material type, empty version, and the note.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesModel.test.ts`

Expected: TypeScript failure because `note` is not an accepted metadata patch.

- [ ] **Step 3: Add the smallest data-model change**

Add optional `note?: string` to `DeliverableFileMeta`; accept only string notes in `fileMeta()`; and allow `note` in `updateDeliverableFileMeta`'s patch type.

- [ ] **Step 4: Re-run the model test**

Run: `pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesModel.test.ts`

Expected: PASS.

### Task 2: Add per-file double-click editing

**Files:**
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Modify: `apps/web/src/views/ProjectsView.css`

- [ ] **Step 1: Write the failing source-level UI test**

Assert that the workspace source contains a `备注` header, a per-file note input state, `onDoubleClick` to start editing, and an update that patches `{ note: editingFileNote }`.

- [ ] **Step 2: Run the workspace test to verify it fails**

Run: `pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

Expected: FAIL because no note UI exists.

- [ ] **Step 3: Add the minimal UI**

Use a sixth grid column for notes. Render a subtle empty-state prompt, switch only the selected file to a text input on double click, and save via the existing `updateFileMeta` API on blur or Cmd/Ctrl+Enter. Escape restores the original note without saving.

- [ ] **Step 4: Re-run the workspace test**

Run: `pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

Expected: PASS.

### Task 3: Verify and publish the desktop app

**Files:**
- Verify: `apps/web/src/views/project-management/deliverables/DeliverablesModel.test.ts`
- Verify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`
- Verify: `apps/desktop/release/mac-arm64/Rich.app`

- [ ] **Step 1: Run focused tests, type-check, and web build**

Run: `pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesModel.test.ts src/views/project-management/deliverables/DeliverablesWorkspace.test.ts && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 2: Package the desktop app**

Run: `pnpm --filter @ke/desktop package`

Expected: `apps/desktop/release/mac-arm64/Rich.app` exists.

- [ ] **Step 3: Replace and restart only the installed Rich.app**

Quit the running Rich app, replace only `/Applications/Rich.app` with the new bundle using an exact temporary backup, open `/Applications/Rich.app`, verify it starts, then remove the exact backup.

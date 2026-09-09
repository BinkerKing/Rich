# Knowledge Tree Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the Deep Workbench open a knowledge-tree topic as an editable mind map, with structural edits written immediately to the existing knowledge-tree APIs.

**Architecture:** Knowledge-tree `elements` and `relations(kind=child)` remain the source of truth. A pure web-side mapper projects one selected root into the existing Deep Workbench map shape; the map persists only its visual settings. Outline edits are reconciled into minimal create, rename, move, reorder, and leaf-delete operations, then the map is rebuilt from the canonical tree.

**Tech Stack:** React, Zustand, TypeScript, existing `/api/elements` and `/api/relations` endpoints, `simple-mind-map`, Node's test runner via `tsx`.

---

### Task 1: Add tree projection and edit-plan helpers

**Files:**
- Create: `apps/web/src/views/deep-workbench/knowledgeTreeWorkbench.ts`
- Create: `apps/web/src/views/deep-workbench/knowledgeTreeWorkbench.test.ts`

**Step 1: Write failing tests** for projection, visual-data preservation, and reconciliation of rename, creation, reparenting, sibling order, and empty-node removal.

**Step 2: Run the focused test** and verify it fails because the helper module does not exist.

**Step 3: Implement the smallest pure projection and operation-planning helpers.** Existing knowledge IDs remain the map node `uid`; new outline IDs are marked as temporary until the create response supplies a real ID.

**Step 4: Run the focused test** and verify it passes.

### Task 2: Surface knowledge-tree topics in Deep Workbench

**Files:**
- Modify: `apps/web/src/views/DeepWorkbenchView.tsx`
- Modify: `apps/web/src/views/DeepWorkbenchView.css`

**Step 1: Use store-backed elements and relations to list eligible root topics alongside standalone workbenches.**

**Step 2: Opening a topic creates a linked workbench map from canonical tree data, while merging saved visual state from any earlier opening.**

**Step 3: Add a visible linked-state label so users know edits update the knowledge tree.**

### Task 3: Commit workbench structure edits to the knowledge tree

**Files:**
- Modify: `apps/web/src/views/DeepWorkbenchView.tsx`

**Step 1: Reconcile each outline edit through existing APIs: create new elements, patch renamed titles, move existing nodes, reorder children, and delete removed leaf nodes.**

**Step 2: Rehydrate store state and rebuild the map after successful mutation, preserving styles by node ID.**

**Step 3: Report mutation failures in the workbench instead of leaving a misleading local structure.**

### Task 4: Verify

**Files:**
- Test: `apps/web/src/views/deep-workbench/knowledgeTreeWorkbench.test.ts`

**Step 1: Run the focused helper tests.**

**Step 2: Run web typecheck and production build.**

**Step 3: Inspect the resulting diff to ensure unrelated working-tree changes were untouched.**

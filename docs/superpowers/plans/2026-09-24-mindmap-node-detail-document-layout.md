# Mindmap Node Detail Document Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render mindmap node details inside the existing drawer as a workbench-document-style reading page with a section directory.

**Architecture:** Keep node data and drawer controls in `DeepWorkbenchView`. Replace collapsible `NodeDetailSection` rendering with stable document sections inside a scroll container and connect its scroll position to the existing directory data source. Scope new styles under `deep-node-detail-document` so the independent document workbench remains unchanged.

**Tech Stack:** React, TypeScript, CSS, Node test runner via `tsx`.

---

### Task 1: Capture the document-drawer contract

**Files:**
- Modify: `apps/web/src/views/DeepWorkbenchView.detailHeader.test.ts`
- Modify: `apps/web/src/views/deep-workbench/NodeDetailTableOfContents.test.ts`

- [ ] **Step 1: Write the failing tests**

Add assertions that the node detail body contains a `deep-node-detail-document` reading grid, a `deep-node-detail-document__content` scroll container, and four chapters with ids `node-detail-description`, `node-detail-flowcharts`, `node-detail-table`, and `node-detail-files`. Assert that the directory uses the label `工作台目录` and no longer uses `aria-label="本页内容"`.

- [ ] **Step 2: Run the targeted tests to verify failure**

Run: `pnpm --dir apps/web exec tsx --test src/views/DeepWorkbenchView.detailHeader.test.ts src/views/deep-workbench/NodeDetailTableOfContents.test.ts`

Expected: FAIL because the current implementation still renders collapsible `NodeDetailSection` blocks and the old directory label.

- [ ] **Step 3: Keep the tests focused on observable structure**

Do not assert internal state setter names or exact CSS declarations. The assertions must only require the document layout, stable target ids, and user-visible directory identity.

### Task 2: Render the drawer as a document workbench

**Files:**
- Modify: `apps/web/src/views/DeepWorkbenchView.tsx:53-88, 280-281`
- Modify: `apps/web/src/views/deep-workbench/NodeDetailTableOfContents.tsx:3-5`

- [ ] **Step 1: Add a document section model**

Replace the `DetailSection` union with a constant describing the four stable section ids, titles, and DOM targets. Use it for directory selection and for rendering document chapters in the order: description, flowcharts, table, files.

- [ ] **Step 2: Replace collapsible sections with full chapters**

Render `deep-node-detail-document` inside the existing drawer body. Its content column must contain four `<section>` elements with the target ids from Task 1. Keep `ProjectRichTextEditor`, `FlowchartBindings`, `NodeDetailTableEditor`, and `ExternalFileBindings` unchanged as their chapter content. Retain the description edit control.

- [ ] **Step 3: Wire directory navigation to the drawer scroll container**

Use a ref for `deep-node-detail-document__content`; clicking a directory item scrolls its target chapter inside that container. Handle its `onScroll` event to update the active directory item from chapter offsets. Remove the current `document.querySelector` scroll-to-open-section behavior.

- [ ] **Step 4: Update directory terminology**

Change `NodeDetailTableOfContents` to expose `aria-label="工作台目录"` and heading text `工作台目录`; preserve the existing `nodeDetailToc` order and active-state button semantics.

- [ ] **Step 5: Run targeted tests to verify green**

Run: `pnpm --dir apps/web exec tsx --test src/views/DeepWorkbenchView.detailHeader.test.ts src/views/deep-workbench/NodeDetailTableOfContents.test.ts`

Expected: PASS.

### Task 3: Apply the document workbench visual system inside the drawer

**Files:**
- Modify: `apps/web/src/views/DeepWorkbenchView.css:10-38`
- Modify: `apps/web/src/views/DeepWorkbenchView.detailHeader.test.ts`

- [ ] **Step 1: Add a failing style assertion**

Assert that `DeepWorkbenchView.css` defines `deep-node-detail-document` with a two-column layout and that the directory host is sticky. Assert that document chapter headings use the workbench's gold left rule and bottom divider.

- [ ] **Step 2: Verify the style assertion fails**

Run: `pnpm --dir apps/web exec tsx --test src/views/DeepWorkbenchView.detailHeader.test.ts`

Expected: FAIL because current styles are scoped to `deep-node-detail__section` accordion cards.

- [ ] **Step 3: Implement scoped document styles**

Add `deep-node-detail-document` styles for a left reading column and a right 160-190px sticky directory. Style chapter headings as document-workbench level-one headings: gold text, left accent, and low-contrast bottom divider. Style body text and resource containers to retain the existing rich editor, grid, and bindings. Hide the directory below 820px and make the content column fill the drawer.

- [ ] **Step 4: Remove obsolete accordion-only styles**

Delete only styles uniquely belonging to `deep-node-detail__section`, `deep-node-detail__section-state`, and accordion first-child expansion. Preserve shared resource, editor, binding, and drawer controls.

- [ ] **Step 5: Run the targeted tests to verify green**

Run: `pnpm --dir apps/web exec tsx --test src/views/DeepWorkbenchView.detailHeader.test.ts src/views/deep-workbench/NodeDetailTableOfContents.test.ts`

Expected: PASS.

### Task 4: Verify the production surface

**Files:**
- Verify: `apps/web/src/views/DeepWorkbenchView.tsx`
- Verify: `apps/web/src/views/DeepWorkbenchView.css`

- [ ] **Step 1: Run the focused test suite**

Run: `pnpm --dir apps/web exec tsx --test src/views/DeepWorkbenchView.detailHeader.test.ts src/views/deep-workbench/NodeDetailTableOfContents.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run the production build**

Run: `pnpm --dir apps/web run build`

Expected: TypeScript and Vite build exit with code 0.

- [ ] **Step 3: Check the diff**

Run: `git diff --check -- apps/web/src/views/DeepWorkbenchView.tsx apps/web/src/views/DeepWorkbenchView.css apps/web/src/views/DeepWorkbenchView.detailHeader.test.ts apps/web/src/views/deep-workbench/NodeDetailTableOfContents.tsx apps/web/src/views/deep-workbench/NodeDetailTableOfContents.test.ts`

Expected: no whitespace errors; the diff is limited to the node-detail document layout and its tests.

# Flowchart Phase One Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Rich flowchart canvas practical for creating, editing, connecting and organising diagrams without leaving the canvas.

**Architecture:** Keep graph data serializable in `flowchartModel.ts`; add compact helpers for node creation, connection metadata and immutable history snapshots. The React Flow workspace renders contextual node/edge controls while the existing movable node style toolbar continues to handle shared visual style.

**Tech Stack:** React 18, TypeScript, `@xyflow/react`, Node test runner, CSS.

---

### Task 1: Extend the graph model

**Files:**
- Modify: `apps/web/src/views/project-management/flowcharts/flowchartModel.ts`
- Test: `apps/web/src/views/project-management/flowcharts/flowchartModel.test.ts`

1. Write failing tests for creating a typed node and retaining edge appearance metadata.
2. Run the model tests and verify the expected failure.
3. Add serializable node/edge helpers and defaults.
4. Re-run the model tests.

### Task 2: Add direct node and edge editing

**Files:**
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartNodeStyleToolbar.tsx`
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.css`
- Test: `apps/web/src/views/project-management/flowcharts/flowchartLayout.test.mjs`

1. Write layout tests for node type selection, resizing, edge labels/styles and reconnecting.
2. Implement the smallest UI that satisfies the tests.
3. Run the layout tests and TypeScript check.

### Task 3: Add canvas productivity controls

**Files:**
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.css`
- Test: `apps/web/src/views/project-management/flowcharts/flowchartLayout.test.mjs`

1. Write failing tests for drag-to-empty quick creation, undo/redo, duplicate and minimap.
2. Implement history snapshots, keyboard shortcuts and the small contextual UI.
3. Run focused tests, build the web app and manually inspect the desktop flowchart.

### Task 4: Integrate and deliver

1. Commit only the flowchart files and this plan.
2. Delete merged local feature branches after confirming `main` contains their tips; retain only `main`.
3. Rebuild, republish and restart `/Applications/Rich.app` as requested by the user preference.

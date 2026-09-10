# Flowchart Phase Two Implementation Plan

**Goal:** Make dense flowcharts quick to arrange, duplicate and collapse into readable groups.

**Architecture:** Keep arrangement and copy operations as pure `flowchartModel.ts` helpers, then expose them through the existing movable selection toolbar. Groups reuse region nodes and persist membership on each node, so old graph JSON remains valid.

**Tech Stack:** React 18, TypeScript, `@xyflow/react`, Node test runner.

---

### Task 1: Graph editing helpers

**Files:**
- Modify: `apps/web/src/views/project-management/flowcharts/flowchartModel.ts`
- Test: `apps/web/src/views/project-management/flowcharts/flowchartModel.test.ts`

1. Add failing tests for alignment, distribution, layout, copying selected nodes with their internal edges, and grouping.
2. Add serializable pure helpers and verify all model tests pass.

### Task 2: Canvas controls

**Files:**
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartNodeStyleToolbar.tsx`
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartFloatingToolbar.tsx`
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.css`
- Test: `apps/web/src/views/project-management/flowcharts/flowchartLayout.test.mjs`

1. Wire Cmd+C / Cmd+V to the pure selection helpers.
2. Add arrangement, layout, group and collapse actions to the movable selection toolbar.
3. Filter collapsed group members from the active canvas while retaining their stored graph data.
4. Run focused tests and type checking.

### Task 3: Deliver

1. Commit only the phase-two flowchart files and this plan.
2. Package the desktop application, replace `/Applications/Rich.app`, and restart it.

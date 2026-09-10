# Reusable Outline and Mind-map Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build independently reusable dark-outline and mind-map React components that edit one ordered tree without conversion loss.

**Architecture:** `outline-editor` owns a generic controlled outline and immutable tree operations; `mindmap` owns the `simple-mind-map` lifecycle. `DeepWorkbenchView` persists the existing tree and switches views. The reusable components never import one another.

**Tech Stack:** React 18, TypeScript, Node test runner, Vite, `simple-mind-map`.

---

## File structure

- Create `apps/web/src/components/outline-editor/types.ts`: generic tree and public Props.
- Create `apps/web/src/components/outline-editor/outlineTreeOps.ts`: immutable insert, nesting, deletion, text, and recursive expansion operations.
- Create `apps/web/src/components/outline-editor/outlineTreeOps.test.ts`: Node tests for each operation.
- Create `apps/web/src/components/outline-editor/OutlineEditor.tsx`, `OutlineTree.tsx`, `OutlineNodeRow.tsx`, and `outlineEditor.css`: dark, controlled, reusable outline UI.
- Create `apps/web/src/components/mindmap/MindmapCanvas.tsx`: map library lifecycle wrapper with no workbench import.
- Create `apps/web/src/views/deep-workbench/deepWorkbenchOutlineAdapter.ts` and its test: explicit conversion boundary.
- Modify `apps/web/src/views/DeepWorkbenchView.tsx` and `DeepWorkbenchView.css`: compose both reusable components and center title.
- Delete `apps/web/src/views/DeepWorkbenchOutline.css` and `apps/web/src/views/deep-workbench/deepWorkbenchOutline.ts`: superseded page-specific code.

### Task 1: Test and implement immutable outline operations

**Files:** `types.ts`, `outlineTreeOps.ts`, `outlineTreeOps.test.ts`.

- [ ] Write failing Node tests for insertion, indent/outdent, root and first-sibling constraints, empty-node deletion with ordered child promotion, text update, and recursive expansion. The fixture must contain root → `a`, empty `b` → `b1`.
- [ ] Run `node --test apps/web/src/components/outline-editor/outlineTreeOps.test.ts`; expect module resolution failure before implementation.
- [ ] Implement this public type contract:

```ts
export interface OutlineNode { id: string; text: string; expanded?: boolean; children: OutlineNode[]; }
export interface OutlineEditorProps { root: OutlineNode; onChange(root: OutlineNode): void; createId(): string; className?: string; }
```

- [ ] Implement `insertSiblingAfter`, `appendChild`, `indentNode`, `outdentNode`, `removeEmptyNode`, `updateNodeText`, and `expandAll` as `structuredClone`-based pure functions. `removeEmptyNode` returns unchanged root for a root or non-empty node; otherwise it replaces the node with `...node.children` at the same parent index.
- [ ] Re-run the test command; expect all tests to pass.
- [ ] Commit only those three source/test files with `feat: add reusable outline tree operations`.

### Task 2: Test and implement the deep-workbench adapter

**Files:** `deepWorkbenchOutlineAdapter.ts`, `deepWorkbenchOutlineAdapter.test.ts`.

- [ ] Write a failing round-trip test from `{ data: { uid, text, expand }, children }` to `{ id, text, expanded, children }` and back, asserting IDs, text, expansion state, and ordered children are exactly retained.
- [ ] Run `node --test apps/web/src/views/deep-workbench/deepWorkbenchOutlineAdapter.test.ts`; expect module resolution failure.
- [ ] Implement only these conversions:

```ts
export function toOutlineNode(node: DeepWorkbenchNode): OutlineNode {
  return { id: node.data.uid, text: node.data.text, expanded: node.data.expand, children: node.children.map(toOutlineNode) };
}
export function fromOutlineNode(node: OutlineNode): DeepWorkbenchNode {
  return { data: { uid: node.id, text: node.text, expand: node.expanded }, children: node.children.map(fromOutlineNode) };
}
```

- [ ] Re-run the adapter test; expect it to pass. Commit these two files with `feat: adapt deep workbench trees for outline editor`.

### Task 3: Implement reusable paragraph-style outline UI

**Files:** `OutlineEditor.tsx`, `OutlineTree.tsx`, `OutlineNodeRow.tsx`, `outlineEditor.css`.

- [ ] Create `OutlineEditor.tsx` importing the absent `OutlineTree` and run `pnpm --filter @ke/web typecheck`; expect missing module failure.
- [ ] Implement recursive rendering only for `expanded !== false`; use a controlled borderless input for text with no selected-row state.
- [ ] In `OutlineNodeRow`, use `Enter` to insert a following sibling, `Tab`/`Shift+Tab` to indent/outdent, and `Backspace` on an empty non-root node to call `removeEmptyNode`. Focus a newly inserted node or the previous visible node after removal.
- [ ] Render only leading controls: an arrow for a node with children and a hover/focus `+` for a child. No trailing buttons and no “more” menu.
- [ ] Apply scoped CSS: `#0a0a0b` background, transparent rows and inputs, no focus box shadow, and controls visible only on hover/focus.
- [ ] Re-run `pnpm --filter @ke/web typecheck`; expect exit code 0. Commit the component folder with `feat: add dark reusable outline editor`.

### Task 4: Extract reusable mind-map wrapper

**Files:** `MindmapCanvas.tsx`.

- [ ] Create a generic wrapper shell using undefined `MindmapCanvasProps` and run `pnpm --filter @ke/web typecheck`; expect that missing type error.
- [ ] Define props for `data`, `layout`, `theme`, `onChange`, and optional `onReady`. Inside `useEffect`, create `MindMap` against a ref, forward `data_change` as `onChange(mindMap.getData(true) as T)`, and destroy in cleanup.
- [ ] Expose `undo`, `redo`, `insertSibling`, `insertChild`, and `exportPng` through `onReady`; do not import outline or workbench files.
- [ ] Re-run web typecheck; expect exit code 0. Commit with `feat: add reusable mindmap canvas`.

### Task 5: Compose the workbench and verify

**Files:** `DeepWorkbenchView.tsx`, `DeepWorkbenchView.css`, composition test, obsolete files.

- [ ] Add a Node regression test proving `fromOutlineNode(expandAll(toOutlineNode(root), false))` preserves IDs/text/hierarchy and recursively sets `expand: false`. Run it first; expect pass because it verifies prior component contracts.
- [ ] Remove direct map imports/refs/effect, page-owned outline operation imports, row rendering, old white CSS import, and inert “more” buttons.
- [ ] Render `<OutlineEditor root={toOutlineNode(active.map.root)} onChange={node => updateOutline(fromOutlineNode(node))} createId={newId} />` in outline mode and `<MindmapCanvas data={active.map.root} layout={active.map.layout} theme={active.map.theme} onChange={root => updateOutline(root)} onReady={setMindmapActions} />` in map mode.
- [ ] Implement global folding with `fromOutlineNode(expandAll(toOutlineNode(active.map.root), nextExpanded))`; use map wrapper actions for map-only toolbar controls and disable them until ready.
- [ ] Use a three-column header grid: left back control, true centered title, right actions. Keep page background dark.
- [ ] Delete the two superseded page-specific outline files.
- [ ] Run:

```bash
node --test apps/web/src/components/outline-editor/outlineTreeOps.test.ts apps/web/src/views/deep-workbench/deepWorkbenchOutlineAdapter.test.ts apps/web/src/views/deep-workbench/deepWorkbenchComposition.test.ts
pnpm --filter @ke/web typecheck
pnpm --filter @ke/web build
```

- [ ] Manually check dark styling, centered title, no row selection rectangle, keyboard editing, child promotion on delete, recursive fold, and map/outline continuity.
- [ ] Commit composition with `feat: compose reusable outline and mindmap workbench`.

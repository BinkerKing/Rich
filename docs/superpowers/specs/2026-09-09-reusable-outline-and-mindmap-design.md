# Reusable outline and mind-map components

## Goal

Turn the existing deep-workbench outline and mind-map views into independent,
reusable React components. Both views edit the same ordered tree, allowing a
user to switch representations without conversion loss.

## Scope

The outline becomes a dark, keyboard-driven Mubu-style editor:

- paragraph-like node editing without full-row selection or input borders;
- a leading expand/collapse control and a hover/focus `+` control for adding a
  child;
- `Enter` adds a following sibling, `Tab` indents, and `Shift+Tab` outdents;
- `Backspace` on an empty node deletes it immediately and promotes its children
  to its former sibling position;
- a working recursive expand/collapse action;
- no placeholder "more" controls, drag-and-drop, move actions, or rich text.

The workbench toolbar stays responsible for navigation, a visually centered
document title, representation switching, and recursive expand/collapse. It
does not contain outline-node operations.

## Component boundaries

`outline-editor/` contains a generic tree contract and reusable UI:

- `types.ts`: `OutlineNode` and `OutlineEditorProps`.
- `outlineTreeAdapter.ts`: conversion between a consumer's node shape and the
  generic contract. The deep workbench maps `data.uid`, `data.text`, and
  `data.expand` to `id`, `text`, and `expanded`.
- `outlineTreeOps.ts`: immutable, DOM-free operations for insertion, deletion,
  indent/outdent, text update, and recursive expansion. These functions are
  unit-tested.
- `OutlineEditor.tsx`: public controlled component.
- `OutlineTree.tsx` and `OutlineNodeRow.tsx`: recursive rendering and a single
  paragraph-style editable node row.
- `outlineEditor.css`: dark, locally scoped component styles.

`mindmap/` exposes a separate reusable `MindmapCanvas` wrapper for
`simple-mind-map`. It receives and emits the consumer's canonical tree and
owns library lifecycle, map commands, and export. It does not import the
outline component.

`DeepWorkbenchView` owns persistence and adapts its `DeepWorkbenchNode` tree
to each component. It is the only place that coordinates view switching.

## Data flow

The workbench's `DeepWorkbenchNode` remains the single source of truth. An
outline operation produces a new canonical root via adapter + tree operation;
the workbench persists it. A mind-map `data_change` similarly emits a new
canonical root. Switching views only re-renders the other component from that
same root; there is no bidirectional synchronizer or duplicated state.

## Error and edge-case behavior

- The root cannot be indented, outdented, or deleted.
- Indenting the first sibling leaves the tree unchanged.
- Deleting an empty node preserves its children and their order by promoting
  them to the removed node's parent.
- If no child nodes exist, expand/collapse controls are visually hidden and do
  not perform an operation.
- Component callbacks emit immutable tree values only.

## Verification

Unit tests cover all tree operations, particularly ordered child promotion on
delete and recursive expand/collapse. The web typecheck and production build
must pass. A manual smoke check verifies title centering, dark outline styling,
keyboard editing, deletion behavior, and map/outline state continuity.

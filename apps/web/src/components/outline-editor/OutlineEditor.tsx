import { useState } from "react";
import {
  appendChild,
  indentNode,
  insertSiblingAfter,
  outdentNode,
  removeEmptyNode,
  updateNodeText,
} from "./outlineTreeOps.js";
import { OutlineTree } from "./OutlineTree.js";
import type { OutlineEditorProps, OutlineNode } from "./types.js";
import "./outlineEditor.css";

function parentId(root: OutlineNode, nodeId: string): string | null {
  for (const child of root.children) {
    if (child.id === nodeId) return root.id;
    const found = parentId(child, nodeId);
    if (found) return found;
  }

  return null;
}

export function OutlineEditor({ root, onChange, createId, className = "" }: OutlineEditorProps) {
  const [focusId, setFocusId] = useState<string | null>(null);

  const commit = (next: OutlineNode, nextFocusId?: string | null) => {
    onChange(next);
    if (nextFocusId !== undefined) setFocusId(nextFocusId);
  };

  return (
    <div className={`outline-editor ${className}`.trim()}>
      <OutlineTree
        node={root}
        rootId={root.id}
        focusId={focusId}
        onFocused={() => setFocusId(null)}
        onTextChange={(nodeId, text) => commit(updateNodeText(root, nodeId, text))}
        onToggle={(nodeId, expanded) => {
          const toggle = (node: OutlineNode): OutlineNode => node.id === nodeId
            ? { ...node, expanded }
            : { ...node, children: node.children.map(toggle) };
          commit(toggle(root));
        }}
        onAppendChild={(nodeId) => {
          const childId = createId();
          commit(appendChild(root, nodeId, () => childId), childId);
        }}
        onInsertSibling={(nodeId) => {
          const siblingId = createId();
          commit(insertSiblingAfter(root, nodeId, () => siblingId), siblingId);
        }}
        onIndent={(nodeId) => commit(indentNode(root, nodeId), nodeId)}
        onOutdent={(nodeId) => commit(outdentNode(root, nodeId), nodeId)}
        onRemove={(nodeId) => commit(removeEmptyNode(root, nodeId), parentId(root, nodeId))}
      />
    </div>
  );
}

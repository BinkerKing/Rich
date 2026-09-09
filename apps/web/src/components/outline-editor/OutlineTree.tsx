import type { OutlineNode } from "./types.js";
import { OutlineNodeRow } from "./OutlineNodeRow.js";

type OutlineTreeProps = {
  node: OutlineNode;
  rootId: string;
  focusId: string | null;
  onFocused: () => void;
  onTextChange: (nodeId: string, text: string) => void;
  onToggle: (nodeId: string, expanded: boolean) => void;
  onAppendChild: (nodeId: string) => void;
  onInsertSibling: (nodeId: string) => void;
  onIndent: (nodeId: string) => void;
  onOutdent: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export function OutlineTree({ node, rootId, focusId, onFocused, ...actions }: OutlineTreeProps) {
  const hasChildren = node.children.length > 0;
  const expanded = node.expanded ?? true;

  return (
    <div className="outline-tree">
      <OutlineNodeRow
        node={node}
        isRoot={node.id === rootId}
        focus={focusId === node.id}
        onFocused={onFocused}
        {...actions}
      />
      {hasChildren && expanded && (
        <div className="outline-tree__children" role="group">
          {node.children.map((child) => (
            <OutlineTree
              key={child.id}
              node={child}
              rootId={rootId}
              focusId={focusId}
              onFocused={onFocused}
              {...actions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

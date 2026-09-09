import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { OutlineNode } from "./types.js";

type OutlineNodeRowProps = {
  node: OutlineNode;
  isRoot: boolean;
  focus: boolean;
  onFocused: () => void;
  onTextChange: (nodeId: string, text: string) => void;
  onToggle: (nodeId: string, expanded: boolean) => void;
  onAppendChild: (nodeId: string) => void;
  onInsertSibling: (nodeId: string) => void;
  onIndent: (nodeId: string) => void;
  onOutdent: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export function OutlineNodeRow({
  node,
  isRoot,
  focus,
  onFocused,
  onTextChange,
  onToggle,
  onAppendChild,
  onInsertSibling,
  onIndent,
  onOutdent,
  onRemove,
}: OutlineNodeRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;
  const expanded = node.expanded ?? true;

  useEffect(() => {
    if (!focus) return;
    inputRef.current?.focus();
    onFocused();
  }, [focus, onFocused]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isRoot) {
      event.preventDefault();
      onInsertSibling(node.id);
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) onOutdent(node.id);
      else onIndent(node.id);
    }
    if (event.key === "Backspace" && !isRoot && !node.text) {
      event.preventDefault();
      onRemove(node.id);
    }
  };

  return (
    <div className="outline-node-row" role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      {hasChildren ? (
        <button
          className="outline-node-row__toggle"
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => onToggle(node.id, !expanded)}
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : <span className="outline-node-row__toggle-spacer" aria-hidden="true" />}
      <input
        ref={inputRef}
        className="outline-node-row__input"
        value={node.text}
        aria-label={isRoot ? "Outline title" : "Outline item"}
        onChange={(event) => onTextChange(node.id, event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        className="outline-node-row__add"
        type="button"
        aria-label="Add child"
        onClick={() => onAppendChild(node.id)}
      >
        +
      </button>
    </div>
  );
}

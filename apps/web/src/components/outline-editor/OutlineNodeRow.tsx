import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { nodeStyleFromData } from "../mindmap/nodeStyleControls.js";
import type { OutlineNode } from "./types.js";

type OutlineNodeRowProps = {
  node: OutlineNode;
  isRoot: boolean;
  level: number;
  themeConfig?: Record<string, unknown>;
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
  level,
  themeConfig,
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
  const inputRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children.length > 0;
  const expanded = node.expanded ?? true;
  const themeStyle = themeConfig?.[level === 0 ? "root" : level === 1 ? "second" : "node"];
  const style = nodeStyleFromData({
    ...(themeStyle && typeof themeStyle === "object" ? themeStyle as Record<string, unknown> : {}),
    ...node.data,
  });

  useEffect(() => {
    if (!focus) return;
    inputRef.current?.focus();
    onFocused();
  }, [focus, onFocused]);

  useEffect(() => {
    if (document.activeElement === inputRef.current || !inputRef.current || inputRef.current.innerHTML === node.text) return;
    inputRef.current.innerHTML = node.text;
  }, [node.text]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !isRoot) {
      event.preventDefault();
      onInsertSibling(node.id);
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) onOutdent(node.id);
      else onIndent(node.id);
    }
    if (event.key === "Backspace" && !isRoot && !event.currentTarget.textContent?.trim()) {
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
      <div
        ref={inputRef}
        className="outline-node-row__input outline-node-row__rich-input"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-label={isRoot ? "Outline title" : "Outline item"}
        style={{
          color: style.color,
          backgroundColor: style.fillColor,
          borderColor: style.borderColor,
          borderWidth: style.borderWidth,
          borderRadius: style.borderRadius,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
        }}
        dangerouslySetInnerHTML={{ __html: node.text }}
        onInput={(event) => onTextChange(node.id, event.currentTarget.innerHTML)}
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

import { useEffect, useState } from "react";
import { nodeStyleFromData, type NodeStyle } from "./nodeStyleControls.js";
import { titleFromNodeHtml, titleNoteNodeHtml, titleOnlyNodeHtml } from "./richTextNode.js";
import "./mindmapNodeStyleToolbar.css";

export type MindmapNodeStyleTarget = {
  getData(key: string): unknown;
  setData(data: Record<string, unknown>): void;
  setText(text: string, richText?: boolean): void;
  setStyles(style: Partial<NodeStyle>): void;
};

type Props = {
  node: MindmapNodeStyleTarget;
};

const colorInputs: Array<{ key: "color" | "fillColor" | "borderColor"; label: string }> = [
  { key: "color", label: "文字颜色" },
  { key: "fillColor", label: "背景颜色" },
  { key: "borderColor", label: "边框颜色" },
];

export function MindmapNodeStyleToolbar({ node }: Props) {
  const [style, setStyle] = useState(() => nodeStyleFromData(readNodeStyle(node)));
  const [hasNote, setHasNote] = useState(() => node.getData("nodeCardStyle") === "title-note");

  useEffect(() => {
    setStyle(nodeStyleFromData(readNodeStyle(node)));
    setHasNote(node.getData("nodeCardStyle") === "title-note");
  }, [node]);

  const apply = (patch: Partial<NodeStyle>) => {
    const next = { ...style, ...patch };
    setStyle(next);
    node.setStyles(patch);
  };

  return <aside className="mindmap-node-style-toolbar" aria-label="节点样式">
    <span className="mindmap-node-style-toolbar__title">节点样式</span>
    <label title="字号">字号<select value={style.fontSize} onChange={event => apply({ fontSize: Number(event.target.value) })}>{[14, 16, 18, 22, 26].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    <button className={style.fontWeight === "bold" ? "is-active" : ""} type="button" title="加粗" aria-pressed={style.fontWeight === "bold"} onClick={() => apply({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}>B</button>
    {colorInputs.map(({ key, label }) => <label key={key} className="mindmap-node-style-toolbar__color" title={label}>{label}<input type="color" value={style[key]} onChange={event => apply({ [key]: event.target.value })} /></label>)}
    <label title="边框粗细">边框<select value={style.borderWidth} onChange={event => apply({ borderWidth: Number(event.target.value) })}>{[0, 1, 2, 3].map(width => <option key={width} value={width}>{width}px</option>)}</select></label>
    <label title="圆角">圆角<select value={style.borderRadius} onChange={event => apply({ borderRadius: Number(event.target.value) })}>{[0, 8, 16, 28, 48].map(radius => <option key={radius} value={radius}>{radius}px</option>)}</select></label>
    <button className={hasNote ? "is-active" : ""} type="button" title={hasNote ? "移除备注" : "增加备注"} aria-label={hasNote ? "移除备注" : "增加备注"} aria-pressed={hasNote} onClick={() => {
      const title = titleFromNodeHtml(node.getData("text"));
      if (hasNote) {
        node.setData({ nodeCardStyle: undefined });
        node.setText(titleOnlyNodeHtml(node.getData("text")), true);
        setHasNote(false);
        return;
      }
      node.setData({ nodeCardStyle: "title-note" });
      node.setText(titleNoteNodeHtml(title, "点击两次编辑备注"), true);
      setHasNote(true);
    }}>▤</button>
  </aside>;
}

function readNodeStyle(node: MindmapNodeStyleTarget): Record<string, unknown> {
  return Object.fromEntries(["color", "fillColor", "borderColor", "borderWidth", "borderRadius", "fontSize", "fontWeight"].map(key => [key, node.getData(key)]));
}

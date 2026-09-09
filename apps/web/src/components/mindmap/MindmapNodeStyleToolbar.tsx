import { useEffect, useRef, useState } from "react";
import { nodeStyleFromData, type NodeStyle } from "./nodeStyleControls.js";
import { noteButtonState, styleMenuOptions, type StyleMenu } from "./nodeStyleToolbarMenu.js";
import { clampNodeStyleToolbarPosition, parseNodeStyleToolbarPosition, type NodeStyleToolbarPosition } from "./nodeStyleToolbarPosition.js";
import { titleFromNodeHtml, titleNoteNodeHtml } from "./richTextNode.js";
import "./mindmapNodeStyleToolbar.css";

export type MindmapNodeStyleTarget = {
  getData(key: string): unknown;
  setData(data: Record<string, unknown>): void;
  setText(text: string, richText?: boolean): void;
  setStyles(style: Partial<NodeStyle>): void;
};

type Props = { node: MindmapNodeStyleTarget };
type OpenMenu = StyleMenu | "color" | "fillColor" | "borderColor" | "border" | null;
const POSITION_STORAGE_KEY = "rich.mindmap.node-style-toolbar.position.v1";

export function MindmapNodeStyleToolbar({ node }: Props) {
  const [style, setStyle] = useState(() => nodeStyleFromData(readNodeStyle(node)));
  const [hasNote, setHasNote] = useState(() => node.getData("nodeCardStyle") === "title-note");
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [position, setPosition] = useState<NodeStyleToolbarPosition | null>(() => parseNodeStyleToolbarPosition(localStorage.getItem(POSITION_STORAGE_KEY)));
  const toolbarRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    setStyle(nodeStyleFromData(readNodeStyle(node)));
    setHasNote(node.getData("nodeCardStyle") === "title-note");
    setOpenMenu(null);
  }, [node]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const toolbar = toolbarRef.current;
      const canvas = toolbar?.parentElement;
      const drag = dragRef.current;
      if (!toolbar || !canvas || !drag) return;
      const canvasRect = canvas.getBoundingClientRect();
      setPosition(clampNodeStyleToolbarPosition(
        { x: event.clientX - canvasRect.left - drag.offsetX, y: event.clientY - canvasRect.top - drag.offsetY },
        canvasRect,
        toolbar.getBoundingClientRect(),
      ));
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPosition(current => {
        if (current) localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(current));
        return current;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, []);

  const apply = (patch: Partial<NodeStyle>) => {
    setStyle(current => ({ ...current, ...patch }));
    node.setStyles(patch);
  };
  const toggle = (menu: OpenMenu) => setOpenMenu(current => current === menu ? null : menu);
  const colorMenu = (key: "color" | "fillColor" | "borderColor", label: string) => <div className="mindmap-node-style-toolbar__menu mindmap-node-style-toolbar__menu--color"><span>{label}</span><input aria-label={label} type="color" value={style[key]} onChange={event => apply({ [key]: event.target.value })} /></div>;
  const noteState = noteButtonState(hasNote);
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPosition({ x: rect.left - toolbar.parentElement!.getBoundingClientRect().left, y: rect.top - toolbar.parentElement!.getBoundingClientRect().top });
  };

  return <aside ref={toolbarRef} className="mindmap-node-style-toolbar" aria-label="节点样式" style={position ? { left: position.x, top: position.y, bottom: "auto", transform: "none" } : undefined}>
    <button className="mindmap-node-style-toolbar__drag" type="button" title="拖动编辑器" aria-label="拖动编辑器" onPointerDown={startDrag}><ToolbarIcon name="drag" /></button>
    {openMenu && <div className="mindmap-node-style-toolbar__menu-wrap">
      {openMenu === "fontSize" && <div className="mindmap-node-style-toolbar__menu"><span>字号</span><div>{styleMenuOptions("fontSize").map(size => <button key={size} className={style.fontSize === size ? "is-active" : ""} type="button" onClick={() => { apply({ fontSize: size }); setOpenMenu(null); }}>{size}</button>)}</div></div>}
      {openMenu === "color" && colorMenu("color", "文字颜色")}
      {openMenu === "fillColor" && colorMenu("fillColor", "背景颜色")}
      {openMenu === "borderColor" && colorMenu("borderColor", "边框颜色")}
      {openMenu === "border" && <div className="mindmap-node-style-toolbar__menu mindmap-node-style-toolbar__menu--border"><span>边框</span><div><small>颜色</small><input aria-label="边框颜色" type="color" value={style.borderColor} onChange={event => apply({ borderColor: event.target.value })} /></div><div><small>粗细</small>{styleMenuOptions("borderWidth").map(width => <button key={width} className={style.borderWidth === width ? "is-active" : ""} type="button" onClick={() => apply({ borderWidth: width })}>{width}px</button>)}</div><div><small>圆角</small>{styleMenuOptions("borderRadius").map(radius => <button key={radius} className={style.borderRadius === radius ? "is-active" : ""} type="button" onClick={() => apply({ borderRadius: radius })}>{radius}</button>)}</div></div>}
    </div>}
    <button type="button" title="字号" aria-label="字号" aria-expanded={openMenu === "fontSize"} onClick={() => toggle("fontSize")}><ToolbarIcon name="text" /></button>
    <button className={style.fontWeight === "bold" ? "is-active" : ""} type="button" title="加粗" aria-label="加粗" aria-pressed={style.fontWeight === "bold"} onClick={() => apply({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}><ToolbarIcon name="bold" /></button>
    <button type="button" title="文字颜色" aria-label="文字颜色" aria-expanded={openMenu === "color"} onClick={() => toggle("color")}><ToolbarIcon name="color" /></button>
    <button type="button" title="背景颜色" aria-label="背景颜色" aria-expanded={openMenu === "fillColor"} onClick={() => toggle("fillColor")}><ToolbarIcon name="fill" /></button>
    <button type="button" title="边框样式" aria-label="边框样式" aria-expanded={openMenu === "border"} onClick={() => toggle("border")}><ToolbarIcon name="border" /></button>
    <button className={hasNote ? "is-active" : ""} type="button" disabled={noteState.disabled} title={noteState.label} aria-label={noteState.label} aria-pressed={hasNote} onClick={() => {
      const title = titleFromNodeHtml(node.getData("text"));
      node.setData({ nodeCardStyle: "title-note" });
      node.setText(titleNoteNodeHtml(title, "点击两次编辑备注"), true);
      setHasNote(true);
    }}><ToolbarIcon name="note" /></button>
  </aside>;
}

function ToolbarIcon({ name }: { name: "text" | "bold" | "color" | "fill" | "border" | "note" | "drag" }) {
  const paths = {
    text: <><path d="M5 5h14M12 5v14M8 19h8" /></>,
    bold: <path d="M8 5h5a3 3 0 0 1 0 6H8zm0 6h6a3 3 0 0 1 0 6H8z" />,
    color: <><path d="m8 17 4-11 4 11M9.5 13h5" /><path d="M5 20h14" /></>,
    fill: <><path d="m7 4 10 10-5 5L2 9z" /><path d="M16 18h5" /></>,
    border: <><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 12h6" /></>,
    note: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 9h8M8 13h8" /></>,
    drag: <><circle cx="9" cy="7" r="1" /><circle cx="15" cy="7" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="17" r="1" /><circle cx="15" cy="17" r="1" /></>,
  }[name];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

function readNodeStyle(node: MindmapNodeStyleTarget): Record<string, unknown> {
  return Object.fromEntries(["color", "fillColor", "borderColor", "borderWidth", "borderRadius", "fontSize", "fontWeight"].map(key => [key, node.getData(key)]));
}

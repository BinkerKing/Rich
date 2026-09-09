import { useEffect, useRef, useState } from "react";
import { nodeStyleFromData, type NodeStyle } from "./nodeStyleControls.js";
import { nodeColorPresets, noteButtonState, styleMenuOptions, type NodeColorStyle, type StyleMenu } from "./nodeStyleToolbarMenu.js";
import { applyNodeStyle } from "./mindmapMultiSelection.js";
import { clampNodeStyleToolbarPosition, parseNodeStyleToolbarPosition, type NodeStyleToolbarPosition } from "./nodeStyleToolbarPosition.js";
import { parseNodeStylePresets, saveNodeStylePreset, type NodeStylePreset } from "./nodeStylePresets.js";
import { nextNodeIcon, nodeIconHtml, titleFromNodeHtml, titleNoteNodeHtml } from "./richTextNode.js";
import "./mindmapNodeStyleToolbar.css";

export type MindmapNodeStyleTarget = {
  getData(key: string): unknown;
  setData(data: Record<string, unknown>): void;
  setText(text: string, richText?: boolean): void;
  setStyles(style: Partial<NodeStyle>): void;
};

type Props = { nodes: MindmapNodeStyleTarget[] };
type OpenMenu = StyleMenu | "color" | "fillColor" | "borderColor" | "border" | "presets" | "icon" | null;
const POSITION_STORAGE_KEY = "rich.mindmap.node-style-toolbar.position.v1";
const PRESETS_STORAGE_KEY = "rich.mindmap.node-style-presets.v1";
const nodeIcons = ["📌", "⭐", "💡", "⚙️", "🎯", "✅", "⚠️", "📚", "🔗", "🚀", "💬", "🔍"];

export function MindmapNodeStyleToolbar({ nodes }: Props) {
  const node = nodes[0]!;
  const [style, setStyle] = useState(() => nodeStyleFromData(readNodeStyle(node)));
  const [hasNote, setHasNote] = useState(() => node.getData("nodeCardStyle") === "title-note");
  const [nodeIcon, setNodeIcon] = useState(() => readNodeIcon(node));
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [presets, setPresets] = useState<NodeStylePreset[]>(() => parseNodeStylePresets(localStorage.getItem(PRESETS_STORAGE_KEY)));
  const [presetName, setPresetName] = useState("");
  const [position, setPosition] = useState<NodeStyleToolbarPosition | null>(() => parseNodeStyleToolbarPosition(localStorage.getItem(POSITION_STORAGE_KEY)));
  const toolbarRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    setStyle(nodeStyleFromData(readNodeStyle(node)));
    setHasNote(node.getData("nodeCardStyle") === "title-note");
    setNodeIcon(readNodeIcon(node));
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
    applyNodeStyle(nodes, patch);
  };
  const toggle = (menu: OpenMenu) => setOpenMenu(current => current === menu ? null : menu);
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    setPresets(current => {
      const next = saveNodeStylePreset(current, name, style);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setPresetName("");
  };
  const applyPreset = (preset: NodeStylePreset) => {
    setStyle(preset.style);
    applyNodeStyle(nodes, preset.style);
    setOpenMenu(null);
  };
  const applyIcon = (icon?: string) => {
    nodes.forEach(target => {
      target.setData({ nodeIcon: icon });
      target.setText(nodeIconHtml(target.getData("text"), icon), true);
    });
    setNodeIcon(icon);
    setOpenMenu(null);
  };
  const colorSwatches = (key: NodeColorStyle, label: string) => <div className="mindmap-node-style-toolbar__swatches">{nodeColorPresets(key).map(color => <button key={color} className={style[key] === color ? "is-active" : ""} type="button" title={color} aria-label={`${label}：${color}`} style={{ backgroundColor: color }} onClick={() => apply({ [key]: color })} />)}<label className="mindmap-node-style-toolbar__custom-color" title={`自定义${label}`} aria-label={`自定义${label}`}><ToolbarIcon name="palette" /><input aria-label={`自定义${label}`} type="color" value={style[key]} onChange={event => apply({ [key]: event.target.value })} /></label></div>;
  const colorMenu = (key: NodeColorStyle, label: string) => <div className="mindmap-node-style-toolbar__menu mindmap-node-style-toolbar__menu--color"><span>{label}</span>{colorSwatches(key, label)}</div>;
  const noteState = nodes.length === 1 ? noteButtonState(hasNote) : { disabled: true, label: "批量选择时不能增加备注" };
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPosition({ x: rect.left - toolbar.parentElement!.getBoundingClientRect().left, y: rect.top - toolbar.parentElement!.getBoundingClientRect().top });
  };

  return <aside ref={toolbarRef} className="mindmap-node-style-toolbar" aria-label={`节点样式${nodes.length > 1 ? `，已选 ${nodes.length} 个节点` : ""}`} style={position ? { left: position.x, top: position.y, bottom: "auto", transform: "none" } : undefined}>
    <button className="mindmap-node-style-toolbar__drag" type="button" title="拖动编辑器" aria-label="拖动编辑器" onPointerDown={startDrag}><ToolbarIcon name="drag" /></button>
    {openMenu && <div className="mindmap-node-style-toolbar__menu-wrap">
      {openMenu === "fontSize" && <div className="mindmap-node-style-toolbar__menu"><span>字号</span><div>{styleMenuOptions("fontSize").map(size => <button key={size} className={style.fontSize === size ? "is-active" : ""} type="button" onClick={() => { apply({ fontSize: size }); setOpenMenu(null); }}>{size}</button>)}</div></div>}
      {openMenu === "color" && colorMenu("color", "文字颜色")}
      {openMenu === "fillColor" && colorMenu("fillColor", "背景颜色")}
      {openMenu === "borderColor" && colorMenu("borderColor", "边框颜色")}
      {openMenu === "border" && <div className="mindmap-node-style-toolbar__menu mindmap-node-style-toolbar__menu--border"><span>边框</span><div><small>颜色</small>{colorSwatches("borderColor", "边框颜色")}</div><div><small>粗细</small>{styleMenuOptions("borderWidth").map(width => <button key={width} className={style.borderWidth === width ? "is-active" : ""} type="button" onClick={() => apply({ borderWidth: width })}>{width}px</button>)}</div><div><small>圆角</small>{styleMenuOptions("borderRadius").map(radius => <button key={radius} className={style.borderRadius === radius ? "is-active" : ""} type="button" onClick={() => apply({ borderRadius: radius })}>{radius}</button>)}</div></div>}
      {openMenu === "icon" && <div className="mindmap-node-style-toolbar__menu mindmap-node-style-toolbar__menu--icons"><span>节点图标</span><div>{nodeIcons.map(icon => <button key={icon} className={nodeIcon === icon ? "is-active" : ""} type="button" title={nodeIcon === icon ? `移除${icon}` : `使用${icon}`} aria-label={nodeIcon === icon ? `移除${icon}` : `使用${icon}`} onClick={() => applyIcon(nextNodeIcon(nodeIcon, icon))}>{icon}</button>)}<button className={!nodeIcon ? "is-active" : ""} type="button" title="移除图标" aria-label="移除图标" onClick={() => applyIcon(undefined)}>×</button></div></div>}
      {openMenu === "presets" && <div className="mindmap-node-style-toolbar__menu mindmap-node-style-toolbar__menu--presets"><span>节点样式</span><div className="mindmap-node-style-toolbar__preset-list">{presets.length ? presets.map(preset => <button key={preset.id} type="button" title={`应用“${preset.name}”`} onClick={() => applyPreset(preset)}>{preset.name}</button>) : <small>保存当前样式后，可在这里复用</small>}</div><div className="mindmap-node-style-toolbar__preset-save"><input aria-label="节点样式名称" value={presetName} placeholder="例如：重点节点" maxLength={24} onChange={event => setPresetName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") savePreset(); }} /><button type="button" disabled={!presetName.trim()} onClick={savePreset}>保存</button></div></div>}
    </div>}
    <button type="button" title="字号" aria-label="字号" aria-expanded={openMenu === "fontSize"} onClick={() => toggle("fontSize")}><ToolbarIcon name="text" /></button>
    <button className={style.fontWeight === "bold" ? "is-active" : ""} type="button" title="加粗" aria-label="加粗" aria-pressed={style.fontWeight === "bold"} onClick={() => apply({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}><ToolbarIcon name="bold" /></button>
    <button className={nodeIcon ? "is-active" : ""} type="button" title="节点图标" aria-label="节点图标" aria-expanded={openMenu === "icon"} onClick={() => toggle("icon")}><ToolbarIcon name="icon" /></button>
    <button type="button" title="文字颜色" aria-label="文字颜色" aria-expanded={openMenu === "color"} onClick={() => toggle("color")}><ToolbarIcon name="color" /></button>
    <button type="button" title="背景颜色" aria-label="背景颜色" aria-expanded={openMenu === "fillColor"} onClick={() => toggle("fillColor")}><ToolbarIcon name="fill" /></button>
    <button type="button" title="边框样式" aria-label="边框样式" aria-expanded={openMenu === "border"} onClick={() => toggle("border")}><ToolbarIcon name="border" /></button>
    <button type="button" title="节点样式" aria-label="节点样式" aria-expanded={openMenu === "presets"} onClick={() => toggle("presets")}><ToolbarIcon name="preset" /></button>
    <button className={hasNote ? "is-active" : ""} type="button" disabled={noteState.disabled} title={noteState.label} aria-label={noteState.label} aria-pressed={hasNote} onClick={() => {
      const title = titleFromNodeHtml(node.getData("text"));
      node.setData({ nodeCardStyle: "title-note" });
      node.setText(nodeIconHtml(titleNoteNodeHtml(title, "点击两次编辑备注"), nodeIcon), true);
      setHasNote(true);
    }}><ToolbarIcon name="note" /></button>
  </aside>;
}

function ToolbarIcon({ name }: { name: "text" | "bold" | "color" | "fill" | "border" | "note" | "drag" | "preset" | "palette" | "icon" }) {
  const paths = {
    text: <><path d="M5 5h14M12 5v14M8 19h8" /></>,
    bold: <path d="M8 5h5a3 3 0 0 1 0 6H8zm0 6h6a3 3 0 0 1 0 6H8z" />,
    color: <><path d="m8 17 4-11 4 11M9.5 13h5" /><path d="M5 20h14" /></>,
    fill: <><path d="m7 4 10 10-5 5L2 9z" /><path d="M16 18h5" /></>,
    border: <><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 12h6" /></>,
    note: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 9h8M8 13h8" /></>,
    drag: <><circle cx="9" cy="7" r="1" /><circle cx="15" cy="7" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="17" r="1" /><circle cx="15" cy="17" r="1" /></>,
    preset: <><path d="M6 4h12v16H6z" /><path d="m9 8 3-2 3 2v4l-3 2-3-2z" /><path d="M9 17h6" /></>,
    palette: <><path d="M12 4a8 8 0 1 0 0 16h1.1a1.9 1.9 0 0 0 .7-3.67 1.6 1.6 0 0 1 .6-3.08H16A4 4 0 0 0 12 4Z" /><circle cx="8" cy="11" r=".8" fill="currentColor" /><circle cx="11" cy="8" r=".8" fill="currentColor" /><circle cx="15" cy="9" r=".8" fill="currentColor" /></>,
    icon: <><circle cx="12" cy="12" r="7" /><circle cx="9.5" cy="10" r=".7" fill="currentColor" /><circle cx="14.5" cy="10" r=".7" fill="currentColor" /><path d="M9 14c1.5 1.3 4.5 1.3 6 0" /></>,
  }[name];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

function readNodeStyle(node: MindmapNodeStyleTarget): Record<string, unknown> {
  return Object.fromEntries(["color", "fillColor", "borderColor", "borderWidth", "borderRadius", "fontSize", "fontWeight"].map(key => [key, node.getData(key)]));
}

function readNodeIcon(node: MindmapNodeStyleTarget): string | undefined {
  const icon = node.getData("nodeIcon");
  return typeof icon === "string" && icon.trim() ? icon : undefined;
}

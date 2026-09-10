import { useEffect, useRef, useState } from "react";
import { nodeStyleFromData, type NodeStyle } from "../../../components/mindmap/nodeStyleControls.js";
import { nodeColorPresets, styleMenuOptions, type NodeColorStyle } from "../../../components/mindmap/nodeStyleToolbarMenu.js";
import { clampNodeStyleToolbarPosition, parseNodeStyleToolbarPosition, type NodeStyleToolbarPosition } from "../../../components/mindmap/nodeStyleToolbarPosition.js";
import { parseNodeStylePresets, saveNodeStylePreset, type NodeStylePreset } from "../../../components/mindmap/nodeStylePresets.js";
import type { FlowNode, FlowNodeKind } from "./flowchartModel.js";

const POSITION_STORAGE_KEY = "rich.flowchart.node-style-toolbar.position.v1";
const PRESETS_STORAGE_KEY = "rich.flowchart.node-style-presets.v1";
type OpenMenu = "fontSize" | "color" | "fillColor" | "border" | "presets" | "icon" | "kind" | null;
const nodeIcons = ["📌", "⭐", "💡", "⚙️", "🎯", "✅", "⚠️", "📚", "🔗", "🚀", "💬", "🔍"];
const nodeKinds: { value: FlowNodeKind; label: string }[] = [{ value: "step", label: "步骤" }, { value: "decision", label: "判断" }, { value: "table", label: "数据表" }, { value: "boundary", label: "开始/结束" }, { value: "region", label: "区域" }, { value: "note", label: "备注" }];

export function FlowchartNodeStyleToolbar({ nodes, onChange, onKindChange }: { nodes: FlowNode[]; onChange: (patch: Partial<FlowNode["data"]>) => void; onKindChange: (kind: FlowNodeKind) => void }) {
  const node = nodes[0]!;
  const [style, setStyle] = useState(() => nodeStyleFromData(node.data));
  const [icon, setIcon] = useState(node.data.icon);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [presets, setPresets] = useState<NodeStylePreset[]>(() => parseNodeStylePresets(localStorage.getItem(PRESETS_STORAGE_KEY)));
  const [presetName, setPresetName] = useState("");
  const [position, setPosition] = useState<NodeStyleToolbarPosition | null>(() => parseNodeStyleToolbarPosition(localStorage.getItem(POSITION_STORAGE_KEY)));
  const toolbarRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => { setStyle(nodeStyleFromData(node.data)); setIcon(node.data.icon); setOpenMenu(null); }, [node]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const toolbar = toolbarRef.current;
      const canvas = toolbar?.parentElement;
      const drag = dragRef.current;
      if (!toolbar || !canvas || !drag) return;
      const canvasRect = canvas.getBoundingClientRect();
      setPosition(clampNodeStyleToolbarPosition({ x: event.clientX - canvasRect.left - drag.offsetX, y: event.clientY - canvasRect.top - drag.offsetY }, canvasRect, toolbar.getBoundingClientRect()));
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPosition(current => { if (current) localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(current)); return current; });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, []);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const canvas = toolbar?.parentElement;
    if (!toolbar || !canvas || !position) return;
    const keepVisible = () => {
      const next = clampNodeStyleToolbarPosition(position, canvas.getBoundingClientRect(), toolbar.getBoundingClientRect());
      if (next.x !== position.x || next.y !== position.y) { localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next)); setPosition(next); }
    };
    keepVisible(); const observer = new ResizeObserver(keepVisible); observer.observe(canvas);
    return () => observer.disconnect();
  }, [position]);

  const apply = (patch: Partial<NodeStyle>) => { setStyle(current => ({ ...current, ...patch })); onChange(patch); };
  const toggle = (menu: OpenMenu) => setOpenMenu(current => current === menu ? null : menu);
  const colorSwatches = (key: NodeColorStyle, label: string) => <div className="pfc-node-style-toolbar__swatches">{nodeColorPresets(key).map(color => <button key={color} className={style[key] === color ? "is-active" : ""} type="button" title={color} aria-label={`${label}：${color}`} style={{ backgroundColor: color }} onClick={() => apply({ [key]: color })} />)}<label className="pfc-node-style-toolbar__custom-color" aria-label={`自定义${label}`}><span>◉</span><input aria-label={`自定义${label}`} type="color" value={style[key]} onChange={event => apply({ [key]: event.target.value })} /></label></div>;
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const toolbar = toolbarRef.current;
    const canvas = toolbar?.parentElement;
    if (!toolbar || !canvas) return;
    const rect = toolbar.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPosition({ x: rect.left - canvas.getBoundingClientRect().left, y: rect.top - canvas.getBoundingClientRect().top });
  };
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    setPresets(current => { const next = saveNodeStylePreset(current, name, style); localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next)); return next; });
    setPresetName("");
  };

  return <aside ref={toolbarRef} className="pfc-node-style-toolbar" aria-label={`节点样式编辑器${nodes.length > 1 ? `，已选 ${nodes.length} 个节点` : ""}`} style={position ? { left: position.x, top: position.y, bottom: "auto", transform: "none" } : undefined}>
    <button className="pfc-node-style-toolbar__drag" type="button" title="拖动编辑器" aria-label="拖动编辑器" onPointerDown={startDrag}>⠿</button>
    {openMenu && <div className="pfc-node-style-toolbar__menu-wrap">
      {openMenu === "fontSize" && <div className="pfc-node-style-toolbar__menu"><span>字号</span><div>{styleMenuOptions("fontSize").map(size => <button key={size} className={style.fontSize === size ? "is-active" : ""} type="button" onClick={() => { apply({ fontSize: size }); setOpenMenu(null); }}>{size}</button>)}</div></div>}
      {openMenu === "color" && <div className="pfc-node-style-toolbar__menu"><span>文字颜色</span>{colorSwatches("color", "文字颜色")}</div>}
      {openMenu === "fillColor" && <div className="pfc-node-style-toolbar__menu"><span>背景颜色</span>{colorSwatches("fillColor", "背景颜色")}</div>}
      {openMenu === "border" && <div className="pfc-node-style-toolbar__menu pfc-node-style-toolbar__menu--border"><span>边框</span><div><small>颜色</small>{colorSwatches("borderColor", "边框颜色")}</div><div><small>粗细</small>{styleMenuOptions("borderWidth").map(width => <button key={width} className={style.borderWidth === width ? "is-active" : ""} type="button" onClick={() => apply({ borderWidth: width })}>{width}px</button>)}</div><div><small>圆角</small>{styleMenuOptions("borderRadius").map(radius => <button key={radius} className={style.borderRadius === radius ? "is-active" : ""} type="button" onClick={() => apply({ borderRadius: radius })}>{radius}</button>)}</div></div>}
      {openMenu === "icon" && <div className="pfc-node-style-toolbar__menu pfc-node-style-toolbar__menu--icons"><span>节点图标</span><div>{nodeIcons.map(nextIcon => <button key={nextIcon} className={icon === nextIcon ? "is-active" : ""} type="button" title={icon === nextIcon ? `移除${nextIcon}` : `使用${nextIcon}`} aria-label={icon === nextIcon ? `移除${nextIcon}` : `使用${nextIcon}`} onClick={() => { const value = icon === nextIcon ? undefined : nextIcon; setIcon(value); onChange({ icon: value }); }}><span>{nextIcon}</span></button>)}<button className={!icon ? "is-active" : ""} type="button" title="移除图标" aria-label="移除图标" onClick={() => { setIcon(undefined); onChange({ icon: undefined }); }}>×</button></div></div>}
      {openMenu === "kind" && <div className="pfc-node-style-toolbar__menu"><span>节点类型</span><div className="pfc-node-style-toolbar__kind-list">{nodeKinds.map(kind => <button key={kind.value} className={node.data.kind === kind.value ? "is-active" : ""} type="button" onClick={() => { onKindChange(kind.value); setOpenMenu(null); }}>{kind.label}</button>)}</div></div>}
      {openMenu === "presets" && <div className="pfc-node-style-toolbar__menu pfc-node-style-toolbar__menu--presets"><span>节点样式</span><div className="pfc-node-style-toolbar__preset-list">{presets.length ? presets.map(preset => <button key={preset.id} type="button" onClick={() => { setStyle(preset.style); onChange(preset.style); setOpenMenu(null); }}>{preset.name}</button>) : <small>保存当前样式后，可在这里复用</small>}</div><div className="pfc-node-style-toolbar__preset-save"><input aria-label="节点样式名称" value={presetName} placeholder="例如：重点节点" maxLength={24} onChange={event => setPresetName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") savePreset(); }} /><button type="button" disabled={!presetName.trim()} onClick={savePreset}>保存</button></div></div>}
    </div>}
    <button type="button" title="字号" aria-label="字号" aria-expanded={openMenu === "fontSize"} onClick={() => toggle("fontSize")}>T</button>
    <button className={style.fontWeight === "bold" ? "is-active" : ""} type="button" title="加粗" aria-label="加粗" aria-pressed={style.fontWeight === "bold"} onClick={() => apply({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}>B</button>
    <button className={icon ? "is-active" : ""} type="button" title="节点图标" aria-label="节点图标" aria-expanded={openMenu === "icon"} onClick={() => toggle("icon")}>☺</button>
    <button type="button" title="节点类型" aria-label="节点类型" aria-expanded={openMenu === "kind"} onClick={() => toggle("kind")}>◇</button>
    <button type="button" title="文字颜色" aria-label="文字颜色" aria-expanded={openMenu === "color"} onClick={() => toggle("color")}>A</button>
    <button type="button" title="背景颜色" aria-label="背景颜色" aria-expanded={openMenu === "fillColor"} onClick={() => toggle("fillColor")}>▰</button>
    <button type="button" title="边框样式" aria-label="边框样式" aria-expanded={openMenu === "border"} onClick={() => toggle("border")}>□</button>
    <button type="button" title="节点样式" aria-label="节点样式" aria-expanded={openMenu === "presets"} onClick={() => toggle("presets")}>◆</button>
  </aside>;
}

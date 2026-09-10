import { useEffect, useState } from "react";
import { nodeStyleFromData, type NodeStyle } from "../../../components/mindmap/nodeStyleControls.js";
import { nodeColorPresets, styleMenuOptions, type NodeColorStyle } from "../../../components/mindmap/nodeStyleToolbarMenu.js";
import { parseNodeStylePresets, saveNodeStylePreset, type NodeStylePreset } from "../../../components/mindmap/nodeStylePresets.js";
import type { FlowNode, FlowNodeKind, FlowNodeAlignment, FlowNodeDistribution } from "./flowchartModel.js";
import { FlowchartFloatingToolbar, FlowchartToolbarIcon } from "./FlowchartFloatingToolbar.js";

const PRESETS_STORAGE_KEY = "rich.flowchart.node-style-presets.v1";
type OpenMenu = "fontSize" | "color" | "fillColor" | "border" | "presets" | "icon" | "kind" | "align" | "distribute" | "layout" | null;
const nodeIcons = ["📌", "⭐", "💡", "⚙️", "🎯", "✅", "⚠️", "📚", "🔗", "🚀", "💬", "🔍"];
const nodeKinds: { value: FlowNodeKind; label: string }[] = [{ value: "step", label: "步骤" }, { value: "decision", label: "判断" }, { value: "table", label: "数据表" }, { value: "boundary", label: "开始/结束" }, { value: "region", label: "区域" }, { value: "note", label: "备注" }];

export function FlowchartNodeStyleToolbar({ nodes, onChange, onKindChange, onAlign, onDistribute, onLayout, onGroup, onToggleGroup }: { nodes: FlowNode[]; onChange: (patch: Partial<FlowNode["data"]>) => void; onKindChange: (kind: FlowNodeKind) => void; onAlign: (alignment: FlowNodeAlignment) => void; onDistribute: (direction: FlowNodeDistribution) => void; onLayout: (direction: FlowNodeDistribution) => void; onGroup: () => void; onToggleGroup: () => void }) {
  const node = nodes[0]!;
  const [style, setStyle] = useState(() => nodeStyleFromData(node.data));
  const [icon, setIcon] = useState(node.data.icon);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [presets, setPresets] = useState<NodeStylePreset[]>(() => parseNodeStylePresets(localStorage.getItem(PRESETS_STORAGE_KEY)));
  const [presetName, setPresetName] = useState("");

  useEffect(() => { setStyle(nodeStyleFromData(node.data)); setIcon(node.data.icon); setOpenMenu(null); }, [node]);
  const apply = (patch: Partial<NodeStyle>) => { setStyle(current => ({ ...current, ...patch })); onChange(patch); };
  const toggle = (menu: OpenMenu) => setOpenMenu(current => current === menu ? null : menu);
  const colorSwatches = (key: NodeColorStyle, label: string) => <div className="pfc-node-style-toolbar__swatches">{nodeColorPresets(key).map(color => <button key={color} className={style[key] === color ? "is-active" : ""} type="button" title={color} aria-label={`${label}：${color}`} style={{ backgroundColor: color }} onClick={() => apply({ [key]: color })} />)}<label className="pfc-node-style-toolbar__custom-color" aria-label={`自定义${label}`}><span>◉</span><input aria-label={`自定义${label}`} type="color" value={style[key]} onChange={event => apply({ [key]: event.target.value })} /></label></div>;
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    setPresets(current => { const next = saveNodeStylePreset(current, name, style); localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next)); return next; });
    setPresetName("");
  };

  return <FlowchartFloatingToolbar ariaLabel={`节点样式编辑器${nodes.length > 1 ? `，已选 ${nodes.length} 个节点` : ""}`}>
    {openMenu && <div className="pfc-node-style-toolbar__menu-wrap">
      {openMenu === "fontSize" && <div className="pfc-node-style-toolbar__menu"><span>字号</span><div>{styleMenuOptions("fontSize").map(size => <button key={size} className={style.fontSize === size ? "is-active" : ""} type="button" onClick={() => { apply({ fontSize: size }); setOpenMenu(null); }}>{size}</button>)}</div></div>}
      {openMenu === "color" && <div className="pfc-node-style-toolbar__menu"><span>文字颜色</span>{colorSwatches("color", "文字颜色")}</div>}
      {openMenu === "fillColor" && <div className="pfc-node-style-toolbar__menu"><span>背景颜色</span>{colorSwatches("fillColor", "背景颜色")}</div>}
      {openMenu === "border" && <div className="pfc-node-style-toolbar__menu pfc-node-style-toolbar__menu--border"><span>边框</span><div><small>颜色</small>{colorSwatches("borderColor", "边框颜色")}</div><div><small>粗细</small>{styleMenuOptions("borderWidth").map(width => <button key={width} className={style.borderWidth === width ? "is-active" : ""} type="button" onClick={() => apply({ borderWidth: width })}>{width}px</button>)}</div><div><small>圆角</small>{styleMenuOptions("borderRadius").map(radius => <button key={radius} className={style.borderRadius === radius ? "is-active" : ""} type="button" onClick={() => apply({ borderRadius: radius })}>{radius}</button>)}</div></div>}
      {openMenu === "icon" && <div className="pfc-node-style-toolbar__menu pfc-node-style-toolbar__menu--icons"><span>节点图标</span><div>{nodeIcons.map(nextIcon => <button key={nextIcon} className={icon === nextIcon ? "is-active" : ""} type="button" title={icon === nextIcon ? `移除${nextIcon}` : `使用${nextIcon}`} aria-label={icon === nextIcon ? `移除${nextIcon}` : `使用${nextIcon}`} onClick={() => { const value = icon === nextIcon ? undefined : nextIcon; setIcon(value); onChange({ icon: value }); }}><span>{nextIcon}</span></button>)}<button className={!icon ? "is-active" : ""} type="button" title="移除图标" aria-label="移除图标" onClick={() => { setIcon(undefined); onChange({ icon: undefined }); }}>×</button></div></div>}
      {openMenu === "kind" && <div className="pfc-node-style-toolbar__menu"><span>节点类型</span><div className="pfc-node-style-toolbar__kind-list">{nodeKinds.map(kind => <button key={kind.value} className={node.data.kind === kind.value ? "is-active" : ""} type="button" onClick={() => { onKindChange(kind.value); setOpenMenu(null); }}>{kind.label}</button>)}</div></div>}
      {openMenu === "presets" && <div className="pfc-node-style-toolbar__menu pfc-node-style-toolbar__menu--presets"><span>节点样式</span><div className="pfc-node-style-toolbar__preset-list">{presets.length ? presets.map(preset => <button key={preset.id} type="button" onClick={() => { setStyle(preset.style); onChange(preset.style); setOpenMenu(null); }}>{preset.name}</button>) : <small>保存当前样式后，可在这里复用</small>}</div><div className="pfc-node-style-toolbar__preset-save"><input aria-label="节点样式名称" value={presetName} placeholder="例如：重点节点" maxLength={24} onChange={event => setPresetName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") savePreset(); }} /><button type="button" disabled={!presetName.trim()} onClick={savePreset}>保存</button></div></div>}
      {openMenu === "align" && <div className="pfc-node-style-toolbar__menu"><span>对齐选中节点</span><div><button type="button" onClick={() => { onAlign("left"); setOpenMenu(null); }}>左对齐</button><button type="button" onClick={() => { onAlign("center"); setOpenMenu(null); }}>水平居中</button><button type="button" onClick={() => { onAlign("right"); setOpenMenu(null); }}>右对齐</button></div><div><button type="button" onClick={() => { onAlign("top"); setOpenMenu(null); }}>顶对齐</button><button type="button" onClick={() => { onAlign("middle"); setOpenMenu(null); }}>垂直居中</button><button type="button" onClick={() => { onAlign("bottom"); setOpenMenu(null); }}>底对齐</button></div></div>}
      {openMenu === "distribute" && <div className="pfc-node-style-toolbar__menu"><span>均匀分布</span><div><button type="button" onClick={() => { onDistribute("horizontal"); setOpenMenu(null); }}>横向等距</button><button type="button" onClick={() => { onDistribute("vertical"); setOpenMenu(null); }}>纵向等距</button></div></div>}
      {openMenu === "layout" && <div className="pfc-node-style-toolbar__menu"><span>自动布局选区</span><div><button type="button" onClick={() => { onLayout("horizontal"); setOpenMenu(null); }}>横向流程</button><button type="button" onClick={() => { onLayout("vertical"); setOpenMenu(null); }}>纵向流程</button></div></div>}
    </div>}
    <button type="button" title="字号" aria-label="字号" aria-expanded={openMenu === "fontSize"} onClick={() => toggle("fontSize")}><FlowchartToolbarIcon name="text" /></button>
    <button className={style.fontWeight === "bold" ? "is-active" : ""} type="button" title="加粗" aria-label="加粗" aria-pressed={style.fontWeight === "bold"} onClick={() => apply({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}><FlowchartToolbarIcon name="bold" /></button>
    <button className={icon ? "is-active" : ""} type="button" title="节点图标" aria-label="节点图标" aria-expanded={openMenu === "icon"} onClick={() => toggle("icon")}><FlowchartToolbarIcon name="icon" /></button>
    <button type="button" title="节点类型" aria-label="节点类型" aria-expanded={openMenu === "kind"} onClick={() => toggle("kind")}><FlowchartToolbarIcon name="kind" /></button>
    <button type="button" title="文字颜色" aria-label="文字颜色" aria-expanded={openMenu === "color"} onClick={() => toggle("color")}><FlowchartToolbarIcon name="color" /></button>
    <button type="button" title="背景颜色" aria-label="背景颜色" aria-expanded={openMenu === "fillColor"} onClick={() => toggle("fillColor")}><FlowchartToolbarIcon name="fill" /></button>
    <button type="button" title="边框样式" aria-label="边框样式" aria-expanded={openMenu === "border"} onClick={() => toggle("border")}><FlowchartToolbarIcon name="border" /></button>
    <button type="button" title="节点样式" aria-label="节点样式" aria-expanded={openMenu === "presets"} onClick={() => toggle("presets")}><FlowchartToolbarIcon name="preset" /></button>
    {nodes.length > 1 && <><button type="button" title="对齐" aria-label="对齐" aria-expanded={openMenu === "align"} onClick={() => toggle("align")}><FlowchartToolbarIcon name="align" /></button><button type="button" title="均匀分布" aria-label="均匀分布" aria-expanded={openMenu === "distribute"} onClick={() => toggle("distribute")}><FlowchartToolbarIcon name="distribute" /></button><button type="button" title="自动布局" aria-label="自动布局" aria-expanded={openMenu === "layout"} onClick={() => toggle("layout")}><FlowchartToolbarIcon name="layout" /></button><button type="button" title="创建流程组" aria-label="创建流程组" onClick={onGroup}><FlowchartToolbarIcon name="group" /></button></>}
    {nodes.length === 1 && node.data.kind === "region" && <button type="button" title={node.data.collapsed ? "展开流程组" : "折叠流程组"} aria-label={node.data.collapsed ? "展开流程组" : "折叠流程组"} onClick={onToggleGroup}><FlowchartToolbarIcon name="collapse" /></button>}
  </FlowchartFloatingToolbar>;
}

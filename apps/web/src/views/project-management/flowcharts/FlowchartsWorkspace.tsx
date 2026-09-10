import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, PanOnScrollMode, MiniMap, NodeResizer, reconnectEdge, applyNodeChanges, applyEdgeChanges,
  type Connection, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, type ProjectModuleItem } from "../../../api/client.js";
import { createFlowchart, createFlowEdge, createFlowNode, flowNodeType, readFlowchart, removeFlowNodes, ROOT_SCOPE, scopePath, searchFlowNodes,
  type FlowchartData, type FlowEdge, type FlowNode, type FlowNodeKind } from "./flowchartModel.js";
import { exportFlowchartPng } from "./flowchartExport.js";
import { FlowchartNodeStyleToolbar } from "./FlowchartNodeStyleToolbar.js";
import { ProjectRichTextEditor } from "../ProjectManagementModules.js";
import { isNodeEditShortcut } from "../../../components/mindmap/nodeEditShortcut.js";
import "./FlowchartsWorkspace.css";

const DETAIL_PANEL_WIDTH_KEY = "rich.flowchart.node-detail-panel-width";
const detailPanelWidth = (value: number, maxWidth = Math.floor(window.innerWidth * 2 / 3)) => Math.min(maxWidth, Math.max(320, Math.round(value)));
function RegionNode({ data, selected }: NodeProps<FlowNode>) {
  return <div className={`pfc-region tone-${data.tone || "cyan"}${selected ? " is-selected" : ""}`} style={nodeStyle(data)}>
    <NodeResizer isVisible={selected} minWidth={220} minHeight={120} color="#72c7ef" />
    <header><NodeLabel data={data} />{data.caption && <span>{data.caption}</span>}</header>
  </div>;
}
function NoteNode({ data, selected }: NodeProps<FlowNode>) {
  return <div className={`pfc-note tone-${data.tone || "amber"}${selected ? " is-selected" : ""}`} style={nodeStyle(data)}>
    <NodeResizer isVisible={selected} minWidth={180} minHeight={100} color="#ecc680" />
    <span className="pfc-note-pin" aria-hidden="true" />
    <small>NOTE / 备注</small>{data.editing ? <NoteContent data={data} /> : <><NodeLabel data={data} />{data.caption && <p>{data.caption}</p>}</>}
  </div>;
}
function AnalysisNode({ data, selected }: NodeProps<FlowNode>) {
  return <div className={`pfc-node is-${data.kind}${selected ? " is-selected" : ""}`} style={nodeStyle(data)}>
    <NodeResizer isVisible={selected} minWidth={140} minHeight={60} color="#82d7ef" />
    <Handle type="target" position={Position.Left} />
    <span className="pfc-node-symbol" aria-hidden="true">{data.icon || (data.kind === "table" ? "▤" : data.kind === "decision" ? "◇" : data.kind === "boundary" ? "◉" : "→")}</span>
    <NodeLabel data={data} />
    <Handle type="source" position={Position.Right} />
  </div>;
}
function NodeLabel({ data }: { data: FlowNode["data"] }) {
  if (!data.editing) return <strong>{data.label}</strong>;
  return <strong className="pfc-node-label-editor nodrag nopan" aria-label="编辑节点文字" contentEditable suppressContentEditableWarning autoFocus
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Enter" && event.metaKey) { event.preventDefault(); document.execCommand("insertLineBreak"); return; }
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") { event.currentTarget.textContent = data.label; event.currentTarget.blur(); }
    }} onBlur={event => data.onLabelChange?.(event.currentTarget.innerText.trim() || data.label)}>{data.label}</strong>;
}
function NoteContent({ data }: { data: FlowNode["data"] }) {
  const text = [data.label, data.caption].filter(Boolean).join("\n");
  return <div className="pfc-node-label-editor pfc-note-content-editor nodrag nopan" aria-label="编辑节点文字" contentEditable suppressContentEditableWarning autoFocus
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Enter" && event.metaKey) { event.preventDefault(); document.execCommand("insertLineBreak"); return; }
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") { event.currentTarget.innerText = text; event.currentTarget.blur(); }
    }} onBlur={event => data.onNoteTextChange?.(event.currentTarget.innerText)}><strong>{data.label}</strong>{data.caption && <p>{data.caption}</p>}</div>;
}
function nodeStyle(data: FlowNode["data"]): CSSProperties {
  return {
    ...(data.color ? { color: data.color } : {}),
    ...(data.fillColor ? { backgroundColor: data.fillColor } : {}),
    ...(data.borderColor ? { borderColor: data.borderColor } : {}),
    ...(data.borderWidth !== undefined ? { borderWidth: data.borderWidth } : {}),
    ...(data.borderRadius !== undefined ? { borderRadius: data.borderRadius } : {}),
    ...(data.fontSize ? { "--pfc-node-font-size": `${data.fontSize}px` } : {}),
    ...(data.fontWeight ? { "--pfc-node-font-weight": data.fontWeight } : {}),
    ...(data.color ? { "--pfc-node-color": data.color } : {}),
  } as CSSProperties;
}
const nodeTypes = { analysis: AnalysisNode, region: RegionNode, note: NoteNode };
const edgeStyle = (edge: FlowEdge) => ({
  ...(edge.data?.lineColor ? { stroke: edge.data.lineColor } : {}),
  ...(edge.data?.lineWidth ? { strokeWidth: edge.data.lineWidth } : {}),
  ...(edge.data?.lineStyle === "dashed" ? { strokeDasharray: "7 4" } : edge.data?.lineStyle === "dotted" ? { strokeDasharray: "2 4" } : {}),
});

export function FlowchartsWorkspace({ projectId, focusId, flowchartIds, onFlowchartIdsChange, standalone = false, embedded = false }: { projectId?: string; focusId?: string; flowchartIds?: string[]; onFlowchartIdsChange?: (ids: string[]) => Promise<void>; standalone?: boolean; embedded?: boolean }) {
  const [items, setItems] = useState<ProjectModuleItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string>();
  const [graph, setGraph] = useState<FlowchartData>();
  const [title, setTitle] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [template, setTemplate] = useState("code");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState(ROOT_SCOPE);
  const [selected, setSelected] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdge, setSelectedEdge] = useState("");
  const [query, setQuery] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance<FlowNode>>();
  const [target, setTarget] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingNode, setEditingNode] = useState("");
  const [detailNode, setDetailNode] = useState("");
  const [nodeDetailWidth, setNodeDetailWidth] = useState(() => {
    try { return detailPanelWidth(Number(localStorage.getItem(DETAIL_PANEL_WIDTH_KEY)) || 440); } catch { return 440; }
  });
  const [nodeDetailFullscreen, setNodeDetailFullscreen] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState("");
  const [quickCreate, setQuickCreate] = useState<{ source: string; position: { x: number; y: number }; screen: { x: number; y: number } }>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rightClickNode = useRef<{ id: string; time: number } | null>(null);
  const undoStack = useRef<FlowchartData[]>([]);
  const redoStack = useRef<FlowchartData[]>([]);
  const draftKey = `rich-flowchart-draft:${projectId ?? "standalone"}`;
  const isFullscreen = standalone;

  useEffect(() => {
    let cancelled = false;
    const load = flowchartIds
      ? api.listFlowcharts().then(next => next.filter(item => flowchartIds.includes(item.id)).map(item => ({ ...item, moduleKey: "flowcharts", parentId: null, subtitle: null, sortOrder: 0, content: { graph: item.graph } } as unknown as ProjectModuleItem)))
      : projectId
      ? api.listProjectManagementModuleItems(projectId, "flowcharts")
      : api.listFlowcharts().then(next => next.map(item => ({ ...item, moduleKey: "flowcharts", parentId: null, subtitle: null, sortOrder: 0, content: { graph: item.graph } } as unknown as ProjectModuleItem)));
    load.then(next => {
      if (!cancelled) {
        setItems(next); setLoaded(true);
        try {
          const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
          if (draft && next.some(item => item.id === draft.id)) {
            setGraph(readFlowchart({ graph: draft.graph })); setActive(draft.id);
            setTitle(draft.title); setDirty(true);
            setExpanded(true);
          }
        } catch { /* An unavailable or invalid local draft never blocks server data. */ }
      }
    }).catch(e => { if (!cancelled) { setError(String(e)); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [projectId, flowchartIds]);
  useEffect(() => {
    if (!active || !graph) return;
    try {
      if (dirty) sessionStorage.setItem(draftKey, JSON.stringify({ id: active, title, graph }));
      else sessionStorage.removeItem(draftKey);
    } catch { /* Saving to the server remains available if browser storage is full. */ }
  }, [active, graph, title, dirty, draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { setNodeDetailFullscreen(false); }, [detailNode]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailNode) { event.preventDefault(); event.stopPropagation(); setDetailNode(""); return; }
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable=true]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redoGraph() : undoGraph(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelectedNodes(); return; }
      if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); deleteSelectedNodes(); return; }
      if (!selected || editingNode || !isNodeEditShortcut(event)) return;
      event.preventDefault(); event.stopPropagation(); setEditingNode(selected);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [selected, editingNode, detailNode, graph, selectedIds]);
  useEffect(() => {
    if (!flow) return;
    const timer = window.setTimeout(() => {
      void flow.fitView({ ...(target ? { nodes: [{ id: target }] } : {}), padding: 0.35, maxZoom: 1.2, duration: 250 });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [flow, scope, target, active, expanded]);

  const open = (item: ProjectModuleItem) => {
    if (busy || (dirty && !window.confirm("当前流程图有未保存修改，放弃修改并切换？"))) return;
    try {
      setGraph(readFlowchart(item.content)); setActive(item.id); setTitle(item.title); setDirty(false);
      setScope(ROOT_SCOPE); setSelected(""); setSelectedIds([]); setSelectedEdge(""); setEditingNode(""); setDetailNode(""); setQuery(""); setTarget(undefined); setError("");
      setExpanded(true); setSearchOpen(false); setSettingsOpen(false);
    } catch (e) { setError(String(e)); }
  };
  useEffect(() => {
    if (!focusId || dirty || busy) return;
    if (active === focusId) { setExpanded(true); return; }
    const item = items.find(row => row.id === focusId);
    if (item) open(item);
  }, [focusId, items]);
  const update = (next: FlowchartData) => {
    if (graph && graph !== next) { undoStack.current = [...undoStack.current.slice(-49), graph]; redoStack.current = []; }
    setGraph(next); setDirty(true);
  };
  const undoGraph = () => setGraph(current => {
    const previous = undoStack.current.pop();
    if (!current || !previous) return current;
    redoStack.current.push(current); setDirty(true); return previous;
  });
  const redoGraph = () => setGraph(current => {
    const next = redoStack.current.pop();
    if (!current || !next) return current;
    undoStack.current.push(current); setDirty(true); return next;
  });
  const create = async () => {
    if (!newTitle.trim() || busy || (dirty && !window.confirm("当前流程图有未保存修改，放弃修改并创建？"))) return;
    setBusy(true); setError("");
    try {
      const next = createFlowchart(template === "code");
      const item = flowchartIds
        ? ({ ...(await api.createFlowchart({ title: newTitle.trim(), graph: next as unknown as Record<string, unknown> })), moduleKey: "flowcharts", parentId: null, subtitle: null, sortOrder: 0, content: { graph: next } } as unknown as ProjectModuleItem)
        : projectId
        ? await api.createProjectManagementModuleItem(projectId, "flowcharts", { title: newTitle.trim(), content: { graph: next } })
        : ({ ...(await api.createFlowchart({ title: newTitle.trim(), graph: next as unknown as Record<string, unknown> })), moduleKey: "flowcharts", parentId: null, subtitle: null, sortOrder: 0, content: { graph: next } } as unknown as ProjectModuleItem);
      setItems(rows => [...rows, item]); setActive(item.id); setGraph(next); setTitle(item.title);
      if (flowchartIds) await onFlowchartIdsChange?.([...flowchartIds, item.id]);
      setNewTitle(""); setDirty(false); setScope(ROOT_SCOPE); setSelected(""); setSelectedIds([]); setSelectedEdge(""); setEditingNode(""); setDetailNode(""); setQuery(""); setTarget(undefined);
      setExpanded(true); setCreating(false); setSettingsOpen(false); setSearchOpen(false);
    } catch (e) { setError(`创建失败：${String(e)}`); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!graph || !active || !title.trim()) return;
    setBusy(true); setError("");
    try {
      const original = items.find(row => row.id === active);
      const isLegacy = original?.content.legacyFlowchart === true;
      const item = isLegacy && projectId
        ? await api.updateProjectManagementModuleItem(projectId, active, { title: title.trim(), content: { ...original?.content, graph } })
        : flowchartIds
        ? ({ ...(await api.updateFlowchart(active, { title: title.trim(), graph: graph as unknown as Record<string, unknown> })), moduleKey: "flowcharts", parentId: null, subtitle: null, sortOrder: 0, content: { graph } } as unknown as ProjectModuleItem)
        : projectId
        ? await api.updateProjectManagementModuleItem(projectId, active, { title: title.trim(), content: { ...original?.content, graph } })
        : ({ ...(await api.updateFlowchart(active, { title: title.trim(), graph: graph as unknown as Record<string, unknown> })), moduleKey: "flowcharts", parentId: null, subtitle: null, sortOrder: 0, content: { graph } } as unknown as ProjectModuleItem);
      setItems(rows => rows.map(row => row.id === item.id ? item : row)); setDirty(false);
    } catch (e) { setError(`保存失败，修改仍保留在画布：${String(e)}`); } finally { setBusy(false); }
  };
  const removeTask = async () => {
    if (!active || !window.confirm(`删除流程图任务“${title}”及其所有节点？此操作不能撤销。`)) return;
    setBusy(true); setError("");
    try {
      const original = items.find(item => item.id === active);
      if (original?.content.legacyFlowchart === true && projectId) await api.deleteProjectManagementModuleItem(projectId, active);
      else if (flowchartIds) await onFlowchartIdsChange?.(flowchartIds.filter(id => id !== active));
      else if (projectId) await api.deleteProjectManagementModuleItem(projectId, active);
      else await api.deleteFlowchart(active);
      try { sessionStorage.removeItem(draftKey); } catch { /* Optional draft storage. */ }
      setItems(rows => rows.filter(row => row.id !== active)); setActive(undefined); setGraph(undefined); setDirty(false);
    } catch (e) { setError(`删除失败：${String(e)}`); } finally { setBusy(false); }
  };
  const selectedNodes = graph?.nodes.filter(row => selectedIds.includes(row.id)) ?? [];
  const selectedFlowEdge = graph?.edges.find(row => row.id === selectedEdge);
  const detail = graph?.nodes.find(row => row.id === detailNode);
  const editNode = (patch: Partial<FlowNode["data"]>) => {
    if (graph) update({ ...graph, nodes: graph.nodes.map(row => selectedIds.includes(row.id) ? { ...row, ...(patch.kind ? { type: flowNodeType(patch.kind) } : {}), data: { ...row.data, ...patch } } : row) });
  };
  const addNode = (kind: FlowNodeKind, position = { x: 220, y: 160 }, source?: string) => {
    if (!graph) return;
    const node = createFlowNode(kind, position, scope);
    update({ ...graph, nodes: [...graph.nodes, node], edges: source ? [...graph.edges, createFlowEdge({ source, target: node.id })] : graph.edges });
    setSelected(node.id); setSelectedIds([node.id]); setSelectedEdge(""); setQuickCreate(undefined);
  };
  const duplicateSelectedNodes = () => {
    if (!graph || selectedIds.length === 0) return;
    const copies = graph.nodes.filter(node => selectedIds.includes(node.id)).map(node => ({ ...node, id: crypto.randomUUID(), position: { x: node.position.x + 32, y: node.position.y + 32 }, selected: true }));
    update({ ...graph, nodes: [...graph.nodes.map(node => ({ ...node, selected: false })), ...copies] });
    setSelected(copies[0]?.id || ""); setSelectedIds(copies.map(node => node.id));
  };
  const deleteSelectedNodes = () => {
    if (!graph || selectedIds.length === 0) return;
    update(removeFlowNodes(graph, selectedIds)); setSelected(""); setSelectedIds([]); setEditingNode("");
  };
  const autoLayout = () => {
    if (!graph) return;
    const visible = graph.nodes.filter(node => node.data.scope === scope);
    update({ ...graph, nodes: graph.nodes.map(node => {
      const index = visible.findIndex(item => item.id === node.id);
      return index < 0 ? node : { ...node, position: { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 180 } };
    }) });
  };
  const editEdge = (patch: Partial<FlowEdge>) => {
    if (graph && selectedEdge) update({ ...graph, edges: graph.edges.map(edge => edge.id === selectedEdge ? { ...edge, ...patch, data: { ...edge.data, ...patch.data } } : edge) });
  };
  const resizeNodeDetail = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = nodeDetailWidth;
    const onPointerMove = (moveEvent: PointerEvent) => setNodeDetailWidth(detailPanelWidth(startWidth + startX - moveEvent.clientX));
    const onPointerUp = () => {
      setNodeDetailWidth(width => {
        try { localStorage.setItem(DETAIL_PANEL_WIDTH_KEY, String(width)); } catch { /* Size preference is optional. */ }
        return width;
      });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };
  const enter = (id: string) => { setScope(id); setSelected(""); setSelectedIds([]); setSelectedEdge(""); setEditingNode(""); setDetailNode(""); setTarget(undefined); };
  const exportPng = async () => {
    if (!canvasRef.current || exporting) return;
    setExporting(true); setError("");
    try {
      await exportFlowchartPng(canvasRef.current, title);
    } catch (e) { setError(`导出失败：${String(e)}`); } finally { setExporting(false); }
  };

  return <section className={`pfc${standalone ? " pfc--standalone" : ""}${embedded ? " pfc--embedded" : ""}`}>
    {error && <p role="alert" className="pfc-error">{error}</p>}
    {creating && <div className="pfc-create" role="dialog" aria-label="创建流程图任务">
        <button className="pfc-close" aria-label="关闭创建任务" onClick={() => setCreating(false)}>×</button>
        <form onSubmit={event => { event.preventDefault(); void create(); }}>
          <input aria-label="新任务名称" placeholder="例如：VTB 一代代码解析" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <select aria-label="流程图模板" value={template} onChange={e => setTemplate(e.target.value)}><option value="code">代码分析</option><option value="flow">通用流程</option></select>
          <button disabled={busy || !loaded || !newTitle.trim()}>＋ 创建流程图任务</button>
        </form>
    </div>}
    {standalone && !expanded && <header className="pfc-list-header">
      <div className="pfc-list-intro"><p>流程图</p><h1>用一张图，把复杂逻辑讲清楚。</h1></div>
      <button className="pfc-list-create" type="button" disabled={busy || !loaded} onClick={() => setCreating(true)}>新建流程图</button>
    </header>}
    {standalone && !expanded && <div className="pfc-list-label"><span>内容清单</span><small>{items.length} 张流程图</small></div>}
    {!loaded ? <p>加载中…</p> : items.length === 0 ? <div className="pfc-empty"><strong>还没有流程图</strong><p>创建一张图，从梳理第一个流程开始。</p><button className="pfc-list-create" type="button" onClick={() => setCreating(true)}>新建流程图</button></div> : <div className={standalone ? "pfc-list-grid" : "pfc-task-list"}>{items.map(item => {
      if (expanded && active !== item.id) return null;
      return <article key={item.id} className={`pfc-task${active === item.id && expanded ? " is-expanded" : ""}`}>
      <header className="pfc-title-row">
        <button className="pfc-task-title" aria-expanded={active === item.id && expanded} aria-controls={`pfc-chart-${item.id}`} disabled={busy} onClick={() => {
          if (active === item.id) { setExpanded(value => !value); setSettingsOpen(false); }
          else open(item);
        }}><span aria-hidden="true">{active === item.id && expanded ? "▾" : "▸"}</span><strong>{active === item.id ? title : item.title}</strong>{standalone && !(active === item.id && expanded) && <small>{new Date(item.updatedAt).toLocaleString("zh-CN")}</small>}</button>
            {active === item.id && expanded && <>
              {isFullscreen && <span className="pfc-save-state">{busy ? "保存中…" : dirty ? "未保存" : "已保存"}</span>}
              {dirty && <button disabled={busy} onClick={() => void save()}>{busy ? "保存中…" : "保存修改"}</button>}
              <button aria-label="撤销" title="撤销（⌘Z）" disabled={undoStack.current.length === 0} onClick={undoGraph}>↶</button>
              <button aria-label="重做" title="重做（⌘⇧Z）" disabled={redoStack.current.length === 0} onClick={redoGraph}>↷</button>
              <button aria-label="添加节点" title="添加处理节点" onClick={() => addNode("step")}>＋ 节点</button>
              <button aria-label="自动排版" title="自动排版当前层级" onClick={autoLayout}>整理</button>
              <button aria-label="导出 PNG" title="导出当前流程图为 PNG" disabled={exporting} onClick={() => void exportPng()}>{exporting ? "导出中…" : "导出 PNG"}</button>
          <button aria-label="搜索节点" title="搜索节点" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}>⌕</button>
          <button aria-label="任务设置" title="任务设置" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}>⋯</button>
          {isFullscreen && <button className="pfc-back-to-list" aria-label="返回流程图清单" title="返回流程图清单" onClick={() => { setExpanded(false); setSettingsOpen(false); }}>←</button>}
        </>}
        {!standalone && <button aria-label="创建流程图任务" title="创建流程图任务" disabled={busy} onClick={() => setCreating(true)}>＋</button>}
      </header>
      {active === item.id && expanded && graph && <div className="pfc-editor" id={`pfc-chart-${item.id}`} style={busy ? { pointerEvents: "none", opacity: 0.7 } : undefined}>
        {settingsOpen && <fieldset disabled={busy} className="pfc-settings">
            <button className="pfc-close" aria-label="关闭任务设置" onClick={() => setSettingsOpen(false)}>×</button>
            <label>任务名称
            <input aria-label="任务名称" value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }} />
            </label>
            <label>任务状态
            <select aria-label="任务状态" value={graph.status} onChange={e => update({ ...graph, status: e.target.value as FlowchartData["status"] })}>
              <option value="draft">草稿</option><option value="active">分析中</option><option value="completed">已完成</option>
            </select>
            </label>
            <span role="status">{busy ? "处理中…" : dirty ? "有未保存修改" : "已保存"}</span>
            <button type="button" disabled={!dirty || !title.trim()} onClick={() => void save()}>保存</button>
            <button type="button" onClick={() => void removeTask()}>删除任务</button>
        </fieldset>}
        {scope !== ROOT_SCOPE && <nav className="pfc-breadcrumb" aria-label="子流程路径"><button onClick={() => enter(ROOT_SCOPE)}>总流程</button>{scopePath(graph.nodes, scope).map(row => <button key={row.id} onClick={() => enter(row.id)}>› {row.data.label}</button>)}</nav>}
        {searchOpen && <div className="pfc-search">
            <input aria-label="搜索节点" placeholder="搜索所有层级：节点、方法、源码…" value={query} onChange={e => setQuery(e.target.value)} />
            <button aria-label="关闭搜索" onClick={() => setSearchOpen(false)}>×</button>
          {query.trim() && <div className="pfc-results">{searchFlowNodes(graph.nodes, query).length === 0 ? <span>没有匹配节点</span> : searchFlowNodes(graph.nodes, query).map(row => <button key={row.id} onClick={() => {
            setScope(row.data.scope); setSelected(row.id); setSelectedIds([row.id]); setSelectedEdge(""); setTarget(row.id);
            setSearchOpen(false);
            if (row.data.scope === scope) void flow?.fitView({ nodes: [{ id: row.id }], padding: 0.35, maxZoom: 1.2, duration: 250 });
          }}>{row.data.label} <small>{row.id.slice(0, 8)}</small></button>)}</div>}
        </div>}
              <div className="pfc-canvas" ref={canvasRef}>
                <ReactFlow<FlowNode> nodes={graph.nodes.filter(row => row.data.scope === scope).map(row => ({ ...row, selected: selectedIds.includes(row.id), data: { ...row.data, editing: row.id === editingNode, onLabelChange: label => { update({ ...graph, nodes: graph.nodes.map(node => node.id === row.id ? { ...node, data: { ...node.data, label } } : node) }); setEditingNode(""); }, onNoteTextChange: text => { const [label, ...caption] = text.split(/\r?\n/); update({ ...graph, nodes: graph.nodes.map(node => node.id === row.id ? { ...node, data: { ...node.data, label: label.trim() || node.data.label, caption: caption.join("\n").trim() || undefined } } : node) }); setEditingNode(""); } } }))}
                  edges={graph.edges.filter(row => graph.nodes.some(n => n.id === row.source && n.data.scope === scope)).map(row => ({ ...row, style: edgeStyle(row), animated: row.data?.animated, markerEnd: row.data?.markerEnd === "none" ? undefined : { type: MarkerType.ArrowClosed } }))}
                  nodeTypes={nodeTypes} onInit={setFlow} fitView minZoom={0.1} maxZoom={2} deleteKeyCode={null} selectionOnDrag panOnDrag={false} panOnScroll panOnScrollMode={PanOnScrollMode.Free} zoomOnScroll={false} multiSelectionKeyCode="Meta"
                  defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
              onNodesChange={changes => {
                const selections = changes.filter(change => change.type === "select");
                if (selections.length) setSelectedIds(current => {
                  const next = new Set(current);
                  selections.forEach(change => change.type === "select" && (change.selected ? next.add(change.id) : next.delete(change.id)));
                  const ids = [...next]; setSelected(ids[0] ?? ""); return ids;
                });
                    const edits = changes.filter(change => change.type !== "select");
                    if (edits.length) update({ ...graph, nodes: applyNodeChanges(edits, graph.nodes) });
                  }}
                  onEdgesChange={changes => { const edits = changes.filter(change => change.type !== "select"); if (edits.length) update({ ...graph, edges: applyEdgeChanges(edits, graph.edges) }); }}
                  onConnect={connection => update({ ...graph, edges: [...graph.edges, createFlowEdge(connection)] })}
                  onConnectStart={(_, params) => setConnectingFrom(params.nodeId || "")}
                  onConnectEnd={(event, connectionState) => {
                    if (connectionState.isValid || !connectingFrom || !flow || !canvasRef.current) { setConnectingFrom(""); return; }
                    if (event.target instanceof Element && event.target.closest(".react-flow__node, .react-flow__handle")) { setConnectingFrom(""); return; }
                    const point = "changedTouches" in event && event.changedTouches.length ? event.changedTouches[0] : event as MouseEvent;
                    const rect = canvasRef.current.getBoundingClientRect();
                    setQuickCreate({ source: connectingFrom, position: flow.screenToFlowPosition({ x: point.clientX, y: point.clientY }), screen: { x: point.clientX - rect.left, y: point.clientY - rect.top } });
                    setConnectingFrom("");
                  }}
                  onReconnect={(oldEdge, connection: Connection) => update({ ...graph, edges: reconnectEdge(oldEdge, connection, graph.edges) as FlowEdge[] })}
              onNodeClick={(event, row) => { setSelectedIds(current => {
                const ids = event.metaKey ? current.includes(row.id) ? current.filter(id => id !== row.id) : [...current, row.id] : [row.id];
                setSelected(ids[0] ?? ""); return ids;
              }); setSelectedEdge(""); setEditingNode(""); setDetailNode(""); }} onNodeDoubleClick={(_, row) => { setSelected(row.id); setSelectedIds([row.id]); setDetailNode(row.id); }} onNodeContextMenu={(event, row) => {
                event.preventDefault();
                const now = Date.now();
                if (rightClickNode.current?.id === row.id && now - rightClickNode.current.time < 450) {
                  enter(row.id); rightClickNode.current = null;
                } else rightClickNode.current = { id: row.id, time: now };
              }}
              onEdgeClick={(_, row) => { setSelectedEdge(row.id); setSelected(""); setSelectedIds([]); setEditingNode(""); setDetailNode(""); }} onPaneClick={() => setEditingNode("")} onPaneContextMenu={event => event.preventDefault()}>
                  <Background gap={28} size={1} color="#44444d" /><MiniMap pannable zoomable nodeColor="#275368" maskColor="#101113cc" /><Controls />
                </ReactFlow>
                {quickCreate && <div className="pfc-quick-create" style={{ left: quickCreate.screen.x, top: quickCreate.screen.y }} role="dialog" aria-label="快速新建节点"><strong>新建并连接</strong>{(["step", "decision", "note", "table"] as FlowNodeKind[]).map(kind => <button key={kind} type="button" onClick={() => addNode(kind, quickCreate.position, quickCreate.source)}>{({ step: "处理步骤", decision: "判断", note: "备注", table: "数据表" } as Record<string, string>)[kind]}</button>)}<button type="button" onClick={() => setQuickCreate(undefined)}>取消</button></div>}
              </div>
              <div className="pfc-legend" aria-label="流程图图例"><span>● 处理</span><span>● 数据表</span><span>◇ 判断</span><span>— 主线</span><span>┄ 规则 / 数据关联</span></div>
              {selectedNodes.length > 0 && <FlowchartNodeStyleToolbar nodes={selectedNodes} onChange={editNode} onKindChange={kind => editNode({ kind })} />}
              {selectedFlowEdge && <aside className="pfc-edge-toolbar" aria-label="连线编辑器">
                <input aria-label="连线文字" placeholder="连线文字" value={String(selectedFlowEdge.label || "")} onChange={event => editEdge({ label: event.target.value })} />
                <select aria-label="连线路径" value={selectedFlowEdge.type || "smoothstep"} onChange={event => editEdge({ type: event.target.value })}><option value="smoothstep">平滑折线</option><option value="straight">直线</option><option value="step">直角线</option><option value="bezier">贝塞尔曲线</option></select>
                <select aria-label="连线样式" value={selectedFlowEdge.data?.lineStyle || "solid"} onChange={event => editEdge({ data: { lineStyle: event.target.value as NonNullable<FlowEdge["data"]>["lineStyle"] } })}><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点线</option></select>
                <select aria-label="连线粗细" value={selectedFlowEdge.data?.lineWidth || 1.5} onChange={event => editEdge({ data: { lineWidth: Number(event.target.value) } })}><option value={1.5}>细</option><option value={3}>中</option><option value={5}>粗</option></select>
                <label title="连线颜色">色<input aria-label="连线颜色" type="color" value={selectedFlowEdge.data?.lineColor || "#9ca5ce"} onChange={event => editEdge({ data: { lineColor: event.target.value } })} /></label>
                <button type="button" className={selectedFlowEdge.data?.markerEnd === "none" ? "is-active" : ""} title="切换终点箭头" onClick={() => editEdge({ data: { markerEnd: selectedFlowEdge.data?.markerEnd === "none" ? "arrow" : "none" } })}>→</button>
                <button type="button" className={selectedFlowEdge.data?.animated ? "is-active" : ""} title="切换流动动画" onClick={() => editEdge({ data: { animated: !selectedFlowEdge.data?.animated } })}>≈</button>
                <button type="button" title="删除连线" onClick={() => { if (graph) update({ ...graph, edges: graph.edges.filter(edge => edge.id !== selectedFlowEdge.id) }); setSelectedEdge(""); }}>×</button>
              </aside>}
          {detailNode && <aside className={`pfc-details pfc-node-detail${nodeDetailFullscreen ? " is-fullscreen" : ""}`} aria-label="节点详情" style={nodeDetailFullscreen ? undefined : { width: nodeDetailWidth }}>
            <div className="pfc-node-detail__resize-handle" role="separator" aria-label="调整节点详情宽度" aria-orientation="vertical" onPointerDown={resizeNodeDetail} />
            <header><h2>{detail?.data.label}</h2><div className="pfc-node-detail__header-actions"><button type="button" aria-label={nodeDetailFullscreen ? "还原节点详情" : "全屏显示节点详情"} title={nodeDetailFullscreen ? "还原" : "全屏"} onClick={() => setNodeDetailFullscreen(fullscreen => !fullscreen)}>{nodeDetailFullscreen ? "↙" : "⛶"}</button><button type="button" aria-label="关闭节点详情" onClick={() => setDetailNode("")}>×</button></div></header>
            {detail && <div className="pfc-node-detail__body"><ProjectRichTextEditor projectId={`flowchart-${active}-${detail.id}`} value={detail.data.description || ""} onChange={description => {
              update({ ...graph, nodes: graph.nodes.map(row => row.id === detail.id ? { ...row, data: { ...row.data, description } } : row) });
            }} /></div>}
          </aside>}
      </div>}
    </article>})}</div>}
  </section>;
}

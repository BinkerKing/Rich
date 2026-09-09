import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, applyNodeChanges, applyEdgeChanges,
  type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, type ProjectModuleItem } from "../../../api/client.js";
import { createFlowchart, readFlowchart, ROOT_SCOPE, scopePath, searchFlowNodes,
  type FlowchartData, type FlowNode } from "./flowchartModel.js";
import { exportFlowchartPng } from "./flowchartExport.js";
import { FlowchartNodeStyleToolbar } from "./FlowchartNodeStyleToolbar.js";
import { ProjectRichTextEditor } from "../ProjectManagementModules.js";
import { isNodeEditShortcut } from "../../../components/mindmap/nodeEditShortcut.js";
import "./FlowchartsWorkspace.css";

const DETAIL_PANEL_WIDTH_KEY = "rich.flowchart.node-detail-panel-width";
const detailPanelWidth = (value: number, maxWidth = Math.floor(window.innerWidth * 2 / 3)) => Math.min(maxWidth, Math.max(320, Math.round(value)));
function RegionNode({ data, selected }: NodeProps<FlowNode>) {
  return <div className={`pfc-region tone-${data.tone || "cyan"}${selected ? " is-selected" : ""}`} style={nodeStyle(data)}>
    <header><NodeLabel data={data} />{data.caption && <span>{data.caption}</span>}</header>
  </div>;
}
function NoteNode({ data, selected }: NodeProps<FlowNode>) {
  return <div className={`pfc-note tone-${data.tone || "amber"}${selected ? " is-selected" : ""}`} style={nodeStyle(data)}>
    <span className="pfc-note-pin" aria-hidden="true" />
    <small>NOTE / 备注</small><NodeLabel data={data} />
    {data.caption && <p>{data.caption}</p>}
  </div>;
}
function AnalysisNode({ data, selected }: NodeProps<FlowNode>) {
  return <div className={`pfc-node is-${data.kind}${selected ? " is-selected" : ""}`} style={nodeStyle(data)}>
    <Handle type="target" position={Position.Left} />
    <span className="pfc-node-symbol" aria-hidden="true">{data.kind === "table" ? "▤" : data.kind === "decision" ? "◇" : data.kind === "boundary" ? "◉" : "→"}</span>
    <NodeLabel data={data} />
    <Handle type="source" position={Position.Right} />
  </div>;
}
function NodeLabel({ data }: { data: FlowNode["data"] }) {
  if (!data.editing) return <strong>{data.label}</strong>;
  return <input className="pfc-node-label-input" aria-label="编辑节点文字" autoFocus defaultValue={data.label}
    onClick={event => event.stopPropagation()} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") { event.currentTarget.value = data.label; event.currentTarget.blur(); }
    }} onBlur={event => data.onLabelChange?.(event.currentTarget.value.trim() || data.label)} />;
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
  const canvasRef = useRef<HTMLDivElement>(null);
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
      if (!selected || editingNode || !isNodeEditShortcut(event)) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable=true]")) return;
      event.preventDefault(); event.stopPropagation(); setEditingNode(selected);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [selected, editingNode, detailNode]);
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
  const update = (next: FlowchartData) => { setGraph(next); setDirty(true); };
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
  const detail = graph?.nodes.find(row => row.id === detailNode);
  const editNode = (patch: Partial<FlowNode["data"]>) => {
    if (graph) update({ ...graph, nodes: graph.nodes.map(row => selectedIds.includes(row.id) ? { ...row, data: { ...row.data, ...patch } } : row) });
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
            <ReactFlow<FlowNode> nodes={graph.nodes.filter(row => row.data.scope === scope).map(row => ({ ...row, selected: selectedIds.includes(row.id), data: { ...row.data, editing: row.id === editingNode, onLabelChange: label => { update({ ...graph, nodes: graph.nodes.map(node => node.id === row.id ? { ...node, data: { ...node.data, label } } : node) }); setEditingNode(""); } } }))}
              edges={graph.edges.filter(row => graph.nodes.some(n => n.id === row.source && n.data.scope === scope))}
              nodeTypes={nodeTypes} onInit={setFlow} fitView minZoom={0.1} maxZoom={2} deleteKeyCode={null} selectionOnDrag panOnDrag={[2]} multiSelectionKeyCode="Meta"
              defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
              onNodesChange={changes => {
                const selections = changes.filter(change => change.type === "select");
                if (selections.length) setSelectedIds(current => {
                  const next = new Set(current);
                  selections.forEach(change => change.type === "select" && (change.selected ? next.add(change.id) : next.delete(change.id)));
                  const ids = [...next]; setSelected(ids[0] ?? ""); return ids;
                });
                const edits = changes.filter(change => change.type === "position");
                if (edits.length) update({ ...graph, nodes: applyNodeChanges(edits, graph.nodes) });
              }}
              onEdgesChange={changes => setGraph(current => current ? { ...current, edges: applyEdgeChanges(changes, current.edges) } : current)}
              onConnect={connection => update({ ...graph, edges: [...graph.edges, { ...connection, id: crypto.randomUUID(), type: "smoothstep", label: "" }] })}
              onNodeClick={(event, row) => { setSelectedIds(current => {
                const ids = event.metaKey ? current.includes(row.id) ? current.filter(id => id !== row.id) : [...current, row.id] : [row.id];
                setSelected(ids[0] ?? ""); return ids;
              }); setSelectedEdge(""); setEditingNode(""); setDetailNode(""); }} onNodeDoubleClick={(_, row) => { setSelected(row.id); setSelectedIds([row.id]); setDetailNode(row.id); }}
              onEdgeClick={(_, row) => { setSelectedEdge(row.id); setSelected(""); setSelectedIds([]); setEditingNode(""); setDetailNode(""); }} onPaneClick={() => {}} onPaneContextMenu={event => event.preventDefault()}>
              <Background gap={28} size={1} color="#44444d" /><Controls />
            </ReactFlow>
          </div>
          <div className="pfc-legend" aria-label="流程图图例"><span>● 处理</span><span>● 数据表</span><span>◇ 判断</span><span>— 主线</span><span>┄ 规则 / 数据关联</span></div>
          {selectedNodes.length > 0 && <FlowchartNodeStyleToolbar nodes={selectedNodes} onChange={editNode} />}
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

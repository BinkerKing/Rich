import { useEffect, useMemo, useRef, useState } from "react";
import { MindmapCanvas, type MindmapCanvasActions } from "../components/mindmap/MindmapCanvas.js";
import { DARK_MINDMAP_THEMES, MINDMAP_LINE_STYLES, getDarkMindmapTheme, type MindmapLineStyle } from "../components/mindmap/darkMindmapThemes.js";
import { MindmapFloatingToolbar } from "../components/mindmap/MindmapFloatingToolbar.js";
import { OutlineEditor } from "../components/outline-editor/OutlineEditor.js";
import { expandAll } from "../components/outline-editor/outlineTreeOps.js";
import { createDeepWorkbenchMap, type DeepWorkbenchItem, type DeepWorkbenchMap } from "./deep-workbench/deepWorkbenchModel.js";
import { fromOutlineNode, toOutlineNode } from "./deep-workbench/deepWorkbenchOutlineAdapter.js";
import { planKnowledgeTreeChanges, projectKnowledgeTree } from "./deep-workbench/knowledgeTreeWorkbench.js";
import { workbenchTitleFromRootText } from "./deep-workbench/workbenchTitle.js";
import { nodeDetails, nodeResources, updateNodeDetails, updateNodeResources, type NodeResources } from "./deep-workbench/nodeDetails.js";
import { clampNodeDetailPanelWidth, loadNodeDetailPanelWidth, nodeDetailPanelMaxWidth, NODE_DETAIL_PANEL_WIDTH_KEY } from "./deep-workbench/nodeDetailPanel.js";
import { titleFromNodeHtml } from "../components/mindmap/richTextNode.js";
import { ProjectRichTextEditor as ProjectRichTextEditorInput } from "./project-management/ProjectManagementModules.js";
import { ConfigurableDataGrid } from "../components/ConfigurableDataGrid.js";
import { NodeDetailTableOfContents } from "./deep-workbench/NodeDetailTableOfContents.js";
import { api, type Flowchart } from "../api/client.js";
import { useStore } from "../state/store.js";
import "./DeepWorkbenchView.css";

const STORAGE_KEY = "rich.deep-workbench.v1";
const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function loadItems(): DeepWorkbenchItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value as DeepWorkbenchItem[] : [];
  } catch { return []; }
}

function persist(items: DeepWorkbenchItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function EditorIcon({ name }: { name: "add" | "back" | "map" | "collapse" }) {
  const paths = {
    add: <path d="M12 5v14M5 12h14" />,
    back: <path d="m14 5-7 7 7 7M7 12h11" />,
    map: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 6h5a3 3 0 0 1 3 3v8M17 5h-2a3 3 0 0 0-3 3v1" /></>,
    collapse: <><path d="M5 8h14M5 16h14" /><path d="m9 5-3 3 3 3m6-6 3 3-3 3" /></>,
  }[name];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

function countOutline(root: DeepWorkbenchMap["root"]): { topics: number; words: number } {
  return root.children.reduce((total, child) => {
    const next = countOutline(child);
    return { topics: total.topics + next.topics, words: total.words + next.words };
  }, { topics: 1, words: root.data.text.trim().length });
}

type DetailSection = "description" | "flowcharts" | "table" | "files";

function NodeDetailSection({ title, open, onToggle, actions, children }: { title: string; open: boolean; onToggle: () => void; actions?: React.ReactNode; children: React.ReactNode }) {
  return <section className={`deep-node-detail__section${open ? " is-open" : ""}`}><header onDoubleClick={onToggle}><h3>{title}</h3><div>{actions}<span className="deep-node-detail__section-state" aria-hidden="true">{open ? "−" : "+"}</span></div></header>{open && <div className="deep-node-detail__section-content">{children}</div>}</section>;
}

function ProjectRichTextEditor({ projectId, value, editing, onChange }: { projectId: string; value: string; editing: boolean; onChange: (value: string) => void }) {
  return <>{editing ? <ProjectRichTextEditorInput projectId={projectId} value={value} onChange={onChange} /> : <article className="deep-node-detail__preview workflow-rich-content" dangerouslySetInnerHTML={{ __html: value || "<p>暂无说明。</p>" }} />}</>;
}

function FlowchartBindings({ resources, onChange }: { resources: NodeResources; onChange: (resources: NodeResources) => void }) {
  const [flowcharts, setFlowcharts] = useState<Flowchart[]>([]);
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => { void api.listFlowcharts().then(setFlowcharts).catch(() => setFlowcharts([])); }, []);
  const bound = flowcharts.filter(flowchart => resources.flowchartIds.includes(flowchart.id));
  const bind = () => {
    if (!selectedId || resources.flowchartIds.includes(selectedId)) return;
    onChange({ ...resources, flowchartIds: [...resources.flowchartIds, selectedId] });
    setSelectedId("");
  };
  return <div className="deep-node-detail__resource"><div className="deep-node-detail__bind-row"><select aria-label="选择要绑定的流程图" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">选择已有流程图</option>{flowcharts.filter(flowchart => !resources.flowchartIds.includes(flowchart.id)).map(flowchart => <option key={flowchart.id} value={flowchart.id}>{flowchart.title}</option>)}</select><button type="button" onClick={bind} disabled={!selectedId}>绑定</button></div>{bound.length === 0 ? <p className="deep-node-detail__empty">还没有绑定流程图。</p> : <div className="deep-node-detail__flowchart-list">{bound.map(flowchart => <article key={flowchart.id} className="deep-node-detail__flowchart"><header><strong>{flowchart.title}</strong><button type="button" aria-label={`解除绑定 ${flowchart.title}`} onClick={() => onChange({ ...resources, flowchartIds: resources.flowchartIds.filter(id => id !== flowchart.id) })}>×</button></header><div className="deep-node-detail__flowchart-preview">{flowchartLabels(flowchart).map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div></article>)}</div>}</div>;
}

function flowchartLabels(flowchart: Flowchart): string[] {
  const graph = flowchart.graph as { nodes?: Array<{ data?: { label?: unknown } }> };
  const labels = graph.nodes?.map(node => node.data?.label).filter((label): label is string => typeof label === "string" && label.trim().length > 0) ?? [];
  return labels.slice(0, 5).length ? labels.slice(0, 5) : ["空流程图"];
}

function NodeDetailTableEditor({ resources, onChange }: { resources: NodeResources; onChange: (resources: NodeResources) => void }) {
  const table = resources.table;
  if (!table.columns.length) return <div className="deep-node-detail__resource"><button type="button" onClick={() => onChange({ ...resources, table: { columns: [{ key: "name", name: "名称", width: 180 }], rows: [] } })}>新建表格</button></div>;
  return <ConfigurableDataGrid ariaLabel="节点表格数据" rows={table.rows} columns={table.columns} onRowsChange={rows => onChange({ ...resources, table: { ...table, rows } })} onColumnsChange={columns => onChange({ ...resources, table: { ...table, columns } })} onAddRow={() => onChange({ ...resources, table: { ...table, rows: [...table.rows, { id: newId() }] } })} emptyRowsRenderer="新增一条记录开始填写数据。" showSettings />;
}

function ExternalFileBindings({ resources, onChange }: { resources: NodeResources; onChange: (resources: NodeResources) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const bind = () => {
    const target = url.trim();
    if (!target) return;
    const label = name.trim() || target.split(/[\\/]/).filter(Boolean).at(-1) || "外部文件";
    onChange({ ...resources, files: [...resources.files, { id: newId(), name: label, url: target }] });
    setName(""); setUrl("");
  };
  return <div className="deep-node-detail__resource"><div className="deep-node-detail__file-form"><input aria-label="外部文件名称" value={name} onChange={event => setName(event.target.value)} placeholder="文件名称（可选）" /><input aria-label="外部文件路径或网址" value={url} onChange={event => setUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter") bind(); }} placeholder="文件路径或网址" /><button type="button" onClick={bind} disabled={!url.trim()}>绑定文件</button></div>{resources.files.length === 0 ? <p className="deep-node-detail__empty">可绑定本地文件路径或网址。</p> : <ul className="deep-node-detail__file-list">{resources.files.map(file => <li key={file.id}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a><button type="button" aria-label={`解除绑定 ${file.name}`} onClick={() => onChange({ ...resources, files: resources.files.filter(item => item.id !== file.id) })}>×</button></li>)}</ul>}</div>;
}

export function DeepWorkbenchView() {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const [items, setItems] = useState<DeepWorkbenchItem[]>(loadItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<"mindmap" | "outline">("mindmap");
  const [mindmapActions, setMindmapActions] = useState<MindmapCanvasActions | null>(null);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ id: string; text: string } | null>(null);
  const [activeDetailSection, setActiveDetailSection] = useState<DetailSection>("description");
  const [nodeDetailEditing, setNodeDetailEditing] = useState(false);
  const [nodeDetailPanelWidth, setNodeDetailPanelWidth] = useState(() => loadNodeDetailPanelWidth(localStorage.getItem(NODE_DETAIL_PANEL_WIDTH_KEY), nodeDetailPanelMaxWidth(window.innerWidth)));
  const [nodeDetailPanelFullscreen, setNodeDetailPanelFullscreen] = useState(false);
  const knowledgeSyncTimer = useRef<number | undefined>();
  useEffect(() => {
    if (!selectedNode) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedNode(null);
      setNodeDetailPanelFullscreen(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [selectedNode]);
  useEffect(() => { setActiveDetailSection("description"); setNodeDetailEditing(false); }, [selectedNode?.id]);
  const active = items.find(item => item.id === activeId) ?? null;
  const standaloneItems = items.filter(item => item.source !== "knowledge-tree");
  const knowledgeRoots = useMemo(() => {
    const childIds = new Set(relations.filter(relation => relation.kind === "child").map(relation => relation.to));
    return Array.from(elements.values()).filter(element => element.type === "topic" && !childIds.has(element.id));
  }, [elements, relations]);

  const updateItems = (next: DeepWorkbenchItem[]) => { setItems(next); persist(next); };
  const updateActive = (id: string, patch: (item: DeepWorkbenchItem) => DeepWorkbenchItem) => {
    setItems(previous => {
      const next = previous.map(item => item.id === id ? patch(item) : item);
      persist(next);
      return next;
    });
  };

  const create = () => {
    const title = newTitle.trim();
    if (!title) return;
    const timestamp = now();
    const item: DeepWorkbenchItem = {
      id: newId(), title, createdAt: timestamp, updatedAt: timestamp,
      map: createDeepWorkbenchMap(title, newId()),
    };
    updateItems([item, ...items]);
    setCreating(false); setNewTitle(""); setActiveId(item.id);
  };

  const openKnowledgeTree = (rootElementId: string) => {
    const root = elements.get(rootElementId);
    if (!root) return;
    const id = `knowledge-tree:${rootElementId}`;
    const existing = items.find(item => item.id === id);
    const item: DeepWorkbenchItem = {
      id, title: root.title, source: "knowledge-tree", rootElementId,
      map: projectKnowledgeTree(rootElementId, elements.values(), relations, existing?.map),
      createdAt: existing?.createdAt ?? now(), updatedAt: now(),
    };
    updateItems([item, ...items.filter(existingItem => existingItem.id !== id)]);
    setKnowledgeError(null);
    setActiveId(id);
  };

  const saveMap = (map: DeepWorkbenchMap) => {
    if (!active) return;
    if (active.source !== "knowledge-tree" || !active.rootElementId) {
      updateActive(active.id, item => ({ ...item, map, updatedAt: now() }));
      return;
    }
    const plan = planKnowledgeTreeChanges(active.map.root, map.root, new Set(elements.keys()));
    updateActive(active.id, item => ({ ...item, title: workbenchTitleFromRootText(map.root.data.text), map, updatedAt: now() }));
    if (!plan.renames.length && !plan.creates.length && !plan.moves.length && !plan.reorders.length && !plan.deletes.length) return;
    window.clearTimeout(knowledgeSyncTimer.current);
    knowledgeSyncTimer.current = window.setTimeout(() => { void (async () => {
      setSavingKnowledge(true);
      setKnowledgeError(null);
      try {
        const resolvedIds = new Map<string, string>();
        const resolve = (id: string) => resolvedIds.get(id) ?? id;
        for (const create of plan.creates) {
          const result = await api.createElement({ title: create.title, type: "concept", parentId: resolve(create.parentId) });
          resolvedIds.set(create.draftId, result.element.id);
        }
        for (const rename of plan.renames) await api.patchElement(rename.elementId, { title: rename.title });
        for (const move of plan.moves) await api.moveElement(move.elementId, resolve(move.parentId));
        for (const reorder of plan.reorders) await api.reorderChildren(resolve(reorder.parentId), reorder.childIds.map(resolve));
        for (const id of plan.deletes) await api.deleteElement(id);
        await hydrate();
        const refreshed = useStore.getState();
        const root = refreshed.elements.get(active.rootElementId!);
        if (!root) throw new Error("知识树根节点已不存在");
        const rebuilt = projectKnowledgeTree(root.id, refreshed.elements.values(), refreshed.relations, map);
        updateActive(active.id, item => ({ ...item, title: root.title, map: rebuilt, updatedAt: now() }));
      } catch (error) {
        setKnowledgeError(error instanceof Error ? error.message : String(error));
        await hydrate().catch(() => undefined);
      } finally {
        setSavingKnowledge(false);
      }
    })(); }, 350);
  };

  if (!active) {
    return <main className="deep-list">
      <header className="deep-list__header">
        <div><h1>从一个问题开始，逐层构建你的架构。</h1></div>
        <button className="deep-list__create" type="button" title="新建工作台" aria-label="新建工作台" onClick={() => setCreating(true)}><EditorIcon name="add" /></button>
      </header>
      <section className="deep-list__section" aria-label="工作台清单">
        <div className="deep-list__label">工作台</div>
        {standaloneItems.length === 0 ? <div className="deep-empty"><strong>还没有工作台</strong><p>创建一个主题，先从主节点开始思考。</p><button className="deep-primary" type="button" onClick={() => setCreating(true)}>新建工作台</button></div> :
          <div className="deep-list__grid">{standaloneItems.map(item => <button className="deep-item" type="button" key={item.id} onClick={() => setActiveId(item.id)}>
            <span className="deep-item__icon" aria-hidden="true"><EditorIcon name="map" /></span><strong>{item.title}</strong>
          </button>)}</div>}
      </section>
      <section className="deep-list__section" aria-label="知识树任务">
        <div className="deep-list__label">知识树</div>
        {knowledgeRoots.length === 0 ? <p className="deep-list__note">知识树加载后会显示可在工作台中编辑的主题。</p> : <div className="deep-list__grid">{knowledgeRoots.map(root => <button className="deep-item deep-item--knowledge" type="button" key={root.id} onClick={() => openKnowledgeTree(root.id)}>
          <span className="deep-item__icon" aria-hidden="true"><EditorIcon name="map" /></span><strong>{root.title}</strong>
        </button>)}</div>}
      </section>
      {creating && <div className="deep-dialog-backdrop" role="presentation" onMouseDown={() => setCreating(false)}><form className="deep-dialog" onSubmit={event => { event.preventDefault(); create(); }} onMouseDown={event => event.stopPropagation()}>
        <h2>新建工作台</h2><p>输入主节点标题，脑图将从这里开始。</p><input autoFocus value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="例如：支付风控方案" />
        <footer><button type="button" onClick={() => setCreating(false)}>取消</button><button className="deep-primary" type="submit">创建</button></footer>
      </form></div>}
    </main>;
  }

  const outlineStats = countOutline(active.map.root);
  const outlineRoot = toOutlineNode(active.map.root);
  const updateOutline = (root: typeof outlineRoot) => saveMap({ ...active.map, root: fromOutlineNode(root) });
  const allExpanded = outlineRoot.expanded ?? true;
  const activeTheme = getDarkMindmapTheme(active.map.theme.id ?? "");
  const activeLineStyle = active.map.theme.lineStyle ?? "curve";
  const activePanSensitivity = active.map.panSensitivity ?? 0.4;
  const selectedDetails = selectedNode ? nodeDetails(findNode(active.map.root, selectedNode.id) ?? active.map.root) : "";
  const selectedResources = selectedNode ? nodeResources(findNode(active.map.root, selectedNode.id) ?? active.map.root) : { flowchartIds: [], table: { columns: [], rows: [] }, files: [] };
  const resizeNodeDetailPanel = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = nodeDetailPanelWidth;
    const onPointerMove = (moveEvent: PointerEvent) => setNodeDetailPanelWidth(clampNodeDetailPanelWidth(startWidth + startX - moveEvent.clientX, nodeDetailPanelMaxWidth(window.innerWidth)));
    const onPointerUp = () => {
      setNodeDetailPanelWidth(width => {
        localStorage.setItem(NODE_DETAIL_PANEL_WIDTH_KEY, String(width));
        return width;
      });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };
  const selectTheme = (themeId: string) => {
    const theme = getDarkMindmapTheme(themeId);
    saveMap({ ...active.map, theme: { id: theme.id, lineStyle: activeLineStyle, template: "default", config: { ...theme.config, lineStyle: activeLineStyle } } });
  };
  const selectLineStyle = (lineStyle: MindmapLineStyle) => saveMap({ ...active.map, theme: { ...active.map.theme, lineStyle, config: { ...active.map.theme.config, lineStyle } } });
  return <main className="deep-canvas">
    <header className="deep-canvas__header"><div className="deep-editor-start" /><div className="deep-editor-title"><input aria-label="工作台标题" value={active.title} onChange={event => {
      const title = event.target.value;
      if (active.source === "knowledge-tree") saveMap({ ...active.map, root: { ...active.map.root, data: { ...active.map.root.data, text: title } } });
      else updateActive(active.id, item => ({ ...item, title, updatedAt: now() }));
    }} /><span>{active.source === "knowledge-tree" ? (savingKnowledge ? "正在同步知识树…" : "已绑定知识树") : "已保存"}</span></div>
      <div className="deep-editor-actions"><button className={viewMode === "mindmap" ? "is-active" : ""} type="button" onClick={() => setViewMode(viewMode === "outline" ? "mindmap" : "outline")}><EditorIcon name="map" />{viewMode === "outline" ? "思维导图" : "返回大纲"}</button><button className="deep-editor-icon" type="button" title={allExpanded ? "全部折叠" : "全部展开"} aria-label={allExpanded ? "全部折叠" : "全部展开"} onClick={() => updateOutline(expandAll(outlineRoot, !allExpanded))}><EditorIcon name="collapse" /></button><button className="deep-editor-icon" type="button" title="返回内容清单" aria-label="返回内容清单" onClick={() => setActiveId(null)}><EditorIcon name="back" /></button>
      </div>
    </header>
    {knowledgeError && <p className="deep-knowledge-error" role="alert">知识树同步失败：{knowledgeError}</p>}
    {viewMode === "mindmap" ? <div className="deep-canvas__map"><MindmapFloatingToolbar themes={DARK_MINDMAP_THEMES} theme={activeTheme.id} lineStyles={MINDMAP_LINE_STYLES} lineStyle={activeLineStyle} layouts={[{ id: "logicalStructure", name: "逻辑结构" }, { id: "mindMap", name: "思维导图" }, { id: "organizationStructure", name: "组织结构" }]} layout={active.map.layout} panSensitivity={activePanSensitivity} onThemeChange={selectTheme} onLineStyleChange={lineStyle => selectLineStyle(lineStyle as MindmapLineStyle)} onLayoutChange={layout => saveMap({ ...active.map, layout: layout as DeepWorkbenchMap["layout"] })} onPanSensitivityChange={panSensitivity => saveMap({ ...active.map, panSensitivity })} onFitView={() => mindmapActions?.fitView()} onExportPng={() => mindmapActions?.exportPng(active.title)} /><MindmapCanvas data={active.map.root as unknown as Record<string, unknown>} layout={active.map.layout} theme={active.map.theme} panSensitivity={activePanSensitivity} onChange={root => saveMap({ ...active.map, root: root as unknown as DeepWorkbenchMap["root"] })} onNodeDoubleClick={setSelectedNode} onReady={setMindmapActions} />{selectedNode && <aside className={`deep-node-detail${nodeDetailPanelFullscreen ? " is-fullscreen" : ""}`} aria-label="节点详情" style={nodeDetailPanelFullscreen ? undefined : { width: nodeDetailPanelWidth }}><div className="deep-node-detail__resize-handle" role="separator" aria-label="调整节点详情宽度" aria-orientation="vertical" onPointerDown={resizeNodeDetailPanel} /><header><h2>{titleFromNodeHtml(selectedNode.text)}</h2><div className="deep-node-detail__header-actions"><button type="button" aria-label={nodeDetailPanelFullscreen ? "还原节点详情" : "全屏显示节点详情"} title={nodeDetailPanelFullscreen ? "还原" : "全屏"} onClick={() => setNodeDetailPanelFullscreen(fullscreen => !fullscreen)}>{nodeDetailPanelFullscreen ? "↙" : "⛶"}</button><button type="button" aria-label="关闭节点详情" onClick={() => setSelectedNode(null)}>×</button></div></header><div className="deep-node-detail__body"><NodeDetailSection title="说明" open={activeDetailSection === "description"} onToggle={() => setActiveDetailSection("description")} actions={<button type="button" className="deep-node-detail__edit" aria-label={nodeDetailEditing ? "完成编辑说明" : "编辑说明"} title={nodeDetailEditing ? "完成" : "编辑"} onClick={event => { event.stopPropagation(); setActiveDetailSection("description"); setNodeDetailEditing(editing => !editing); }}>{nodeDetailEditing ? "完成" : "✎"}</button>}><ProjectRichTextEditor projectId={`deep-workbench-${active.id}-${selectedNode.id}`} value={selectedDetails} editing={nodeDetailEditing} onChange={detailsHtml => saveMap({ ...active.map, root: updateNodeDetails(active.map.root, selectedNode.id, detailsHtml) })} /></NodeDetailSection><NodeDetailSection title="流程图" open={activeDetailSection === "flowcharts"} onToggle={() => setActiveDetailSection("flowcharts")}><FlowchartBindings resources={selectedResources} onChange={resources => saveMap({ ...active.map, root: updateNodeResources(active.map.root, selectedNode.id, resources) })} /></NodeDetailSection><NodeDetailSection title="表格数据" open={activeDetailSection === "table"} onToggle={() => setActiveDetailSection("table")}><NodeDetailTableEditor resources={selectedResources} onChange={resources => saveMap({ ...active.map, root: updateNodeResources(active.map.root, selectedNode.id, resources) })} /></NodeDetailSection><NodeDetailSection title="外部文件" open={activeDetailSection === "files"} onToggle={() => setActiveDetailSection("files")}><ExternalFileBindings resources={selectedResources} onChange={resources => saveMap({ ...active.map, root: updateNodeResources(active.map.root, selectedNode.id, resources) })} /></NodeDetailSection></div></aside>}</div> : <section className="deep-outline"><div className="deep-outline__document-label">{active.source === "knowledge-tree" ? "知识树结构（编辑后即时同步）" : "文档目录"}</div><OutlineEditor root={outlineRoot} onChange={updateOutline} createId={newId} themeConfig={active.map.theme.config} /></section>}
    {selectedNode && nodeDetailPanelFullscreen && <NodeDetailTableOfContents activeId={activeDetailSection} onSelect={section => { setActiveDetailSection(section as DetailSection); window.requestAnimationFrame(() => document.querySelector(".deep-node-detail__section.is-open")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />}
  </main>;
}

function findNode(root: DeepWorkbenchMap["root"], nodeId: string): DeepWorkbenchMap["root"] | undefined {
  if (root.data.uid === nodeId) return root;
  for (const child of root.children) {
    const match = findNode(child, nodeId);
    if (match) return match;
  }
  return undefined;
}

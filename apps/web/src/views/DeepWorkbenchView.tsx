import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MindmapCanvas, type MindmapCanvasActions } from "../components/mindmap/MindmapCanvas.js";
import { DARK_MINDMAP_THEMES, MINDMAP_LINE_STYLES, getDarkMindmapTheme, type MindmapLineStyle } from "../components/mindmap/darkMindmapThemes.js";
import { MindmapFloatingToolbar } from "../components/mindmap/MindmapFloatingToolbar.js";
import { OutlineEditor } from "../components/outline-editor/OutlineEditor.js";
import { expandAll } from "../components/outline-editor/outlineTreeOps.js";
import { createDeepWorkbenchMap, type DeepWorkbenchItem, type DeepWorkbenchMap } from "./deep-workbench/deepWorkbenchModel.js";
import { fromOutlineNode, toOutlineNode } from "./deep-workbench/deepWorkbenchOutlineAdapter.js";
import { planKnowledgeTreeChanges, projectKnowledgeTree } from "./deep-workbench/knowledgeTreeWorkbench.js";
import { workbenchTitleFromRootText } from "./deep-workbench/workbenchTitle.js";
import { nodeDetails, updateNodeDetails } from "./deep-workbench/nodeDetails.js";
import { clampNodeDetailPanelWidth, loadNodeDetailPanelWidth, nodeDetailPanelMaxWidth, NODE_DETAIL_PANEL_WIDTH_KEY } from "./deep-workbench/nodeDetailPanel.js";
import { titleFromNodeHtml } from "../components/mindmap/richTextNode.js";
import { ProjectRichTextEditor as ProjectRichTextEditorInput } from "./project-management/ProjectManagementModules.js";
import { api } from "../api/client.js";
import { useStore } from "../state/store.js";
import { openBoundCodex } from "./project-management/deliverables/DeliverableCodexLauncher.js";
import { useCurrentCodexShortcut } from "../lib/currentCodexShortcut.js";
import { deepMindMapsApi, mergeLegacyMaps } from "./deep-workbench/deepMindMapsApi.js";

const MINIMAP_FOCUS_KEY = "rich:mindmap-focus";
export function requestMindmapFocus(id: string) { window.sessionStorage.setItem(MINIMAP_FOCUS_KEY, id); }
import "./DeepWorkbenchView.css";

const STORAGE_KEY = "rich.deep-workbench.v1";
const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function loadLegacyItems(): DeepWorkbenchItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value as DeepWorkbenchItem[] : [];
  } catch { return []; }
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

function EditModeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14.5 5.5 4 4M4 20l4.2-1 10.6-10.6a2.8 2.8 0 0 0-4-4L4.2 15z" /></svg>;
}

function countOutline(root: DeepWorkbenchMap["root"]): { topics: number; words: number } {
  return root.children.reduce((total, child) => {
    const next = countOutline(child);
    return { topics: total.topics + next.topics, words: total.words + next.words };
  }, { topics: 1, words: root.data.text.trim().length });
}

function ProjectRichTextEditor({ projectId, value, editing, onChange }: { projectId: string; value: string; editing: boolean; onChange: (value: string) => void }) {
  return <>{editing ? <ProjectRichTextEditorInput projectId={projectId} value={value} onChange={onChange} /> : <article className="deep-node-detail__preview workflow-rich-content" dangerouslySetInnerHTML={{ __html: value || "<p>暂无说明。</p>" }} />}</>;
}

export function DeepWorkbenchView() {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const [items, setItems] = useState<DeepWorkbenchItem[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<"mindmap" | "outline">("mindmap");
  const [mindmapActions, setMindmapActions] = useState<MindmapCanvasActions | null>(null);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [codexError, setCodexError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ id: string; text: string } | null>(null);
  const [outlineSelectedNodeId, setOutlineSelectedNodeId] = useState<string | null>(null);
  const [nodeDetailEditing, setNodeDetailEditing] = useState(false);
  const [nodeDetailPanelWidth, setNodeDetailPanelWidth] = useState(() => loadNodeDetailPanelWidth(localStorage.getItem(NODE_DETAIL_PANEL_WIDTH_KEY), nodeDetailPanelMaxWidth(window.innerWidth)));
  const [nodeDetailPanelFullscreen, setNodeDetailPanelFullscreen] = useState(false);
  const knowledgeSyncTimer = useRef<number | undefined>();
  useEffect(() => { void (async () => {
    try {
      const serverItems = await deepMindMapsApi.list();
      const legacyItems = mergeLegacyMaps(serverItems, loadLegacyItems());
      const imported = await Promise.all(legacyItems.map(item => deepMindMapsApi.create(item, true)));
      if (legacyItems.length) localStorage.removeItem(STORAGE_KEY);
      setItems([...imported, ...serverItems]);
    } catch (error) { setStorageError(error instanceof Error ? error.message : String(error)); }
  })(); }, []);
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
  useEffect(() => { setNodeDetailEditing(false); }, [selectedNode?.id, outlineSelectedNodeId]);
  useEffect(() => { setOutlineSelectedNodeId(null); }, [activeId]);
  const active = items.find(item => item.id === activeId) ?? null;
  const standaloneItems = items.filter(item => item.source !== "knowledge-tree");
  useEffect(() => {
    const id = window.sessionStorage.getItem(MINIMAP_FOCUS_KEY);
    if (id && items.some(item => item.id === id)) { window.sessionStorage.removeItem(MINIMAP_FOCUS_KEY); setActiveId(id); }
  }, [items]);
  const knowledgeRoots = useMemo(() => {
    const childIds = new Set(relations.filter(relation => relation.kind === "child").map(relation => relation.to));
    return Array.from(elements.values()).filter(element => element.type === "topic" && !childIds.has(element.id));
  }, [elements, relations]);

  const updateItems = (next: DeepWorkbenchItem[]) => { setItems(next); };
  const updateActive = (id: string, patch: (item: DeepWorkbenchItem) => DeepWorkbenchItem) => {
    setItems(previous => {
      const current = previous.find(item => item.id === id);
      const next = previous.map(item => item.id === id ? patch(item) : item);
      const changed = next.find(item => item.id === id);
      if (current && changed && current.source !== "knowledge-tree") void deepMindMapsApi.update(changed, current.updatedAt).then(saved => setItems(items => items.map(item => item.id === saved.id ? saved : item))).catch(error => setStorageError(error instanceof Error ? error.message : String(error)));
      return next;
    });
  };

  const create = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const timestamp = now();
    const item: DeepWorkbenchItem = {
      id: newId(), title, createdAt: timestamp, updatedAt: timestamp,
      map: createDeepWorkbenchMap(title, newId()),
    };
    try {
      const saved = await deepMindMapsApi.create(item);
      updateItems([saved, ...items]);
    } catch (error) { setStorageError(error instanceof Error ? error.message : String(error)); return; }
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
  const openCodexConversation = async (item: DeepWorkbenchItem) => {
    setCodexError(null);
    try {
      const response = await fetch("/api/deliverable-codex/deliverables/__general__/__general__/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: `[DeepMindMap] ${item.title} · Codex` }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; conversation?: { id: string } };
      if (!response.ok || !payload.conversation) throw new Error(payload.error ?? `创建 Codex 对话失败 (${response.status})`);
      const session = payload.conversation;
      openBoundCodex({ projectId: "__general__", deliverableId: "__general__", deliverableTitle: "通用任务", conversationId: session.id });
    } catch (error) {
      setCodexError(error instanceof Error ? error.message : String(error));
    }
  };
  useCurrentCodexShortcut(active ? () => { void openCodexConversation(active); } : undefined);

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
  const outlineSelectedNode = findNode(active.map.root, outlineSelectedNodeId ?? active.map.root.data.uid) ?? active.map.root;
  const outlineSelectedDetails = nodeDetails(outlineSelectedNode);
  const allExpanded = outlineRoot.expanded ?? true;
  const activeTheme = getDarkMindmapTheme(active.map.theme.id ?? "");
  const activeLineStyle = active.map.theme.lineStyle ?? "curve";
  const activePanSensitivity = active.map.panSensitivity ?? 0.4;
  const selectedDetails = selectedNode ? nodeDetails(findNode(active.map.root, selectedNode.id) ?? active.map.root) : "";
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
    {storageError && <p className="deep-knowledge-error" role="alert">DeepMindMap 存储不可用：{storageError}</p>}
    {knowledgeError && <p className="deep-knowledge-error" role="alert">知识树同步失败：{knowledgeError}</p>}
    {codexError && <p className="deep-knowledge-error" role="alert">打开 Codex 对话失败：{codexError}</p>}
    {viewMode === "mindmap" ? <div className="deep-canvas__map"><MindmapFloatingToolbar themes={DARK_MINDMAP_THEMES} theme={activeTheme.id} lineStyles={MINDMAP_LINE_STYLES} lineStyle={activeLineStyle} layouts={[{ id: "logicalStructure", name: "逻辑结构" }, { id: "mindMap", name: "思维导图" }, { id: "organizationStructure", name: "组织结构" }]} layout={active.map.layout} panSensitivity={activePanSensitivity} onThemeChange={selectTheme} onLineStyleChange={lineStyle => selectLineStyle(lineStyle as MindmapLineStyle)} onLayoutChange={layout => saveMap({ ...active.map, layout: layout as DeepWorkbenchMap["layout"] })} onPanSensitivityChange={panSensitivity => saveMap({ ...active.map, panSensitivity })} onFitView={() => mindmapActions?.fitView()} onExportPng={() => mindmapActions?.exportPng(active.title)} onOpenCodex={() => void openCodexConversation(active)} /><MindmapCanvas data={active.map.root as unknown as Record<string, unknown>} layout={active.map.layout} theme={active.map.theme} panSensitivity={activePanSensitivity} onChange={root => saveMap({ ...active.map, root: root as unknown as DeepWorkbenchMap["root"] })} onNodeDoubleClick={setSelectedNode} onReady={setMindmapActions} />{selectedNode && <aside className={`deep-node-detail${nodeDetailPanelFullscreen ? " is-fullscreen" : ""}`} aria-label="节点详情" style={{ "--node-detail-accent": nodeFrameColor(active.map.root, selectedNode.id, active.map.theme.config, activeTheme.accent), ...(nodeDetailPanelFullscreen ? {} : { width: nodeDetailPanelWidth }) } as CSSProperties}><div className="deep-node-detail__resize-handle" role="separator" aria-label="调整节点详情宽度" aria-orientation="vertical" onPointerDown={resizeNodeDetailPanel} /><header><h2>{titleFromNodeHtml(selectedNode.text)}</h2><div className="deep-node-detail__header-actions"><button type="button" className={`deep-node-detail__edit-toggle${nodeDetailEditing ? " is-active" : ""}`} aria-label={nodeDetailEditing ? "切换为预览模式" : "切换为编辑模式"} title={nodeDetailEditing ? "预览" : "编辑"} onClick={() => setNodeDetailEditing(editing => !editing)}><EditModeIcon /></button><button type="button" aria-label={nodeDetailPanelFullscreen ? "还原节点详情" : "全屏显示节点详情"} title={nodeDetailPanelFullscreen ? "还原" : "全屏"} onClick={() => setNodeDetailPanelFullscreen(fullscreen => !fullscreen)}>{nodeDetailPanelFullscreen ? "↙" : "⛶"}</button><button type="button" aria-label="关闭节点详情" onClick={() => setSelectedNode(null)}>×</button></div></header><div className="deep-node-detail__body"><div className="deep-node-detail__richtext"><ProjectRichTextEditor projectId={`deep-workbench-${active.id}-${selectedNode.id}`} value={selectedDetails} editing={nodeDetailEditing} onChange={detailsHtml => saveMap({ ...active.map, root: updateNodeDetails(active.map.root, selectedNode.id, detailsHtml) })} /></div></div></aside>}</div> : <section className="deep-outline-workspace"><aside className="deep-outline-workspace__outline"><div className="deep-outline__document-label">{active.source === "knowledge-tree" ? "知识树结构（编辑后即时同步）" : "文档目录"}</div><OutlineEditor root={outlineRoot} onChange={updateOutline} createId={newId} themeConfig={active.map.theme.config} onNodeSelect={setOutlineSelectedNodeId} /></aside><section className="deep-outline-workspace__detail" aria-label="节点详情" style={{ "--node-detail-accent": nodeFrameColor(active.map.root, outlineSelectedNode.data.uid, active.map.theme.config, activeTheme.accent) } as CSSProperties}><header><h2>{titleFromNodeHtml(outlineSelectedNode.data.text)}</h2><button type="button" className={`deep-node-detail__edit-toggle${nodeDetailEditing ? " is-active" : ""}`} aria-label={nodeDetailEditing ? "切换为预览模式" : "切换为编辑模式"} title={nodeDetailEditing ? "预览" : "编辑"} onClick={() => setNodeDetailEditing(editing => !editing)}><EditModeIcon /></button></header><div className="deep-node-detail__body"><div className="deep-node-detail__richtext"><ProjectRichTextEditor projectId={`deep-workbench-${active.id}-${outlineSelectedNode.data.uid}`} value={outlineSelectedDetails} editing={nodeDetailEditing} onChange={detailsHtml => saveMap({ ...active.map, root: updateNodeDetails(active.map.root, outlineSelectedNode.data.uid, detailsHtml) })} /></div></div></section></section>}
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

function nodeFrameColor(root: DeepWorkbenchMap["root"], nodeId: string, config: Record<string, unknown>, fallback: string): string {
  const findWithDepth = (node: DeepWorkbenchMap["root"], depth: number): { node: DeepWorkbenchMap["root"]; depth: number } | undefined => {
    if (node.data.uid === nodeId) return { node, depth };
    for (const child of node.children) {
      const match = findWithDepth(child, depth + 1);
      if (match) return match;
    }
    return undefined;
  };
  const match = findWithDepth(root, 0);
  const customColor = match?.node.data.borderColor;
  if (typeof customColor === "string") return customColor;
  const level = match?.depth === 0 ? "root" : match?.depth === 1 ? "second" : "node";
  const nodeConfig = config[level];
  return typeof nodeConfig === "object" && nodeConfig !== null && typeof (nodeConfig as Record<string, unknown>).borderColor === "string"
    ? (nodeConfig as Record<string, string>).borderColor
    : fallback;
}

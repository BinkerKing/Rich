import { useMemo, useRef, useState } from "react";
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
import { titleFromNodeHtml } from "../components/mindmap/richTextNode.js";
import { ProjectRichTextEditor } from "./project-management/ProjectManagementModules.js";
import { api } from "../api/client.js";
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

function EditorIcon({ name }: { name: "back" | "map" | "collapse" }) {
  const paths = {
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
  const knowledgeSyncTimer = useRef<number | undefined>();
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
        <div><p>深度工作台</p><h1>从一个问题开始，逐层构建你的架构。</h1></div>
        <button className="deep-primary" type="button" onClick={() => setCreating(true)}>新建工作台</button>
      </header>
      <section className="deep-list__section" aria-label="工作台清单">
        <div className="deep-list__label"><span>内容清单</span><small>{standaloneItems.length} 个工作台</small></div>
        {standaloneItems.length === 0 ? <div className="deep-empty"><strong>还没有工作台</strong><p>创建一个主题，先从主节点开始思考。</p><button className="deep-primary" type="button" onClick={() => setCreating(true)}>新建工作台</button></div> :
          <div className="deep-list__grid">{standaloneItems.map(item => <button className="deep-item" type="button" key={item.id} onClick={() => setActiveId(item.id)}>
            <span className="deep-item__dot" aria-hidden="true" /><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString("zh-CN")}</small>
          </button>)}</div>}
      </section>
      <section className="deep-list__section" aria-label="知识树任务">
        <div className="deep-list__label"><span>知识树任务</span><small>{knowledgeRoots.length} 个主题</small></div>
        {knowledgeRoots.length === 0 ? <p className="deep-list__note">知识树加载后会显示可在工作台中编辑的主题。</p> : <div className="deep-list__grid">{knowledgeRoots.map(root => <button className="deep-item deep-item--knowledge" type="button" key={root.id} onClick={() => openKnowledgeTree(root.id)}>
          <span className="deep-item__dot" aria-hidden="true" /><strong>{root.title}</strong><small>知识树 · 在脑图中查看和编辑</small>
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
    {viewMode === "mindmap" ? <div className="deep-canvas__map"><MindmapFloatingToolbar themes={DARK_MINDMAP_THEMES} theme={activeTheme.id} lineStyles={MINDMAP_LINE_STYLES} lineStyle={activeLineStyle} layouts={[{ id: "logicalStructure", name: "逻辑结构" }, { id: "mindMap", name: "思维导图" }, { id: "organizationStructure", name: "组织结构" }]} layout={active.map.layout} panSensitivity={activePanSensitivity} onThemeChange={selectTheme} onLineStyleChange={lineStyle => selectLineStyle(lineStyle as MindmapLineStyle)} onLayoutChange={layout => saveMap({ ...active.map, layout: layout as DeepWorkbenchMap["layout"] })} onPanSensitivityChange={panSensitivity => saveMap({ ...active.map, panSensitivity })} onFitView={() => mindmapActions?.fitView()} onExportPng={() => mindmapActions?.exportPng(active.title)} /><MindmapCanvas data={active.map.root as unknown as Record<string, unknown>} layout={active.map.layout} theme={active.map.theme} panSensitivity={activePanSensitivity} onChange={root => saveMap({ ...active.map, root: root as unknown as DeepWorkbenchMap["root"] })} onNodeActive={setSelectedNode} onReady={setMindmapActions} />{selectedNode && <aside className="deep-node-detail" aria-label="节点详情"><header><div><span>节点详情</span><h2>{titleFromNodeHtml(selectedNode.text)}</h2></div><button type="button" aria-label="关闭节点详情" onClick={() => setSelectedNode(null)}>×</button></header><div className="deep-node-detail__body"><span className="deep-node-detail__label">详情</span><ProjectRichTextEditor projectId={`deep-workbench-${active.id}-${selectedNode.id}`} value={selectedDetails} onChange={detailsHtml => saveMap({ ...active.map, root: updateNodeDetails(active.map.root, selectedNode.id, detailsHtml) })} /></div></aside>}</div> : <section className="deep-outline"><div className="deep-outline__document-label">{active.source === "knowledge-tree" ? "知识树结构（编辑后即时同步）" : "文档目录"}</div><OutlineEditor root={outlineRoot} onChange={updateOutline} createId={newId} themeConfig={active.map.theme.config} /></section>}
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

import { useState } from "react";
import { MindmapCanvas, type MindmapCanvasActions } from "../components/mindmap/MindmapCanvas.js";
import { DARK_MINDMAP_THEMES, MINDMAP_LINE_STYLES, getDarkMindmapTheme, type MindmapLineStyle } from "../components/mindmap/darkMindmapThemes.js";
import { OutlineEditor } from "../components/outline-editor/OutlineEditor.js";
import { expandAll } from "../components/outline-editor/outlineTreeOps.js";
import { createDeepWorkbenchMap, type DeepWorkbenchItem, type DeepWorkbenchMap } from "./deep-workbench/deepWorkbenchModel.js";
import { fromOutlineNode, toOutlineNode } from "./deep-workbench/deepWorkbenchOutlineAdapter.js";
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
  const [items, setItems] = useState<DeepWorkbenchItem[]>(loadItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<"mindmap" | "outline">("outline");
  const [mindmapActions, setMindmapActions] = useState<MindmapCanvasActions | null>(null);
  const active = items.find(item => item.id === activeId) ?? null;

  const updateItems = (next: DeepWorkbenchItem[]) => { setItems(next); persist(next); };

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

  const saveMap = (map: DeepWorkbenchMap) => {
    if (!activeId) return;
    setItems(previous => {
      const next = previous.map(item => item.id === activeId ? { ...item, map, updatedAt: now() } : item);
      persist(next);
      return next;
    });
  };

  if (!active) {
    return <main className="deep-list">
      <header className="deep-list__header">
        <div><p>深度工作台</p><h1>从一个问题开始，逐层构建你的架构。</h1></div>
        <button className="deep-primary" type="button" onClick={() => setCreating(true)}>新建工作台</button>
      </header>
      <section className="deep-list__section" aria-label="工作台清单">
        <div className="deep-list__label"><span>内容清单</span><small>{items.length} 个工作台</small></div>
        {items.length === 0 ? <div className="deep-empty"><strong>还没有工作台</strong><p>创建一个主题，先从主节点开始思考。</p><button className="deep-primary" type="button" onClick={() => setCreating(true)}>新建工作台</button></div> :
          <div className="deep-list__grid">{items.map(item => <button className="deep-item" type="button" key={item.id} onClick={() => setActiveId(item.id)}>
            <span className="deep-item__dot" aria-hidden="true" /><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString("zh-CN")}</small>
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
  const selectTheme = (themeId: string) => {
    const theme = getDarkMindmapTheme(themeId);
    saveMap({ ...active.map, theme: { id: theme.id, lineStyle: activeLineStyle, template: "default", config: { ...theme.config, lineStyle: activeLineStyle } } });
  };
  const selectLineStyle = (lineStyle: MindmapLineStyle) => saveMap({ ...active.map, theme: { ...active.map.theme, lineStyle, config: { ...active.map.theme.config, lineStyle } } });
  return <main className="deep-canvas">
    <header className="deep-canvas__header"><div className="deep-editor-start"><button className="deep-editor-icon" type="button" onClick={() => setActiveId(null)} aria-label="返回内容清单"><EditorIcon name="back" /></button></div><div className="deep-editor-title"><input aria-label="工作台标题" value={active.title} onChange={event => updateItems(items.map(item => item.id === active.id ? { ...item, title: event.target.value, updatedAt: now() } : item))} /><span>已保存</span></div>
      <div className="deep-editor-actions"><button className={viewMode === "mindmap" ? "is-active" : ""} type="button" onClick={() => setViewMode(viewMode === "outline" ? "mindmap" : "outline")}><EditorIcon name="map" />{viewMode === "outline" ? "思维导图" : "返回大纲"}</button><button className="deep-editor-icon" type="button" title={allExpanded ? "全部折叠" : "全部展开"} aria-label={allExpanded ? "全部折叠" : "全部展开"} onClick={() => updateOutline(expandAll(outlineRoot, !allExpanded))}><EditorIcon name="collapse" /></button>
      {viewMode === "mindmap" && <div className="deep-canvas__tools"><button type="button" onClick={() => mindmapActions?.undo()}>撤销</button><button type="button" onClick={() => mindmapActions?.redo()}>重做</button><button type="button" onClick={() => mindmapActions?.insertSibling()}>同级</button><button className="deep-primary" type="button" onClick={() => mindmapActions?.insertChild()}>子节点</button><button type="button" onClick={() => mindmapActions?.exportPng(active.title)}>导出 PNG</button><label className="deep-theme-picker"><i style={{ backgroundColor: activeTheme.accent }} aria-hidden="true" /><select aria-label="脑图主题" value={activeTheme.id} onChange={event => selectTheme(event.target.value)}>{DARK_MINDMAP_THEMES.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><select aria-label="脑图线条" value={activeLineStyle} onChange={event => selectLineStyle(event.target.value as MindmapLineStyle)}>{MINDMAP_LINE_STYLES.map(style => <option key={style.id} value={style.id}>{style.name}</option>)}</select><select aria-label="脑图布局" value={active.map.layout} onChange={event => saveMap({ ...active.map, layout: event.target.value as DeepWorkbenchMap["layout"] })}><option value="logicalStructure">逻辑结构</option><option value="mindMap">思维导图</option><option value="organizationStructure">组织结构</option></select></div>}</div>
    </header>
    {viewMode === "mindmap" ? <div className="deep-canvas__map"><MindmapCanvas data={active.map.root as unknown as Record<string, unknown>} layout={active.map.layout} theme={active.map.theme} onChange={root => saveMap({ ...active.map, root: root as unknown as DeepWorkbenchMap["root"] })} onReady={setMindmapActions} /></div> : <section className="deep-outline"><div className="deep-outline__document-label">文档目录</div><OutlineEditor root={outlineRoot} onChange={updateOutline} createId={newId} /></section>}
    <footer className="deep-canvas__hint">{viewMode === "mindmap" ? "Tab 新增子节点 · Enter 新增同级节点 · 拖拽调整层级 · / 折叠 · ⌘L 整理布局" : `当前文档 ${outlineStats.topics} 条主题 · 共 ${outlineStats.words} 字`}</footer>
  </main>;
}

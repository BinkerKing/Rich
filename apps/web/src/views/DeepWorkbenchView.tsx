import { useEffect, useRef, useState } from "react";
import MindMap from "simple-mind-map";
import Drag from "simple-mind-map/src/plugins/Drag.js";
import Select from "simple-mind-map/src/plugins/Select.js";
import Export from "simple-mind-map/src/plugins/Export.js";
import { createDeepWorkbenchMap, type DeepWorkbenchItem, type DeepWorkbenchMap } from "./deep-workbench/deepWorkbenchModel.js";
import { indentOutlineNode, insertOutlineChild, insertOutlineSibling, outdentOutlineNode, setOutlineExpanded, updateOutlineText } from "./deep-workbench/deepWorkbenchOutline.js";
import "./DeepWorkbenchView.css";
import "./DeepWorkbenchOutline.css";

MindMap.usePlugin(Drag).usePlugin(Select).usePlugin(Export);

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

function EditorIcon({ name }: { name: "back" | "map" | "collapse" | "more" | "add" }) {
  const paths = {
    back: <path d="m14 5-7 7 7 7M7 12h11" />,
    map: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 6h5a3 3 0 0 1 3 3v8M17 5h-2a3 3 0 0 0-3 3v1" /></>,
    collapse: <><path d="M5 8h14M5 16h14" /><path d="m9 5-3 3 3 3m6-6 3 3-3 3" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    add: <path d="M12 5v14M5 12h14" />,
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
  const [outlineFocusId, setOutlineFocusId] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mindMapRef = useRef<any>(null);
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

  useEffect(() => {
    if (!active || !hostRef.current || viewMode !== "mindmap") return;
    const mindMap = new MindMap({
      el: hostRef.current,
      data: active.map.root,
      layout: active.map.layout,
      theme: active.map.theme.template,
      themeConfig: active.map.theme.config,
      fit: true,
      enableFreeDrag: false,
      beforeDragEnd: () => false,
    });
    mindMapRef.current = mindMap;
    const onChange = () => saveMap(mindMap.getData(true) as DeepWorkbenchMap);
    mindMap.on("data_change", onChange);
    mindMap.on("layout_change", onChange);
    return () => { mindMap.destroy(); mindMapRef.current = null; };
  // Recreate only when switching a workspace. The map itself owns editing state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, viewMode]);

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

  const command = (name: string) => mindMapRef.current?.execCommand(name);
  const changeLayout = (layout: DeepWorkbenchMap["layout"]) => {
    mindMapRef.current?.setLayout(layout); saveMap({ ...active.map, layout });
  };
  const updateOutline = (root: DeepWorkbenchMap["root"]) => saveMap({ ...active.map, root });
  const addOutlineNode = (uid: string, asChild = false) => {
    const nextId = newId();
    updateOutline(asChild ? insertOutlineChild(active.map.root, uid, nextId) : insertOutlineSibling(active.map.root, uid, nextId));
    setOutlineFocusId(nextId);
  };
  const onOutlineKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, uid: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addOutlineNode(uid, uid === active.map.root.data.uid);
    }
    if (event.key === "Tab") {
      event.preventDefault();
      updateOutline(event.shiftKey ? outdentOutlineNode(active.map.root, uid) : indentOutlineNode(active.map.root, uid));
    }
  };
  const renderOutlineNode = (node: DeepWorkbenchMap["root"], depth = 0) => {
    const hasChildren = node.children.length > 0;
    const expanded = node.data.expand !== false;
    return <li className={`deep-outline__item${depth === 0 ? " deep-outline__item--root" : ""}`} key={node.data.uid}>
      <div className="deep-outline__row">
        <button className={`deep-outline__toggle${hasChildren ? "" : " is-empty"}${expanded ? " is-expanded" : ""}`} type="button" aria-label={expanded ? "折叠子主题" : "展开子主题"} aria-expanded={hasChildren ? expanded : undefined} onClick={() => hasChildren && updateOutline(setOutlineExpanded(active.map.root, node.data.uid, !expanded))}>⌄</button>
        <input autoFocus={outlineFocusId === node.data.uid} aria-label={`第 ${depth + 1} 层节点`} value={node.data.text} onFocus={() => setOutlineFocusId(null)} onChange={event => updateOutline(updateOutlineText(active.map.root, node.data.uid, event.target.value))} onKeyDown={event => onOutlineKeyDown(event, node.data.uid)} placeholder="输入节点标题" />
        <span className="deep-outline__row-actions"><button type="button" aria-label="新增子节点" title="新增子节点" onClick={() => addOutlineNode(node.data.uid, true)}><EditorIcon name="add" /></button><button type="button" aria-label="更多操作" title="更多操作"><EditorIcon name="more" /></button></span>
      </div>
      {hasChildren && expanded && <ul>{node.children.map(child => renderOutlineNode(child, depth + 1))}</ul>}
    </li>;
  };
  const outlineStats = countOutline(active.map.root);
  return <main className="deep-canvas">
    <header className="deep-canvas__header"><button className="deep-editor-icon" type="button" onClick={() => setActiveId(null)} aria-label="返回内容清单"><EditorIcon name="back" /></button><div className="deep-editor-title"><input aria-label="工作台标题" value={active.title} onChange={event => updateItems(items.map(item => item.id === active.id ? { ...item, title: event.target.value, updatedAt: now() } : item))} /><span>已保存</span></div>
      <div className="deep-editor-actions"><button className={viewMode === "mindmap" ? "is-active" : ""} type="button" onClick={() => setViewMode(viewMode === "outline" ? "mindmap" : "outline")}><EditorIcon name="map" />{viewMode === "outline" ? "思维导图" : "返回大纲"}</button><button className="deep-editor-icon" type="button" title={active.map.root.data.expand === false ? "全部展开" : "全部折叠"} aria-label={active.map.root.data.expand === false ? "全部展开" : "全部折叠"} onClick={() => updateOutline(setOutlineExpanded(active.map.root, active.map.root.data.uid, active.map.root.data.expand === false))}><EditorIcon name="collapse" /></button><button className="deep-editor-icon" type="button" aria-label="更多文档操作" title="更多文档操作"><EditorIcon name="more" /></button></div>
      {viewMode === "mindmap" && <div className="deep-canvas__tools"><button type="button" onClick={() => command("BACK")}>撤销</button><button type="button" onClick={() => command("FORWARD")}>重做</button><button type="button" onClick={() => command("INSERT_NODE")}>同级</button><button className="deep-primary" type="button" onClick={() => command("INSERT_CHILD_NODE")}>子节点</button><button type="button" onClick={() => mindMapRef.current?.export?.export("png", true, active.title)}>导出 PNG</button><select aria-label="脑图布局" value={active.map.layout} onChange={event => changeLayout(event.target.value as DeepWorkbenchMap["layout"])}><option value="logicalStructure">逻辑结构</option><option value="mindMap">思维导图</option><option value="organizationStructure">组织结构</option></select></div>}
    </header>
    {viewMode === "mindmap" ? <div className="deep-canvas__map" ref={hostRef} /> : <section className="deep-outline"><div className="deep-outline__document-label">文档目录</div><ul className="deep-outline__tree">{renderOutlineNode(active.map.root)}</ul></section>}
    <footer className="deep-canvas__hint">{viewMode === "mindmap" ? "Tab 新增子节点 · Enter 新增同级节点 · 拖拽调整层级 · / 折叠 · ⌘L 整理布局" : `当前文档 ${outlineStats.topics} 条主题 · 共 ${outlineStats.words} 字`}</footer>
  </main>;
}

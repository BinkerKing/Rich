import { useState } from "react";
import { Icon } from "../components/Icon.js";
import { APP_MENU_ITEMS, type AppMenuItem } from "../lib/appCatalog.js";
import { useStore, type AppView } from "../state/store.js";
import "./AppLauncherView.css";

const ORDER_KEY = "rich:app-launcher-order:v1";
const LAYOUT_KEY = "rich:app-launcher-layout:v1";
type LauncherId = AppView;
type LauncherItem = AppMenuItem;
type LauncherApp = { type: "app"; id: LauncherId };
type LauncherFolder = { type: "folder"; id: string; label: string; items: LauncherId[] };
type LauncherEntry = LauncherApp | LauncherFolder;
type DragSource = { type: "app"; id: LauncherId } | { type: "folder"; id: string };

const itemById = new Map(APP_MENU_ITEMS.map(item => [item.id, item]));

function isLauncherId(value: unknown): value is LauncherId {
  return typeof value === "string" && itemById.has(value as LauncherId);
}

function legacyLayout(): LauncherEntry[] {
  try {
    const order = JSON.parse(window.localStorage.getItem(ORDER_KEY) ?? "[]");
    const rank = new Map(Array.isArray(order) ? order.filter(isLauncherId).map((id, index) => [id, index]) : []);
    return [...APP_MENU_ITEMS].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999) || APP_MENU_ITEMS.indexOf(a) - APP_MENU_ITEMS.indexOf(b)).map(item => ({ type: "app", id: item.id }));
  } catch {
    return APP_MENU_ITEMS.map(item => ({ type: "app", id: item.id }));
  }
}

function normalizeLayout(value: unknown): LauncherEntry[] {
  if (!Array.isArray(value)) return legacyLayout();
  const seen = new Set<LauncherId>();
  const entries: LauncherEntry[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as { type?: unknown; id?: unknown; label?: unknown; items?: unknown };
    if (entry.type === "app" && isLauncherId(entry.id) && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push({ type: "app", id: entry.id });
      continue;
    }
    if (entry.type !== "folder" || typeof entry.id !== "string" || !Array.isArray(entry.items)) continue;
    const items = entry.items.filter(isLauncherId).filter(id => !seen.has(id));
    items.forEach(id => seen.add(id));
    if (items.length > 1) entries.push({ type: "folder", id: entry.id, label: typeof entry.label === "string" && entry.label.trim() ? entry.label : "应用分组", items });
    else if (items.length === 1) entries.push({ type: "app", id: items[0] });
  }
  APP_MENU_ITEMS.forEach(item => { if (!seen.has(item.id)) entries.push({ type: "app", id: item.id }); });
  return entries;
}

function loadLayout(): LauncherEntry[] {
  if (typeof window === "undefined") return APP_MENU_ITEMS.map(item => ({ type: "app", id: item.id }));
  const saved = window.localStorage.getItem(LAYOUT_KEY);
  if (saved) {
    try { return normalizeLayout(JSON.parse(saved)); }
    catch { /* fall through to a clean migration */ }
  }
  const migrated = legacyLayout();
  saveLayout(migrated);
  return migrated;
}

function saveLayout(entries: LauncherEntry[]) {
  window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(entries));
}

function appId(source: DragSource | null): LauncherId | null {
  return source?.type === "app" ? source.id : null;
}

function withoutApp(entries: LauncherEntry[], id: LauncherId): LauncherEntry[] {
  return entries.flatMap<LauncherEntry>(entry => {
    if (entry.type === "app") return entry.id === id ? [] : [entry];
    const items = entry.items.filter(item => item !== id);
    if (items.length > 1) return [{ ...entry, items }];
    return items.length === 1 ? [{ type: "app", id: items[0] }] : [];
  });
}

function createFolder(entries: LauncherEntry[], sourceId: LauncherId, targetId: LauncherId): LauncherEntry[] {
  if (sourceId === targetId) return entries;
  const removed = withoutApp(entries, sourceId);
  const targetIndex = removed.findIndex(entry => entry.type === "app" && entry.id === targetId);
  if (targetIndex < 0) return entries;
  const next = [...removed];
  next.splice(targetIndex, 1, { type: "folder", id: crypto.randomUUID(), label: "应用分组", items: [targetId, sourceId] });
  return next;
}

function moveIntoFolder(entries: LauncherEntry[], sourceId: LauncherId, folderId: string): LauncherEntry[] {
  const removed = withoutApp(entries, sourceId);
  return removed.map(entry => entry.type === "folder" && entry.id === folderId ? { ...entry, items: [...entry.items, sourceId] } : entry);
}

function removeFromFolder(entries: LauncherEntry[], sourceId: LauncherId, targetId?: LauncherId): LauncherEntry[] {
  const removed = withoutApp(entries, sourceId);
  const index = targetId ? removed.findIndex(entry => entry.type === "app" && entry.id === targetId) : removed.length;
  const next = [...removed];
  next.splice(index < 0 ? next.length : index, 0, { type: "app", id: sourceId });
  return next;
}

function moveEntry(entries: LauncherEntry[], source: DragSource, targetId?: LauncherId, after = false): LauncherEntry[] {
  const sourceEntry = source.type === "app" ? entries.find(entry => entry.type === "app" && entry.id === source.id) : entries.find(entry => entry.type === "folder" && entry.id === source.id);
  if (!sourceEntry) return source.type === "app" ? removeFromFolder(entries, source.id, targetId) : entries;
  const removed = entries.filter(entry => entry !== sourceEntry);
  const index = targetId ? removed.findIndex(entry => entry.type === "app" && entry.id === targetId) : removed.length;
  const next = [...removed];
  next.splice(index < 0 ? next.length : index + (after ? 1 : 0), 0, sourceEntry);
  return next;
}

function parseDrag(event: React.DragEvent): DragSource | null {
  try {
    const value = JSON.parse(event.dataTransfer.getData("application/x-rich-app-launcher")) as DragSource;
    return value.type === "folder" && typeof value.id === "string" || value.type === "app" && isLauncherId(value.id) ? value : null;
  } catch { return null; }
}

function dropMode(event: React.DragEvent<HTMLButtonElement>): "group" | "before" | "after" {
  const { left, width } = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientX - left) / width;
  return ratio > .26 && ratio < .74 ? "group" : ratio <= .26 ? "before" : "after";
}

export function AppLauncherView() {
  const setAppView = useStore(s => s.setAppView);
  const exitToHome = useStore(s => s.exitToHome);
  const [layout, setLayout] = useState<LauncherEntry[]>(loadLayout);
  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const openFolder = layout.find((entry): entry is LauncherFolder => entry.type === "folder" && entry.id === openFolderId) ?? null;

  function updateLayout(updater: (current: LauncherEntry[]) => LauncherEntry[]) {
    setLayout(current => {
      const next = normalizeLayout(updater(current));
      saveLayout(next);
      return next;
    });
  }

  function openApp(id: AppView) {
    if (id === "tree") exitToHome();
    if (id === "taskWorkbench") localStorage.removeItem("rich.workbench.selected");
    setAppView(id);
  }

  function startDrag(event: React.DragEvent, source: DragSource) {
    setDragging(source);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-rich-app-launcher", JSON.stringify(source));
  }

  function clearDrag() {
    setDragging(null);
    setDropTarget(null);
  }

  function dropOnApp(event: React.DragEvent<HTMLButtonElement>, targetId: LauncherId) {
    event.preventDefault();
    event.stopPropagation();
    const source = parseDrag(event);
    const sourceId = appId(source);
    if (!source || sourceId === targetId) return clearDrag();
    const mode = dropMode(event);
    updateLayout(current => sourceId && mode === "group" ? createFolder(current, sourceId, targetId) : moveEntry(current, source, targetId, mode === "after"));
    clearDrag();
  }

  function dropOnFolder(event: React.DragEvent<HTMLButtonElement>, folderId: string) {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = appId(parseDrag(event));
    if (sourceId) updateLayout(current => moveIntoFolder(current, sourceId, folderId));
    clearDrag();
  }

  return (
    <main className="app-launcher" aria-label="Rich 应用中心">
      <section className="app-launcher__desktop" aria-label="应用列表" onDragOver={event => event.preventDefault()} onDrop={event => {
        if (event.target !== event.currentTarget) return;
        const source = parseDrag(event);
        if (source) updateLayout(current => moveEntry(current, source));
        clearDrag();
      }}>
        {layout.map(entry => entry.type === "app" ? <AppIcon key={entry.id} item={itemById.get(entry.id)!} dragging={dragging?.type === "app" && dragging.id === entry.id} dropTarget={dropTarget === `app:${entry.id}`} onOpen={() => openApp(entry.id)} onDragStart={event => startDrag(event, { type: "app", id: entry.id })} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(`app:${entry.id}`); }} onDragLeave={() => setDropTarget(current => current === `app:${entry.id}` ? null : current)} onDrop={event => dropOnApp(event, entry.id)} onDragEnd={clearDrag} /> : <FolderIcon key={entry.id} folder={entry} dragging={dragging?.type === "folder" && dragging.id === entry.id} dropTarget={dropTarget === `folder:${entry.id}`} onOpen={() => setOpenFolderId(entry.id)} onDragStart={event => startDrag(event, { type: "folder", id: entry.id })} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(`folder:${entry.id}`); }} onDragLeave={() => setDropTarget(current => current === `folder:${entry.id}` ? null : current)} onDrop={event => dropOnFolder(event, entry.id)} onDragEnd={clearDrag} />)}
      </section>
      {openFolder && <section className="app-launcher-folder-backdrop" role="presentation" onClick={() => setOpenFolderId(null)}>
        <section className="app-launcher-folder" role="dialog" aria-modal="true" aria-label={openFolder.label} onClick={event => event.stopPropagation()}>
          <header><h1>{openFolder.label}</h1><button type="button" aria-label="关闭分组" onClick={() => setOpenFolderId(null)}>×</button></header>
          <div className="app-launcher-folder__items">{openFolder.items.map(id => <AppIcon key={id} item={itemById.get(id)!} onOpen={() => openApp(id)} onDragStart={event => startDrag(event, { type: "app", id })} onDragEnd={clearDrag} />)}</div>
          <div className="app-launcher-folder__extract" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const sourceId = appId(parseDrag(event)); if (sourceId) updateLayout(current => removeFromFolder(current, sourceId)); clearDrag(); }}>拖到这里移出分组</div>
        </section>
      </section>}
    </main>
  );
}

type IconProps = { item: LauncherItem; dragging?: boolean; dropTarget?: boolean; onOpen: () => void; onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void; onDragOver?: (event: React.DragEvent<HTMLButtonElement>) => void; onDragLeave?: () => void; onDrop?: (event: React.DragEvent<HTMLButtonElement>) => void; onDragEnd?: () => void; };

function AppIcon({ item, dragging, dropTarget, onOpen, ...dragEvents }: IconProps) {
  return <button type="button" draggable={Boolean(dragEvents.onDragStart)} className={["app-launcher-icon", dragging ? "is-dragging" : "", dropTarget ? "is-drop-target" : ""].filter(Boolean).join(" ")} onClick={onOpen} {...dragEvents}><span className="app-launcher-icon__glyph"><Icon name={item.icon} /></span><strong>{item.label}</strong><small>{item.desc}</small></button>;
}

type FolderProps = Omit<IconProps, "item"> & { folder: LauncherFolder };

function FolderIcon({ folder, dragging, dropTarget, onOpen, ...dragEvents }: FolderProps) {
  return <button type="button" draggable className={["app-launcher-icon", "app-launcher-folder-icon", dragging ? "is-dragging" : "", dropTarget ? "is-drop-target" : ""].filter(Boolean).join(" ")} onClick={onOpen} {...dragEvents}><span className="app-launcher-folder-icon__glyph">{folder.items.slice(0, 4).map(id => <span key={id}><Icon name={itemById.get(id)!.icon} /></span>)}</span><strong>{folder.label}</strong><small>{folder.items.length} 个应用</small></button>;
}

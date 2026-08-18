import { useMemo, useState } from "react";
import { Icon } from "../components/Icon.js";
import { APP_MENU_ITEMS, type AppMenuItem } from "../lib/appCatalog.js";
import { useStore, type AppView } from "../state/store.js";
import "./AppLauncherView.css";

const ORDER_KEY = "rich:app-launcher-order:v1";
type LauncherId = AppView;
type LauncherItem = AppMenuItem;

function loadOrder(): LauncherId[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ORDER_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is LauncherId => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveOrder(items: LauncherItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(items.map(item => item.id)));
}

function sortByOrder(order: LauncherId[]): LauncherItem[] {
  const catalog: LauncherItem[] = [...APP_MENU_ITEMS];
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...catalog].sort((a, b) => {
    const ar = rank.get(a.id) ?? 999;
    const br = rank.get(b.id) ?? 999;
    return ar - br || catalog.findIndex(item => item.id === a.id) - catalog.findIndex(item => item.id === b.id);
  });
}

export function AppLauncherView() {
  const setAppView = useStore(s => s.setAppView);
  const exitToHome = useStore(s => s.exitToHome);
  const [items, setItems] = useState<LauncherItem[]>(() => sortByOrder(loadOrder()));
  const [draggingId, setDraggingId] = useState<LauncherId | null>(null);
  const [dropId, setDropId] = useState<LauncherId | null>(null);
  const subtitle = useMemo(() => `${items.length} 个应用 · 拖拽卡片调整顺序`, [items.length]);

  function openApp(id: AppView) {
    if (id === "tree") exitToHome();
    setAppView(id);
  }

  function moveItem(fromId: LauncherId, toId: LauncherId) {
    if (fromId === toId) return;
    setItems(prev => {
      const from = prev.findIndex(item => item.id === fromId);
      const to = prev.findIndex(item => item.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      saveOrder(next);
      return next;
    });
  }

  function resetOrder() {
    const next = sortByOrder([]);
    setItems(next);
    saveOrder(next);
  }

  return (
    <main className="app-launcher" aria-label="Rich 应用中心">
      <div className="app-launcher__glow app-launcher__glow--left" />
      <div className="app-launcher__glow app-launcher__glow--right" />
      <header className="app-launcher__header">
        <div>
          <p>Rich Apps</p>
          <h1>应用中心</h1>
          <span>{subtitle}</span>
        </div>
        <div className="app-launcher__actions">
          <button type="button" onClick={resetOrder}>恢复默认排序</button>
        </div>
      </header>

      <section className="app-launcher__grid" aria-label="应用列表">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            draggable
            className={[
              "app-launcher-card",
              `app-launcher-card--${item.tone}`,
              draggingId === item.id ? "is-dragging" : "",
              dropId === item.id ? "is-drop-target" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => openApp(item.id)}
            onDragStart={event => {
              setDraggingId(item.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
            }}
            onDragOver={event => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropId(item.id);
            }}
            onDragLeave={() => setDropId(current => current === item.id ? null : current)}
            onDrop={event => {
              event.preventDefault();
              const fromId = event.dataTransfer.getData("text/plain") as LauncherId;
              moveItem(fromId, item.id);
              setDraggingId(null);
              setDropId(null);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropId(null);
            }}
          >
            <span className="app-launcher-card__icon">
              <Icon name={item.icon} />
            </span>
            <span className="app-launcher-card__body">
              <strong>{item.label}</strong>
              <em>{item.desc}</em>
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}

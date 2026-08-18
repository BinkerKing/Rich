import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../components/Icon.js";
import { useStore } from "../state/store.js";
import "./MiniAppsView.css";

type MiniProgramTone = "cyan" | "blue" | "gold" | "green" | "violet" | "slate";

interface MiniProgram {
  id: string;
  label: string;
  desc: string;
  category: string;
  icon: IconName;
  tone: MiniProgramTone;
  path: string | null;
  exists: boolean;
  launchable: boolean;
}

const ORDER_KEY = "rich:mini-program-order:v1";

function loadOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ORDER_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveOrder(programs: MiniProgram[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(programs.map(program => program.id)));
}

function sortPrograms(programs: MiniProgram[], order: string[]) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...programs].sort((a, b) => {
    const ar = rank.get(a.id) ?? 999;
    const br = rank.get(b.id) ?? 999;
    return ar - br || a.label.localeCompare(b.label, "zh-Hans-CN");
  });
}

export function MiniAppsView() {
  const setAppView = useStore(s => s.setAppView);
  const [programs, setPrograms] = useState<MiniProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const subtitle = useMemo(() => `${programs.length} 个小程序 · 来自 Ai-WorkSpace`, [programs.length]);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/mini-programs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { programs?: MiniProgram[] };
      setPrograms(sortPrograms(body.programs ?? [], loadOrder()));
    } catch {
      setMessage("小程序清单读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function launch(program: MiniProgram) {
    if (!program.launchable || !program.exists) return;
    setLaunchingId(program.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/mini-programs/${encodeURIComponent(program.id)}/open`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage(`${program.label}已打开`);
    } catch {
      setMessage(`${program.label}启动失败，请检查工作空间路径`);
    } finally {
      setLaunchingId(null);
      window.setTimeout(() => setMessage(null), 2600);
    }
  }

  function moveProgram(fromId: string, toId: string) {
    if (fromId === toId) return;
    setPrograms(prev => {
      const from = prev.findIndex(program => program.id === fromId);
      const to = prev.findIndex(program => program.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      saveOrder(next);
      return next;
    });
  }

  return (
    <main className="mini-apps" aria-label="Rich 小程序">
      <header className="mini-apps__header">
        <div>
          <button type="button" className="mini-apps__back" onClick={() => setAppView("apps")}>
            ← 应用中心
          </button>
          <p>Rich Mini Apps</p>
          <h1>小程序</h1>
          <span>{loading ? "正在读取工作空间..." : subtitle}</span>
        </div>
        <div className="mini-apps__actions">
          {message && <span className="mini-apps__status">{message}</span>}
          <button type="button" onClick={() => void refresh()}>刷新</button>
        </div>
      </header>

      <section className="mini-apps__grid" aria-label="小程序列表">
        {programs.map(program => (
          <article
            key={program.id}
            draggable
            className={[
              "mini-app-card",
              `mini-app-card--${program.tone}`,
              draggingId === program.id ? "is-dragging" : "",
              dropId === program.id ? "is-drop-target" : "",
              !program.exists ? "is-missing" : "",
            ].filter(Boolean).join(" ")}
            onDragStart={event => {
              setDraggingId(program.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", program.id);
            }}
            onDragOver={event => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropId(program.id);
            }}
            onDragLeave={() => setDropId(current => current === program.id ? null : current)}
            onDrop={event => {
              event.preventDefault();
              moveProgram(event.dataTransfer.getData("text/plain"), program.id);
              setDraggingId(null);
              setDropId(null);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropId(null);
            }}
          >
            <div className="mini-app-card__top">
              <span className="mini-app-card__icon"><Icon name={program.icon} /></span>
              <span className="mini-app-card__tag">{program.category}</span>
            </div>
            <div className="mini-app-card__body">
              <h2>{program.label}</h2>
              <p>{program.desc}</p>
              <code>{program.path ?? "未找到入口文件"}</code>
            </div>
            <div className="mini-app-card__actions">
              <span className={program.exists ? "mini-app-card__ok" : "mini-app-card__bad"}>
                {program.exists ? "入口可用" : "入口缺失"}
              </span>
              <button
                type="button"
                disabled={!program.exists || launchingId === program.id}
                onClick={() => void launch(program)}
              >
                {launchingId === program.id ? "启动中..." : "启动"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

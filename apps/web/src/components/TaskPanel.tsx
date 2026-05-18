import { useStore } from "../state/store.js";
import type { TaskRecord } from "../state/store.js";
import "./TaskPanel.css";

const KIND_LABEL: Record<string, string> = {
  generate: "生成",
  refine: "细化",
  expand: "展开",
  extend: "延伸",
  path: "路径",
  hydrate: "加载",
};

function elapsed(t: TaskRecord): string {
  const end = t.finishedAt ?? Date.now();
  const s = Math.max(0, Math.round((end - t.startedAt) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`;
}

export function TaskPanel() {
  const tasks = useStore(s => s.tasks);
  const enterTree = useStore(s => s.enterTree);

  if (tasks.length === 0) return null;

  const running = tasks.filter(t => t.status === "running").length;

  return (
    <aside className="task-panel" aria-label="任务列表">
      <header>
        <strong>任务</strong>
        {running > 0 && <span className="task-panel__badge">{running} 进行中</span>}
      </header>
      <ol>
        {tasks.map(t => (
          <li key={t.id} className={`task-item task-item--${t.status}`}>
            <div className="task-item__head">
              <span className={`task-item__dot task-item__dot--${t.status}`} aria-hidden="true" />
              <span className="task-item__kind">{KIND_LABEL[t.kind] ?? t.kind}</span>
              <span className="task-item__elapsed">{elapsed(t)}</span>
            </div>
            <div className="task-item__title">{t.title}</div>
            {t.status === "done" && t.summary && (
              <div className="task-item__summary">{t.summary}</div>
            )}
            {t.status === "error" && t.error && (
              <div className="task-item__error">{t.error}</div>
            )}
            {t.status === "done" && t.kind === "generate" && t.rootId && (
              <button
                type="button"
                className="task-item__action"
                onClick={() => void enterTree(t.rootId!)}
              >
                查看树 →
              </button>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}

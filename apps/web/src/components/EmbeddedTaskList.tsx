import { useMemo } from "react";
import { useStore } from "../state/store.js";
import type { TaskRecord } from "../state/store.js";
import "./EmbeddedTaskList.css";

const KIND_LABEL: Record<string, string> = {
  generate: "生成",
  refine: "细化",
  expand: "展开",
  extend: "延伸",
  feedback: "反馈",
  path: "路径",
  hydrate: "加载",
};

function elapsed(t: TaskRecord): string {
  const end = t.finishedAt ?? Date.now();
  const s = Math.max(0, Math.round((end - t.startedAt) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`;
}

interface Props {
  /** When given, scope to this element (+ all generate tasks). When omitted = show all. */
  elementId?: string;
  /** When true (default with elementId), restrict to that element. When false, show all. */
  scopeToElement?: boolean;
  /** Max items to show before scrolling. */
  limit?: number;
}

export function EmbeddedTaskList({ elementId, scopeToElement = true, limit = 8 }: Props) {
  const tasks = useStore(s => s.tasks);
  const enterTree = useStore(s => s.enterTree);
  const enterAtElement = useStore(s => s.enterAtElement);
  const filtered = useMemo(() => {
    const xs = elementId && scopeToElement
      ? tasks.filter(t => t.elementId === elementId || t.kind === "generate")
      : tasks;
    return xs.slice(0, limit);
  }, [tasks, elementId, scopeToElement, limit]);

  const running = filtered.filter(t => t.status === "running").length;

  return (
    <section className="embedded-tasks" aria-label="AI 任务">
      <header>
        <strong>AI 任务</strong>
        {running > 0 && <span className="embedded-tasks__badge">{running} 进行中</span>}
        {running === 0 && filtered.length > 0 && <span className="embedded-tasks__hint">{filtered.length} 条</span>}
      </header>
      {filtered.length === 0 ? (
        <div className="embedded-tasks__empty">点 细化 / 展开 / 延伸 / 反馈 / 深入分析 后会在这里看到任务状态</div>
      ) : (
        <ol>
          {filtered.map(t => {
            // generate → jump to that tree's root; everything else with an
            // elementId → jump to that exact element. Running tasks aren't
            // clickable (we don't want to navigate mid-stream).
            const isGenerate = t.kind === "generate" && !!t.rootId;
            const hasElement = !!t.elementId;
            const navigable = t.status !== "running" && (isGenerate || hasElement);
            const onClick = navigable
              ? (isGenerate
                  ? () => void enterTree(t.rootId!)
                  : () => void enterAtElement(t.elementId!))
              : undefined;
            return (
              <li
                key={t.id}
                className={`embedded-task embedded-task--${t.status}${navigable ? " is-navigable" : ""}`}
                onClick={onClick}
                role={navigable ? "button" : undefined}
                tabIndex={navigable ? 0 : undefined}
                onKeyDown={navigable ? (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
                } : undefined}
                title={navigable ? (isGenerate ? "点击进入这棵知识树" : "点击跳转到对应元") : undefined}
              >
                <div className="embedded-task__head">
                  <span className={`embedded-task__dot embedded-task__dot--${t.status}`} aria-hidden="true" />
                  <span className="embedded-task__kind">{KIND_LABEL[t.kind] ?? t.kind}</span>
                  <span className="embedded-task__elapsed">{elapsed(t)}</span>
                </div>
                <div className="embedded-task__title">{t.title}</div>
                {t.status === "done" && t.summary && (
                  <div className="embedded-task__summary">{t.summary}</div>
                )}
                {t.status === "error" && t.error && (
                  <div className="embedded-task__error">{t.error}</div>
                )}
                {navigable && (
                  <span className="embedded-task__hint">{isGenerate ? "点击进入 →" : "点击跳转到对应元 →"}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

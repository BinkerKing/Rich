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
  "daily-news": "早报",
  "ai-search": "AI 搜索",
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
  const markTaskViewed = useStore(s => s.markTaskViewed);
  const removeTask = useStore(s => s.removeTask);
  const retryTask = useStore(s => s.retryTask);
  const openHomeAnalysisTab = useStore(s => s.openHomeAnalysisTab);
  const filtered = useMemo(() => {
    const visible = tasks.filter(t => !t.hidden);
    if (elementId && scopeToElement) {
      // Scoped mode (element detail panel): only tasks bound to THIS element.
      // No cap — show all of them, since the user explicitly wants to see
      // the full history for this element.
      return visible.filter(t => t.elementId === elementId);
    }
    return visible.slice(0, limit);
  }, [tasks, elementId, scopeToElement, limit]);

  return (
    <section className="embedded-tasks" aria-label="任务列表">
      {/* Status info moved to the SystemPanel header so the inline view is just
       *  the task list itself — no duplicate title, no header line. */}
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
            const isAiSearch = t.kind === "ai-search" && !!t.analysisId;
            const navigable = t.status !== "running" && (isGenerate || hasElement || isAiSearch);
            const unread = t.status === "done" && !t.viewed && navigable;
            const onClick = navigable
              ? () => {
                  markTaskViewed(t.id);
                  if (isAiSearch) openHomeAnalysisTab(t.analysisId!);
                  else if (isGenerate) void enterTree(t.rootId!);
                  else void enterAtElement(t.elementId!);
                }
              : undefined;
            return (
              <li
                key={t.id}
                className={`embedded-task embedded-task--${t.status} embedded-task--kind-${t.kind}${navigable ? " is-navigable" : ""}${unread ? " is-unread" : ""}`}
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
                  <span
                    role="button"
                    tabIndex={0}
                    className="embedded-task__remove"
                    aria-label="删除任务"
                    title={t.status === "running" ? "从列表移除（不会停止服务端任务）" : "删除任务"}
                    onClick={e => { e.stopPropagation(); removeTask(t.id); }}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        removeTask(t.id);
                      }
                    }}
                  >×</span>
                </div>
                <div className="embedded-task__title">{t.title}</div>
                {t.status === "done" && t.summary && (
                  <div className="embedded-task__summary">{t.summary}</div>
                )}
                {t.status === "error" && t.error && (
                  <div className="embedded-task__error">{t.error}</div>
                )}
                {t.status === "error" && (
                  <button
                    type="button"
                    className="embedded-task__retry"
                    onClick={e => { e.stopPropagation(); void retryTask(t.id); }}
                    title={t.retryArgs
                      ? "重新跑这个任务（用相同参数）"
                      : "重新跑这个任务（旧任务用 title 推断参数，richness 默认中档）"}
                  >
                    ↻ 重跑
                  </button>
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

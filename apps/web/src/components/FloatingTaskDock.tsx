import { useStore } from "../state/store.js";
import "./FloatingTaskDock.css";

const KIND_LABEL: Record<string, string> = {
  generate: "生成",
  refine: "细化",
  expand: "展开",
  extend: "延伸",
  feedback: "反馈",
  path: "路径",
  "daily-news": "早报",
  "ai-search": "AI 搜索",
  mindmap: "导图",
  "image-gen": "封面",
  "greatme-brain": "计划管理",
};

function elapsed(startedAt: number, finishedAt: number | undefined): string {
  const end = finishedAt ?? Date.now();
  const s = Math.max(0, Math.round((end - startedAt) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`;
}

/**
 * Floating task dock anchored at the bottom-right of the window.
 *
 * Replaces both the old FooterTaskStrip (gone with the footer) AND the
 * embedded right-rail task list. Each running / unviewed-done task is a
 * card. Cards stack upward — the column uses `flex-direction:
 * column-reverse` so newer tasks render at the bottom (nearest the
 * corner) and older ones drift up.
 *
 * Cards are transparent with only a 1px border, matching the rest of the
 * black-canvas pass.
 */
export function FloatingTaskDock() {
  const tasks = useStore(s => s.tasks);
  const enterTree = useStore(s => s.enterTree);
  const enterAtElement = useStore(s => s.enterAtElement);
  const markTaskViewed = useStore(s => s.markTaskViewed);
  const openHomeAnalysisTab = useStore(s => s.openHomeAnalysisTab);

  const live = tasks.filter(t =>
    !t.hidden && (
      t.status === "running" ||
      (t.status === "done" && !t.viewed)
    ),
  );
  if (live.length === 0) return null;

  // `tasks` from the store is newest-first. With column-reverse on the
  // container the newest ends up at the bottom (closest to the corner)
  // and older items push upward — that's the "从右下角往上新增" feel.
  return (
    <div className="floating-task-dock" role="status" aria-label="任务列表">
      {live.map(t => {
        const isGenerate = t.kind === "generate" && !!t.rootId;
        const hasElement = !!t.elementId;
        const isAiSearch = t.kind === "ai-search" && !!t.analysisId;
        const navigable = t.status !== "running" && (isGenerate || hasElement || isAiSearch);
        const onClick = navigable
          ? () => {
              markTaskViewed(t.id);
              if (isAiSearch) openHomeAnalysisTab(t.analysisId!);
              else if (isGenerate) void enterTree(t.rootId!);
              else void enterAtElement(t.elementId!);
            }
          : undefined;
        const unread = t.status === "done" && !t.viewed && navigable;
        return (
          <button
            key={t.id}
            type="button"
            className={`floating-task floating-task--${t.status} floating-task--kind-${t.kind}${unread ? " is-unread" : ""}${navigable ? " is-navigable" : ""}`}
            onClick={onClick}
            disabled={!navigable}
            title={t.title}
          >
            <span className="floating-task__kind">{KIND_LABEL[t.kind] ?? t.kind}</span>
            <span className="floating-task__title">{t.title}</span>
            <span className="floating-task__elapsed">{elapsed(t.startedAt, t.finishedAt)}</span>
          </button>
        );
      })}
    </div>
  );
}

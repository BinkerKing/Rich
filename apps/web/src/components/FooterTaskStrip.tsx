import { useStore } from "../state/store.js";
import "./FooterTaskStrip.css";

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

function elapsed(startedAt: number, finishedAt: number | undefined): string {
  const end = finishedAt ?? Date.now();
  const s = Math.max(0, Math.round((end - startedAt) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`;
}

/**
 * Compact task strip that lives in the bottom-bar of each view. Only shows
 * tasks that demand attention: in-flight (running) + completed-but-unviewed.
 * Click → jump to the relevant tree/element AND mark viewed → chip disappears.
 *
 * Visual states match EmbeddedTaskList's: running = "charging" pulse +
 * shimmer, unviewed done = gold breathing. Errors and viewed-dones stay in
 * the right-rail task list (this strip is the live attention layer only).
 */
export function FooterTaskStrip() {
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

  return (
    <div className="footer-task-strip" role="status" aria-label="进行中 / 待查看任务">
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
            className={`footer-task footer-task--${t.status} footer-task--kind-${t.kind}${unread ? " is-unread" : ""}${navigable ? " is-navigable" : ""}`}
            onClick={onClick}
            disabled={!navigable}
            title={t.title}
          >
            <span className="footer-task__kind">{KIND_LABEL[t.kind] ?? t.kind}</span>
            <span className="footer-task__title">{t.title}</span>
            <span className="footer-task__elapsed">{elapsed(t.startedAt, t.finishedAt)}</span>
          </button>
        );
      })}
    </div>
  );
}

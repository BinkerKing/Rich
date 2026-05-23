import { useEffect, useMemo, useState } from "react";
import type { TaskRecord, TaskStatus } from "../state/store.js";
import { TASKS_STORAGE_KEY } from "../state/store.js";

const KIND_LABEL: Record<string, string> = {
  generate: "生成知识树",
  refine: "细化",
  expand: "展开",
  extend: "延伸",
  feedback: "反馈整改",
  path: "学习路径",
  "daily-news": "AI 早报",
  "ai-search": "AI 定位",
  mindmap: "思维导图",
  "image-gen": "图像生成",
  "greatme-brain": "计划管理",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  running: "进行中",
  done: "已完成",
  error: "失败",
};

function readTasks(): TaskRecord[] {
  try {
    const raw = window.localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TaskRecord[];
    return Array.isArray(parsed) ? parsed.filter(t => !t.hidden) : [];
  } catch {
    return [];
  }
}

function elapsed(task: TaskRecord): string {
  const end = task.finishedAt ?? Date.now();
  const seconds = Math.max(0, Math.round((end - task.startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}m${rest ? ` ${rest}s` : ""}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function shortTitle(title: string) {
  return title.length > 32 ? `${title.slice(0, 31)}...` : title;
}

export function OverlayTaskView() {
  const [tasks, setTasks] = useState<TaskRecord[]>(() => readTasks());

  useEffect(() => {
    document.documentElement.classList.add("is-overlay-window");

    const refresh = () => setTasks(readTasks());
    const tick = window.setInterval(refresh, 1_000);
    window.addEventListener("storage", refresh);

    return () => {
      document.documentElement.classList.remove("is-overlay-window");
      window.clearInterval(tick);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const visibleTasks = useMemo(() => {
    const attention = tasks.filter(t =>
      t.status === "running" ||
      t.status === "error" ||
      (t.status === "done" && !t.viewed),
    );
    const source = attention.length > 0 ? attention : tasks;
    return source.slice(0, 6);
  }, [tasks]);

  const counts = useMemo(() => ({
    running: tasks.filter(t => t.status === "running").length,
    error: tasks.filter(t => t.status === "error").length,
    done: tasks.filter(t => t.status === "done").length,
  }), [tasks]);

  const activeCount = counts.running + counts.error;

  return (
    <main className="overlay-task-view" aria-label="悬浮任务监控">
      <section className={`overlay-task-panel${activeCount > 0 ? " has-active" : ""}`}>
        <header className="overlay-task-panel__header">
          <div>
            <span className="overlay-task-panel__eyebrow">Rich Overlay</span>
            <h1>任务监控</h1>
          </div>
          <div className={`overlay-task-panel__state${counts.running > 0 ? " is-running" : ""}`}>
            {counts.running > 0 ? `${counts.running} 运行` : "空闲"}
          </div>
        </header>

        <div className="overlay-task-panel__metrics" aria-hidden="true">
          <span><strong>{counts.running}</strong> 运行</span>
          <span><strong>{counts.error}</strong> 异常</span>
          <span><strong>{counts.done}</strong> 完成</span>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="overlay-task-panel__empty">
            <span className="overlay-task-panel__empty-dot" />
            当前没有任务
          </div>
        ) : (
          <ol className="overlay-task-list">
            {visibleTasks.map(task => (
              <li key={task.id} className={`overlay-task overlay-task--${task.status} overlay-task--kind-${task.kind}`}>
                <div className="overlay-task__rail" />
                <div className="overlay-task__body">
                  <div className="overlay-task__topline">
                    <span className="overlay-task__kind">{KIND_LABEL[task.kind] ?? task.kind}</span>
                    <span className="overlay-task__elapsed">{elapsed(task)}</span>
                  </div>
                  <div className="overlay-task__title">{shortTitle(task.title)}</div>
                  <div className="overlay-task__meta">
                    <span>{STATUS_LABEL[task.status]}</span>
                    {task.summary ? <span>{shortTitle(task.summary)}</span> : null}
                    {task.error ? <span>{shortTitle(task.error)}</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

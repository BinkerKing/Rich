// apps/web/src/components/AIDecomposeModal.tsx
//
// Stage 3b: AI 计划拆解弹窗
// 4 个状态：input（输入意图）→ loading（可取消）→ preview（可编辑树）→ accept
// 父组件拿到 DecomposePreview 后负责落库（plan + goals + tasks 一次性 setState）。
import { useRef, useState, type ReactNode } from "react";
import "./AIDecomposeModal.css";

type GoalScope = "year" | "month" | "week";
type PlanScope = "year" | "month" | "week" | "day";

export interface DecomposeGoalDraft {
  tempId: string;
  scope: GoalScope;
  title: string;
  detail: string;
  due: string;
  parentTempId?: string;
  metric?: { unit: string; target: number };
  /** 本地：用户在预览里勾掉的 */
  excluded: boolean;
  /** 本地：用户在预览里加的 */
  userAdded: boolean;
}

export interface DecomposeTaskDraft {
  tempId: string;
  title: string;
  date: string;
  goalTempId?: string;
  badge: string;
  note: string;
  excluded: boolean;
  userAdded: boolean;
}

export interface DecomposePreview {
  plan: { title: string; detail: string; start: string; end: string; scopes: PlanScope[] };
  goals: DecomposeGoalDraft[];
  tasks: DecomposeTaskDraft[];
  reasoning: string;
}

interface Props {
  onAccept: (preview: DecomposePreview) => void;
  onCancel: () => void;
}

const SCOPE_LABEL: Record<GoalScope, string> = { year: "年度", month: "月度", week: "周度" };
const SCOPE_ORDER: Record<GoalScope, number> = { year: 0, month: 1, week: 2 };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AIDecomposeModal({ onAccept, onCancel }: Props): ReactNode {
  const [step, setStep] = useState<"input" | "loading" | "preview" | "error">("input");
  const [intent, setIntent] = useState("");
  const [targetEnd, setTargetEnd] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<DecomposePreview | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- 输入步骤 ----
  const decompose = async (): Promise<void> => {
    const i = intent.trim();
    if (i.length < 2) return;
    setStep("loading");
    setErrorMsg("");
    abortRef.current = new AbortController();
    try {
      const r = await fetch("/api/ai/decompose-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: i, targetEnd: targetEnd || undefined }),
        signal: abortRef.current.signal,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const body = await r.json() as {
        result: {
          plan: DecomposePreview["plan"];
          goals: Array<Omit<DecomposeGoalDraft, "excluded" | "userAdded" | "detail"> & { detail?: string }>;
          tasks: Array<Omit<DecomposeTaskDraft, "tempId" | "excluded" | "userAdded"> & { note?: string; badge?: string }>;
          reasoning: string;
        };
      };
      const result = body.result;
      setPreview({
        plan: result.plan,
        goals: result.goals.map(g => ({
          tempId: g.tempId,
          scope: g.scope,
          title: g.title,
          detail: g.detail ?? "",
          due: g.due,
          parentTempId: g.parentTempId,
          metric: g.metric,
          excluded: false,
          userAdded: false,
        })),
        tasks: result.tasks.map((t, idx) => ({
          tempId: `t${idx}`,
          title: t.title,
          date: t.date,
          goalTempId: t.goalTempId,
          badge: t.badge ?? "",
          note: t.note ?? "",
          excluded: false,
          userAdded: false,
        })),
        reasoning: result.reasoning ?? "",
      });
      setStep("preview");
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name === "AbortError") {
        setStep("input");
        return;
      }
      setErrorMsg(e.message ?? String(err));
      setStep("error");
    }
  };

  const cancelLoading = (): void => {
    abortRef.current?.abort();
  };

  // ---- 预览步骤的编辑工具 ----
  const updatePlan = (patch: Partial<DecomposePreview["plan"]>): void => {
    if (!preview) return;
    setPreview({ ...preview, plan: { ...preview.plan, ...patch } });
  };
  const toggleGoalExcluded = (tempId: string): void => {
    if (!preview) return;
    setPreview({
      ...preview,
      goals: preview.goals.map(g => g.tempId === tempId ? { ...g, excluded: !g.excluded } : g),
    });
  };
  const updateGoalTitle = (tempId: string, title: string): void => {
    if (!preview) return;
    setPreview({
      ...preview,
      goals: preview.goals.map(g => g.tempId === tempId ? { ...g, title } : g),
    });
  };
  const updateGoalDue = (tempId: string, due: string): void => {
    if (!preview) return;
    setPreview({
      ...preview,
      goals: preview.goals.map(g => g.tempId === tempId ? { ...g, due } : g),
    });
  };
  const deleteGoal = (tempId: string): void => {
    if (!preview) return;
    // 软删：标 excluded（也连带把下游 task 看作 excluded — confirm 时处理）
    toggleGoalExcluded(tempId);
  };
  const addGoal = (scope: GoalScope, parentTempId?: string): void => {
    if (!preview) return;
    const tempId = uid("g");
    setPreview({
      ...preview,
      goals: [
        ...preview.goals,
        {
          tempId, scope, parentTempId,
          title: `新增${SCOPE_LABEL[scope]}目标`,
          detail: "",
          due: preview.plan.end,
          excluded: false,
          userAdded: true,
        },
      ],
    });
  };
  const toggleTaskExcluded = (tempId: string): void => {
    if (!preview) return;
    setPreview({
      ...preview,
      tasks: preview.tasks.map(t => t.tempId === tempId ? { ...t, excluded: !t.excluded } : t),
    });
  };
  const updateTask = (tempId: string, patch: Partial<DecomposeTaskDraft>): void => {
    if (!preview) return;
    setPreview({
      ...preview,
      tasks: preview.tasks.map(t => t.tempId === tempId ? { ...t, ...patch } : t),
    });
  };
  const deleteTask = (tempId: string): void => toggleTaskExcluded(tempId);
  const addTask = (goalTempId: string): void => {
    if (!preview) return;
    setPreview({
      ...preview,
      tasks: [
        ...preview.tasks,
        {
          tempId: uid("t"),
          title: "新增任务",
          date: todayYmd(),
          goalTempId,
          badge: "",
          note: "",
          excluded: false,
          userAdded: true,
        },
      ],
    });
  };

  const handleConfirm = (): void => {
    if (!preview) return;
    onAccept(preview);
  };

  // ---- 渲染 ----
  return (
    <div className="ai-dec-back" onClick={onCancel}>
      <div className={`ai-dec-modal ai-dec-modal--${step}`} onClick={e => e.stopPropagation()}>
        <div className="ai-dec-head">
          <div className="ai-dec-title">🪄 AI 拆解计划</div>
          <button className="ai-dec-close" onClick={onCancel}>×</button>
        </div>

        {step === "input" && (
          <div className="ai-dec-body">
            <label className="ai-dec-field">
              <span className="ai-dec-label">告诉 Rich 你想做什么</span>
              <textarea className="ai-dec-textarea" rows={3} autoFocus
                placeholder="例：我想 3 个月减 10 斤，从慢跑和控糖开始 / 读完《思考快与慢》"
                value={intent} onChange={e => setIntent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && intent.trim().length >= 2) decompose();
                }} />
            </label>
            <label className="ai-dec-field">
              <span className="ai-dec-label">目标完成日期（可选 — 不填 AI 自己判断）</span>
              <input className="ai-dec-input" type="date"
                value={targetEnd} onChange={e => setTargetEnd(e.target.value)} />
            </label>
            <div className="ai-dec-hint">
              · AI 会根据时长自己决定要不要年/月/周/日完整层级<br/>
              · 拆解大概需要 30-90 秒，期间可以随时取消<br/>
              · 拆出来的树你可以编辑、删除、补充再落库
            </div>
            <div className="ai-dec-foot">
              <button className="ai-dec-btn" onClick={onCancel}>取消</button>
              <button className="ai-dec-btn is-primary"
                disabled={intent.trim().length < 2}
                onClick={() => void decompose()}>开始拆解</button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="ai-dec-body ai-dec-loading">
            <div className="ai-dec-spinner" />
            <div className="ai-dec-loading__title">Hermes 正在拆解…</div>
            <div className="ai-dec-loading__sub">{intent}</div>
            <div className="ai-dec-loading__hint">通常 30-90 秒</div>
            <button className="ai-dec-btn" onClick={cancelLoading}>取消</button>
          </div>
        )}

        {step === "error" && (
          <div className="ai-dec-body">
            <div className="ai-dec-error">{errorMsg || "拆解失败"}</div>
            <div className="ai-dec-foot">
              <button className="ai-dec-btn" onClick={onCancel}>关闭</button>
              <button className="ai-dec-btn is-primary" onClick={() => setStep("input")}>重试</button>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <PreviewBody
            preview={preview}
            updatePlan={updatePlan}
            toggleGoalExcluded={toggleGoalExcluded}
            updateGoalTitle={updateGoalTitle}
            updateGoalDue={updateGoalDue}
            deleteGoal={deleteGoal}
            addGoal={addGoal}
            toggleTaskExcluded={toggleTaskExcluded}
            updateTask={updateTask}
            deleteTask={deleteTask}
            addTask={addTask}
            onCancel={onCancel}
            onConfirm={handleConfirm} />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 预览体 — 树形结构 + 行内编辑
// ----------------------------------------------------------------------
interface PreviewBodyProps {
  preview: DecomposePreview;
  updatePlan: (patch: Partial<DecomposePreview["plan"]>) => void;
  toggleGoalExcluded: (tempId: string) => void;
  updateGoalTitle: (tempId: string, title: string) => void;
  updateGoalDue: (tempId: string, due: string) => void;
  deleteGoal: (tempId: string) => void;
  addGoal: (scope: GoalScope, parentTempId?: string) => void;
  toggleTaskExcluded: (tempId: string) => void;
  updateTask: (tempId: string, patch: Partial<DecomposeTaskDraft>) => void;
  deleteTask: (tempId: string) => void;
  addTask: (goalTempId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function PreviewBody(p: PreviewBodyProps): ReactNode {
  const { preview } = p;

  // 树的根：parentTempId 为空的目标
  const roots = preview.goals
    .filter(g => !g.parentTempId)
    .sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope]);
  // 提示有哪些 scope（来自 plan.scopes，但排除 day —— task 不是 goal）
  const usableScopes = preview.plan.scopes.filter((s): s is GoalScope => s !== "day");

  const counts = {
    goals: preview.goals.filter(g => !g.excluded).length,
    tasks: preview.tasks.filter(t => !t.excluded).length,
  };

  return (
    <div className="ai-dec-body ai-dec-preview">
      {/* 计划头 */}
      <div className="ai-dec-plan-head">
        <input className="ai-dec-plan-title" value={preview.plan.title}
          onChange={e => p.updatePlan({ title: e.target.value })} />
        <div className="ai-dec-plan-meta">
          <input className="ai-dec-date" type="date" value={preview.plan.start}
            onChange={e => p.updatePlan({ start: e.target.value })} />
          <span>→</span>
          <input className="ai-dec-date" type="date" value={preview.plan.end}
            onChange={e => p.updatePlan({ end: e.target.value })} />
          <span className="ai-dec-scope-tags">
            {preview.plan.scopes.map(s => <span key={s} className="ai-dec-scope-tag">{s}</span>)}
          </span>
        </div>
        {preview.reasoning && (
          <div className="ai-dec-reasoning">💡 {preview.reasoning}</div>
        )}
      </div>

      {/* 目标树 */}
      <div className="ai-dec-tree">
        {roots.length === 0 && (
          <div className="ai-dec-empty">还没有目标。下方按 + 添加一个开始。</div>
        )}
        {roots.map(root => (
          <GoalNode key={root.tempId} goal={root} {...p} />
        ))}
        <div className="ai-dec-add-row">
          {usableScopes.map(s => (
            <button key={s} className="ai-dec-add-btn" onClick={() => p.addGoal(s)}>
              + 顶层{SCOPE_LABEL[s]}目标
            </button>
          ))}
        </div>
      </div>

      {/* 没挂到任何目标的孤儿任务 */}
      {(() => {
        const orphans = preview.tasks.filter(t =>
          !t.goalTempId || !preview.goals.some(g => g.tempId === t.goalTempId));
        if (orphans.length === 0) return null;
        return (
          <div className="ai-dec-orphans">
            <div className="ai-dec-orphans__head">未挂到目标的任务（直接挂到计划）</div>
            {orphans.map(t => (
              <TaskRow key={t.tempId} task={t} {...p} />
            ))}
          </div>
        );
      })()}

      <div className="ai-dec-foot">
        <span className="ai-dec-counts">将创建 {counts.goals} 个目标 · {counts.tasks} 个任务</span>
        <div style={{ flex: 1 }} />
        <button className="ai-dec-btn" onClick={p.onCancel}>取消</button>
        <button className="ai-dec-btn is-primary"
          disabled={preview.plan.title.trim().length === 0 || counts.goals === 0}
          onClick={p.onConfirm}>确认 创建计划</button>
      </div>
    </div>
  );
}

// 一个目标节点（递归渲染子目标 + 它的任务）
function GoalNode({ goal, ...p }: { goal: DecomposeGoalDraft } & PreviewBodyProps): ReactNode {
  const children = p.preview.goals
    .filter(g => g.parentTempId === goal.tempId)
    .sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope]);
  const ownTasks = p.preview.tasks.filter(t => t.goalTempId === goal.tempId);
  // 下一层 scope（如果当前 scope 是 week，则没有下一层 goal scope；只能加 task）
  const nextScope: GoalScope | null =
    goal.scope === "year" ? "month" :
    goal.scope === "month" ? "week" :
    null;

  return (
    <div className={`ai-dec-node ai-dec-node--${goal.scope} ${goal.excluded ? "is-excluded" : ""}`}>
      <div className="ai-dec-goal-row">
        <input type="checkbox" className="ai-dec-check"
          checked={!goal.excluded}
          onChange={() => p.toggleGoalExcluded(goal.tempId)} />
        <span className="ai-dec-scope-pill">{SCOPE_LABEL[goal.scope]}</span>
        <input className="ai-dec-goal-title" value={goal.title}
          onChange={e => p.updateGoalTitle(goal.tempId, e.target.value)} />
        <input className="ai-dec-date ai-dec-date--mini" type="date" value={goal.due}
          onChange={e => p.updateGoalDue(goal.tempId, e.target.value)} />
        {goal.userAdded && <span className="ai-dec-pill ai-dec-pill--user">手动</span>}
        <button className="ai-dec-icon-btn" title="删除"
          onClick={() => p.deleteGoal(goal.tempId)}>×</button>
      </div>

      <div className="ai-dec-node-children">
        {children.map(c => <GoalNode key={c.tempId} goal={c} {...p} />)}
        {nextScope && (
          <button className="ai-dec-add-btn ai-dec-add-btn--inline"
            onClick={() => p.addGoal(nextScope, goal.tempId)}>
            + 子{SCOPE_LABEL[nextScope]}目标
          </button>
        )}
        {ownTasks.map(t => <TaskRow key={t.tempId} task={t} {...p} />)}
        {/* week 目标可以直接挂任务 */}
        {goal.scope === "week" && (
          <button className="ai-dec-add-btn ai-dec-add-btn--inline ai-dec-add-btn--task"
            onClick={() => p.addTask(goal.tempId)}>+ 任务</button>
        )}
        {/* 若树里没有 week 层，month 目标也允许挂 task */}
        {goal.scope === "month" && !p.preview.plan.scopes.includes("week") && (
          <button className="ai-dec-add-btn ai-dec-add-btn--inline ai-dec-add-btn--task"
            onClick={() => p.addTask(goal.tempId)}>+ 任务</button>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, ...p }: { task: DecomposeTaskDraft } & PreviewBodyProps): ReactNode {
  return (
    <div className={`ai-dec-task-row ${task.excluded ? "is-excluded" : ""}`}>
      <input type="checkbox" className="ai-dec-check"
        checked={!task.excluded}
        onChange={() => p.toggleTaskExcluded(task.tempId)} />
      <span className="ai-dec-task-dot">·</span>
      <input className="ai-dec-task-title" value={task.title}
        onChange={e => p.updateTask(task.tempId, { title: e.target.value })} />
      <input className="ai-dec-date ai-dec-date--mini" type="date" value={task.date}
        onChange={e => p.updateTask(task.tempId, { date: e.target.value })} />
      {task.userAdded && <span className="ai-dec-pill ai-dec-pill--user">手动</span>}
      <button className="ai-dec-icon-btn" title="删除"
        onClick={() => p.deleteTask(task.tempId)}>×</button>
    </div>
  );
}

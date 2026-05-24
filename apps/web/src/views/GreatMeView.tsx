import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { api } from "../api/client.js";
import { migrateLegacyGoals, computePlanProgress } from "@ke/domain";
import type { Plan, Metric } from "@ke/domain";
import { NewPlanModal } from "../components/NewPlanModal.js";
import { AIDecomposeModal, type DecomposePreview } from "../components/AIDecomposeModal.js";
import { PlanDetailView } from "./PlanDetailView.js";
import {
  computeOverallKPIs, computePlanHealth,
  findOverdueTasks, findStuckGoals, findGoalsWithoutTasks, findOrphanTasks,
  type PlanHealth, type PlanHealthStatus,
} from "../lib/analytics.js";
import "./GreatMeView.css";

/* =============================================================
 * GreatMe — TheGreatMe Mac 风格的单机版个人指挥舱
 * 7 个主区：首页 / 目标管理 / 事件洞察 / 数据分析 / 每周复盘 / 对话详情 / 设置
 * 视觉对齐：暖琥珀 + 近黑，详见 GreatMeView.css
 * ============================================================= */

type SectionId = "home" | "goals" | "events" | "analytics" | "weekly_review" | "mission_control" | "settings";
type RangeId = "week" | "month" | "year" | "all" | "custom";
type Phase = "calibrate" | "execute" | "review" | "close";
type HQPersonality = "nova" | "strict" | "warm" | "custom";

interface Goal {
  id: string;
  scope: "year" | "month" | "week";
  title: string;
  detail: string;
  phase: Phase;
  due: string;
  progress: number;
  createdAt: number;
  /** Plan 归属。老数据可能没有；migrate 后会补齐 */
  planId?: string;
  parentId?: string;
  source?: "user" | "ai" | "ai-confirmed";
  metric?: Metric;
}
interface Task {
  id: string;
  title: string;
  done: boolean;
  date: string;
  badge: string;
  goalId: string;
  note: string;
  source?: "user" | "ai" | "ai-template";
  metric?: Metric;
  archived?: boolean;
}
interface EventItem { id: string; title: string; heat: number; category: string; updatedAt: number; notes: { at: number; text: string }[] }
interface Daily { date: string; tomorrowPlan: string; doingToday: string; meditation: string; victoryBlocker: string; nightReport: string }
interface ReviewPerspective { dimension: string; content: string }
interface Review {
  id: string; weekOf: string; score: number;
  victory: string[]; blocker: string[]; planning: string[];
  summary: string;
  perspectives?: ReviewPerspective[];
  source?: "user" | "ai";
  createdAt: number;
}
interface Ability { execution: number; focus: number; rhythm: number; review: number; recovery: number; evidence: number }
interface ConversationMsg { role: "user" | "assistant"; content: string; at: number }
interface Conversation { id: string; title: string; personality: HQPersonality; createdAt: number; messages: ConversationMsg[] }
interface Profile { codename: string; city: string; mbti: string; background: string; hqPersonality: HQPersonality; weekStart: number }

interface AIAnalysis {
  id: string;
  createdAt: number;
  keyInsight: string;
  blockers: string[];
  pushActions: string[];
  priorityTasks: { title: string; reason: string }[];
}
interface GreatMeState {
  profile: Profile;
  plans: Plan[];
  goals: Goal[]; tasks: Task[]; events: EventItem[]; daily: Daily[]; reviews: Review[];
  ability: Ability;
  compounding: { score: number; trend: number[]; topAssets: string[]; topBlockers: string[] };
  conversations: Conversation[];
  activeSection: SectionId; activeRange: RangeId; soundOn: boolean;
  /** 历史 AI 推进建议（最近 20 条，最新在前） */
  aiAnalyses: AIAnalysis[];
  /** 多设备并发安全：每次成功 PUT 后服务端递增；客户端必须回传读到的值。
   *  不匹配 → 服务端 409 → 客户端 refetch + 重试。 */
  version: number;
}

const DEFAULT_STATE: GreatMeState = {
  profile: { codename: "", city: "", mbti: "", background: "", hqPersonality: "nova", weekStart: 1 },
  plans: [],
  goals: [], tasks: [], events: [], daily: [], reviews: [],
  ability: { execution: 0, focus: 0, rhythm: 0, review: 0, recovery: 0, evidence: 0 },
  compounding: { score: 0, trend: [], topAssets: [], topBlockers: [] },
  conversations: [],
  activeSection: "home", activeRange: "week", soundOn: true,
  aiAnalyses: [],
  version: 0,
};

const SECTION_LABELS: Record<SectionId, string> = {
  home: "首页", goals: "目标管理", events: "事件洞察",
  analytics: "数据分析", weekly_review: "每周复盘",
  mission_control: "HQ 对话", settings: "设置",
};
/** 侧栏只渲染这几项；goals / events / mission_control / settings 隐藏。
 *  - goals/events 已并入首页+计划详情+数据分析
 *  - mission_control（HQ 对话）：大斌哥 直接用 Hermes CLI 沟通
 *  - settings：少改 / 不改；profile 字段直接 SQL 改更快
 *  组件代码全部还在，git history 里也在；以后想再用一行恢复。 */
const SIDEBAR_SECTIONS: SectionId[] = [
  "home", "analytics", "weekly_review",
];
const SECTION_SUBTITLES: Record<SectionId, string> = {
  home: "专注当下、持续进化",
  goals: "管理年、月、周目标和今天要推进的任务",
  events: "跟进关键任务与里程碑",
  analytics: "数据分析与回顾策略",
  weekly_review: "每周行动汇报与复盘历史",
  mission_control: "HQ 对话与智能助手",
  settings: "周期、身份、体验偏好",
};

const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayYmd = (): string => ymd(new Date());
const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 复利指数分数 (0-10) → 字母等级 A-E。 */
function compoundingGrade(score: number): string {
  if (score >= 8) return "A";
  if (score >= 6) return "B";
  if (score >= 4) return "C";
  if (score >= 2) return "D";
  return "E";
}

function weekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / 604800000);
}

function getWeekDays(today: Date, weekStart: number): Date[] {
  const offset = (today.getDay() - weekStart + 7) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/**
 * Stage 3c: 把 AI 拆解出来的预览树落到 state。
 * - 过滤掉用户在预览里勾掉的目标 / 任务
 * - 级联过滤：如果父目标被勾掉，子目标和挂在它下的任务也跳过
 * - tempId → 真实 id 映射（先分配 id，再 build 对象，避免父子顺序问题）
 * - source 字段如实标记 "ai" / "user"（用户在预览里加的）
 * 返回新 plan 的 id 供路由切到详情页。
 */
function persistDecompose(
  preview: DecomposePreview,
  setState: React.Dispatch<React.SetStateAction<GreatMeState>>,
): string {
  const now = Date.now();
  const newPlanId = `plan-${now.toString(36)}`;

  // 判断目标是否被级联排除（自己或祖先 excluded）
  const isExcluded = (tempId: string): boolean => {
    const seen = new Set<string>();
    let cursor: string | undefined = tempId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const g = preview.goals.find(x => x.tempId === cursor);
      if (!g) return true;
      if (g.excluded) return true;
      cursor = g.parentTempId;
    }
    return false;
  };

  // 通过的目标 tempIds
  const keptGoals = preview.goals.filter(g => !isExcluded(g.tempId));

  // 先分配新 id（避免父在数组中出现晚于子时取不到）
  const goalIdMap = new Map<string, string>();
  keptGoals.forEach((g, i) => {
    goalIdMap.set(g.tempId, `g-${now.toString(36)}-${i}`);
  });

  const goalsToAdd: Goal[] = keptGoals.map(g => ({
    id: goalIdMap.get(g.tempId)!,
    scope: g.scope,
    title: g.title.trim() || "(未命名目标)",
    detail: g.detail,
    phase: "execute",
    due: g.due,
    progress: 0,
    createdAt: now,
    planId: newPlanId,
    parentId: g.parentTempId ? goalIdMap.get(g.parentTempId) : undefined,
    source: g.userAdded ? "user" : "ai",
    metric: g.metric,
  }));

  const tasksToAdd: Task[] = preview.tasks
    .filter(t => !t.excluded)
    .filter(t => !t.goalTempId || goalIdMap.has(t.goalTempId))  // 父目标若被排除则任务也跳过
    .map((t, i) => ({
      id: `t-${now.toString(36)}-${i}`,
      title: t.title.trim() || "(未命名任务)",
      done: false,
      date: t.date,
      badge: t.badge,
      goalId: t.goalTempId ? goalIdMap.get(t.goalTempId) ?? "" : "",
      note: t.note,
      source: t.userAdded ? "user" : "ai",
    }));

  const newPlan: Plan = {
    id: newPlanId,
    title: preview.plan.title.trim() || "(未命名计划)",
    detail: preview.plan.detail,
    start: preview.plan.start,
    end: preview.plan.end,
    scopes: preview.plan.scopes,
    status: "active",
    source: "ai-decompose",
    createdAt: now,
  };

  setState(prev => ({
    ...prev,
    plans: [...prev.plans, newPlan],
    goals: [...prev.goals, ...goalsToAdd],
    tasks: [...prev.tasks, ...tasksToAdd],
  }));

  return newPlanId;
}

export function GreatMeView(): ReactNode {
  const [state, setState] = useState<GreatMeState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [breathOpen, setBreathOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [aiDecomposeOpen, setAiDecomposeOpen] = useState(false);
  const saveRef = useRef<number | null>(null);
  /** 最近一次"和服务端一致"的 state 快照（JSON 字符串）。
   *  用于：① save 前自检，无变化就不发 PUT；② focus refetch 后避免回写循环。 */
  const lastSyncedJsonRef = useRef<string | null>(null);
  /** Phase 1: 焦点回到窗口时触发 refetch（多设备并发的第一道屏障） */
  const hydratingRef = useRef(false);
  /** focus 监听里读的是 stale closure 的 state；用 ref 同步最新 state。 */
  const stateRef = useRef<GreatMeState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const hydrate = useCallback(async (): Promise<void> => {
    if (hydratingRef.current) return;
    hydratingRef.current = true;
    try {
      const s = await api.getGreatMeState<GreatMeState>();
      if (s) {
        const merged = { ...DEFAULT_STATE, ...s };
        const migrated = migrateLegacyGoals(merged) as GreatMeState;
        setState(migrated);
        lastSyncedJsonRef.current = JSON.stringify(migrated);
      } else {
        lastSyncedJsonRef.current = JSON.stringify(DEFAULT_STATE);
      }
    } catch (err) {
      console.warn("GreatMe load failed", err);
    } finally {
      setLoaded(true);
      hydratingRef.current = false;
    }
  }, []);

  useEffect(() => { void hydrate(); }, [hydrate]);

  // 若 activeSection 指向已隐藏的 section（旧数据 / 另一台机器留下的状态），
  // 自动回退到 home，避免落到一个看不到侧栏入口的"幽灵页面"。
  useEffect(() => {
    if (!loaded) return;
    if (!SIDEBAR_SECTIONS.includes(state.activeSection)) {
      setState(prev => ({ ...prev, activeSection: "home" }));
    }
  }, [loaded, state.activeSection]);

  useEffect(() => {
    if (!loaded) return;
    const json = JSON.stringify(state);
    // 没真变化就不写（refetch / 服务器回传 version 触发的 setState 也会落这里）
    if (json === lastSyncedJsonRef.current) return;
    if (saveRef.current) window.clearTimeout(saveRef.current);
    saveRef.current = window.setTimeout(async () => {
      saveRef.current = null;
      try {
        const res = await api.saveGreatMeState(state);
        if ("conflict" in res) {
          // 服务端比本地新 → 用服务端值覆盖本地（用户没在编辑时，安静地拿到最新）
          console.warn("GreatMe save conflict; server ahead, refetching", res.currentVersion);
          if (res.current) {
            const merged = { ...DEFAULT_STATE, ...(res.current as Partial<GreatMeState>) } as GreatMeState;
            lastSyncedJsonRef.current = JSON.stringify(merged);
            setState(merged);
          } else {
            await hydrate();
          }
        } else {
          // 成功 → 拿服务端递增后的 version 回写本地，并把新 JSON 当作 last-synced
          const synced: GreatMeState = { ...state, version: res.version };
          lastSyncedJsonRef.current = JSON.stringify(synced);
          setState(prev => prev.version === res.version ? prev : { ...prev, version: res.version });
        }
      } catch (err) {
        console.warn("GreatMe save failed", err);
      }
    }, 800);
    return () => { if (saveRef.current) window.clearTimeout(saveRef.current); };
  }, [state, loaded, hydrate]);

  // Phase 1: 窗口聚焦 / 标签可见时重新拉取（用户没在输入框里时才动）
  useEffect(() => {
    const isTyping = (): boolean => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onWake = (): void => {
      if (document.hidden) return;
      if (isTyping()) return;                      // 别打断用户正在敲的字
      if (!loaded) return;
      if (saveRef.current !== null) return;        // 有 debounce 中的 save 待发，让 save 先跑
      // 本地还有未同步的改动 → 不能用服务端值覆盖本地；让 save effect 把它推上去再说
      if (JSON.stringify(stateRef.current) !== lastSyncedJsonRef.current) return;
      void hydrate();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [hydrate, loaded]);

  useEffect(() => {
    const handler = (): void => setBreathOpen(true);
    document.addEventListener("gm-open-breath", handler);
    return () => document.removeEventListener("gm-open-breath", handler);
  }, []);

  const update = (patch: Partial<GreatMeState>): void => setState(prev => ({ ...prev, ...patch }));

  return (
    <div className="gm-app">
      <aside className="gm-side">
        <div className="gm-side__brand">计划管理</div>
        {SIDEBAR_SECTIONS.map(id => (
          <button key={id}
            className={`gm-side__item ${state.activeSection === id ? "is-active" : ""}`}
            onClick={() => update({ activeSection: id })}>
            {SECTION_LABELS[id]}
          </button>
        ))}
      </aside>

      <div className="gm-main">
        <div className="gm-section">
          {selectedPlanId ? (() => {
            const plan = state.plans.find(p => p.id === selectedPlanId);
            if (!plan) { setSelectedPlanId(null); return null; }
            return (
              <PlanDetailView
                plan={plan}
                state={state}
                setState={setState}
                onBack={() => setSelectedPlanId(null)} />
            );
          })() : (
            <>
              {state.activeSection === "home" && <HomeSection state={state} setState={setState} onPickPlan={setSelectedPlanId} onNewPlan={() => setNewPlanOpen(true)} onAIDecompose={() => setAiDecomposeOpen(true)} />}
              {state.activeSection === "goals" && <GoalsSection state={state} setState={setState} />}
              {state.activeSection === "events" && <EventsSection state={state} setState={setState} />}
              {state.activeSection === "analytics" && <AnalyticsSection state={state} setState={setState} />}
              {state.activeSection === "weekly_review" && <WeeklyReviewSection state={state} setState={setState} />}
              {state.activeSection === "mission_control" && <MissionControlSection state={state} setState={setState} />}
              {state.activeSection === "settings" && <SettingsSection state={state} setState={setState} />}
            </>
          )}
        </div>
      </div>

      {newPlanOpen && (
        <NewPlanModal
          onCreate={p => {
            const newId = `plan-${Date.now().toString(36)}`;
            setState(prev => ({ ...prev, plans: [...prev.plans, { ...p, id: newId, createdAt: Date.now() }] }));
            setNewPlanOpen(false);
            setSelectedPlanId(newId);
          }}
          onCancel={() => setNewPlanOpen(false)} />
      )}

      {aiDecomposeOpen && (
        <AIDecomposeModal
          onCancel={() => setAiDecomposeOpen(false)}
          onAccept={(preview) => {
            const newPlanId = persistDecompose(preview, setState);
            setAiDecomposeOpen(false);
            setSelectedPlanId(newPlanId);
          }} />
      )}

      {breathOpen && <BreathOverlay soundOn={state.soundOn} onClose={() => setBreathOpen(false)} />}
    </div>
  );
}

// =================================================================
// 首页（P1+P2）
// =================================================================
interface SectionProps { state: GreatMeState; setState: React.Dispatch<React.SetStateAction<GreatMeState>> }

function HomeSection({ state, setState, onPickPlan, onNewPlan, onAIDecompose }: SectionProps & { onPickPlan: (id: string) => void; onNewPlan: () => void; onAIDecompose: () => void }): ReactNode {
  const today = useMemo(() => new Date(), []);
  const wk = weekNumber(today);
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd());
  // 周选择器：weekAnchor 决定当前显示的是哪一周（默认本周）；点 ← / → 翻周
  const [weekAnchor, setWeekAnchor] = useState<Date>(today);
  const weekDays = useMemo(() => getWeekDays(weekAnchor, state.profile.weekStart), [weekAnchor, state.profile.weekStart]);
  const goPrevWeek = (): void => setWeekAnchor(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  const goNextWeek = (): void => setWeekAnchor(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  const goToday = (): void => { setWeekAnchor(new Date()); setSelectedDate(todayYmd()); };
  const [taskInput, setTaskInput] = useState("");
  const [heroEditing, setHeroEditing] = useState(false);
  const [heroDraft, setHeroDraft] = useState("");
  const [editingGoalOpen, setEditingGoalOpen] = useState(false);
  /** 当前正在为哪条 task 打开"挂到目标"小弹窗。null = 关闭。 */
  const [assignPopupTaskId, setAssignPopupTaskId] = useState<string | null>(null);
  /** 行内重命名 task：当前正编辑哪条 + 编辑中的草稿。 */
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskDraft, setEditingTaskDraft] = useState("");

  const todayTasks = state.tasks.filter(t => t.date === selectedDate);
  const completion = todayTasks.length === 0 ? 0 : Math.round(todayTasks.filter(t => t.done).length / todayTasks.length * 100);

  // 只看 week/month/year（"custom"/"all" fallback 到 week）
  const scope: "week" | "month" | "year" =
    state.activeRange === "month" ? "month" :
    state.activeRange === "year"  ? "year"  : "week";
  const scopeGoal = state.goals.find(g => g.scope === scope);
  const weekGoal = state.goals.find(g => g.scope === "week"); // AI 推荐仍以周目标为锚

  // scope 派生文本：第N周/月/年、"本周"/"本月"/"年度"、card 名等
  const scopeNumber = scope === "year"
    ? today.getFullYear() - 2024   // 2026 → 第2年 ；起点 2025
    : scope === "month" ? today.getMonth() + 1 : wk;
  const scopeUnit  = scope === "year" ? "年" : scope === "month" ? "月" : "周";
  const scopeNoun  = scope === "year" ? "年度" : scope === "month" ? "本月" : "本周";
  // 战术地图标题前缀（年度版用"本年"，其他和 scopeNoun 同）
  const mapPrefix  = scope === "year" ? "本年" : scopeNoun;
  const milestoneLabel = `${scopeNoun}里程碑`;
  const completionLabel = `${scopeNoun}任务完成率`;
  const mapLabel = `${mapPrefix}战术地图`;
  const abilityLabel = `${scopeNoun}能力图`;
  const kpiDoneLabel    = `${scopeNoun}完成`;
  const kpiPendingLabel = `${scopeNoun}待收束`;

  const setRange = (r: RangeId): void => { setState(prev => ({ ...prev, activeRange: r })); setHeroEditing(false); };

  // hero 标题点击 / ✎ 触发的两种动作
  const startHeroInlineEdit = (): void => {
    if (!scopeGoal) { setEditingGoalOpen(true); return; }
    setHeroDraft(scopeGoal.title);
    setHeroEditing(true);
  };
  const cancelHeroInlineEdit = (): void => { setHeroEditing(false); setHeroDraft(""); };
  const saveHeroInlineEdit = (): void => {
    if (!scopeGoal) return;
    const t = heroDraft.trim();
    if (t) setState(prev => ({ ...prev, goals: prev.goals.map(g => g.id === scopeGoal.id ? { ...g, title: t } : g) }));
    setHeroEditing(false);
  };
  // 弹窗保存：替换现有 scopeGoal 的字段
  const handleEditingGoalSave = (g: Omit<Goal, "id" | "createdAt">): void => {
    if (!scopeGoal) {
      // 没有 scope goal 就当新建
      setState(prev => ({ ...prev, goals: [...prev.goals, { ...g, id: uid(), createdAt: Date.now() }] }));
    } else {
      setState(prev => ({ ...prev, goals: prev.goals.map(x => x.id === scopeGoal.id ? { ...x, ...g } : x) }));
    }
    setEditingGoalOpen(false);
  };

  /** S8：智能挂目标。建任务时如果用户没选 goal，自动挑一个候选：
   *  优先 active plan 下的"正在进行"的周目标；没有就选第一个周目标；最后 fallback 空。
   */
  const suggestGoalIdForNewTask = (): string => {
    const activePlanIds = new Set(state.plans.filter(p => p.status === "active").map(p => p.id));
    const candidateWeekGoals = state.goals.filter(g =>
      g.scope === "week" && (g.planId ? activePlanIds.has(g.planId) : true)
    );
    // 优先 progress 0<p<100 的（正在进行）
    const inProgress = candidateWeekGoals.find(g => g.progress > 0 && g.progress < 100);
    if (inProgress) return inProgress.id;
    const planned = candidateWeekGoals.find(g => g.progress === 0);
    if (planned) return planned.id;
    return "";
  };

  const addTask = (): void => {
    const t = taskInput.trim();
    if (!t) return;
    const goalId = suggestGoalIdForNewTask();
    setState(prev => ({ ...prev, tasks: [...prev.tasks, { id: uid(), title: t, done: false, date: selectedDate, badge: "", goalId, note: "" }] }));
    setTaskInput("");
  };
  const toggleTask = (id: string): void => setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  const delTask = (id: string): void => setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  const assignTaskGoal = (taskId: string, goalId: string): void => {
    setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, goalId } : t) }));
    setAssignPopupTaskId(null);
  };
  // 点窗外关闭挂目标弹窗
  useEffect(() => {
    if (!assignPopupTaskId) return;
    const close = (): void => setAssignPopupTaskId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [assignPopupTaskId]);
  const startEditTask = (id: string, title: string): void => { setEditingTaskId(id); setEditingTaskDraft(title); };
  const saveEditTask = (): void => {
    if (!editingTaskId) return;
    const t = editingTaskDraft.trim();
    if (t) setState(prev => ({ ...prev, tasks: prev.tasks.map(x => x.id === editingTaskId ? { ...x, title: t } : x) }));
    setEditingTaskId(null);
    setEditingTaskDraft("");
  };

  const todayDaily = state.daily.find(d => d.date === selectedDate) ?? { date: selectedDate, tomorrowPlan: "", doingToday: "", meditation: "", victoryBlocker: "", nightReport: "" };
  const updateDaily = (patch: Partial<Daily>): void => {
    setState(prev => {
      const others = prev.daily.filter(d => d.date !== selectedDate);
      return { ...prev, daily: [...others, { ...todayDaily, ...patch }] };
    });
  };

  const recentEvents = [...state.events].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const latestReview = [...state.reviews].sort((a, b) => b.createdAt - a.createdAt)[0];

  const trendValues = state.compounding.trend.length ? state.compounding.trend : [0, 0, 0, 0];
  const last7Completion = useMemo(() => {
    const days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const k = ymd(d);
      const dt = state.tasks.filter(t => t.date === k);
      days.push(dt.length === 0 ? 0 : Math.round(dt.filter(t => t.done).length / dt.length * 100));
    }
    return days;
  }, [state.tasks, today]);

  // 4 个固定每日栏目（原版风格）。每个槽点击后打开各自的模态。
  // status / subtitle 根据当前值动态算。
  type SlotId = "victoryBlocker" | "meditation" | "tomorrowPlan" | "doingToday";
  const slotMeta: Record<SlotId, { title: string; hint: string }> = {
    victoryBlocker: { title: "胜利 / 阻碍", hint: "补一句今天真实发生了什么。" },
    meditation:     { title: "2 分钟冥想",   hint: "2 分钟冥想，给今天留一个缓冲。" },
    tomorrowPlan:   { title: "明日规划",     hint: "写下明天最值得先开始的一步。" },
    doingToday:     { title: "今日在做",     hint: "补充今天正在推进的事项。" },
  };
  const dailySlotsOrder: SlotId[] = ["victoryBlocker", "meditation", "tomorrowPlan", "doingToday"];
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null);

  // 计算每个槽的 status + filled state + 显示在卡片下方的副文本
  const slotState = (id: SlotId): { status: string; filled: boolean; subtitle: string } => {
    const v = (todayDaily as unknown as Record<string, string>)[id] ?? "";
    const trimmed = v.trim();
    if (id === "doingToday") {
      const items = trimmed ? trimmed.split("\n").map(s => s.trim()).filter(Boolean) : [];
      return { status: items.length > 0 ? `${items.length}项` : "可添加", filled: items.length > 0, subtitle: items[0] ?? "" };
    }
    if (id === "meditation") {
      return { status: trimmed ? "已完成" : "待开始", filled: !!trimmed, subtitle: trimmed };
    }
    // tomorrowPlan / victoryBlocker：有内容 = 已记录
    return { status: trimmed ? "已记录" : "待补充", filled: !!trimmed, subtitle: trimmed };
  };

  // 派生 AI 推荐文案：基于当前 hero 周目标。
  const aiHintTomorrow = weekGoal
    ? `明天为了完成「${weekGoal.title.slice(0, 16)}」，你打算从哪个具体功能开始？`
    : "明天最值得先开始的一步是什么？";
  const aiHintVictory = weekGoal
    ? `今天在「${weekGoal.title.slice(0, 16)}」上，你完成了哪个实际的小进展，又遇到了哪个具体阻碍？`
    : "今天完成了什么、卡在哪里？";

  // 关键动作未完成数（hero 副 meta 用）
  const remainingActions = todayTasks.filter(t => !t.done).length;

  // === v3: today-focused 双栏布局 ===
  // 问候 + 日期文案
  const greeting = (() => {
    const h = today.getHours();
    if (h < 6) return "凌晨好";
    if (h < 12) return "早上好";
    if (h < 14) return "中午好";
    if (h < 19) return "下午好";
    return "晚上好";
  })();
  const dayOfWeek = ["日","一","二","三","四","五","六"][today.getDay()];
  // 顶部窄条用今天的日期（这是问候上下文）
  const todayDateLabel = `${today.getMonth() + 1} 月 ${today.getDate()} 日 周${dayOfWeek}`;
  // 今日任务卡里的日期跟随 selectedDate（看哪天就显示哪天）
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }, [selectedDate]);
  const selectedDateLabel = (() => {
    const isToday = selectedDate === todayYmd();
    const dow = ["日","一","二","三","四","五","六"][selectedDateObj.getDay()];
    const base = `${selectedDateObj.getMonth() + 1} 月 ${selectedDateObj.getDate()} 日 周${dow}`;
    return isToday ? `${base} · 今天` : base;
  })();

  // 今日任务按 plan 分组 + 孤儿任务
  const planMap = new Map(state.plans.map(p => [p.id, p]));
  const goalMap = new Map(state.goals.map(g => [g.id, g]));
  interface GroupedTasks { planId: string; planTitle: string; tasks: typeof todayTasks; goalTitle: Map<string, string> }
  const groups = new Map<string, GroupedTasks>();
  const orphans: typeof todayTasks = [];
  for (const t of todayTasks) {
    const g = t.goalId ? goalMap.get(t.goalId) : undefined;
    if (g && g.planId && planMap.has(g.planId)) {
      const pid = g.planId;
      if (!groups.has(pid)) {
        groups.set(pid, { planId: pid, planTitle: planMap.get(pid)!.title, tasks: [], goalTitle: new Map() });
      }
      groups.get(pid)!.tasks.push(t);
      groups.get(pid)!.goalTitle.set(g.id, g.title);
    } else {
      orphans.push(t);
    }
  }
  const groupList = Array.from(groups.values());

  // 活跃计划进度 + 距截止
  const activePlans = state.plans.filter(p => p.status === "active");
  const daysLeftLabel = (end: string): string => {
    if (!end) return "未设截止";
    const d = Math.ceil((Date.parse(end) - Date.now()) / 86400000);
    if (d < 0) return "已过期";
    if (d === 0) return "今天截止";
    return `还剩 ${d} 天`;
  };
  const planProgress = (planId: string): number => computePlanProgress(
    planId,
    state.goals as Parameters<typeof computePlanProgress>[1],
    state.tasks as Parameters<typeof computePlanProgress>[2],
  );

  const doneToday = todayTasks.filter(t => t.done).length;

  return (
    <div className="gm-home-v3">
      {/* === 顶部窄条：问候 + 日期 + 今日完成度 === */}
      <div className="gm-home-v3__top">
        <div className="gm-home-v3__top-left">
          <span className="gm-home-v3__hello">{greeting}，{state.profile.codename || "大斌哥"}</span>
          <span className="gm-home-v3__date">{todayDateLabel} · 第 {wk} 周</span>
        </div>
        <div className="gm-home-v3__top-right">
          <div className="gm-home-v3__top-num">{completion}%</div>
          <div className="gm-home-v3__top-meta">
            <span>今日 {doneToday} / {todayTasks.length}</span>
            <div className="gm-home-v3__top-bar"><span style={{ width: `${completion}%` }} /></div>
          </div>
        </div>
      </div>

      {/* === 主双栏 === */}
      <div className="gm-home-v3__main">
        {/* 左栏：今日任务 */}
        <div className="gm-home-v3__col gm-home-v3__col--tasks">
          <div className="gm-home-v3__card-head">
            <div className="gm-home-v3__card-head-lead">
              <div className="gm-home-v3__card-title">
                {selectedDate === todayYmd() ? "今日任务" : "任务列表"}
              </div>
              <div className="gm-home-v3__card-date">{selectedDateLabel}</div>
            </div>
            {todayTasks.length > 0 && (
              <span className="gm-home-v3__card-sub">{doneToday}/{todayTasks.length} 已完成</span>
            )}
          </div>

          {/* 周选择条：可切换看其他天的任务 */}
          <div className="gm-home-v3__week">
            <button className="gm-home-v3__week-nav" title="上一周" onClick={goPrevWeek}>‹</button>
            <div className="gm-home-v3__week-days">
              {weekDays.map(d => {
                const k = ymd(d);
                const dayTasks = state.tasks.filter(t => t.date === k);
                const doneCount = dayTasks.filter(t => t.done).length;
                const isSelected = k === selectedDate;
                const isToday = k === todayYmd();
                const dow = ["日","一","二","三","四","五","六"][d.getDay()];
                return (
                  <button key={k}
                    className={`gm-home-v3__day ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                    title={k}
                    onClick={() => setSelectedDate(k)}>
                    <span className="gm-home-v3__day-dow">周{dow}</span>
                    <span className="gm-home-v3__day-num">{d.getDate()}</span>
                    {dayTasks.length > 0 && (
                      <span className="gm-home-v3__day-dots" title={`${doneCount}/${dayTasks.length}`}>
                        <span className={`gm-home-v3__day-bar`} style={{ width: `${dayTasks.length === 0 ? 0 : Math.round(doneCount / dayTasks.length * 100)}%` }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button className="gm-home-v3__week-nav" title="下一周" onClick={goNextWeek}>›</button>
            {selectedDate !== todayYmd() && (
              <button className="gm-home-v3__week-today" onClick={goToday}>今天</button>
            )}
          </div>

          <div className="gm-home-v3__input-bar">
            <input
              className="gm-home-v3__input"
              placeholder={selectedDate === todayYmd()
                ? "+ 加一条今日任务（按回车，自动挂到正在进行的周目标）"
                : `+ 加一条 ${selectedDateObj.getMonth() + 1}/${selectedDateObj.getDate()} 的任务`}
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addTask(); }} />
            <button className="gm-home-v3__input-btn"
              disabled={!taskInput.trim()}
              onClick={addTask}>添加</button>
          </div>

          <div className="gm-home-v3__tasks">
            {groupList.length === 0 && orphans.length === 0 && (
              <div className="gm-home-v3__empty">
                <div className="gm-home-v3__empty-title">今天还没有任务</div>
                <div className="gm-home-v3__empty-sub">
                  上面输入框加一条，或者去
                  <a className="gm-home-v3__empty-link" onClick={onAIDecompose}> 🪄 AI 拆解 </a>
                  一个意图开始。
                </div>
              </div>
            )}
            {groupList.map(group => (
              <div key={group.planId} className="gm-home-v3__task-group">
                <button className="gm-home-v3__task-group-head"
                  onClick={() => onPickPlan(group.planId)}
                  title="打开此计划详情">
                  ▎{group.planTitle}
                  <span className="gm-home-v3__task-group-count">{group.tasks.filter(t => t.done).length} / {group.tasks.length}</span>
                </button>
                {group.tasks.map(t => {
                  const isEditing = editingTaskId === t.id;
                  const goalTitle = t.goalId ? group.goalTitle.get(t.goalId) : null;
                  return (
                    <div key={t.id} className={`gm-home-v3__task ${t.done ? "is-done" : ""}`}>
                      <button className={`gm-home-v3__task-check ${t.done ? "is-done" : ""}`}
                        onClick={() => toggleTask(t.id)}
                        title={t.done ? "标记未完成" : "标记完成"}>
                        {t.done ? "✓" : ""}
                      </button>
                      {isEditing ? (
                        <input className="gm-home-v3__task-edit" autoFocus
                          value={editingTaskDraft}
                          onChange={e => setEditingTaskDraft(e.target.value)}
                          onBlur={saveEditTask}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveEditTask();
                            if (e.key === "Escape") { setEditingTaskId(null); setEditingTaskDraft(""); }
                          }} />
                      ) : (
                        <span className="gm-home-v3__task-title"
                          onClick={() => startEditTask(t.id, t.title)}
                          title="点击编辑标题">{t.title}</span>
                      )}
                      {goalTitle && (
                        <span className="gm-home-v3__task-goal" title={goalTitle}>↑ {goalTitle}</span>
                      )}
                      <button className="gm-home-v3__task-del" title="删除"
                        onClick={() => delTask(t.id)}>×</button>
                    </div>
                  );
                })}
              </div>
            ))}
            {orphans.length > 0 && (
              <div className="gm-home-v3__task-group">
                <div className="gm-home-v3__task-group-head gm-home-v3__task-group-head--orphan">
                  ▎未挂目标
                  <span className="gm-home-v3__task-group-count">{orphans.filter(t => t.done).length} / {orphans.length}</span>
                </div>
                {orphans.map(t => {
                  const isEditing = editingTaskId === t.id;
                  return (
                    <div key={t.id} className={`gm-home-v3__task ${t.done ? "is-done" : ""}`}>
                      <button className={`gm-home-v3__task-check ${t.done ? "is-done" : ""}`}
                        onClick={() => toggleTask(t.id)}>{t.done ? "✓" : ""}</button>
                      {isEditing ? (
                        <input className="gm-home-v3__task-edit" autoFocus
                          value={editingTaskDraft}
                          onChange={e => setEditingTaskDraft(e.target.value)}
                          onBlur={saveEditTask}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveEditTask();
                            if (e.key === "Escape") { setEditingTaskId(null); setEditingTaskDraft(""); }
                          }} />
                      ) : (
                        <span className="gm-home-v3__task-title"
                          onClick={() => startEditTask(t.id, t.title)}>{t.title}</span>
                      )}
                      <button className="gm-home-v3__task-del" onClick={() => delTask(t.id)}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右栏：我的计划 */}
        <div className="gm-home-v3__col gm-home-v3__col--plans">
          <div className="gm-home-v3__card-head">
            <div className="gm-home-v3__card-title">我的计划</div>
            <div className="gm-home-v3__card-actions">
              <button className="gm-chip" onClick={onAIDecompose} title="AI 帮我拆解一个意图">🪄 AI 拆解</button>
              <button className="gm-chip" onClick={onNewPlan} title="新建空计划">+ 新建</button>
            </div>
          </div>
          <div className="gm-home-v3__plans">
            {activePlans.length === 0 && (
              <div className="gm-home-v3__empty">
                <div className="gm-home-v3__empty-title">还没有计划</div>
                <div className="gm-home-v3__empty-sub">从 🪄 AI 拆解 或 + 新建 开始。</div>
              </div>
            )}
            {activePlans.map(p => {
              const prog = planProgress(p.id);
              return (
                <button key={p.id} className="gm-home-v3__plan"
                  onClick={() => onPickPlan(p.id)}>
                  <div className="gm-home-v3__plan-title">{p.title}</div>
                  <div className="gm-home-v3__plan-bar">
                    <span style={{ width: `${prog}%` }} />
                  </div>
                  <div className="gm-home-v3__plan-meta">
                    <span className="gm-home-v3__plan-pct">{prog}%</span>
                    <span className="gm-home-v3__plan-due">{daysLeftLabel(p.end)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* === 底部窄条：4 个今日节奏小格 === */}
      <div className="gm-home-v3__bottom">
        {dailySlotsOrder.map(s => {
          const st = slotState(s);
          return (
            <button key={s}
              className={`gm-home-v3__slot ${st.filled ? "is-filled" : ""}`}
              onClick={() => setOpenSlot(s)}>
              <div className="gm-home-v3__slot-head">
                <span className="gm-home-v3__slot-title">{slotMeta[s].title}</span>
                <span className="gm-home-v3__slot-status">{st.status}</span>
              </div>
              <div className="gm-home-v3__slot-body">
                {st.subtitle ? st.subtitle.slice(0, 60) : slotMeta[s].hint}
              </div>
            </button>
          );
        })}
      </div>

      {openSlot && (
        <DailySlotModal
          slot={openSlot}
          value={(todayDaily as unknown as Record<string, string>)[openSlot] ?? ""}
          aiHint={openSlot === "tomorrowPlan" ? aiHintTomorrow : openSlot === "victoryBlocker" ? aiHintVictory : undefined}
          onSave={v => updateDaily({ [openSlot]: v } as Partial<Daily>)}
          onClose={() => setOpenSlot(null)} />
      )}
    </div>
  );
}

// =================================================================
// 每日栏目模态：4 种 (今日在做 / 明日规划 / 胜利阻碍 / 2 分钟冥想)
// =================================================================
function DailySlotModal({ slot, value, aiHint, onSave, onClose }: {
  slot: "doingToday" | "tomorrowPlan" | "victoryBlocker" | "meditation";
  value: string;
  aiHint?: string;
  onSave: (v: string) => void;
  onClose: () => void;
}): ReactNode {
  return (
    <div className="gm-modal-back" onClick={onClose}>
      <div className="gm-daily-modal" onClick={e => e.stopPropagation()}>
        {slot === "doingToday"    && <DoingTodayBody    value={value} onSave={onSave} onClose={onClose} />}
        {slot === "tomorrowPlan"  && <TomorrowPlanBody  value={value} onSave={onSave} onClose={onClose} aiHint={aiHint} />}
        {slot === "victoryBlocker"&& <VictoryBlockerBody value={value} onSave={onSave} onClose={onClose} aiHint={aiHint} />}
        {slot === "meditation"    && <MeditationBody    value={value} onSave={onSave} onClose={onClose} />}
      </div>
    </div>
  );
}

function ModalHead({ title, badge, subtitle, onClose }: { title: string; badge: string; subtitle: string; onClose: () => void }): ReactNode {
  return (
    <>
      <button className="gm-daily-modal__close" onClick={onClose} title="关闭">×</button>
      <div className="gm-daily-modal__title">
        {title}<span className="gm-daily-modal__badge">{badge}</span>
      </div>
      <div className="gm-daily-modal__sub">{subtitle}</div>
    </>
  );
}

function AIHintBox({ text }: { text: string }): ReactNode {
  return (
    <div className="gm-ai-hint">
      <div className="gm-ai-hint__head">✦ AI 推荐</div>
      <div className="gm-ai-hint__body">{text}</div>
    </div>
  );
}

function ModalFoot({ submitLabel, onSubmit, disabled }: { submitLabel: string; onSubmit: () => void; disabled?: boolean }): ReactNode {
  return (
    <div className="gm-daily-modal__foot gm-daily-modal__foot--single">
      <button className="gm-daily-modal__submit" type="button" disabled={disabled} onClick={onSubmit}>
        <span className="gm-daily-modal__submit-arrow">➤</span> {submitLabel}
      </button>
    </div>
  );
}

function DoingTodayBody({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }): ReactNode {
  const items = value.split("\n").map(s => s.trim()).filter(Boolean);
  const [draft, setDraft] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const replaceAll = (next: string[]): void => onSave(next.join("\n"));
  const addDraft = (): void => {
    const additions = draft.split("\n").map(s => s.trim()).filter(Boolean);
    if (additions.length === 0) return;
    replaceAll([...items, ...additions]);
    setDraft("");
  };
  const startEdit = (i: number): void => { setEditingIdx(i); setEditingText(items[i]); };
  const saveEdit = (): void => {
    if (editingIdx == null) return;
    const t = editingText.trim();
    if (t) replaceAll(items.map((x, j) => j === editingIdx ? t : x));
    else replaceAll(items.filter((_, j) => j !== editingIdx));
    setEditingIdx(null);
  };
  const remove = (i: number): void => { replaceAll(items.filter((_, j) => j !== i)); };

  return (
    <>
      <ModalHead title="今日在做" badge="可选" subtitle="写下正在推进的事项，可以一行一个。" onClose={onClose} />
      <div className="gm-daily-modal__hint">这会加入今日在做列表。</div>
      {items.length > 0 && (
        <div className="gm-daily-modal__items">
          <div className="gm-daily-modal__items-head">已加入今日在做</div>
          {items.map((it, i) => (
            <div key={i} className="gm-daily-modal__item">
              <span className="gm-daily-modal__item-check">✓</span>
              {editingIdx === i ? (
                <input className="gm-daily-modal__item-input" autoFocus value={editingText}
                  onChange={e => setEditingText(e.target.value)} onBlur={saveEdit}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingIdx(null); }} />
              ) : (
                <span className="gm-daily-modal__item-text">{it}</span>
              )}
              <button className="gm-daily-modal__item-edit" title="编辑" onClick={() => startEdit(i)}>✎</button>
              <button className="gm-daily-modal__item-del" title="删除" onClick={() => remove(i)}>🗑</button>
            </div>
          ))}
        </div>
      )}
      <textarea className="gm-daily-modal__textarea"
        value={draft}
        placeholder="写下正在推进的事项，可以一行一个。"
        onChange={e => setDraft(e.target.value)} />
      <ModalFoot submitLabel="加入" onSubmit={addDraft} disabled={!draft.trim()} />
    </>
  );
}

function TomorrowPlanBody({ value, onSave, onClose, aiHint }: { value: string; onSave: (v: string) => void; onClose: () => void; aiHint?: string }): ReactNode {
  const [draft, setDraft] = useState(value);
  const save = (): void => { onSave(draft.trim()); onClose(); };
  return (
    <>
      <ModalHead title="明日规划" badge="可选" subtitle="写下明天最值得先开始的一步。" onClose={onClose} />
      {aiHint && <AIHintBox text={aiHint} />}
      <div className="gm-daily-modal__hint">这会保存到明日规划。</div>
      <textarea className="gm-daily-modal__textarea" autoFocus
        value={draft} placeholder="写下明天最值得先开始的一步。"
        onChange={e => setDraft(e.target.value)} />
      <ModalFoot submitLabel="保存" onSubmit={save} />
    </>
  );
}

function VictoryBlockerBody({ value, onSave, onClose, aiHint }: { value: string; onSave: (v: string) => void; onClose: () => void; aiHint?: string }): ReactNode {
  const lines = value.split("\n");
  const initialV = lines.find(l => l.startsWith("胜利："))?.slice(3) ?? (lines[0] ?? "");
  const initialB = lines.find(l => l.startsWith("阻碍："))?.slice(3) ?? "";
  const [victory, setVictory] = useState(initialV);
  const [blocker, setBlocker] = useState(initialB);
  const save = (): void => {
    const v = victory.trim();
    const b = blocker.trim();
    if (!v && !b) { onClose(); return; }
    onSave(`胜利：${v}\n阻碍：${b}`);
    onClose();
  };
  return (
    <>
      <ModalHead title="胜利 / 阻碍" badge="每日" subtitle="补一句今天真实发生了什么。" onClose={onClose} />
      {aiHint && <AIHintBox text={aiHint} />}
      <div className="gm-daily-modal__hint">这会同步到今日的最小胜利和阻碍记录。</div>
      <div className="gm-daily-modal__label">胜利</div>
      <input className="gm-daily-modal__input" autoFocus
        value={victory} placeholder="今天真实完成了什么。"
        onChange={e => setVictory(e.target.value)} />
      <div className="gm-daily-modal__label">阻碍</div>
      <input className="gm-daily-modal__input"
        value={blocker} placeholder="今天卡住、被消耗或需要处理的是什么。"
        onChange={e => setBlocker(e.target.value)} />
      <ModalFoot submitLabel="记录" onSubmit={save} />
    </>
  );
}

function MeditationBody({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }): ReactNode {
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          window.clearInterval(id);
          setRunning(false);
          const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
          onSave(`完成 2 分钟冥想 · ${now}`);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, onSave]);
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");
  const pct = ((120 - secondsLeft) / 120) * 100;
  const markDone = (): void => {
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    onSave(`手动记 2 分钟冥想 · ${now}`);
    onClose();
  };
  return (
    <>
      <ModalHead title="2 分钟冥想" badge="每日" subtitle="给今天留一个缓冲，专注呼吸。" onClose={onClose} />
      <div className="gm-daily-modal__hint">完成后会记入今日冥想。</div>
      <div className="gm-meditation">
        <div className="gm-meditation__digits">{mm}:{ss}</div>
        <div className="gm-meditation__bar"><span style={{ width: `${pct}%` }} /></div>
      </div>
      {value && <div className="gm-meditation__history">最近：{value}</div>}
      <div className="gm-daily-modal__foot">
        <button className="gm-daily-modal__altbtn" type="button" onClick={() => setRunning(r => !r)}>
          {running ? "⏸ 暂停" : "▶ 开始"}
        </button>
        <button className="gm-daily-modal__submit" type="button" onClick={markDone}>
          <span className="gm-daily-modal__submit-arrow">✓</span> 标记完成
        </button>
      </div>
    </>
  );
}

function DailyCard({ title, value, placeholder, onSave, extraButton }: { title: string; value: string; placeholder: string; onSave: (v: string) => void; extraButton?: ReactNode }): ReactNode {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="gm-quad__cell">
      <div className="gm-quad__title">{title}</div>
      <textarea className="gm-quad__field" value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)} onBlur={() => onSave(draft)} />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        {extraButton}
        <button className="gm-quad__submit" onClick={() => onSave(draft)}>保存</button>
      </div>
    </div>
  );
}

function ReportCol({ kind, title, items, empty }: { kind: "victory" | "blocker" | "planning"; title: string; items: string[]; empty: string }): ReactNode {
  return (
    <div className="gm-report-3col__col" data-kind={kind}>
      <div className="gm-report-3col__head">{title}</div>
      {items.length === 0
        ? <div className="gm-report-3col__empty">{empty}</div>
        : items.map((it, i) => <div key={i} className="gm-report-3col__item">{it}</div>)}
    </div>
  );
}

// =================================================================
// 目标管理（P3）
// =================================================================
function GoalsSection({ state, setState }: SectionProps): ReactNode {
  const [scope, setScope] = useState<"year" | "month" | "week" | "all">("week");
  const [modalOpen, setModalOpen] = useState(false);
  const [heroEditing, setHeroEditing] = useState(false);
  const [heroDraft, setHeroDraft] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const goals = scope === "all" ? state.goals : state.goals.filter(g => g.scope === scope);

  const addGoal = (g: Omit<Goal, "id" | "createdAt">): void => {
    setState(prev => ({ ...prev, goals: [...prev.goals, { ...g, id: uid(), createdAt: Date.now() }] }));
    setModalOpen(false);
  };
  const updateGoal = (id: string, patch: Partial<Goal>): void => {
    setState(prev => ({ ...prev, goals: prev.goals.map(g => g.id === id ? { ...g, ...patch } : g) }));
  };
  const deleteGoal = (id: string): void => {
    setState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
    if (selectedGoalId === id) setSelectedGoalId(null);
  };

  // 切 scope / 删目标后，若选中的不在当前列表里，回退到首个
  useEffect(() => {
    if (selectedGoalId && !goals.some(g => g.id === selectedGoalId)) {
      setSelectedGoalId(null);
      setHeroEditing(false);
    }
  }, [scope, goals, selectedGoalId]);

  const planned = goals.filter(g => g.progress === 0);
  const active  = goals.filter(g => g.progress > 0 && g.progress < 100);
  const done    = goals.filter(g => g.progress >= 100);

  // hero 优先展示选中目标，没有就回退到第一个
  const heroGoal = (selectedGoalId ? goals.find(g => g.id === selectedGoalId) : null) ?? goals[0] ?? null;
  const heroIndex = heroGoal ? goals.findIndex(g => g.id === heroGoal.id) + 1 : 0;
  const scopeLabel = scope === "week" ? "周度目标" : scope === "month" ? "月度目标" : scope === "year" ? "年度目标" : "全部目标";

  const selectGoalAndEdit = (id: string): void => {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    setSelectedGoalId(id);
    setHeroDraft(g.title);
    setHeroEditing(true);
  };

  const pyramidLevels = {
    year:  state.goals.filter(g => g.scope === "year"),
    month: state.goals.filter(g => g.scope === "month"),
    week:  state.goals.filter(g => g.scope === "week"),
  };

  const startEditHero = (): void => {
    if (!heroGoal) return;
    setHeroDraft(heroGoal.title);
    setHeroEditing(true);
  };
  const cancelEditHero = (): void => { setHeroEditing(false); setHeroDraft(""); };
  const saveEditHero = (): void => {
    if (!heroGoal) return;
    const t = heroDraft.trim();
    if (t) updateGoal(heroGoal.id, { title: t });
    setHeroEditing(false);
  };

  return (
    <>
      {/* 顶部行：hero 卡 + 金字塔卡 */}
      <div className="gm-goals-top">
        {/* HERO 卡 */}
        <div className={`gm-card gm-goal-hero ${heroEditing ? "is-editing" : ""}`}>
          <div className="gm-goal-hero__head">
            <div className="gm-goal-hero__title-row">
              <span className="gm-goal-hero__scope">{scopeLabel}</span>
              <button className="gm-icon-btn gm-goal-hero__editbtn"
                title={heroEditing ? "退出编辑" : heroGoal ? "编辑" : "新增目标"}
                onClick={heroEditing ? cancelEditHero : heroGoal ? startEditHero : () => setModalOpen(true)}>✎</button>
            </div>
            <div className="gm-goal-hero__tabs">
              {(["week", "month", "year", "all"] as const).map(s => (
                <button key={s}
                  className={`gm-range__chip ${scope === s ? "is-active" : ""}`}
                  style={{ padding: "4px 14px" }}
                  onClick={() => { setScope(s); setHeroEditing(false); }}>
                  {s === "week" ? "周度" : s === "month" ? "月度" : s === "year" ? "年度" : "全部"}
                </button>
              ))}
            </div>
          </div>

          {heroEditing && heroGoal ? (
            <>
              <div className="gm-goal-hero__editor">
                <textarea className="gm-goal-hero__editor-field"
                  value={heroDraft}
                  onChange={e => setHeroDraft(e.target.value)}
                  autoFocus />
                <div className="gm-goal-hero__editor-actions">
                  <button className="gm-goal-hero__editor-undo" title="撤销"
                    onClick={() => setHeroDraft(heroGoal.title)}>↶</button>
                  <button className="gm-goal-hero__editor-save" title="保存"
                    onClick={saveEditHero}>✓</button>
                </div>
              </div>
              <div className="gm-goal-hero__meta">
                共 {goals.length} 个目标{goals.length > 1 && heroGoal ? ` · 当前 ${heroIndex} / ${goals.length}` : ""}
              </div>
            </>
          ) : (
            <>
              <div
                className="gm-goal-hero__big is-clickable"
                title={heroGoal ? "点击编辑" : "点击新增目标"}
                onClick={heroGoal ? startEditHero : () => setModalOpen(true)}>
                {heroGoal ? heroGoal.title : `等待填写${scopeLabel}。`}
              </div>
              <div className="gm-goal-hero__meta">
                共 {goals.length} 个目标{goals.length > 1 && heroGoal ? ` · 当前 ${heroIndex} / ${goals.length}` : ""}
              </div>
              <div className="gm-goal-hero__bar">
                <span style={{ width: `${heroGoal?.progress ?? 0}%` }} />
              </div>
            </>
          )}
        </div>

        {/* 金字塔卡 */}
        <div className="gm-card gm-pyramid-card">
          <div className="gm-card__head">
            <div className="gm-card__title">▦ 目标金字塔</div>
            <button className="gm-chip" onClick={() => setScope("all")}>全部目标</button>
          </div>
          <PyramidGlyph levels={pyramidLevels} highlight={scope} onPick={setScope} />
        </div>
      </div>

      {/* 看板 3 栏 */}
      <div className="gm-kanban">
        <KanbanCol title="计划中" status="planned" goals={planned}
          selectedId={heroGoal?.id ?? null} onSelectEdit={selectGoalAndEdit}
          onAdd={() => setModalOpen(true)} onUpdate={updateGoal} onDelete={deleteGoal} />
        <KanbanCol title="正在进行" status="active" goals={active}
          selectedId={heroGoal?.id ?? null} onSelectEdit={selectGoalAndEdit}
          onAdd={() => setModalOpen(true)} onUpdate={updateGoal} onDelete={deleteGoal} />
        <KanbanCol title="已完成" status="done" goals={done}
          selectedId={heroGoal?.id ?? null} onSelectEdit={selectGoalAndEdit}
          onAdd={() => setModalOpen(true)} onUpdate={updateGoal} onDelete={deleteGoal} />
      </div>

      {modalOpen && <GoalModal defaultScope={scope === "all" ? "week" : scope} onSave={addGoal} onCancel={() => setModalOpen(false)} />}
    </>
  );
}

type GoalStatus = "planned" | "active" | "done";

function goalPeriodLabel(goal: Goal): string {
  const ref = goal.due ? new Date(goal.due) : new Date(goal.createdAt);
  if (goal.scope === "year") return `${ref.getFullYear()}年`;
  if (goal.scope === "month") return `${ref.getFullYear()}年${ref.getMonth() + 1}月`;
  const offset = (ref.getDay() + 6) % 7;
  const mon = new Date(ref); mon.setDate(ref.getDate() - offset);
  const sun = new Date(mon);  sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}月${mon.getDate()}日 - ${sun.getMonth() + 1}月${sun.getDate()}日`;
}

function goalStatusLabel(status: GoalStatus): string {
  return status === "planned" ? "未进行" : status === "active" ? "正在进行" : "已完成";
}

function KanbanCol({ title, status, goals, selectedId, onSelectEdit, onAdd, onUpdate, onDelete }: {
  title: string; status: GoalStatus; goals: Goal[];
  selectedId: string | null; onSelectEdit: (id: string) => void;
  onAdd: () => void; onUpdate: (id: string, p: Partial<Goal>) => void; onDelete: (id: string) => void;
}): ReactNode {
  return (
    <div className="gm-card gm-kanban-col">
      <div className="gm-card__head">
        <div className="gm-card__title">{title}</div>
        <div className="gm-row" style={{ gap: 6 }}>
          <span className="gm-badge">{goals.length}</span>
          <button className="gm-inputbar__plus" style={{ width: 24, height: 24 }} onClick={onAdd} title="新增">+</button>
        </div>
      </div>
      {goals.length === 0 ? (
        <div className="gm-empty" style={{ padding: 16, fontSize: 12 }}>暂无{title}的目标卡片。</div>
      ) : (
        <div className="gm-goal-cards">
          {goals.map(g => (
            <GoalCard key={g.id} goal={g} status={status}
              isSelected={g.id === selectedId} onSelectEdit={onSelectEdit}
              onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, status, isSelected, onSelectEdit, onUpdate, onDelete }: {
  goal: Goal; status: GoalStatus;
  isSelected: boolean; onSelectEdit: (id: string) => void;
  onUpdate: (id: string, p: Partial<Goal>) => void; onDelete: (id: string) => void;
}): ReactNode {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (): void => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);
  const handleProgress = (v: number): void => {
    onUpdate(goal.id, { progress: v });
    setSaved(true);
    if (savedRef.current) window.clearTimeout(savedRef.current);
    savedRef.current = window.setTimeout(() => setSaved(false), 1600);
  };
  return (
    <div className={`gm-goal-card gm-goal-card--${status} ${isSelected ? "is-selected" : ""}`}>
      <div className="gm-goal-card__head">
        <span className="gm-goal-card__period">{goalPeriodLabel(goal)}</span>
        <button className="gm-goal-card__menu" title="更多"
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}>⋯ ⌄</button>
        {menuOpen && (
          <div className="gm-goal-card__menupop" onClick={e => e.stopPropagation()}>
            <button onClick={() => { onDelete(goal.id); setMenuOpen(false); }}>删除目标</button>
          </div>
        )}
      </div>
      <div className="gm-goal-card__title is-clickable" title="点击编辑此目标"
        onClick={() => onSelectEdit(goal.id)}>{goal.title}</div>
      <div className="gm-goal-card__progress">
        <input type="range" min={0} max={100} value={goal.progress}
          onChange={e => handleProgress(parseInt(e.target.value))}
          style={{ "--gm-p": `${goal.progress}%` } as CSSProperties} />
        <span className="gm-goal-card__pct">{goal.progress}%</span>
      </div>
      <div className="gm-goal-card__foot">
        <span className={`gm-goal-card__status gm-goal-card__status--${status}`}>{goalStatusLabel(status)}</span>
        {status !== "planned" && (
          <span className="gm-goal-card__saved">{saved ? "已自动保存" : "已自动保存"}</span>
        )}
      </div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

function PyramidGlyph({ levels, highlight, onPick }: {
  levels: { year: Goal[]; month: Goal[]; week: Goal[] };
  highlight: "year" | "month" | "week" | "all";
  onPick: (s: "year" | "month" | "week") => void;
}): ReactNode {
  // 金字塔在 viewBox 460x300 内画三段。each band = 一个独立多边形，可独立点击+高亮。
  // 顶尖 → 底基 之间分两道水平切线 → 三段：年(顶三角) / 月(中梯形) / 周(底梯形)
  const APEX = { x: 230, y: 28 };
  const D1L = { x: 145, y: 124 }; const D1R = { x: 315, y: 124 };  // 年-月 分割
  const D2L = { x: 92,  y: 196 }; const D2R = { x: 368, y: 196 };  // 月-周 分割
  const BL  = { x: 40,  y: 270 }; const BR  = { x: 420, y: 270 };  // 底

  const yearPts  = `${APEX.x},${APEX.y} ${D1R.x},${D1R.y} ${D1L.x},${D1L.y}`;
  const monthPts = `${D1L.x},${D1L.y} ${D1R.x},${D1R.y} ${D2R.x},${D2R.y} ${D2L.x},${D2L.y}`;
  const weekPts  = `${D2L.x},${D2L.y} ${D2R.x},${D2R.y} ${BR.x},${BR.y} ${BL.x},${BL.y}`;

  const txt = (arr: Goal[]): string => arr.length === 0 ? "待设置" : arr[0].title.slice(0, 10);

  const band = (key: "year" | "month" | "week", pts: string): ReactNode => {
    const isOn = highlight === key || highlight === "all";
    return (
      <polygon
        points={pts}
        fill={isOn ? "rgba(217,154,62,0.14)" : "transparent"}
        stroke={isOn ? "var(--gm-amber-2)" : "var(--gm-amber)"}
        strokeWidth={isOn ? 2.2 : 1.2}
        style={isOn ? { filter: "drop-shadow(0 0 6px rgba(217,154,62,0.55))", cursor: "pointer" } : { cursor: "pointer", opacity: 0.55 }}
        onClick={() => onPick(key)}
      />
    );
  };

  return (
    <svg viewBox="0 0 460 300" style={{ width: "100%", height: 260, display: "block" }}>
      <defs>
        <linearGradient id="gm-pyramid-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gm-amber)" stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--gm-amber)" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* 三段（顺序：先底再上，让顶层叠在上面） */}
      {band("week", weekPts)}
      {band("month", monthPts)}
      {band("year", yearPts)}

      {/* 层内文字 */}
      <text x={APEX.x} y={(APEX.y + D1L.y) / 2 + 6} textAnchor="middle"
        fill={highlight === "year" || highlight === "all" ? "var(--gm-amber-2)" : "var(--gm-amber)"}
        fontSize="11" fontWeight={highlight === "year" ? 600 : 400}>
        {txt(levels.year)}
      </text>
      <text x={APEX.x} y={(D1L.y + D2L.y) / 2 + 5} textAnchor="middle"
        fill={highlight === "month" || highlight === "all" ? "var(--gm-amber-2)" : "var(--gm-amber)"}
        fontSize="12" fontWeight={highlight === "month" ? 600 : 400}>
        {txt(levels.month)}
      </text>
      <text x={APEX.x} y={(D2L.y + BL.y) / 2 + 5} textAnchor="middle"
        fill={highlight === "week" || highlight === "all" ? "var(--gm-amber-2)" : "var(--gm-amber)"}
        fontSize="12" fontWeight={highlight === "week" ? 600 : 400}>
        {txt(levels.week)}
      </text>

      {/* 右侧引线 + 标签：年 / 月 / 周 */}
      <line x1={D1R.x} y1={(APEX.y + D1L.y) / 2 + 2} x2="420" y2={(APEX.y + D1L.y) / 2 + 2}
        stroke="var(--gm-amber)" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.6" />
      <text x="438" y={(APEX.y + D1L.y) / 2 + 6} fill="var(--gm-amber-2)" fontSize="13" fontWeight={highlight === "year" ? 600 : 400}>年</text>

      <line x1={D2R.x} y1={(D1L.y + D2L.y) / 2 + 2} x2="420" y2={(D1L.y + D2L.y) / 2 + 2}
        stroke="var(--gm-amber)" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.6" />
      <text x="438" y={(D1L.y + D2L.y) / 2 + 6} fill="var(--gm-amber-2)" fontSize="13" fontWeight={highlight === "month" ? 600 : 400}>月</text>

      <line x1={BR.x} y1={(D2L.y + BL.y) / 2 + 2} x2="420" y2={(D2L.y + BL.y) / 2 + 2}
        stroke="var(--gm-amber)" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.6" />
      <text x="438" y={(D2L.y + BL.y) / 2 + 6} fill="var(--gm-amber-2)" fontSize="13" fontWeight={highlight === "week" ? 600 : 400}>周</text>
    </svg>
  );
}

export function GoalModal({ defaultScope, editing, lockedPlanId, lockedPlanTitle, lockedParentId, lockedParentTitle, onSave, onCancel }: {
  defaultScope: "year" | "month" | "week";
  /** 传入则进入编辑态：标题变 "编辑目标"，按钮变 "保存"，预填字段。 */
  editing?: Goal;
  /** 锁定归属：从 PlanDetailView 调起时传 plan.id；用户看到只读"归属：<plan title>"行，不能改归属。 */
  lockedPlanId?: string;
  lockedPlanTitle?: string;
  /** 锁定父目标：例如从月度卡的"+ 新建周计划"调起时传 month.id；保存的 goal.parentId 就是它。 */
  lockedParentId?: string;
  lockedParentTitle?: string;
  onSave: (g: Omit<Goal, "id" | "createdAt">) => void;
  onCancel: () => void;
}): ReactNode {
  const [scope, setScope] = useState<"year" | "month" | "week">(editing?.scope ?? defaultScope);
  const initBody = editing ? (editing.detail ? `${editing.title}\n${editing.detail}` : editing.title) : "";
  const [body, setBody] = useState(initBody);
  const [progress, setProgress] = useState(editing?.progress ?? 0);
  const [aiBusy, setAiBusy] = useState(false);

  // 根据 scope 算出当前周期的起止 + 标签
  const { rangeLabel, periodTag, periodLabel, dueIso } = useMemo(() => {
    const now = new Date();
    if (scope === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end   = new Date(now.getFullYear(), 11, 31);
      return {
        rangeLabel: `${start.getFullYear()}年1月1日 - ${end.getFullYear()}年12月31日`,
        periodTag: "本年",
        periodLabel: `本年 · ${now.getFullYear()}年`,
        dueIso: ymd(end),
      };
    }
    if (scope === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        rangeLabel: `${start.getFullYear()}年${start.getMonth() + 1}月1日 - ${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`,
        periodTag: "本月",
        periodLabel: `本月 · ${now.getFullYear()}年${now.getMonth() + 1}月`,
        dueIso: ymd(end),
      };
    }
    const offset = (now.getDay() + 6) % 7;
    const start = new Date(now); start.setDate(now.getDate() - offset);
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    return {
      rangeLabel: `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`,
      periodTag: "本周",
      periodLabel: `本周 · ${start.getMonth() + 1}月${start.getDate()}日起`,
      dueIso: ymd(end),
    };
  }, [scope]);

  const scopeTabs: { id: "year" | "month" | "week"; label: string }[] = [
    { id: "year",  label: "年度目标" },
    { id: "month", label: "本月目标" },
    { id: "week",  label: "本周目标" },
  ];

  const callAI = async (): Promise<void> => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const sys = `你是参谋长 Nova，给用户拟定 ${scopeTabs.find(t => t.id === scope)?.label}。基于以下周期：${rangeLabel}。返回一段简洁的目标描述，第一句是目标标题，后续 1-2 句是关键动作与预期结果。不超过 80 字。不要列表。`;
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [
          { role: "system", content: sys },
          { role: "user", content: body.trim() ? `当前已写的草稿：${body.trim()}。请帮我润色、补全成完整目标。` : "请给我一个该周期下值得推进的目标。" },
        ] }),
      });
      const j = await r.json();
      const text = j.message?.content ?? "";
      if (text) setBody(text.trim());
    } catch (e) {
      console.warn("AI generate failed", e);
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = (): void => {
    const text = body.trim();
    if (!text) return;
    const firstLine = text.split(/\n+/)[0].slice(0, 80);
    const rest = text.length > firstLine.length ? text.slice(firstLine.length).trim() : "";
    const planId = lockedPlanId ?? editing?.planId;
    const parentId = lockedParentId ?? editing?.parentId;
    onSave({
      title: firstLine,
      scope,
      detail: rest,
      phase: progress >= 100 ? "close" : progress > 0 ? "execute" : "calibrate",
      due: dueIso,
      progress,
      ...(planId ? { planId } : {}),
      ...(parentId ? { parentId } : {}),
    });
  };

  return (
    <div className="gm-modal-back" onClick={onCancel}>
      <div className="gm-goal-modal" onClick={e => e.stopPropagation()}>
        {/* 顶部：标题 + 副标题 + 右上角取消/添加 */}
        <div className="gm-goal-modal__head">
          <div>
            <div className="gm-goal-modal__title">{editing ? "编辑目标" : "新增目标"}</div>
            <div className="gm-goal-modal__sub">{rangeLabel}</div>
          </div>
          <div className="gm-row" style={{ gap: 8 }}>
            <button className="gm-btn" onClick={onCancel}>取消</button>
            <button className="gm-btn is-primary" disabled={!body.trim()} onClick={handleSave}>{editing ? "保存" : "添加"}</button>
          </div>
        </div>

        {/* 范围 pill tabs */}
        <div className="gm-row" style={{ gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: "var(--gm-text-mute)", marginRight: 4 }}>范围</span>
          {scopeTabs.map(t => (
            <button key={t.id}
              className={`gm-range__chip ${scope === t.id ? "is-active" : ""}`}
              style={{ padding: "5px 14px" }}
              onClick={() => setScope(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 归属计划 / 父目标 只读信息（来自 PlanDetailView 调用时锁定）*/}
        {(lockedPlanTitle || lockedParentTitle) && (
          <div className="gm-goal-modal__locks">
            {lockedPlanTitle && (
              <div className="gm-goal-modal__lock">
                <span className="gm-goal-modal__lock-label">归属计划</span>
                <span className="gm-goal-modal__lock-value">{lockedPlanTitle}</span>
              </div>
            )}
            {lockedParentTitle && (
              <div className="gm-goal-modal__lock">
                <span className="gm-goal-modal__lock-label">父目标</span>
                <span className="gm-goal-modal__lock-value">{lockedParentTitle}</span>
              </div>
            )}
          </div>
        )}

        {/* 周期选择器 */}
        <div className="gm-goal-modal__period">
          <div>
            <div style={{ fontSize: 11, color: "var(--gm-text-mute)" }}>周期</div>
            <div style={{ fontSize: 12, color: "var(--gm-amber-2)" }}>{periodTag}</div>
          </div>
          <div className="gm-row" style={{ gap: 6, color: "var(--gm-amber-2)", fontSize: 13 }}>
            <span style={{ fontSize: 10 }}>▾</span>
            <span>{periodLabel}</span>
            <span style={{ fontSize: 10 }}>▾</span>
          </div>
        </div>

        {/* 任务目标 + AI 按钮 */}
        <div className="gm-row" style={{ justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "var(--gm-text-mute)" }}>任务目标</span>
          <button className="gm-ai-btn" onClick={callAI} disabled={aiBusy}>
            ✦ {aiBusy ? "生成中…" : "AI 总部下发任务"}
          </button>
        </div>
        <textarea className="gm-goal-modal__body"
          placeholder="描述目标和预期结果"
          value={body}
          onChange={e => setBody(e.target.value)} />

        {/* 完成进度 */}
        <div>
          <div className="gm-row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "var(--gm-text-mute)" }}>完成进度</span>
            <span style={{ fontSize: 13, color: "var(--gm-amber-2)", fontWeight: 600 }}>{progress}%</span>
          </div>
          <input type="range" min={0} max={100} value={progress}
            onChange={e => setProgress(parseInt(e.target.value))}
            style={{ width: "100%", accentColor: "var(--gm-amber)" }} />
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 事件洞察（P4）
// =================================================================
function EventsSection({ state, setState }: SectionProps): ReactNode {
  const [scope, setScope] = useState<"week" | "month" | "year" | "all">("week");
  const [viewMode, setViewMode] = useState<"topic" | "timeline">("topic");
  const [sortMode, setSortMode] = useState<"recent" | "heat">("recent");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const events = state.events;

  // 当前 scope 范围过滤（简化：scope == all 显示全部，其它按 updatedAt 时间窗）
  const cutoff = useMemo(() => {
    const now = Date.now();
    if (scope === "week")  return now - 7  * 86400000;
    if (scope === "month") return now - 30 * 86400000;
    if (scope === "year")  return now - 365 * 86400000;
    return 0;
  }, [scope]);
  const filtered = events
    .filter(e => e.updatedAt >= cutoff)
    .filter(e => !search.trim() || e.title.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) =>
    sortMode === "heat" ? b.heat - a.heat : b.updatedAt - a.updatedAt
  );

  // 本周在做：最近一条事件的最新 note，或空态
  const heroEvent = events.length === 0 ? null
    : [...events].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const heroText = heroEvent
    ? (heroEvent.notes[heroEvent.notes.length - 1]?.text ?? heroEvent.title)
    : "本周还没有可显示的主题。";

  // KPI 计算
  const kpiTotal     = events.length;
  const kpiActive    = filtered.length;
  const kpiNew       = events.filter(e => e.updatedAt >= cutoff && e.notes.length === 0).length;
  const kpiNotes     = events.reduce((s, e) => s + e.notes.filter(n => n.at >= cutoff).length, 0);

  const detail = events.find(e => e.id === selected) ?? null;

  // 泡泡布局（在战术地图区域内）
  const positions = useMemo(() => {
    const W = 900, H = 480;
    return filtered.map((e, i) => {
      const angle = (i / Math.max(filtered.length, 1)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.32;
      return { id: e.id, cx: W / 2 + r * Math.cos(angle), cy: H / 2 + r * Math.sin(angle), size: 40 + e.heat * 1.1 };
    });
  }, [filtered]);

  const addEvent = (): void => {
    const t = draft.trim();
    if (!t) return;
    const e: EventItem = { id: uid(), title: t, heat: 30, category: "", updatedAt: Date.now(), notes: [] };
    setState(prev => ({ ...prev, events: [...prev.events, e] }));
    setDraft("");
    setAdding(false);
    setSelected(e.id);
  };
  const delEvent = (id: string): void => {
    setState(prev => ({ ...prev, events: prev.events.filter(x => x.id !== id) }));
    if (selected === id) setSelected(null);
  };
  const addNote = (id: string, text: string): void => {
    const tt = text.trim();
    if (!tt) return;
    setState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === id
        ? { ...e, notes: [...e.notes, { at: Date.now(), text: tt }], heat: Math.min(100, e.heat + 5), updatedAt: Date.now() }
        : e),
    }));
  };

  const scopeLabel = scope === "week" ? "本周在做" : scope === "month" ? "本月在做" : scope === "year" ? "本年在做" : "全部正在推进";

  return (
    <div className="gm-events-v2">
      {/* === 左列 === */}
      <div className="gm-col">
        {/* 本周在做 hero */}
        <div className="gm-card">
          <div className="gm-card__head" style={{ marginBottom: 6 }}>
            <div className="gm-row" style={{ gap: 8 }}>
              <span className="gm-amber-icon">⛀</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gm-amber-2)" }}>{scopeLabel}</span>
              <button className="gm-icon-btn" style={{ width: 22, height: 22, fontSize: 11 }} title="编辑">✎</button>
            </div>
            <div className="gm-row" style={{ gap: 6 }}>
              {(["week", "month", "year", "all"] as const).map(s => (
                <button key={s}
                  className={`gm-range__chip ${scope === s ? "is-active" : ""}`}
                  style={{ padding: "5px 14px" }}
                  onClick={() => setScope(s)}>
                  {s === "week" ? "本周" : s === "month" ? "本月" : s === "year" ? "本年" : "全部"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gm-amber-2)", marginTop: 12 }}>
            {heroText}
          </div>
        </div>

        {/* 战术地图 */}
        <div className="gm-card gm-flex-1" style={{ display: "flex", flexDirection: "column" }}>
          <div className="gm-card__head">
            <div>
              <div className="gm-card__title">战术地图</div>
              <div className="gm-card__sub">{scope === "week" ? "本周行动关联" : scope === "month" ? "本月升温关系" : scope === "year" ? "本年影响关系" : "全部关系"}</div>
            </div>
            <div className="gm-row" style={{ gap: 6 }}>
              <button className="gm-chip" onClick={() => setState(p => ({ ...p, events: [...p.events] }))}>⟳ 强制刷新</button>
              <div className="gm-chiprow" style={{ gap: 0 }}>
                <button className={`gm-chip ${viewMode === "topic" ? "is-active" : ""}`}
                  style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                  onClick={() => setViewMode("topic")}>主题视图</button>
                <button className={`gm-chip ${viewMode === "timeline" ? "is-active" : ""}`}
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                  onClick={() => setViewMode("timeline")}>时间视角</button>
              </div>
            </div>
          </div>

          {/* 战术地图主体 */}
          <div className="gm-tactical-map">
            {filtered.length === 0 ? (
              <div className="gm-empty" style={{ alignSelf: "flex-end", width: "100%", padding: 14, background: "rgba(217,154,62,0.06)", border: "1px dashed var(--gm-line)", borderRadius: 10, marginTop: "auto" }}>
                当前范围还没有可显示的主题辖区。
              </div>
            ) : viewMode === "topic" ? (
              <div style={{ position: "relative", flex: 1, width: "100%" }}>
                {positions.map(p => {
                  const e = filtered.find(x => x.id === p.id)!;
                  const style: CSSProperties = {
                    width: p.size, height: p.size,
                    left: `calc(${p.cx / 9}% - ${p.size / 2}px)`,
                    top:  `calc(${p.cy / 4.8}% - ${p.size / 2}px)`,
                  };
                  return (
                    <div key={p.id} className={`gm-bubble ${selected === p.id ? "is-selected" : ""}`}
                      style={style} onClick={() => setSelected(p.id)}>{e.title}</div>
                  );
                })}
              </div>
            ) : (
              <div className="gm-timeline">
                {sorted.map(e => (
                  <div key={e.id} className={`gm-timeline-item ${selected === e.id ? "is-selected" : ""}`}
                    onClick={() => setSelected(e.id)}>
                    <span className="gm-timeline-dot" />
                    <div className="gm-grow">
                      <div style={{ fontSize: 13, color: "var(--gm-text)" }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: "var(--gm-text-dim)" }}>
                        {new Date(e.updatedAt).toLocaleDateString("zh-CN")} · 热度 {e.heat} · {e.notes.length} 条
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === 右列 === */}
      <div className="gm-col">
        {/* KPI 2x2 */}
        <div className="gm-card">
          <div className="gm-card__title" style={{ marginBottom: 10 }}>KPI</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <div className="gm-kpi"><div className="gm-kpi__num">{kpiTotal}</div><div className="gm-kpi__label">事件总数</div></div>
            <div className="gm-kpi"><div className="gm-kpi__num">{kpiActive}</div><div className="gm-kpi__label">活跃主题</div></div>
            <div className="gm-kpi"><div className="gm-kpi__num">{kpiNew}</div><div className="gm-kpi__label">新增事件</div></div>
            <div className="gm-kpi"><div className="gm-kpi__num">{kpiNotes}</div><div className="gm-kpi__label">范围记录</div></div>
          </div>
        </div>

        {/* 搜索 + 新建 */}
        <div className="gm-card" style={{ padding: 10 }}>
          <div className="gm-row" style={{ gap: 8 }}>
            <div className="gm-inputbar" style={{ flex: 1, margin: 0 }}>
              <span style={{ color: "var(--gm-text-mute)" }}>⌕</span>
              <input className="gm-inputbar__field" placeholder="搜索事件"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="gm-btn is-primary" onClick={() => setAdding(true)}>+ 新建事件</button>
          </div>
          {adding && (
            <div className="gm-row gm-mt12" style={{ gap: 6 }}>
              <input style={{ background: "var(--gm-bg-input)", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--gm-line)", color: "var(--gm-text)", outline: "none", flex: 1, fontSize: 12 }}
                placeholder="主题名" value={draft} autoFocus onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addEvent(); if (e.key === "Escape") setAdding(false); }} />
              <button className="gm-btn is-primary" onClick={addEvent} style={{ padding: "4px 10px" }}>保存</button>
              <button className="gm-btn" onClick={() => setAdding(false)} style={{ padding: "4px 10px" }}>取消</button>
            </div>
          )}
        </div>

        {/* 周度事件 list */}
        <div className="gm-card gm-flex-1" style={{ display: "flex", flexDirection: "column" }}>
          <div className="gm-card__head">
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gm-amber-2)" }}>
                {scope === "week" ? "周度" : scope === "month" ? "月度" : scope === "year" ? "年度" : "全部"}事件
              </span>
              <span style={{ fontSize: 11, color: "var(--gm-text-mute)", marginLeft: 6 }}>{sorted.length} 个事件</span>
            </div>
            <button className="gm-chip" onClick={() => setSortMode(sortMode === "recent" ? "heat" : "recent")}>
              {sortMode === "recent" ? "最新优先" : "热度优先"} ⌄
            </button>
          </div>
          <div className="gm-tasks" style={{ flex: 1, overflowY: "auto" }}>
            {sorted.length === 0 ? (
              <div className="gm-empty" style={{ padding: 14, fontSize: 12 }}>没有找到匹配的事件。</div>
            ) : sorted.map(e => (
              <div key={e.id} className={`gm-task ${selected === e.id ? "is-active" : ""}`} onClick={() => setSelected(e.id)}>
                <div className="gm-task__body">
                  <div className="gm-task__title">{e.title}</div>
                  <div className="gm-task__sub">热度 {e.heat} · {e.notes.length} 条记录</div>
                </div>
                <button className="gm-task__del" onClick={(ev) => { ev.stopPropagation(); delEvent(e.id); }}>×</button>
              </div>
            ))}
          </div>
          <div className="gm-row" style={{ justifyContent: "space-between", padding: "8px 6px 0", borderTop: "1px solid var(--gm-line)", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--gm-text-mute)" }}>✉ 查看相关事件 ({sorted.length})</span>
          </div>
        </div>
      </div>

      {/* 选中事件的详情浮层（在地图区域内） */}
      {detail && (
        <div className="gm-event-detail-pop">
          <div className="gm-card__head">
            <div>
              <div className="gm-card__title">{detail.title}</div>
              <div className="gm-card__sub">热度 {detail.heat} · {detail.notes.length} 条记录 · {new Date(detail.updatedAt).toLocaleString("zh-CN")}</div>
            </div>
            <button className="gm-task__del" onClick={() => setSelected(null)} title="关闭">×</button>
          </div>
          <textarea className="gm-quad__field" placeholder="给这个主题加一条记录（⌘ + Enter 提交）…"
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                const v = (e.target as HTMLTextAreaElement).value;
                addNote(detail.id, v);
                (e.target as HTMLTextAreaElement).value = "";
              }
            }} />
          <div className="gm-tasks gm-mt12" style={{ maxHeight: 240, overflowY: "auto" }}>
            {detail.notes.slice().reverse().map((n, i) => (
              <div key={i} className="gm-task">
                <div className="gm-task__body">
                  <div className="gm-task__title">{n.text}</div>
                  <div className="gm-task__sub">{new Date(n.at).toLocaleString("zh-CN")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// 数据分析（P5）
// =================================================================
function AnalyticsSection({ state, setState }: SectionProps): ReactNode {
  // —— Phase A: 可视化 + 卡点识别（纯计算，无 AI 调用） ——
  const kpis = useMemo(() => computeOverallKPIs(
    state.plans as Parameters<typeof computeOverallKPIs>[0],
    state.goals as Parameters<typeof computeOverallKPIs>[1],
    state.tasks as Parameters<typeof computeOverallKPIs>[2],
  ), [state.plans, state.goals, state.tasks]);

  const planHealths = useMemo(() => {
    const active = state.plans.filter(p => p.status === "active");
    return active.map(p => computePlanHealth(
      p as Parameters<typeof computePlanHealth>[0],
      state.goals as Parameters<typeof computePlanHealth>[1],
      state.tasks as Parameters<typeof computePlanHealth>[2],
    )).sort((a, b) => {
      // 排序：critical > behind > healthy > completed > no-time
      const order = { critical: 0, behind: 1, healthy: 2, "no-time": 3, completed: 4 };
      return order[a.status] - order[b.status];
    });
  }, [state.plans, state.goals, state.tasks]);

  const overdueTasks = useMemo(() => findOverdueTasks(state.tasks as Parameters<typeof findOverdueTasks>[0]), [state.tasks]);
  const stuckGoals = useMemo(() => findStuckGoals(state.goals as Parameters<typeof findStuckGoals>[0], state.tasks as Parameters<typeof findStuckGoals>[1]), [state.goals, state.tasks]);
  const goalsWithoutTasks = useMemo(() => findGoalsWithoutTasks(state.goals as Parameters<typeof findGoalsWithoutTasks>[0], state.tasks as Parameters<typeof findGoalsWithoutTasks>[1]), [state.goals, state.tasks]);
  const orphanTasks = useMemo(() => findOrphanTasks(state.tasks as Parameters<typeof findOrphanTasks>[0], state.goals as Parameters<typeof findOrphanTasks>[1]), [state.tasks, state.goals]);

  // 辅助：goal/plan 标题
  const goalById = (id: string): { title: string; planTitle: string } | null => {
    const g = state.goals.find(x => x.id === id);
    if (!g) return null;
    const p = g.planId ? state.plans.find(x => x.id === g.planId) : null;
    return { title: g.title, planTitle: p?.title ?? "" };
  };

  const statusLabel: Record<PlanHealthStatus, { text: string; cls: string; icon: string }> = {
    healthy:   { text: "进度健康",       cls: "is-healthy",  icon: "🟢" },
    behind:    { text: "略落后",         cls: "is-behind",   icon: "🟡" },
    critical:  { text: "严重落后",       cls: "is-critical", icon: "🔴" },
    completed: { text: "已完成",         cls: "is-completed", icon: "✅" },
    "no-time": { text: "未设起止时间",    cls: "is-no-time",  icon: "⚪" },
  };

  return (
    <div className="gm-analytics-v3">
      {/* 顶部 4 KPI */}
      <div className="gm-analytics-v3__kpis">
        <div className="gm-kpi">
          <div className="gm-kpi__num">{kpis.activePlans}</div>
          <div className="gm-kpi__label">活跃计划</div>
        </div>
        <div className="gm-kpi">
          <div className="gm-kpi__num">{kpis.weekDone}/{kpis.weekTotal}</div>
          <div className="gm-kpi__label">本周完成</div>
        </div>
        <div className="gm-kpi">
          <div className="gm-kpi__num">{kpis.overallProgress}%</div>
          <div className="gm-kpi__label">整体进度</div>
        </div>
        <div className="gm-kpi">
          <div className="gm-kpi__num">{kpis.streak}</div>
          <div className="gm-kpi__label">连续打卡</div>
        </div>
      </div>

      {/* 中部双栏：左 健康度 / 右 卡点 */}
      <div className="gm-analytics-v3__main">
        {/* —— 左：计划推进总览 —— */}
        <div className="gm-card gm-analytics-v3__col">
          <div className="gm-card__head">
            <div className="gm-card__title">计划推进总览</div>
            <div className="gm-card__sub">按健康度排序</div>
          </div>
          <div className="gm-analytics-v3__plans">
            {planHealths.length === 0 && (
              <div className="gm-empty" style={{ padding: 20, fontSize: 12 }}>
                还没有活跃计划。去首页新建一个开始。
              </div>
            )}
            {planHealths.map(h => {
              const sl = statusLabel[h.status];
              return (
                <div key={h.plan.id} className={`gm-analytics-v3__plan ${sl.cls}`}>
                  <div className="gm-analytics-v3__plan-head">
                    <span className="gm-analytics-v3__plan-status" title={sl.text}>{sl.icon}</span>
                    <span className="gm-analytics-v3__plan-title">{h.plan.title}</span>
                    <span className="gm-analytics-v3__plan-pct">{h.progress}%</span>
                  </div>
                  <div className="gm-analytics-v3__plan-bar">
                    <span className="gm-analytics-v3__plan-bar-progress" style={{ width: `${h.progress}%` }} />
                    {h.status !== "no-time" && (
                      <span className="gm-analytics-v3__plan-bar-time" style={{ left: `${h.timeProgress}%` }} title={`时间已过 ${h.timeProgress}%`} />
                    )}
                  </div>
                  <div className="gm-analytics-v3__plan-meta">
                    {h.status === "no-time" ? (
                      <span>未设起止时间，无法对比时间进度</span>
                    ) : (
                      <>
                        <span>时间已过 {h.timeProgress}% · {h.delta >= 0 ? `提前 ${h.delta}%` : `落后 ${-h.delta}%`}</span>
                        <span>本周 {h.weekDone}/{h.weekTotal} 任务</span>
                        {h.daysLeft >= 0 ? <span>还剩 {h.daysLeft} 天</span> : <span style={{ color: "#ff9a8a" }}>已过期 {-h.daysLeft} 天</span>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* —— 右：卡点 & 风险 —— */}
        <div className="gm-card gm-analytics-v3__col">
          <div className="gm-card__head">
            <div className="gm-card__title">卡点 & 风险</div>
            <div className="gm-card__sub">自动识别</div>
          </div>
          <div className="gm-analytics-v3__blockers">

            <BlockerGroup
              icon="🔴"
              title="逾期未完成"
              count={overdueTasks.length}
              empty="没有逾期任务"
              items={overdueTasks.slice(0, 8).map(t => {
                const g = goalById(t.goalId);
                return {
                  key: t.id,
                  primary: t.title,
                  secondary: `${t.date} · ${g ? `${g.planTitle} · ${g.title}` : "无目标"}`,
                };
              })}
              moreCount={Math.max(0, overdueTasks.length - 8)} />

            <BlockerGroup
              icon="🟡"
              title="长时间未推进的目标（14天）"
              count={stuckGoals.length}
              empty="所有目标都在推进"
              items={stuckGoals.slice(0, 8).map(g => {
                const p = g.planId ? state.plans.find(x => x.id === g.planId) : null;
                return {
                  key: g.id,
                  primary: g.title,
                  secondary: p ? `计划: ${p.title}` : "无所属计划",
                };
              })}
              moreCount={Math.max(0, stuckGoals.length - 8)} />

            <BlockerGroup
              icon="⚠️"
              title="无任务的目标（永远 0%）"
              count={goalsWithoutTasks.length}
              empty="所有叶目标都有任务"
              items={goalsWithoutTasks.slice(0, 8).map(g => {
                const p = g.planId ? state.plans.find(x => x.id === g.planId) : null;
                return {
                  key: g.id,
                  primary: g.title,
                  secondary: p ? `计划: ${p.title} · 给它加任务才能推进` : "无所属计划",
                };
              })}
              moreCount={Math.max(0, goalsWithoutTasks.length - 8)} />

            <BlockerGroup
              icon="📌"
              title="没挂目标的任务（不计入进度）"
              count={orphanTasks.length}
              empty="所有任务都挂到了目标"
              items={orphanTasks.slice(0, 8).map(t => ({
                key: t.id,
                primary: t.title,
                secondary: `${t.date || "未设日期"} · 去任务详情挂到一个目标`,
              }))}
              moreCount={Math.max(0, orphanTasks.length - 8)} />

          </div>
        </div>

        {/* —— 第 3 列：AI 推进建议 (Phase B)，内部滚动 —— */}
        <ProgressAIPanel state={state} setState={setState} planHealths={planHealths}
          overdueCount={overdueTasks.length}
          stuckCount={stuckGoals.length}
          emptyGoalCount={goalsWithoutTasks.length}
          orphanTaskCount={orphanTasks.length} />
      </div>
    </div>
  );
}

// 一个卡点分组的子组件
interface BlockerItem { key: string; primary: string; secondary: string }
function BlockerGroup({ icon, title, count, empty, items, moreCount }: {
  icon: string;
  title: string;
  count: number;
  empty: string;
  items: BlockerItem[];
  moreCount: number;
}): ReactNode {
  return (
    <div className={`gm-analytics-v3__blocker-group ${count === 0 ? "is-empty" : ""}`}>
      <div className="gm-analytics-v3__blocker-head">
        <span>{icon} {title}</span>
        <span className="gm-analytics-v3__blocker-count">{count}</span>
      </div>
      {count === 0 ? (
        <div className="gm-analytics-v3__blocker-empty">{empty} ✓</div>
      ) : (
        <>
          {items.map(it => (
            <div key={it.key} className="gm-analytics-v3__blocker-item">
              <div className="gm-analytics-v3__blocker-primary">{it.primary}</div>
              <div className="gm-analytics-v3__blocker-secondary">{it.secondary}</div>
            </div>
          ))}
          {moreCount > 0 && (
            <div className="gm-analytics-v3__blocker-more">还有 {moreCount} 条 …</div>
          )}
        </>
      )}
    </div>
  );
}

// Phase B：AI 推进建议
// 调用 /api/ai/analyze-progress 拿到 { keyInsight, blockers, pushActions, priorityTasks }
// 持久化到 state.aiAnalyses（最新在前，cap 20），切 tab / 重启 / 跨设备都还在。
function ProgressAIPanel({ state, setState, planHealths, overdueCount, stuckCount, emptyGoalCount, orphanTaskCount }: {
  state: GreatMeState;
  setState: React.Dispatch<React.SetStateAction<GreatMeState>>;
  planHealths: PlanHealth[];
  overdueCount: number;
  stuckCount: number;
  emptyGoalCount: number;
  orphanTaskCount: number;
}): ReactNode {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // 直接从 state 读最新的一条；切 tab / 重启不丢
  const latest: AIAnalysis | null = state.aiAnalyses[0] ?? null;
  const result = latest;

  // 相对时间文案
  const fmtAge = (ts: number): string => {
    const sec = Math.round((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec} 秒前`;
    if (sec < 3600) return `${Math.round(sec / 60)} 分钟前`;
    if (sec < 86400) return `${Math.round(sec / 3600)} 小时前`;
    return `${Math.round(sec / 86400)} 天前`;
  };

  const analyze = async (): Promise<void> => {
    setLoading(true);
    setError("");
    abortRef.current = new AbortController();
    try {
      const r = await fetch("/api/ai/analyze-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: {
            plans: state.plans,
            goals: state.goals,
            tasks: state.tasks,
          },
          metrics: {
            planHealthList: planHealths.map(h => ({
              title: h.plan.title,
              progress: h.progress,
              timeProgress: h.timeProgress,
              delta: h.delta,
              status: h.status,
              weekDone: h.weekDone,
              weekTotal: h.weekTotal,
            })),
            overdueCount, stuckCount, emptyGoalCount, orphanTaskCount,
          },
        }),
        signal: abortRef.current.signal,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const body = await r.json() as { result: Omit<AIAnalysis, "id" | "createdAt"> };
      const newAnalysis: AIAnalysis = {
        id: `aia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        keyInsight: body.result.keyInsight,
        blockers: body.result.blockers,
        pushActions: body.result.pushActions,
        priorityTasks: body.result.priorityTasks,
      };
      // 写入 state.aiAnalyses：最新在前，最多保 20 条
      setState(prev => ({
        ...prev,
        aiAnalyses: [newAnalysis, ...prev.aiAnalyses].slice(0, 20),
      }));
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name === "AbortError") { setLoading(false); return; }
      setError(e.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gm-card gm-analytics-v3__ai">
      <div className="gm-card__head">
        <div className="gm-card__title">🪄 AI 推进建议</div>
        <div className="gm-card__sub">由 Hermes 分析当前推进状况</div>
      </div>
      <div className="gm-analytics-v3__ai-body">
        {!result && !loading && !error && (
          <div className="gm-analytics-v3__ai-empty">
            点下方按钮，让 Rich 看一眼你的卡点 + 给出可执行的推进建议。
          </div>
        )}
        {loading && (
          <div className="gm-analytics-v3__ai-loading">
            <div className="ai-dec-spinner" />
            Hermes 正在分析（30-60 秒）…
            <button className="gm-chip" onClick={() => abortRef.current?.abort()}>取消</button>
          </div>
        )}
        {error && (
          <div className="gm-analytics-v3__ai-error">
            分析失败：{error}
          </div>
        )}
        {result && !loading && (
          <div className="gm-analytics-v3__ai-result">
            <div className="gm-analytics-v3__ai-meta">
              生成于 {fmtAge(result.createdAt)} ({new Date(result.createdAt).toLocaleString("zh-CN")})
              {state.aiAnalyses.length > 1 && <span style={{ marginLeft: 12 }}>· 历史 {state.aiAnalyses.length} 条</span>}
            </div>
            <div className="gm-analytics-v3__ai-insight">
              <div className="gm-analytics-v3__ai-section-title">核心判断</div>
              <div>{result.keyInsight}</div>
            </div>
            {result.blockers.length > 0 && (
              <div className="gm-analytics-v3__ai-block">
                <div className="gm-analytics-v3__ai-section-title">🚧 主要卡点</div>
                <ul>{result.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
              </div>
            )}
            {result.pushActions.length > 0 && (
              <div className="gm-analytics-v3__ai-block">
                <div className="gm-analytics-v3__ai-section-title">🚀 推进办法</div>
                <ul>{result.pushActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            {result.priorityTasks.length > 0 && (
              <div className="gm-analytics-v3__ai-block">
                <div className="gm-analytics-v3__ai-section-title">⭐ 这周优先做的</div>
                {result.priorityTasks.map((p, i) => (
                  <div key={i} className="gm-analytics-v3__ai-priority">
                    <div className="gm-analytics-v3__ai-priority-title">{p.title}</div>
                    <div className="gm-analytics-v3__ai-priority-reason">{p.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="gm-analytics-v3__ai-foot">
        <button className="gm-chip"
          disabled={loading}
          onClick={() => void analyze()}>
          {result ? "↻ 重新分析" : "让 Rich 分析推进策略"}
        </button>
      </div>
    </div>
  );
}

// =================================================================
// 每周复盘（P6）
// =================================================================
function WeeklyReviewSection({ state, setState }: SectionProps): ReactNode {
  const [selectedId, setSelectedId] = useState<string | null>(state.reviews[0]?.id ?? null);
  const [editing, setEditing] = useState<Review | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const reviews = [...state.reviews].sort((a, b) => b.createdAt - a.createdAt);
  const selected = reviews.find(r => r.id === selectedId) ?? reviews[0];

  const saveReview = (r: Review): void => {
    setState(prev => ({ ...prev, reviews: [...prev.reviews.filter(x => x.id !== r.id), r] }));
    setSelectedId(r.id);
    setEditing(null);
  };

  // AI 起草本周复盘：拉本周 tasks/goals/plans + 上一周复盘 → Hermes → 写入 state
  const draftAiReview = async (): Promise<void> => {
    setAiLoading(true);
    setAiError(null);
    aiAbortRef.current = new AbortController();
    try {
      // 本周时间窗（周一-周日）
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7;
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
      const weekStartYmd = ymd(weekStart);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      const weekEndYmd = ymd(weekEnd);

      const weekTasks = state.tasks.filter(t => t.date >= weekStartYmd && t.date <= weekEndYmd);
      const taskGoalIds = new Set(weekTasks.map(t => t.goalId).filter(Boolean));
      const weekGoals = state.goals.filter(g => taskGoalIds.has(g.id));
      const activePlans = state.plans.filter(p => p.status === "active");

      const weekDone = weekTasks.filter(t => t.done).length;
      const weekTotal = weekTasks.length;
      const completionRate = weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100);
      // 卡点统计
      const today = todayYmd();
      const overdue = state.tasks.filter(t => !t.done && t.date && t.date < today);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
      const cutoffYmd = ymd(cutoff);
      const stuck = state.goals.filter(g => {
        const ts = state.tasks.filter(t => t.goalId === g.id);
        if (ts.length === 0 || ts.every(t => t.done)) return false;
        return !ts.some(t => t.done && t.date >= cutoffYmd);
      });

      // 上周复盘（如果有），让 AI 对照"上周说要做但本周没做的"
      const lastReview = reviews.find(r => r.weekOf < weekStartYmd);

      const r = await fetch("/api/ai/draft-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekOf: weekStartYmd,
          weekTasks, weekGoals, activePlans,
          lastReview: lastReview ?? null,
          metrics: {
            weekDone, weekTotal, completionRate,
            overdueCount: overdue.length,
            stuckCount: stuck.length,
          },
        }),
        signal: aiAbortRef.current.signal,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const body = await r.json() as {
        result: {
          score: number;
          victory: string[]; blocker: string[]; planning: string[];
          summary: string;
          perspectives: ReviewPerspective[];
        };
      };

      // 同周已有复盘 → 替换；没有 → 新建
      const existing = state.reviews.find(x => x.weekOf === weekStartYmd);
      const newReview: Review = {
        id: existing?.id ?? `review-ai-${Date.now().toString(36)}`,
        weekOf: weekStartYmd,
        score: body.result.score,
        victory: body.result.victory,
        blocker: body.result.blocker,
        planning: body.result.planning,
        summary: body.result.summary,
        perspectives: body.result.perspectives,
        source: "ai",
        createdAt: Date.now(),
      };
      setState(prev => ({
        ...prev,
        reviews: [...prev.reviews.filter(x => x.id !== newReview.id), newReview],
      }));
      setSelectedId(newReview.id);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name === "AbortError") { setAiLoading(false); return; }
      setAiError(e.message ?? String(err));
    } finally {
      setAiLoading(false);
    }
  };

  const avgScore = reviews.length === 0 ? 0 : Math.round(reviews.reduce((s, r) => s + r.score, 0) / reviews.length);

  return (
    <>
      <div className="gm-row" style={{ justifyContent: "space-between" }}>
        <div className="gm-card__title">每周复盘</div>
        <button className="gm-btn is-primary" onClick={() => void draftAiReview()} disabled={aiLoading}>
          {aiLoading ? "Hermes 起草中…" : "🪄 AI 复盘"}
        </button>
      </div>
      {aiError && (
        <div style={{
          padding: "8px 12px", borderRadius: 8, marginTop: 8,
          background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.3)",
          color: "#ff9a8a", fontSize: 12,
        }}>
          起草失败：{aiError}
        </div>
      )}

      {/* 位置互换：左 = 数据洞察 + 历史；右 = 整体摘要（宽，承载多维度内容） */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.8fr)", gap: 14, alignItems: "start" }}>
        <div className="gm-card">
          <div className="gm-card__title">数据洞察</div>
          <div className="gm-analytics-overview gm-mt12" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div className="gm-kpi"><div className="gm-kpi__num">{reviews.length}</div><div className="gm-kpi__label">复盘次数</div></div>
            <div className="gm-kpi"><div className="gm-kpi__num">{avgScore}</div><div className="gm-kpi__label">平均分</div></div>
          </div>
          <div className="gm-card__title gm-mt20">历史考核</div>
          <div className="gm-tasks gm-mt12" style={{ maxHeight: 360, overflowY: "auto" }}>
            {reviews.length === 0 ? <div className="gm-empty">还没有历史记录</div> :
              reviews.map(r => (
                <div key={r.id} className={`gm-task ${r.id === selectedId ? "is-active" : ""}`} onClick={() => setSelectedId(r.id)}>
                  <div className="gm-task__body">
                    <div className="gm-task__title">
                      {r.weekOf} · {r.score} 分
                      {r.source === "ai" && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "rgba(217,154,62,0.18)", color: "#d99a3e" }}>AI</span>}
                    </div>
                    <div className="gm-task__sub">{new Date(r.createdAt).toLocaleDateString("zh-CN")}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="gm-card">
          <div className="gm-card__head">
            <div>
              <div className="gm-card__title">整体摘要</div>
              <div className="gm-card__sub">
                {selected ? `第 ${selected.weekOf} 周起 · ${new Date(selected.createdAt).toLocaleDateString("zh-CN")}` : "选择一份复盘查看详情"}
              </div>
            </div>
            {selected && <span className="gm-badge">{selected.score} 分</span>}
          </div>
          {!selected ? (
            <div className="gm-empty">
              <div>暂无复盘记录</div>
              <button className="gm-empty__cta" onClick={() => void draftAiReview()}>🪄 让 Rich 起草本周复盘</button>
            </div>
          ) : (
            <>
              <div className="gm-mt12" style={{ lineHeight: 1.7 }}>{selected.summary || "（暂无摘要）"}</div>

              <div className="gm-report-3col gm-mt20">
                <ReportCol kind="victory" title="胜利回顾" items={selected.victory} empty="—" />
                <ReportCol kind="blocker" title="阻碍复盘" items={selected.blocker} empty="—" />
                <ReportCol kind="planning" title="下周规划" items={selected.planning} empty="—" />
              </div>

              {/* 多维度复盘块（AI 复盘专属，手动复盘可能没有这块） */}
              {selected.perspectives && selected.perspectives.length > 0 && (
                <div className="gm-mt20">
                  <div className="gm-card__title" style={{ marginBottom: 10 }}>多视角分析</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    {selected.perspectives.map((p, i) => (
                      <div key={i} style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(217,154,62,0.05)",
                        borderLeft: "3px solid #d99a3e",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#d99a3e", marginBottom: 4 }}>{p.dimension}</div>
                        <div style={{ fontSize: 12, lineHeight: 1.65, color: "#c9a96a" }}>{p.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editing && <ReviewModal initial={editing} onSave={saveReview} onCancel={() => setEditing(null)} />}
    </>
  );
}

function ReviewModal({ initial, onSave, onCancel }: { initial: Review; onSave: (r: Review) => void; onCancel: () => void }): ReactNode {
  const [r, setR] = useState<Review>(initial);
  const setList = (key: "victory" | "blocker" | "planning", text: string): void => {
    setR(prev => ({ ...prev, [key]: text.split("\n").map(s => s.trim()).filter(Boolean) }));
  };
  return (
    <div className="gm-modal-back" onClick={onCancel}>
      <div className="gm-modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="gm-modal__title">新建周复盘</div>
        <div className="gm-modal__field">
          <label>分数（0-100）</label>
          <input type="number" min={0} max={100} value={r.score} onChange={e => setR({ ...r, score: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="gm-modal__field"><label>胜利回顾（每行一条）</label>
          <textarea rows={3} defaultValue={r.victory.join("\n")} onBlur={e => setList("victory", e.target.value)} />
        </div>
        <div className="gm-modal__field"><label>阻碍复盘</label>
          <textarea rows={3} defaultValue={r.blocker.join("\n")} onBlur={e => setList("blocker", e.target.value)} />
        </div>
        <div className="gm-modal__field"><label>下周规划</label>
          <textarea rows={3} defaultValue={r.planning.join("\n")} onBlur={e => setList("planning", e.target.value)} />
        </div>
        <div className="gm-modal__field"><label>摘要</label>
          <textarea rows={3} value={r.summary} onChange={e => setR({ ...r, summary: e.target.value })} />
        </div>
        <div className="gm-modal__actions">
          <button className="gm-btn" onClick={onCancel}>取消</button>
          <button className="gm-btn is-primary" onClick={() => onSave(r)}>保存</button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 对话详情页（P7）
// =================================================================
function MissionControlSection({ state, setState }: SectionProps): ReactNode {
  const [selectedId, setSelectedId] = useState<string | null>(state.conversations[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [framework, setFramework] = useState<"auto" | "first_principles" | "five_whys" | "swot">("auto");

  const conv = state.conversations.find(c => c.id === selectedId) ?? null;

  const newConv = (): void => {
    const c: Conversation = { id: uid(), title: "新对话", personality: state.profile.hqPersonality, createdAt: Date.now(), messages: [] };
    setState(prev => ({ ...prev, conversations: [c, ...prev.conversations] }));
    setSelectedId(c.id);
  };

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (!text || sending) return;
    let target = conv;
    if (!target) {
      const c: Conversation = { id: uid(), title: text.slice(0, 20), personality: state.profile.hqPersonality, createdAt: Date.now(), messages: [] };
      setState(prev => ({ ...prev, conversations: [c, ...prev.conversations] }));
      setSelectedId(c.id);
      target = c;
    }
    const userMsg: ConversationMsg = { role: "user", content: text, at: Date.now() };
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(c => c.id === target!.id ? { ...c, messages: [...c.messages, userMsg] } : c),
    }));
    setInput("");
    setSending(true);

    try {
      const sysPrompt = personalityToPrompt(target.personality) +
        (framework === "first_principles" ? "\n用第一性原理推演。" :
         framework === "five_whys" ? "\n用五问法持续追问。" :
         framework === "swot" ? "\n用 SWOT 框架分析。" : "");

      const messages = [
        { role: "system", content: sysPrompt },
        ...target.messages,
        userMsg,
      ].map(m => ({ role: m.role, content: m.content }));

      const r = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, stream: false }),
      });
      const body = await r.json();
      const reply = body.message?.content ?? body.error ?? "（无回复）";
      const aiMsg: ConversationMsg = { role: "assistant", content: reply, at: Date.now() };
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(c => c.id === target!.id ? { ...c, messages: [...c.messages, aiMsg] } : c),
      }));
    } catch (err) {
      const errMsg: ConversationMsg = { role: "assistant", content: `AI 回复失败：${err instanceof Error ? err.message : String(err)}`, at: Date.now() };
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(c => c.id === target!.id ? { ...c, messages: [...c.messages, errMsg] } : c),
      }));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="gm-twocol">
      <div className="gm-twocol__list">
        <div className="gm-row" style={{ justifyContent: "space-between", padding: "4px 8px 10px" }}>
          <div className="gm-card__title">对话列表</div>
          <button className="gm-icon-btn" onClick={newConv} title="新建">+</button>
        </div>
        {state.conversations.length === 0 ? (
          <div className="gm-empty">点 + 开启第一段对话</div>
        ) : state.conversations.map(c => (
          <div key={c.id} className={`gm-twocol__listitem ${c.id === selectedId ? "is-active" : ""}`} onClick={() => setSelectedId(c.id)}>
            {c.title}
            <div className="gm-twocol__listitem__sub">{personalityLabel(c.personality)} · {c.messages.length} 条</div>
          </div>
        ))}
      </div>

      <div className="gm-twocol__detail">
        <div className="gm-twocol__head">
          {conv ? conv.title : "对话详情"}
          <span style={{ fontSize: 11, color: "var(--gm-text-dim)", marginLeft: 10 }}>
            {conv ? personalityLabel(conv.personality) : ""}
          </span>
        </div>
        <div className="gm-twocol__body">
          {!conv || conv.messages.length === 0 ? (
            <div className="gm-empty">输入第一条消息开始对话</div>
          ) : conv.messages.map((m, i) => (
            <div key={i} className={`gm-msg ${m.role === "user" ? "is-mine" : ""}`}>
              <div className="gm-msg__avatar">{m.role === "user" ? "我" : "AI"}</div>
              <div className="gm-msg__bubble">
                {m.role === "assistant" && <div className="gm-msg__from">{personalityLabel(conv.personality)}</div>}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="gm-msg">
              <div className="gm-msg__avatar">AI</div>
              <div className="gm-msg__bubble">…</div>
            </div>
          )}
        </div>
        <div className="gm-twocol__footer">
          <div className="gm-chiprow">
            {(["auto", "first_principles", "five_whys", "swot"] as const).map(f => (
              <button key={f} className={`gm-chip ${framework === f ? "is-active" : ""}`} onClick={() => setFramework(f)}>
                {f === "auto" ? "自动判断" : f === "first_principles" ? "第一性原理" : f === "five_whys" ? "五问法" : "SWOT"}
              </button>
            ))}
          </div>
          <div className="gm-inputbar" style={{ margin: 0 }}>
            <button className="gm-inputbar__plus" onClick={send}>↑</button>
            <input className="gm-inputbar__field"
              placeholder="输入消息…"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function personalityToPrompt(p: HQPersonality): string {
  switch (p) {
    case "nova":   return "你是参谋长 Nova，是用户的人生指挥官。理性、清晰、不啰嗦，敢于直接指出问题。回答时先给结论，再给关键证据。";
    case "strict": return "你是严格执行官，对用户的执行力高标准、零容忍拖延。语气冷峻、要求具体的下一步动作。";
    case "warm":   return "你是温和陪跑官。语气真诚、不评判，关注用户的能量与节奏。先共情再给方案。";
    case "custom": return "你是用户自定义的私人助手。结合上下文判断风格。";
  }
}

function personalityLabel(p: HQPersonality): string {
  return p === "nova" ? "Nova · 主考官" : p === "strict" ? "严格执行官" : p === "warm" ? "温和陪跑官" : "自定义";
}

// =================================================================
// 设置（P8）
// =================================================================
function SettingsSection({ state, setState }: SectionProps): ReactNode {
  type SettingTab = "identity" | "cadence" | "data" | "experience" | "notifications" | "about";
  const [tab, setTab] = useState<SettingTab>("identity");

  const updateProfile = (patch: Partial<Profile>): void => {
    setState(prev => ({ ...prev, profile: { ...prev.profile, ...patch } }));
  };

  const SettingRow = ({ label, cap, control }: { label: string; cap?: string; control: ReactNode }): ReactNode => (
    <div className="gm-settings__row">
      <div>
        <div className="gm-settings__row-label">{label}</div>
        {cap && <div className="gm-settings__row-cap">{cap}</div>}
      </div>
      {control}
    </div>
  );

  return (
    <div className="gm-settings">
      <div className="gm-settings__nav">
        {([
          ["identity", "身份"], ["cadence", "周期"], ["data", "数据"],
          ["experience", "体验"], ["notifications", "提醒"], ["about", "关于"],
        ] as [SettingTab, string][]).map(([id, label]) => (
          <button key={id} className={`gm-settings__nav-item ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div className="gm-card">
        {tab === "identity" && (
          <>
            <SettingRow label="特工代号" cap="给自己起个内部代号" control={
              <input className="gm-settings__input" value={state.profile.codename} onChange={e => updateProfile({ codename: e.target.value })} />
            } />
            <SettingRow label="城市" control={
              <input className="gm-settings__input" value={state.profile.city} onChange={e => updateProfile({ city: e.target.value })} />
            } />
            <SettingRow label="MBTI" cap="数据分析里会用到" control={
              <input className="gm-settings__input" value={state.profile.mbti} onChange={e => updateProfile({ mbti: e.target.value.toUpperCase().slice(0, 4) })} placeholder="如 INTJ" />
            } />
            <SettingRow label="背景资料" cap="HQ 对话会把这段作为上下文" control={
              <textarea className="gm-settings__input" rows={3} style={{ minWidth: 280 }} value={state.profile.background} onChange={e => updateProfile({ background: e.target.value })} />
            } />
            <SettingRow label="HQ 人格" cap="对话中的助手风格" control={
              <select className="gm-settings__input" value={state.profile.hqPersonality} onChange={e => updateProfile({ hqPersonality: e.target.value as HQPersonality })}>
                <option value="nova">参谋长 Nova</option>
                <option value="strict">严格执行官</option>
                <option value="warm">温和陪跑官</option>
                <option value="custom">自定义</option>
              </select>
            } />
          </>
        )}
        {tab === "cadence" && (
          <>
            <SettingRow label="周起始" cap="决定周视图和复盘周期" control={
              <select className="gm-settings__input" value={state.profile.weekStart} onChange={e => updateProfile({ weekStart: parseInt(e.target.value) })}>
                <option value={1}>周一</option><option value={0}>周日</option>
              </select>
            } />
            <SettingRow label="当前周" control={<span style={{ color: "var(--gm-amber-2)" }}>第 {weekNumber(new Date())} 周</span>} />
          </>
        )}
        {tab === "data" && (
          <>
            <SettingRow label="状态" cap="本地 SQLite · Hermes 大脑" control={<span style={{ color: "var(--gm-success)" }}>● 在线</span>} />
            <SettingRow label="导出 JSON" cap="把所有计划管理数据导出成 .json 文件" control={
              <button className="gm-btn" onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `greatme-${todayYmd()}.json`;
                a.click();
              }}>导出</button>
            } />
            <SettingRow label="清空所有数据" cap="此操作不可撤销" control={
              <button className="gm-btn is-danger" onClick={() => {
                if (confirm("确定清空所有计划管理数据？")) setState(DEFAULT_STATE);
              }}>清空</button>
            } />
          </>
        )}
        {tab === "experience" && (
          <SettingRow label="声音" cap="呼吸冥想的提示音" control={
            <button className="gm-btn" onClick={() => setState(p => ({ ...p, soundOn: !p.soundOn }))}>{state.soundOn ? "开" : "关"}</button>
          } />
        )}
        {tab === "notifications" && (
          <SettingRow label="提醒" cap="单机版暂未接系统通知，先在 Rich 主面板用 cron" control={<span style={{ color: "var(--gm-text-dim)" }}>—</span>} />
        )}
        {tab === "about" && (
          <>
            <SettingRow label="版本" control={<span>Rich · GreatMe v2</span>} />
            <SettingRow label="致敬" cap="本页设计参考 TheGreatMe Mac App" control={<span style={{ color: "var(--gm-amber-2)" }}>♡</span>} />
          </>
        )}
      </div>
    </div>
  );
}

// =================================================================
// 呼吸冥想 overlay（P9）
// =================================================================
function BreathOverlay({ soundOn, onClose }: { soundOn: boolean; onClose: () => void }): ReactNode {
  const TOTAL = 133;
  const [left, setLeft] = useState(TOTAL);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setLeft(prev => Math.max(0, prev - 1)), 1000);
    if (soundOn) {
      try {
        const a = new Audio("/sound/breath/breath.mp3");
        a.loop = true;
        a.volume = 0.4;
        void a.play().catch(() => {});
        audioRef.current = a;
      } catch { /* no-op */ }
    }
    return () => {
      window.clearInterval(t);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [soundOn]);

  useEffect(() => {
    if (left === 0) {
      const t = window.setTimeout(onClose, 1000);
      return () => window.clearTimeout(t);
    }
  }, [left, onClose]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="gm-breath">
      <div className="gm-breath__caption">深吸 · 慢呼 · 让此刻成为锚点</div>
      <div className="gm-breath__ring">
        <div className="gm-breath__timer">{mm}:{ss}</div>
      </div>
      <div className="gm-breath__caption">{left === 0 ? "结束" : "随圆环缩放呼吸"}</div>
      <button className="gm-breath__close" onClick={onClose}>结束</button>
    </div>
  );
}

// =================================================================
// 视觉子组件
// =================================================================
function BigPentagonGlyph(): ReactNode {
  const cx = 200, cy = 200, r = 140;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const inner = pts.map(p => `${cx + (p[0] - cx) * 0.62},${cy + (p[1] - cy) * 0.62}`).join(" ");
  return (
    <svg viewBox="0 0 400 400" style={{ width: "100%", maxWidth: 360, height: "auto" }}>
      <defs>
        <radialGradient id="gm-penta-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--gm-amber)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--gm-amber)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 20} fill="url(#gm-penta-glow)" />
      <polygon points={pts.map(p => p.join(",")).join(" ")} fill="rgba(217,154,62,0.10)" stroke="var(--gm-amber)" strokeWidth="2" />
      <polygon points={inner} fill="none" stroke="rgba(217,154,62,0.4)" strokeWidth="1" />
    </svg>
  );
}

function PentagonGlyph(): ReactNode {
  const cx = 110, cy = 110, r = 70;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const path = pts.map(p => p.join(",")).join(" ");
  return (
    <svg viewBox="0 0 220 220">
      <polygon points={path} fill="rgba(217,154,62,0.12)" stroke="var(--gm-amber)" strokeWidth="1.5" />
      <polygon points={pts.map(p => `${cx + (p[0] - cx) * 0.5},${cy + (p[1] - cy) * 0.5}`).join(" ")} fill="none" stroke="rgba(217,154,62,0.4)" strokeWidth="1" />
    </svg>
  );
}

function RadarChart({ ability }: { ability: Ability }): ReactNode {
  const axes: { key: keyof Ability; label: string }[] = [
    { key: "execution", label: "执行" },
    { key: "focus", label: "聚焦" },
    { key: "rhythm", label: "节奏" },
    { key: "review", label: "复盘" },
    { key: "recovery", label: "恢复" },
    { key: "evidence", label: "证据" },
  ];
  const cx = 120, cy = 120, maxR = 80;
  const angle = (i: number): number => -Math.PI / 2 + (i / 6) * Math.PI * 2;
  const dataPts = axes.map((a, i) => {
    const v = ability[a.key] / 100;
    return [cx + maxR * v * Math.cos(angle(i)), cy + maxR * v * Math.sin(angle(i))];
  });
  return (
    <svg viewBox="0 0 240 240">
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon key={scale}
          points={axes.map((_, i) => `${cx + maxR * scale * Math.cos(angle(i))},${cy + maxR * scale * Math.sin(angle(i))}`).join(" ")}
          fill="none" stroke="rgba(217,154,62,0.12)" strokeWidth="0.5" />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy}
          x2={cx + maxR * Math.cos(angle(i))} y2={cy + maxR * Math.sin(angle(i))}
          stroke="rgba(217,154,62,0.18)" strokeWidth="0.5" />
      ))}
      <polygon points={dataPts.map(p => p.join(",")).join(" ")}
        fill="rgba(217,154,62,0.25)" stroke="var(--gm-amber)" strokeWidth="1.5" />
      {axes.map((a, i) => (
        <text key={a.key}
          x={cx + (maxR + 14) * Math.cos(angle(i))} y={cy + (maxR + 14) * Math.sin(angle(i))}
          fill="var(--gm-text-mute)" fontSize="10" textAnchor="middle" dominantBaseline="central">{a.label}</text>
      ))}
    </svg>
  );
}

function Sparkline({ values }: { values: number[] }): ReactNode {
  if (values.length === 0) return <svg className="gm-spark" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const W = 240, H = 60;
  const pad = 4;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / Math.max(max - min, 1)) * (H - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p.join(",")).join(" ");
  return (
    <svg className="gm-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="gm-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gm-amber)" />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={`${path} L${W - pad},${H - pad} L${pad},${H - pad} Z`} fill="url(#gm-spark-grad)" opacity="0.25" />
      <path d={path} fill="none" stroke="var(--gm-amber)" strokeWidth="1.8" />
    </svg>
  );
}

function TrendLine({ values, dayLabels }: { values: number[]; dayLabels?: string[] }): ReactNode {
  if (values.length === 0) return <svg className="gm-trendline" />;
  const W = 800, H = 120;
  const padL = 8, padR = 8, padT = 8, padB = dayLabels ? 22 : 8;
  const pts = values.map((v, i) => {
    const x = padL + (i / Math.max(values.length - 1, 1)) * (W - padL - padR);
    const y = H - padB - (v / 100) * (H - padT - padB);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p.join(",")).join(" ");
  return (
    <svg className="gm-trendline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map(g => (
        <line key={g} x1={padL} x2={W - padR}
          y1={H - padB - g * (H - padT - padB)} y2={H - padB - g * (H - padT - padB)}
          stroke="rgba(217,154,62,0.08)" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}
      <path d={path} fill="none" stroke="var(--gm-amber)" strokeWidth="2" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--gm-amber-2)" />)}
      {dayLabels && pts.map((p, i) => (
        <text key={`l${i}`} x={p[0]} y={H - 6} textAnchor="middle"
          fill="var(--gm-text-mute)" fontSize="9">{dayLabels[i] ?? ""}</text>
      ))}
    </svg>
  );
}

function MilestoneTimeline({ progress, nodes }: { progress: number; nodes: { label: string; active: boolean }[] }): ReactNode {
  const W = 380, H = 80;
  const padL = 14, padR = 14;
  const trackY = 36;
  const xs = nodes.map((_, i) => padL + (i / Math.max(nodes.length - 1, 1)) * (W - padL - padR));
  const progressX = padL + (progress / 100) * (W - padL - padR);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, display: "block" }} preserveAspectRatio="none">
      {/* 上方节点 label */}
      {nodes.map((n, i) => (
        <text key={`t${i}`} x={xs[i]} y={14} textAnchor={i === 0 ? "start" : i === nodes.length - 1 ? "end" : "middle"}
          fill={n.active ? "var(--gm-amber-2)" : "var(--gm-text-mute)"} fontSize="9">{n.label}</text>
      ))}
      {/* track */}
      <line x1={padL} y1={trackY} x2={W - padR} y2={trackY} stroke="var(--gm-amber)" strokeWidth="1.5" opacity="0.4" />
      {/* progress overlay */}
      <line x1={padL} y1={trackY} x2={progressX} y2={trackY} stroke="var(--gm-amber-2)" strokeWidth="2.2" />
      {/* nodes */}
      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          <circle cx={xs[i]} cy={trackY} r={n.active ? 6 : 4}
            fill={n.active ? "var(--gm-amber-2)" : "var(--gm-bg)"}
            stroke="var(--gm-amber)" strokeWidth="1.5" />
          {n.active && <circle cx={xs[i]} cy={trackY} r={2} fill="var(--gm-bg)" />}
        </g>
      ))}
    </svg>
  );
}

function HexRadar({ ability }: { ability: Ability }): ReactNode {
  // 六角形雷达，每轴显示 LvN 7▲+13 风格
  const axes: { key: keyof Ability; label: string }[] = [
    { key: "execution", label: "执行" },
    { key: "focus", label: "聚焦" },
    { key: "rhythm", label: "节奏" },
    { key: "review", label: "复盘" },
    { key: "evidence", label: "证据" },
    { key: "recovery", label: "恢复" },
  ];
  const cx = 160, cy = 170, maxR = 100;
  const angle = (i: number): number => -Math.PI / 2 + (i / 6) * Math.PI * 2;
  const dataPts = axes.map((a, i) => {
    const v = ability[a.key] / 100;
    return [cx + maxR * v * Math.cos(angle(i)), cy + maxR * v * Math.sin(angle(i))];
  });
  // 用整型显示数值 + 简单的"增量"模拟（占位）
  const deltaOf = (v: number): string => v <= 0 ? "—" : v < 10 ? `▲+${v}` : `▲+${Math.floor(v / 2)}`;

  return (
    <svg viewBox="0 0 320 340" style={{ width: "100%", maxWidth: 320, height: "auto", display: "block" }}>
      {/* 六层等高线 */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon key={scale}
          points={axes.map((_, i) => `${cx + maxR * scale * Math.cos(angle(i))},${cy + maxR * scale * Math.sin(angle(i))}`).join(" ")}
          fill="none" stroke="rgba(217,154,62,0.15)" strokeWidth="0.6" />
      ))}
      {/* 轴线 */}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy}
          x2={cx + maxR * Math.cos(angle(i))} y2={cy + maxR * Math.sin(angle(i))}
          stroke="rgba(217,154,62,0.2)" strokeWidth="0.6" />
      ))}
      {/* 数据多边形 */}
      <polygon points={dataPts.map(p => p.join(",")).join(" ")}
        fill="rgba(217,154,62,0.25)" stroke="var(--gm-amber)" strokeWidth="1.8" />
      {dataPts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--gm-amber-2)" />)}

      {/* 标签：每个轴外侧 显示 名字 Lv1 / 值▲+增量 */}
      {axes.map((a, i) => {
        const lx = cx + (maxR + 28) * Math.cos(angle(i));
        const ly = cy + (maxR + 28) * Math.sin(angle(i));
        const v = ability[a.key];
        return (
          <g key={a.key}>
            <text x={lx} y={ly - 2} textAnchor="middle" fill="var(--gm-amber-2)" fontSize="11" fontWeight="600">
              {a.label} Lv1
            </text>
            <text x={lx} y={ly + 11} textAnchor="middle" fill="var(--gm-text-mute)" fontSize="10">
              {v} {deltaOf(v)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


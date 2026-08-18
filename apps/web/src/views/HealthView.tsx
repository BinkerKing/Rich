/**
 * 健康顾问 · Body Insights · V0.2 主视图
 *
 * 2 个 tab：
 *   仪表盘  —— 目标 banner + Rich 今日建议 + 4 KPI + 今日计划 + 走势 + 折叠流水
 *   设置    —— 静态档案 / 周计划编辑 / 苹果健康接入
 *
 * 数据录入由 Rich（对话）完成；视图不再放 quick-log 表单（可用 ?devlogs=1 临时调出）。
 * 单用户，所有 API 都走 healthApi。所有 fetch 失败有 UI 反馈，不会黑屏。
 */
import { useEffect, useMemo, useState } from "react";
import type {
  HealthProfile,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
  MealEntry,
  SleepEntry,
  MoodEntry,
  MealItem,
  HealthReminder,
  ReminderKind,
  ReminderChannel,
} from "@ke/domain";
import { healthApi } from "../api/healthClient.js";
import "./HealthView.css";

type Tab = "dashboard" | "meals" | "settings";

/** dev 模式留个后门把旧的 5 个 quick log 表单挂出来：URL 加 ?devlogs=1 */
function useDevLogs(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("devlogs") === "1";
  }, []);
}

export function HealthView() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const devLogs = useDevLogs();

  return (
    <div className="health-view">
      <header className="health-header">
        <h1>健康顾问</h1>
        <span className="health-sub">Rich 帮你盯身体 · 数据由对话录入</span>
        <SyncStatusBadge />
      </header>

      <nav className="health-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "dashboard"}
          className={`health-tab${tab === "dashboard" ? " is-active" : ""}`}
          onClick={() => setTab("dashboard")}>📊 仪表盘</button>
        <button type="button" role="tab" aria-selected={tab === "meals"}
          className={`health-tab${tab === "meals" ? " is-active" : ""}`}
          onClick={() => setTab("meals")}>📷 饮食记录</button>
        <button type="button" role="tab" aria-selected={tab === "settings"}
          className={`health-tab${tab === "settings" ? " is-active" : ""}`}
          onClick={() => setTab("settings")}>⚙️ 设置</button>
      </nav>

      <div className="health-body">
        {tab === "dashboard" && <DashboardTab devLogs={devLogs} />}
        {tab === "meals" && <MealsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
      <ReminderToastHost />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    顶部右侧 · 苹果健康同步状态徽章
// ═══════════════════════════════════════════════════════════════

interface SyncStatus {
  lastSyncAt: string | null;
  hasData: boolean;
  byKind: {
    weight:  { count: number; lastAt: string | null };
    sleep:   { count: number; lastAt: string | null };
    workout: { count: number; lastAt: string | null };
  };
}

/** "5 分钟前 / 2 小时前 / 3 天前" —— 中文相对时间 */
function relativeChinese(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "刚刚";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} 个月前`;
  return `${Math.floor(mon / 12)} 年前`;
}

/** 把 lastSyncAt 映射成三档健康度：fresh < 12h, stale 12-48h, dead >48h or never */
function syncHealth(iso: string | null): "fresh" | "stale" | "dead" | "never" {
  if (!iso) return "never";
  const ageMs = Date.now() - new Date(iso).getTime();
  const ageHr = ageMs / 3_600_000;
  if (ageHr < 12) return "fresh";
  if (ageHr < 48) return "stale";
  return "dead";
}

function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 拉一次 + 每 30s 刷新（轻量，不走 SSE，没必要）
  useEffect(() => {
    let aborted = false;
    const refresh = () => {
      healthApi.getSyncStatus()
        .then(s => { if (!aborted) { setStatus(s); setErr(null); } })
        .catch(e => { if (!aborted) setErr(e instanceof Error ? e.message : String(e)); });
    };
    refresh();
    const id = window.setInterval(refresh, 30_000);
    // 接到 health-data-changed 时也立刻刷新
    const onChange = () => refresh();
    window.addEventListener("health-data-changed", onChange);
    return () => {
      aborted = true;
      window.clearInterval(id);
      window.removeEventListener("health-data-changed", onChange);
    };
  }, []);

  const health = syncHealth(status?.lastSyncAt ?? null);
  const dotClass = `health-sync-dot health-sync-dot--${health}`;
  const summary =
    err ? "同步状态读取失败"
    : !status ? "读取中…"
    : status.lastSyncAt === null ? "未接入苹果健康"
    : `上次同步 ${relativeChinese(status.lastSyncAt)}`;

  return (
    <div className={`health-sync-badge${open ? " is-open" : ""}`}>
      <button type="button"
        className="health-sync-badge__btn"
        onClick={() => setOpen(o => !o)}
        title="苹果健康同步状态"
      >
        <span className={dotClass} aria-hidden="true" />
        <span className="health-sync-badge__text">🍎 {summary}</span>
      </button>
      {open && status && (
        <div className="health-sync-badge__panel" role="dialog">
          <header>
            <strong>🍎 苹果健康同步</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭">✕</button>
          </header>
          <div className="health-sync-badge__body">
            {status.lastSyncAt ? (
              <>
                <div className="health-sync-badge__hero">
                  上次同步：<strong>{relativeChinese(status.lastSyncAt)}</strong>
                  <div className="health-sync-badge__abs">
                    {new Date(status.lastSyncAt).toLocaleString("zh-CN", {
                      month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
                <ul className="health-sync-badge__list">
                  <SyncRow icon="⚖️" label="体重" data={status.byKind.weight} />
                  <SyncRow icon="😴" label="睡眠" data={status.byKind.sleep} />
                  <SyncRow icon="🏋️" label="训练" data={status.byKind.workout} />
                </ul>
                {health !== "fresh" && (
                  <div className="health-sync-badge__warn">
                    {health === "dead"
                      ? "超过 48 小时没收到新数据。检查 iPhone 快捷指令是否还在自动运行。"
                      : "数据有点旧，下次自动同步即将到来。"}
                  </div>
                )}
              </>
            ) : (
              <div className="health-sync-badge__empty">
                还没有从苹果健康收到任何数据。
                <br />去 <strong>⚙️ 设置 → 🍎 苹果健康接入</strong> 按教程配置 iPhone 快捷指令。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SyncRow({ icon, label, data }:
  { icon: string; label: string; data: { count: number; lastAt: string | null } }) {
  return (
    <li className="health-sync-row">
      <span className="health-sync-row__icon">{icon}</span>
      <span className="health-sync-row__label">{label}</span>
      <span className="health-sync-row__meta">
        {data.count > 0
          ? `${data.count} 条 · ${data.lastAt ? relativeChinese(data.lastAt) : "—"}`
          : "无数据"}
      </span>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    Dashboard Tab —— 顾问主视图
// ═══════════════════════════════════════════════════════════════

function DashboardTab({ devLogs }: { devLogs: boolean }) {
  return (
    <div className="health-dashboard">
      <GoalBanner />
      <CoachNote />
      <KPIRow />
      <TodayPlan />
      <WeekSparklines />
      <MonthTrendPlaceholder />
      <RecentEntriesFolded />
      {devLogs && (
        <details className="health-devlogs" open>
          <summary>🛠 开发用 · 手动打卡（生产用 Rich 对话录入）</summary>
          <div className="health-quick-row">
            <WeightQuickLog />
            <MealQuickLog />
            <WorkoutQuickLog />
            <SleepQuickLog />
            <MoodQuickLog />
          </div>
        </details>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    Settings Tab —— 档案 / 周计划 / 接入
// ═══════════════════════════════════════════════════════════════

function SettingsTab() {
  const [section, setSection] = useState<"profile" | "reminders" | "plan" | "apple">("profile");
  return (
    <div className="health-settings">
      <nav className="health-subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={section === "profile"}
          className={`health-subtab${section === "profile" ? " is-active" : ""}`}
          onClick={() => setSection("profile")}>📋 静态档案</button>
        <button type="button" role="tab" aria-selected={section === "reminders"}
          className={`health-subtab${section === "reminders" ? " is-active" : ""}`}
          onClick={() => setSection("reminders")}>⏰ 定时提醒</button>
        <button type="button" role="tab" aria-selected={section === "plan"}
          className={`health-subtab${section === "plan" ? " is-active" : ""}`}
          onClick={() => setSection("plan")}>🎯 周计划编辑</button>
        <button type="button" role="tab" aria-selected={section === "apple"}
          className={`health-subtab${section === "apple" ? " is-active" : ""}`}
          onClick={() => setSection("apple")}>🍎 苹果健康接入</button>
      </nav>
      <div className="health-settings-body">
        {section === "profile" && <ProfileTab />}
        {section === "reminders" && <RemindersTab />}
        {section === "plan" && <PlanTab />}
        {section === "apple" && <AppleHealthTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    Dashboard 子组件
// ═══════════════════════════════════════════════════════════════

/** 今天 00:00 的 ISO，用作 since 过滤 */
function todayStartISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** 本周一 00:00 的 ISO */
function weekStartISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString();
}

// ── Apple 活动摘要 vs 真训练 区分 ──────────────────────────────
// Apple 同步进来的"workout"其实分两种：
//   1. 每天的活动摘要：sessionName 含 "Apple Health 活动摘要"，notes 是 JSON
//      含 {steps, distanceKm, activeKcal} —— 这是 HKActivitySummary 数据
//   2. 实际运动 session（HKWorkout）：有 durationMin / sessionName 形如 "跑步"
//
// KPI / sparkline 里"训练时长"只算真 session，不能把每天的步数活动当训练。

interface AppleActivityPayload {
  steps?: number;
  distanceKm?: number;
  activeKcal?: number;
}

function parseAppleActivity(workout: { source?: string; sessionName?: string; notes?: string }): AppleActivityPayload | null {
  if (workout.source !== "apple-health") return null;
  if (!workout.sessionName?.includes("活动摘要")) return null;
  if (!workout.notes) return null;
  try {
    const parsed = JSON.parse(workout.notes);
    if (typeof parsed === "object" && parsed != null) return parsed as AppleActivityPayload;
  } catch { /* notes 不是 JSON，跳过 */ }
  return null;
}

function isRealWorkout(workout: { source?: string; sessionName?: string }): boolean {
  // 活动摘要不算真训练；其余都算
  return !workout.sessionName?.includes("活动摘要");
}

// ── Goal Banner ───────────────────────────────────────────────────
function GoalBanner() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);

  useEffect(() => {
    const refresh = () => {
      void healthApi.getProfile().then(setProfile).catch(() => setProfile(null));
      // 拉够多体重数据来算"起点 → 当前 → 目标"的真实进度
      void healthApi.listWeights({ limit: 500 }).then(setWeights).catch(() => {});
    };
    refresh();
    window.addEventListener("health-data-changed", refresh);
    return () => window.removeEventListener("health-data-changed", refresh);
  }, []);

  // 体重按 loggedAt 排序，最早 → 最新；用 sorted 算起点 / 当前 / 进度
  const sorted = useMemo(
    () => [...weights].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    [weights],
  );
  const baseline = sorted[0] ?? null;
  const latest = sorted[sorted.length - 1] ?? null;

  // 近 14 日趋势 → 估算还要多久到目标（hooks 必须在 early-return 前）
  const eta = useMemo(() => {
    if (!profile?.goal || !profile?.targetWeightKg || sorted.length < 2 || !latest) return null;
    if (profile.goal === "maintain") return null;
    const direction = profile.goal === "cut" ? "down" : "up";
    const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).getTime();
    const recent = sorted.filter(w => new Date(w.loggedAt).getTime() >= cutoff);
    if (recent.length < 2) return null;
    const days = (new Date(recent[recent.length - 1].loggedAt).getTime()
                 - new Date(recent[0].loggedAt).getTime()) / (24 * 3600 * 1000);
    if (days < 1) return null;
    const kgPerDay = (recent[recent.length - 1].kg - recent[0].kg) / days;
    // 减脂时 kgPerDay 应 < 0；增肌应 > 0；不一致返回 null（趋势相反，无法估）
    if (direction === "down" && kgPerDay >= 0) return null;
    if (direction === "up" && kgPerDay <= 0) return null;
    const daysLeft = Math.abs((latest.kg - profile.targetWeightKg) / kgPerDay);
    if (!Number.isFinite(daysLeft) || daysLeft > 365) return null;
    return Math.round(daysLeft);
  }, [profile?.goal, profile?.targetWeightKg, sorted, latest]);

  if (!profile?.goal || !profile?.targetWeightKg || !latest) {
    return (
      <section className="health-card health-goal-banner health-goal-banner--empty">
        <span className="health-goal-banner__icon">🎯</span>
        <div>
          <strong>还没有设定目标</strong>
          <p>跟 Rich 说一声「我想{profile?.goal === "cut" ? "继续减脂" : "定个减脂目标"}」，他会帮你设置。也可以去 ⚙️ 设置里手动填档案。</p>
        </div>
      </section>
    );
  }

  const target = profile.targetWeightKg;
  const direction = profile.goal === "cut" ? "down" : profile.goal === "bulk" ? "up" : "hold";
  const startKg = baseline ? baseline.kg : latest.kg;
  // 真实进度：起点 → 当前 / 起点 → 目标
  const totalNeeded = direction === "hold" ? 1 : Math.abs(startKg - target);
  const traveled = direction === "hold"
    ? Math.max(0, 1 - Math.abs(latest.kg - target))
    : Math.abs(startKg - latest.kg);
  const stillToGo = +Math.abs(latest.kg - target).toFixed(1);
  const onTrack = direction === "hold"
    ? Math.abs(latest.kg - target) <= 1
    : direction === "down"
      ? latest.kg <= startKg               // 减脂：还在下降中（不严格小于）
      : latest.kg >= startKg;              // 增肌：在上升中
  const pct = totalNeeded > 0
    ? Math.max(0, Math.min(100, (traveled / totalNeeded) * 100))
    : 100;

  const goalLabel = profile.goal === "cut" ? "减脂" : profile.goal === "bulk" ? "增肌" : "维持";
  const verb = direction === "down" ? "已减" : direction === "up" ? "已增" : "已稳定";
  const traveledRounded = +traveled.toFixed(1);

  return (
    <section className="health-card health-goal-banner">
      <span className="health-goal-banner__icon">🎯</span>
      <div className="health-goal-banner__body">
        <div className="health-goal-banner__line">
          <strong>目标：{goalLabel} 至 {target} kg</strong>
          <span className="health-goal-banner__meta">
            {baseline && baseline.id !== latest.id && <>起点 {baseline.kg} kg · </>}
            当前 {latest.kg} kg · {verb} {traveledRounded} kg · 还差 {stillToGo} kg
            {eta != null && <> · 按近 14 日节奏约 {eta} 天可达</>}
          </span>
        </div>
        <div className={`health-goal-banner__bar health-goal-banner__bar--${onTrack ? "ok" : "warn"}`}>
          <div className="health-goal-banner__bar-fill"
            style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
        </div>
        <div className="health-goal-banner__pct">{Math.round(pct)}% 完成</div>
      </div>
    </section>
  );
}

// ── Rich 今日建议 ─────────────────────────────────────────────────
// V0.1 baseline：用规则引擎从真实数据合成一段建议。
// V0.2 接入 AI（写入 health.coach_note state）后，这段优先显示 AI 建议，
// rules 作为兜底。当前先把规则引擎跑起来，避免给用户看死文案。
function CoachNote() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [todayWorkouts, setTodayWorkouts] = useState<Array<WorkoutSession & { sets: WorkoutSet[] }>>([]);
  const [latestSleep, setLatestSleep] = useState<SleepEntry | null>(null);

  useEffect(() => {
    const refresh = () => {
      const today = todayStartISO();
      void healthApi.getProfile().then(setProfile).catch(() => setProfile(null));
      void healthApi.listWeights({ limit: 100 }).then(setWeights).catch(() => {});
      void healthApi.listMeals({ since: today }).then(setTodayMeals).catch(() => {});
      void healthApi.listWorkouts({ since: today }).then(setTodayWorkouts).catch(() => {});
      void healthApi.listSleep({ limit: 1 }).then(arr => setLatestSleep(arr[0] ?? null)).catch(() => {});
    };
    refresh();
    window.addEventListener("health-data-changed", refresh);
    return () => window.removeEventListener("health-data-changed", refresh);
  }, []);

  const insights = useMemo(
    () => buildCoachInsights({ profile, weights, todayMeals, todayWorkouts, latestSleep }),
    [profile, weights, todayMeals, todayWorkouts, latestSleep],
  );

  return (
    <section className="health-card health-coach-note">
      <header>
        <span className="health-coach-note__avatar">💡</span>
        <strong>Rich 今日建议</strong>
        <span className="health-coach-note__src">基于真实数据 · V0.2 接入 AI 后会更精准</span>
      </header>
      {insights.length === 0 ? (
        <p className="health-coach-note__body">
          数据还不够多。跟 Rich 多聊几天 / 同步几次苹果健康，他就能给出针对性建议了。
        </p>
      ) : (
        <ul className="health-coach-note__list">
          {insights.map((line, i) => (
            <li key={i} className={`health-coach-line health-coach-line--${line.tone}`}>
              <span className="health-coach-line__icon">{line.icon}</span>
              <span className="health-coach-line__text">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface CoachInsight { icon: string; tone: "good" | "warn" | "info"; text: string }

function buildCoachInsights(input: {
  profile: HealthProfile | null;
  weights: WeightEntry[];
  todayMeals: MealEntry[];
  todayWorkouts: Array<WorkoutSession & { sets: WorkoutSet[] }>;
  latestSleep: SleepEntry | null;
}): CoachInsight[] {
  const out: CoachInsight[] = [];
  const { profile, weights, todayMeals, todayWorkouts, latestSleep } = input;
  const sortedW = [...weights].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  const latest = sortedW[sortedW.length - 1];

  // 1) 体重趋势 / 距目标
  if (latest && profile?.targetWeightKg) {
    const target = profile.targetWeightKg;
    const stillToGo = +Math.abs(latest.kg - target).toFixed(1);
    if (stillToGo <= 0.5) {
      out.push({ icon: "🎉", tone: "good", text: `已经接近目标体重 ${target} kg（当前 ${latest.kg}），重点转向维持。` });
    } else if (sortedW.length >= 2) {
      // 近 14 天速度
      const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
      const recent = sortedW.filter(w => new Date(w.loggedAt).getTime() >= cutoff);
      if (recent.length >= 2) {
        const days = (new Date(recent[recent.length - 1].loggedAt).getTime()
                     - new Date(recent[0].loggedAt).getTime()) / (24 * 3600 * 1000);
        if (days >= 1) {
          const delta = +(recent[recent.length - 1].kg - recent[0].kg).toFixed(1);
          const kgPerWeek = +((delta / days) * 7).toFixed(2);
          if (profile.goal === "cut") {
            if (kgPerWeek <= -1.2) out.push({ icon: "⚠️", tone: "warn", text: `近 14 日掉得太快（约 ${Math.abs(kgPerWeek)} kg/周），注意蛋白摄入和力量训练，别掉肌肉。` });
            else if (kgPerWeek < 0)  out.push({ icon: "✅", tone: "good", text: `近 14 日稳定下降，约 ${Math.abs(kgPerWeek)} kg/周，节奏健康。` });
            else if (kgPerWeek > 0)  out.push({ icon: "⚠️", tone: "warn", text: `近 14 日体重在涨（约 ${kgPerWeek} kg/周），检查一下卡路里盈余。` });
          } else if (profile.goal === "bulk") {
            if (kgPerWeek >= 0.7)    out.push({ icon: "⚠️", tone: "warn", text: `近 14 日涨得偏快（约 ${kgPerWeek} kg/周），脂肪增长风险，可微降卡。` });
            else if (kgPerWeek > 0)  out.push({ icon: "✅", tone: "good", text: `近 14 日稳定上涨，约 ${kgPerWeek} kg/周。` });
          }
        }
      }
    }
  }

  // 2) 今日饮食
  const todayKcal = todayMeals.reduce((s, m) => s + (m.totalKcal ?? 0), 0);
  const todayProtein = todayMeals.reduce((s, m) => s + (m.totalProteinG ?? 0), 0);
  const hour = new Date().getHours();
  if (todayMeals.length === 0 && hour >= 12) {
    out.push({ icon: "🍱", tone: "info", text: `已经 ${hour} 点了还没记饮食，别忘了把午餐拍给 Rich。` });
  } else if (todayKcal > 0 && profile?.goal === "cut") {
    // 简化：减脂目标 1800 kcal 兜底；后续可从 today_plan 取
    const targetKcal = 1800;
    if (todayKcal > targetKcal * 1.15) {
      out.push({ icon: "⚠️", tone: "warn", text: `今日已摄入 ${Math.round(todayKcal)} kcal，超过减脂目标（≈${targetKcal}）。晚餐可以清淡点。` });
    }
    if (todayProtein > 0 && todayProtein < 80 && hour >= 18) {
      out.push({ icon: "💪", tone: "info", text: `今日蛋白只有 ${Math.round(todayProtein)}g，目标 100g+。晚饭加块鸡胸/三文鱼。` });
    }
  }

  // 3) 今日活动 / 训练
  let todaySteps = 0;
  for (const w of todayWorkouts) {
    const apple = parseAppleActivity(w);
    if (apple?.steps) todaySteps += apple.steps;
  }
  const realToday = todayWorkouts.filter(isRealWorkout);
  if (todaySteps > 0 && todaySteps < 4000 && hour >= 18) {
    out.push({ icon: "👟", tone: "warn", text: `今日步数才 ${todaySteps.toLocaleString()}，建议出门走 20 分钟。` });
  } else if (todaySteps >= 10000) {
    out.push({ icon: "🚀", tone: "good", text: `今日步数 ${todaySteps.toLocaleString()}，活动量达标。` });
  }
  if (realToday.length === 0 && hour >= 19 && profile?.goal !== "maintain") {
    out.push({ icon: "🏋️", tone: "info", text: `今天还没有力量训练。${profile?.goal === "cut" ? "减脂期保留力量训练才不丢肌。" : "增肌目标得练。"}` });
  }

  // 4) 睡眠
  if (latestSleep?.durationMin != null) {
    const hr = latestSleep.durationMin / 60;
    if (hr < 6) out.push({ icon: "😴", tone: "warn", text: `最近一晚只睡了 ${hr.toFixed(1)}h，睡不够减脂会停滞。今晚提前 1 小时上床。` });
    else if (latestSleep.quality != null && latestSleep.quality <= 5) {
      out.push({ icon: "😴", tone: "warn", text: `最近一晚睡眠质量 ${latestSleep.quality}/10，偏低。检查咖啡/屏幕时间。` });
    }
  }

  return out.slice(0, 4); // 最多 4 条，避免刷屏
}

// ── 5 KPI Cards ───────────────────────────────────────────────────
// 数据策略：
//   - 体重：取最近 1 条 + 4 周窗口算变化（不只是本周，本周可能数据稀疏）
//   - 卡路里 / 真训练：只算今天 00:00 之后
//   - 步数：从今天的 Apple "活动摘要" 取
//   - 睡眠：取最近 1 条
function KPIRow() {
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [recentWeights, setRecentWeights] = useState<WeightEntry[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [todayWorkouts, setTodayWorkouts] = useState<Array<WorkoutSession & { sets: WorkoutSet[] }>>([]);
  const [latestSleep, setLatestSleep] = useState<SleepEntry | null>(null);

  useEffect(() => {
    const refresh = () => {
      const today = todayStartISO();
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString();
      void healthApi.listWeights({ limit: 1 }).then(arr => setLatestWeight(arr[0] ?? null)).catch(() => {});
      void healthApi.listWeights({ since: fourWeeksAgo, limit: 100 }).then(setRecentWeights).catch(() => {});
      void healthApi.listMeals({ since: today }).then(setTodayMeals).catch(() => {});
      void healthApi.listWorkouts({ since: today }).then(setTodayWorkouts).catch(() => {});
      void healthApi.listSleep({ limit: 1 }).then(arr => setLatestSleep(arr[0] ?? null)).catch(() => {});
    };
    refresh();
    window.addEventListener("health-data-changed", refresh);
    return () => window.removeEventListener("health-data-changed", refresh);
  }, []);

  /** 体重变化文案：优先 4 周对比，数据不足回退到"vs 起点" */
  const weightDelta = useMemo(() => {
    if (recentWeights.length < 2) return null;
    const sorted = [...recentWeights].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    const start = sorted[0].kg;
    const end = sorted[sorted.length - 1].kg;
    return +(end - start).toFixed(1);
  }, [recentWeights]);

  const todayKcal = useMemo(
    () => todayMeals.reduce((sum, m) => sum + (m.totalKcal ?? 0), 0),
    [todayMeals]
  );

  /** 真训练 = 排除 Apple 活动摘要 */
  const realWorkouts = useMemo(() => todayWorkouts.filter(isRealWorkout), [todayWorkouts]);
  const todayWorkoutMin = useMemo(
    () => realWorkouts.reduce((sum, w) => sum + (w.durationMin ?? 0), 0),
    [realWorkouts]
  );

  /** 今日步数 = Apple 活动摘要 notes JSON 里的 steps */
  const { todaySteps, todayDistanceKm } = useMemo(() => {
    let steps = 0, dist = 0;
    for (const w of todayWorkouts) {
      const apple = parseAppleActivity(w);
      if (apple) {
        steps += apple.steps ?? 0;
        dist += apple.distanceKm ?? 0;
      }
    }
    return { todaySteps: steps, todayDistanceKm: +dist.toFixed(2) };
  }, [todayWorkouts]);

  const sleepHours = latestSleep?.durationMin ? +(latestSleep.durationMin / 60).toFixed(1) : null;

  return (
    <section className="health-kpi-row">
      <KPICard icon="⚖️" label="体重"
        primary={latestWeight ? `${latestWeight.kg} kg` : "—"}
        sub={weightDelta !== null
          ? `近 4 周 ${weightDelta > 0 ? "↑" : weightDelta < 0 ? "↓" : "→"} ${Math.abs(weightDelta)} kg${latestWeight?.bodyFatPct ? ` · 体脂 ${latestWeight.bodyFatPct}%` : ""}`
          : "记录不足"} />
      <KPICard icon="🍱" label="今日卡路里"
        primary={todayMeals.length > 0 ? `${Math.round(todayKcal)}` : "—"}
        sub={todayMeals.length > 0 ? `kcal · ${todayMeals.length} 餐` : "还没吃饭"} />
      <KPICard icon="👟" label="今日步数"
        primary={todaySteps > 0 ? todaySteps.toLocaleString() : "—"}
        sub={todaySteps > 0 ? `${todayDistanceKm} km` : "Apple 还没同步"} />
      <KPICard icon="🏋️" label="今日训练"
        primary={realWorkouts.length > 0 ? `${todayWorkoutMin} min` : "—"}
        sub={realWorkouts.length > 0 ? `${realWorkouts.length} 次 · ${realWorkouts[0].sessionName ?? "训练"}` : "还没训练"} />
      <KPICard icon="😴" label="最近睡眠"
        primary={sleepHours !== null ? `${sleepHours}h` : "—"}
        sub={latestSleep?.quality ? `质量 ${latestSleep.quality}/10 · ${latestSleep.sleepDate?.slice(5) ?? ""}` : "未记录"} />
    </section>
  );
}

function KPICard({ icon, label, primary, sub }:
  { icon: string; label: string; primary: string; sub: string }) {
  return (
    <div className="health-kpi-card">
      <div className="health-kpi-card__head">
        <span className="health-kpi-card__icon">{icon}</span>
        <span className="health-kpi-card__label">{label}</span>
      </div>
      <div className="health-kpi-card__primary">{primary}</div>
      <div className="health-kpi-card__sub">{sub}</div>
    </div>
  );
}

// ── 今日计划 ──────────────────────────────────────────────────────
function TodayPlan() {
  // V0.1：还没接 today_plan 存储，先放结构 + 空态 CTA。等后端 ready 后这里填真数据。
  return (
    <section className="health-card health-today-plan">
      <header>
        <h3>📋 今日计划</h3>
        <span className="health-today-plan__date">
          {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}
        </span>
      </header>
      <div className="health-today-plan__grid">
        <div className="health-today-plan__col">
          <h4>🏋️ 训练</h4>
          <div className="health-empty">
            今天还没有训练计划。跟 Rich 说一声你想怎么练，他会帮你定。
          </div>
        </div>
        <div className="health-today-plan__col">
          <h4>🍱 饮食</h4>
          <div className="health-empty">
            今天还没有饮食计划。跟 Rich 说一声目标卡路里/蛋白，他会帮你排。
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 本周走势 sparkline ────────────────────────────────────────────
function WeekSparklines() {
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [workouts, setWorkouts] = useState<Array<WorkoutSession & { sets: WorkoutSet[] }>>([]);
  const [sleeps, setSleeps] = useState<SleepEntry[]>([]);

  useEffect(() => {
    const refresh = () => {
      const since = weekStartISO();
      void healthApi.listWeights({ since }).then(setWeights).catch(() => {});
      void healthApi.listMeals({ since }).then(setMeals).catch(() => {});
      void healthApi.listWorkouts({ since }).then(setWorkouts).catch(() => {});
      void healthApi.listSleep({ since }).then(setSleeps).catch(() => {});
    };
    refresh();
    window.addEventListener("health-data-changed", refresh);
    return () => window.removeEventListener("health-data-changed", refresh);
  }, []);

  /** 按 7 天分桶取均值/总和，缺值用 NaN */
  function dailyBuckets<T>(items: T[], at: (t: T) => string, valueOf: (t: T) => number, mode: "avg" | "sum"): number[] {
    const buckets: number[][] = Array.from({ length: 7 }, () => []);
    const start = new Date(weekStartISO()).getTime();
    for (const it of items) {
      const t = new Date(at(it)).getTime();
      const idx = Math.floor((t - start) / (24 * 3600 * 1000));
      if (idx >= 0 && idx < 7) buckets[idx].push(valueOf(it));
    }
    return buckets.map(arr => {
      if (arr.length === 0) return NaN;
      if (mode === "sum") return arr.reduce((a, b) => a + b, 0);
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    });
  }

  const weightSeries = useMemo(() =>
    dailyBuckets(weights, w => w.loggedAt, w => w.kg, "avg"), [weights]);
  const kcalSeries = useMemo(() =>
    dailyBuckets(meals, m => m.consumedAt, m => m.totalKcal ?? 0, "sum"), [meals]);
  // 训练只算真训练，排除 Apple 活动摘要
  const workoutSeries = useMemo(() =>
    dailyBuckets(workouts.filter(isRealWorkout), w => w.performedAt, w => w.durationMin ?? 0, "sum"),
    [workouts]);
  // 步数从 Apple 活动摘要的 notes JSON 取
  const stepsSeries = useMemo(() => {
    const stepWorkouts = workouts
      .map(w => {
        const apple = parseAppleActivity(w);
        return apple?.steps ? { performedAt: w.performedAt, steps: apple.steps } : null;
      })
      .filter((x): x is { performedAt: string; steps: number } => x !== null);
    return dailyBuckets(stepWorkouts, w => w.performedAt, w => w.steps, "sum");
  }, [workouts]);
  const sleepSeries = useMemo(() =>
    dailyBuckets(sleeps, s => s.sleepDate, s => (s.durationMin ?? 0) / 60, "avg"), [sleeps]);

  return (
    <section className="health-card health-week">
      <header>
        <h3>📈 本周走势</h3>
        <span className="health-week__hint">周一 → 今天</span>
      </header>
      <div className="health-week__grid">
        <Sparkline label="体重 (kg)" series={weightSeries} format={v => v.toFixed(1)} />
        <Sparkline label="卡路里" series={kcalSeries} format={v => Math.round(v).toString()} />
        <Sparkline label="步数" series={stepsSeries} format={v => Math.round(v).toLocaleString()} />
        <Sparkline label="训练 (min)" series={workoutSeries} format={v => Math.round(v).toString()} />
        <Sparkline label="睡眠 (h)" series={sleepSeries} format={v => v.toFixed(1)} />
      </div>
    </section>
  );
}

function Sparkline({ label, series, format }:
  { label: string; series: number[]; format: (v: number) => string }) {
  const valid = series.filter(v => Number.isFinite(v));
  if (valid.length === 0) {
    return (
      <div className="health-spark">
        <div className="health-spark__label">{label}</div>
        <div className="health-spark__empty">无数据</div>
      </div>
    );
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min || 1;
  const w = 160, h = 40, pad = 4;
  const step = (w - 2 * pad) / 6; // 7 points
  const points = series.map((v, i) => {
    if (!Number.isFinite(v)) return null;
    const x = pad + i * step;
    const y = pad + (h - 2 * pad) * (1 - (v - min) / span);
    return { x, y };
  });
  const path = points
    .map((p, i) => {
      if (!p) return "";
      return i === 0 || !points[i - 1] ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`;
    })
    .filter(Boolean)
    .join(" ");
  const latest = valid[valid.length - 1];
  return (
    <div className="health-spark">
      <div className="health-spark__label">{label}</div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="health-spark__svg">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
        {points.map((p, i) => p && (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill="currentColor" />
        ))}
      </svg>
      <div className="health-spark__latest">最近：{format(latest)}</div>
    </div>
  );
}

// ── 饮食照片放大查看（被 DayDetailModal 复用）────────────────────
function MealPhotoZoom({ meal, onClose }: { meal: MealEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="health-meal-zoom" onClick={onClose} role="dialog" aria-label="放大查看">
      <img src={meal.photoUrl} alt="" onClick={e => e.stopPropagation()} />
      <button type="button" className="health-meal-zoom__close" onClick={onClose} aria-label="关闭">✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    饮食记录 · 月历 + 日详情
// ═══════════════════════════════════════════════════════════════

/** 当月 1 日 00:00 */
function startOfMonth(d: Date): Date {
  const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x;
}
/** 下月 1 日 00:00（exclusive end） */
function startOfNextMonth(d: Date): Date {
  const x = startOfMonth(d); x.setMonth(x.getMonth() + 1); return x;
}
/** 6×7 日历网格，周一起始；每格一个 Date */
function buildMonthGrid(d: Date): Date[][] {
  const first = startOfMonth(d);
  const dow = first.getDay();                       // 0=Sun
  const startOffset = dow === 0 ? -6 : 1 - dow;     // 让周一落在第 1 列
  const start = new Date(first);
  start.setDate(first.getDate() + startOffset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + i);
      row.push(day);
    }
    weeks.push(row);
  }
  return weeks;
}
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isSameDayLocal(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

interface DayAggregate {
  date: string;
  meals: MealEntry[];
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

function aggregateDay(meals: MealEntry[]): Omit<DayAggregate, "date"> {
  let kcal = 0, proteinG = 0, carbG = 0, fatG = 0;
  for (const m of meals) {
    kcal     += m.totalKcal ?? 0;
    proteinG += m.totalProteinG ?? 0;
    carbG    += m.totalCarbG ?? 0;
    fatG     += m.totalFatG ?? 0;
  }
  return { meals, kcal, proteinG, carbG, fatG };
}

function MealsTab() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [cursor, setCursor] = useState<Date>(today);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayDetail, setDayDetail] = useState<string | null>(null);

  // 当月 + 前后各延伸 1 周（覆盖跨月单元格）
  useEffect(() => {
    const grid = buildMonthGrid(cursor);
    const start = grid[0][0];
    const end = new Date(grid[grid.length - 1][6]); end.setDate(end.getDate() + 1);
    setLoading(true);
    healthApi.listMeals({
      since: start.toISOString(),
      until: end.toISOString(),
      limit: 1000,
    })
      .then(setMeals)
      .catch(() => setMeals([]))
      .finally(() => setLoading(false));
  }, [cursor]);

  // 监听数据变化（Rich 写入新餐时刷新）
  useEffect(() => {
    const refresh = () => setCursor(c => new Date(c));    // 触发 useEffect 重跑
    window.addEventListener("health-data-changed", refresh);
    return () => window.removeEventListener("health-data-changed", refresh);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, MealEntry[]>();
    for (const m of meals) {
      // 用本地时区算日期 key，避免 UTC 偏移把午夜后的餐归错
      const day = ymdLocal(new Date(m.consumedAt));
      const arr = map.get(day) ?? [];
      arr.push(m);
      map.set(day, arr);
    }
    // 按时间排序每天
    for (const arr of map.values()) arr.sort((a, b) => a.consumedAt.localeCompare(b.consumedAt));
    return map;
  }, [meals]);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = useMemo(
    () => cursor.toLocaleDateString("zh-CN", { year: "numeric", month: "long" }),
    [cursor],
  );
  const cursorMonth = cursor.getMonth();

  const monthTotal = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = startOfNextMonth(cursor);
    const inMonth = meals.filter(m => {
      const t = new Date(m.consumedAt);
      return t >= monthStart && t < monthEnd;
    });
    const agg = aggregateDay(inMonth);
    const dayCount = new Set(inMonth.map(m => ymdLocal(new Date(m.consumedAt)))).size;
    return { ...agg, dayCount };
  }, [meals, cursor]);

  return (
    <div className="health-meals-tab">
      <header className="health-mcal__head">
        <div className="health-mcal__nav">
          <button type="button" onClick={() => {
            const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d);
          }} aria-label="上月">‹</button>
          <h2>{monthLabel}</h2>
          <button type="button" onClick={() => {
            const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d);
          }} aria-label="下月">›</button>
          <button type="button" className="health-btn-link" onClick={() => setCursor(today)}>今天</button>
        </div>
        <div className="health-mcal__total">
          {loading ? "加载中…" : (
            <>
              本月 <strong>{monthTotal.dayCount}</strong> 天有记录 ·
              均 <strong>{monthTotal.dayCount > 0 ? Math.round(monthTotal.kcal / monthTotal.dayCount) : 0}</strong> kcal/天
            </>
          )}
        </div>
      </header>

      <div className="health-mcal">
        <div className="health-mcal__weekheader">
          {["一", "二", "三", "四", "五", "六", "日"].map(w => (
            <div key={w} className="health-mcal__weekday">{w}</div>
          ))}
        </div>
        <div className="health-mcal__grid">
          {grid.flat().map((day) => {
            const key = ymdLocal(day);
            const dayMeals = byDay.get(key) ?? [];
            const agg = aggregateDay(dayMeals);
            const inMonth = day.getMonth() === cursorMonth;
            const isToday = isSameDayLocal(day, today);
            const isFuture = day > today;
            return (
              <button
                key={key}
                type="button"
                className={`health-mcal__cell${inMonth ? "" : " is-other-month"}${isToday ? " is-today" : ""}${dayMeals.length > 0 ? " has-data" : ""}`}
                disabled={dayMeals.length === 0}
                onClick={() => dayMeals.length > 0 && setDayDetail(key)}
                title={dayMeals.length > 0 ? `查看 ${dayMeals.length} 餐` : (isFuture ? "未来" : "无记录")}
              >
                <div className="health-mcal__cell-date">{day.getDate()}</div>
                {dayMeals.length > 0 && (
                  <div className="health-mcal__cell-body">
                    <div className="health-mcal__cell-kcal">
                      <strong>{Math.round(agg.kcal)}</strong> kcal
                    </div>
                    <div className="health-mcal__cell-macros">
                      <span className="health-mcal__macro health-mcal__macro--c">碳 {Math.round(agg.carbG)}</span>
                      <span className="health-mcal__macro health-mcal__macro--p">蛋 {Math.round(agg.proteinG)}</span>
                      <span className="health-mcal__macro health-mcal__macro--f">脂 {Math.round(agg.fatG)}</span>
                    </div>
                    <div className="health-mcal__cell-meta">{dayMeals.length} 餐</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {dayDetail && (
        <DayDetailModal
          date={dayDetail}
          meals={byDay.get(dayDetail) ?? []}
          onClose={() => setDayDetail(null)}
        />
      )}
    </div>
  );
}

// ── 日详情弹窗 ────────────────────────────────────────────────────
function DayDetailModal({ date, meals, onClose }:
  { date: string; meals: MealEntry[]; onClose: () => void }) {
  const [zoom, setZoom] = useState<MealEntry | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const agg = aggregateDay(meals);
  const niceDate = useMemo(() => {
    try {
      return new Date(date + "T00:00:00").toLocaleDateString("zh-CN", {
        year: "numeric", month: "long", day: "numeric", weekday: "long",
      });
    } catch { return date; }
  }, [date]);

  return (
    <div className="health-modal-overlay" onClick={onClose} role="dialog">
      <div className="health-modal health-day-modal" onClick={e => e.stopPropagation()}>
        <header className="health-modal__head">
          <h3>{niceDate}</h3>
          <button type="button" className="health-modal__close" onClick={onClose}>✕</button>
        </header>

        <div className="health-day-modal__total">
          <div className="health-day-modal__kcal">
            <strong>{Math.round(agg.kcal)}</strong> kcal
            <span> · {meals.length} 餐</span>
          </div>
          <div className="health-day-modal__macros">
            <span className="health-macro health-macro--c">碳水 <strong>{Math.round(agg.carbG)}</strong>g</span>
            <span className="health-macro health-macro--p">蛋白 <strong>{Math.round(agg.proteinG)}</strong>g</span>
            <span className="health-macro health-macro--f">脂肪 <strong>{Math.round(agg.fatG)}</strong>g</span>
          </div>
        </div>

        <div className="health-modal__body">
          <ul className="health-day-modal__list">
            {meals.map(m => <DayMealRow key={m.id} meal={m} onZoom={() => setZoom(m)} />)}
          </ul>
        </div>
      </div>
      {zoom?.photoUrl && <MealPhotoZoom meal={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function DayMealRow({ meal, onZoom }: { meal: MealEntry; onZoom: () => void }) {
  const time = useMemo(() => {
    try {
      return new Date(meal.consumedAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }, [meal.consumedAt]);

  const mealTypeLabel = meal.mealType === "breakfast" ? "早餐"
    : meal.mealType === "lunch" ? "午餐"
    : meal.mealType === "dinner" ? "晚餐"
    : meal.mealType === "snack" ? "加餐" : "餐";

  return (
    <li className="health-meal-row">
      {meal.photoUrl ? (
        <button type="button" className="health-meal-row__thumb" onClick={onZoom}
          title="点击查看大图">
          <img src={meal.photoUrl} alt={mealTypeLabel} loading="lazy" />
        </button>
      ) : (
        <div className="health-meal-row__thumb health-meal-row__thumb--empty" aria-hidden="true">
          <span>🍽</span>
        </div>
      )}
      <div className="health-meal-row__body">
        <div className="health-meal-row__head">
          <span className="health-meal-row__type">{mealTypeLabel}</span>
          <time className="health-meal-row__time">{time}</time>
        </div>
        {meal.items.length > 0 && (
          <ul className="health-meal-row__items">
            {meal.items.map((it, i) => (
              <li key={i} className="health-meal-item">
                <span className="health-meal-item__name">{it.name}</span>
                {it.grams != null && <span className="health-meal-item__grams">{it.grams}g</span>}
                {it.kcal != null && <span className="health-meal-item__kcal">{Math.round(it.kcal)} kcal</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="health-meal-row__macros">
          {meal.totalKcal != null && (
            <span className="health-macro health-macro--kcal">
              <strong>{Math.round(meal.totalKcal)}</strong> kcal
            </span>
          )}
          {meal.totalProteinG != null && (
            <span className="health-macro health-macro--p">
              蛋白 <strong>{Math.round(meal.totalProteinG)}</strong>g
            </span>
          )}
          {meal.totalCarbG != null && (
            <span className="health-macro health-macro--c">
              碳水 <strong>{Math.round(meal.totalCarbG)}</strong>g
            </span>
          )}
          {meal.totalFatG != null && (
            <span className="health-macro health-macro--f">
              脂肪 <strong>{Math.round(meal.totalFatG)}</strong>g
            </span>
          )}
        </div>
        {meal.notes && <div className="health-meal-row__notes">{meal.notes}</div>}
      </div>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    定时提醒 · 设置面板 + Toast
// ═══════════════════════════════════════════════════════════════

const REMINDER_KIND_OPTIONS: Array<{ id: ReminderKind; label: string; icon: string }> = [
  { id: "workout", label: "健身",   icon: "🏋️" },
  { id: "water",   label: "喝水",   icon: "💧" },
  { id: "meds",    label: "吃药",   icon: "💊" },
  { id: "sleep",   label: "睡觉",   icon: "😴" },
  { id: "meal",    label: "吃饭",   icon: "🍱" },
  { id: "custom",  label: "自定义", icon: "🔔" },
];

const CHANNEL_OPTIONS: Array<{ id: ReminderChannel; label: string; hint: string }> = [
  { id: "feishu", label: "飞书", hint: "需要在下方设置 webhook" },
  { id: "screen", label: "Mac 通知中心", hint: "首次会弹权限请求" },
  { id: "inapp",  label: "应用内浮层", hint: "Rich 打开时才看到" },
];

function RemindersTab() {
  const [items, setItems] = useState<HealthReminder[]>([]);
  const [feishuInfo, setFeishuInfo] = useState<{ configured: boolean; masked: string | null }>({
    configured: false, masked: null,
  });
  const [editing, setEditing] = useState<HealthReminder | null>(null);
  const [creating, setCreating] = useState(false);
  const [webhookInput, setWebhookInput] = useState("");

  const refresh = () => {
    void healthApi.listReminders().then(setItems).catch(() => setItems([]));
    void healthApi.getFeishuWebhook().then(setFeishuInfo).catch(() => setFeishuInfo({ configured: false, masked: null }));
  };
  useEffect(() => { refresh(); }, []);

  async function toggleEnabled(r: HealthReminder) {
    await healthApi.updateReminder(r.id, { enabled: !r.enabled });
    refresh();
  }
  async function remove(id: string) {
    if (!window.confirm("确定删除这条提醒？")) return;
    await healthApi.deleteReminder(id);
    refresh();
  }
  async function fireTest(id: string) {
    await healthApi.testFireReminder(id);
  }
  async function saveWebhook() {
    const v = webhookInput.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      window.alert("webhook 必须是 http(s):// 开头的完整 URL");
      return;
    }
    await healthApi.setFeishuWebhook(v || null);
    setWebhookInput("");
    refresh();
  }

  return (
    <div className="health-reminders">
      <section className="health-card">
        <header className="health-reminders__head">
          <div>
            <h3>⏰ 定时提醒</h3>
            <p className="health-hint">Rich 会按设定时间发飞书 + 弹通知。每分钟扫一次，daily 用 HH:mm，interval 用分钟数。</p>
          </div>
          <button type="button" className="health-btn-primary" onClick={() => setCreating(true)}>
            + 新增提醒
          </button>
        </header>

        {items.length === 0 && (
          <div className="health-empty">还没有提醒。点右上「+ 新增提醒」加一条试试。</div>
        )}

        {items.length > 0 && (
          <ul className="health-reminders__list">
            {items.map(r => (
              <li key={r.id} className={`health-reminder-row${r.enabled ? "" : " is-disabled"}`}>
                <div className="health-reminder-row__main">
                  <div className="health-reminder-row__head">
                    <span className="health-reminder-row__icon">{REMINDER_KIND_OPTIONS.find(k => k.id === r.kind)?.icon ?? "🔔"}</span>
                    <strong>{r.title}</strong>
                    <span className="health-reminder-row__sched">
                      {r.schedule.kind === "daily" ? `每天 ${r.schedule.time ?? "--:--"}` : `每 ${r.schedule.intervalMin ?? "?"} 分钟`}
                    </span>
                  </div>
                  {r.body && <div className="health-reminder-row__body">{r.body}</div>}
                  <div className="health-reminder-row__channels">
                    通道：{r.channels.map(c => CHANNEL_OPTIONS.find(o => o.id === c)?.label ?? c).join(" / ") || "—"}
                    {r.lastFiredAt && (
                      <span className="health-reminder-row__last"> · 上次：{new Date(r.lastFiredAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </div>
                </div>
                <div className="health-reminder-row__actions">
                  <label className="health-toggle" title={r.enabled ? "已启用" : "已停用"}>
                    <input type="checkbox" checked={r.enabled} onChange={() => void toggleEnabled(r)} />
                    <span />
                  </label>
                  <button type="button" className="health-btn-link" onClick={() => void fireTest(r.id)} title="立即测试一次">🔔</button>
                  <button type="button" className="health-btn-link" onClick={() => setEditing(r)} title="编辑">✎</button>
                  <button type="button" className="health-btn-link" onClick={() => void remove(r.id)} title="删除">🗑</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 飞书 webhook 配置 */}
      <section className="health-card">
        <h3>📡 飞书 webhook</h3>
        <p className="health-hint">
          在飞书群里加自定义机器人 → 得到 webhook URL → 粘贴在这里。提醒里勾上「飞书」就会自动发到该群。
        </p>
        {feishuInfo.configured && (
          <div className="health-webhook-current">
            ✓ 已配置 · <code>{feishuInfo.masked}</code>
            <button type="button" className="health-btn-link" onClick={async () => {
              if (window.confirm("清除当前 webhook？")) { await healthApi.setFeishuWebhook(null); refresh(); }
            }}>清除</button>
          </div>
        )}
        <div className="health-webhook-form">
          <input type="url" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            value={webhookInput} onChange={e => setWebhookInput(e.target.value)} />
          <button type="button" className="health-btn-primary" onClick={() => void saveWebhook()}
            disabled={!webhookInput.trim()}>保存</button>
        </div>
      </section>

      {(creating || editing) && (
        <ReminderEditor
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ReminderEditor({ initial, onClose, onSaved }:
  { initial: HealthReminder | null; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<ReminderKind>(initial?.kind ?? "water");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [schedKind, setSchedKind] = useState<"daily" | "interval">(initial?.schedule.kind ?? "daily");
  const [time, setTime] = useState(initial?.schedule.time ?? "09:00");
  const [intervalMin, setIntervalMin] = useState(initial?.schedule.intervalMin ?? 90);
  const [channels, setChannels] = useState<ReminderChannel[]>(initial?.channels ?? ["inapp", "screen"]);
  const [saving, setSaving] = useState(false);

  /** 选择 kind 时，没填 title 的话自动带一个默认 */
  function pickKind(next: ReminderKind) {
    setKind(next);
    if (!title.trim()) {
      const def = REMINDER_KIND_OPTIONS.find(k => k.id === next);
      if (def) setTitle(def.label === "自定义" ? "" : `${def.label}时间到`);
    }
  }

  function toggleChannel(c: ReminderChannel) {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function save() {
    const t = title.trim();
    if (!t) { window.alert("标题不能空"); return; }
    if (channels.length === 0) { window.alert("至少选一个通道"); return; }
    const payload: Partial<HealthReminder> = {
      kind, title: t, body: body.trim() || undefined,
      schedule: schedKind === "daily" ? { kind: "daily", time } : { kind: "interval", intervalMin },
      channels, enabled: initial?.enabled ?? true,
    };
    setSaving(true);
    try {
      if (initial) await healthApi.updateReminder(initial.id, payload);
      else await healthApi.createReminder(payload);
      onSaved();
    } catch (e) {
      window.alert(`保存失败：${e instanceof Error ? e.message : e}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="health-modal-overlay" onClick={onClose} role="dialog">
      <div className="health-modal" onClick={e => e.stopPropagation()}>
        <header className="health-modal__head">
          <h3>{initial ? "编辑提醒" : "新增提醒"}</h3>
          <button type="button" className="health-modal__close" onClick={onClose}>✕</button>
        </header>

        <div className="health-modal__body">
          <label className="health-field">
            <span>类型</span>
            <div className="health-kind-grid">
              {REMINDER_KIND_OPTIONS.map(k => (
                <button key={k.id} type="button"
                  className={`health-kind-chip${kind === k.id ? " is-active" : ""}`}
                  onClick={() => pickKind(k.id)}>
                  <span>{k.icon}</span><span>{k.label}</span>
                </button>
              ))}
            </div>
          </label>

          <label className="health-field">
            <span>标题</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="例：该喝水了" maxLength={80} />
          </label>

          <label className="health-field">
            <span>说明（可选）</span>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="例：300ml，慢慢喝" rows={2} maxLength={400} />
          </label>

          <label className="health-field">
            <span>触发方式</span>
            <div className="health-sched">
              <label className="health-radio">
                <input type="radio" checked={schedKind === "daily"} onChange={() => setSchedKind("daily")} />
                每天固定时间
              </label>
              <label className="health-radio">
                <input type="radio" checked={schedKind === "interval"} onChange={() => setSchedKind("interval")} />
                每隔几分钟
              </label>
            </div>
          </label>

          {schedKind === "daily" ? (
            <label className="health-field">
              <span>时间</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </label>
          ) : (
            <label className="health-field">
              <span>间隔（分钟）</span>
              <input type="number" min={1} max={1440} step={1}
                value={intervalMin}
                onChange={e => setIntervalMin(Math.max(1, Math.min(1440, parseInt(e.target.value || "1", 10))))} />
            </label>
          )}

          <label className="health-field">
            <span>通道</span>
            <div className="health-channels">
              {CHANNEL_OPTIONS.map(c => (
                <label key={c.id} className={`health-channel-chip${channels.includes(c.id) ? " is-active" : ""}`}>
                  <input type="checkbox" checked={channels.includes(c.id)} onChange={() => toggleChannel(c.id)} />
                  <span className="health-channel-chip__label">{c.label}</span>
                  <span className="health-channel-chip__hint">{c.hint}</span>
                </label>
              ))}
            </div>
          </label>
        </div>

        <footer className="health-modal__foot">
          <button type="button" className="health-btn-link" onClick={onClose}>取消</button>
          <button type="button" className="health-btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** 应用内 Toast + Mac 原生通知 —— 订阅 SSE reminder.fire 事件 */
interface ToastEntry { id: string; firedAt: number; title: string; body: string; channels: ReminderChannel[] }

function ReminderToastHost() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  // 启动时跟用户要 Notification 权限（首次会弹系统授权框）
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");
    const handler = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data);
        const d = parsed?.detail;
        if (parsed?.kind !== "greatme.changed") return;
        if (d?.kind !== "reminder.fire") return;
        const entry: ToastEntry = {
          id: `${d.id}-${Date.now()}`,
          firedAt: Date.now(),
          title: String(d.title ?? "提醒"),
          body: String(d.body ?? ""),
          channels: Array.isArray(d.channels) ? d.channels : ["inapp"],
        };
        // 应用内：直接挂到 state，CSS 自动弹
        if (entry.channels.includes("inapp")) {
          setToasts(prev => [...prev, entry].slice(-3));
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== entry.id));
          }, 10_000);
        }
        // Mac 原生：调 window.Notification（需要前面拿到 granted）
        if (entry.channels.includes("screen") && "Notification" in window && Notification.permission === "granted") {
          try {
            const n = new Notification(`Rich · ${entry.title}`, {
              body: entry.body,
              tag: `rich-rmd-${d.id}`,
            });
            n.onclick = () => { window.focus(); n.close(); };
          } catch { /* 某些 Electron 版本不允许 renderer 直接发，忽略 */ }
        }
      } catch { /* malformed; ignore */ }
    };
    es.addEventListener("change", handler);
    return () => { es.removeEventListener("change", handler); es.close(); };
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="health-toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="health-toast" role="alert">
          <header>
            <strong>🔔 {t.title}</strong>
            <button type="button" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </header>
          {t.body && <div className="health-toast__body">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}

// ── 月度走势占位 ──────────────────────────────────────────────────
function MonthTrendPlaceholder() {
  return (
    <section className="health-card health-month-placeholder">
      <header><h3>📅 本月 / 90 日走势</h3></header>
      <div className="health-empty">
        V0.2 接入：30 / 90 日体重曲线 · 训练容量 · 卡路里盈亏 · 多指标对比。
      </div>
    </section>
  );
}

// ── 折叠流水 ──────────────────────────────────────────────────────
function RecentEntriesFolded() {
  return (
    <details className="health-recent-folded">
      <summary>▼ Rich 最近帮你录入的（点开查看）</summary>
      <RecentEntries />
    </details>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    档案 Profile Tab
// ═══════════════════════════════════════════════════════════════

function ProfileTab() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [form, setForm] = useState<Partial<HealthProfile>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void healthApi.getProfile().then(p => {
      setProfile(p);
      if (p) setForm(p);
    }).catch(e => setErr(String(e)));
  }, []);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const next = await healthApi.putProfile(form);
      setProfile(next);
      setSavedAt(new Date().toLocaleTimeString("zh-CN"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="health-card health-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <h2>静态档案</h2>
      <p className="health-hint">填一次就行，目标 / 活动度变化时回来改一下。</p>

      <div className="health-grid">
        <label>
          <span>身高 (cm)</span>
          <input type="number" min={100} max={250}
            value={form.heightCm ?? ""}
            onChange={e => setForm({ ...form, heightCm: e.target.value ? parseInt(e.target.value, 10) : undefined })} />
        </label>
        <label>
          <span>性别</span>
          <select value={form.sex ?? ""}
            onChange={e => setForm({ ...form, sex: (e.target.value || undefined) as HealthProfile["sex"] })}>
            <option value="">—</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          <span>出生日期</span>
          <input type="date" value={form.dob ?? ""}
            onChange={e => setForm({ ...form, dob: e.target.value || undefined })} />
        </label>
        <label>
          <span>目标</span>
          <select value={form.goal ?? ""}
            onChange={e => setForm({ ...form, goal: (e.target.value || undefined) as HealthProfile["goal"] })}>
            <option value="">—</option>
            <option value="cut">减脂</option>
            <option value="maintain">维持</option>
            <option value="bulk">增肌</option>
          </select>
        </label>
        <label>
          <span>活动度</span>
          <select value={form.activityLevel ?? ""}
            onChange={e => setForm({ ...form, activityLevel: (e.target.value || undefined) as HealthProfile["activityLevel"] })}>
            <option value="">—</option>
            <option value="sedentary">久坐</option>
            <option value="light">轻度活动</option>
            <option value="moderate">中度活动</option>
            <option value="active">高活动</option>
            <option value="very-active">极活跃</option>
          </select>
        </label>
        <label>
          <span>目标体重 (kg)</span>
          <input type="number" step="0.1" min={30} max={250}
            value={form.targetWeightKg ?? ""}
            onChange={e => setForm({ ...form, targetWeightKg: e.target.value ? parseFloat(e.target.value) : undefined })} />
        </label>
      </div>

      <label className="health-full">
        <span>健康注意（病史 / 慢性问题等）</span>
        <textarea rows={2} value={form.healthNotes ?? ""}
          onChange={e => setForm({ ...form, healthNotes: e.target.value || undefined })} />
      </label>
      <label className="health-full">
        <span>过敏 / 禁忌</span>
        <textarea rows={2} value={form.allergies ?? ""}
          onChange={e => setForm({ ...form, allergies: e.target.value || undefined })} />
      </label>

      <div className="health-actions">
        <button type="submit" className="health-btn-primary" disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </button>
        {savedAt && <span className="health-saved">已保存 · {savedAt}</span>}
        {profile?.updatedAt && !savedAt && (
          <span className="health-saved health-saved--dim">上次更新 {new Date(profile.updatedAt).toLocaleString("zh-CN")}</span>
        )}
        {err && <span className="health-err">⚠ {err}</span>}
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    Quick log 表单（仅 ?devlogs=1 时可见）
// ═══════════════════════════════════════════════════════════════

function WeightQuickLog() {
  const [kg, setKg] = useState("");
  const [bf, setBf] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const n = parseFloat(kg);
    if (!Number.isFinite(n) || n < 20 || n > 300) {
      setMsg("体重不合理"); return;
    }
    setBusy(true); setMsg(null);
    try {
      await healthApi.logWeight({
        kg: n,
        bodyFatPct: bf ? parseFloat(bf) : undefined,
      });
      setMsg("✓ 已写入");
      setKg(""); setBf("");
      window.dispatchEvent(new CustomEvent("health-data-changed"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="health-card health-quick" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <h3>⚖️ 体重</h3>
      <div className="health-quick-row-fields">
        <label>
          <span>kg</span>
          <input type="number" step="0.1" placeholder="80.5"
            value={kg} onChange={e => setKg(e.target.value)} autoFocus />
        </label>
        <label>
          <span>体脂 %</span>
          <input type="number" step="0.1" placeholder="选填"
            value={bf} onChange={e => setBf(e.target.value)} />
        </label>
      </div>
      <button type="submit" className="health-btn-primary" disabled={busy || !kg}>
        {busy ? "…" : "记录"}
      </button>
      {msg && <div className="health-quick-msg">{msg}</div>}
    </form>
  );
}

function MealQuickLog() {
  const [items, setItems] = useState<MealItem[]>([{ name: "" }]);
  const [mealType, setMealType] = useState<MealEntry["mealType"]>("lunch");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patchItem(i: number, patch: Partial<MealItem>) {
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  async function submit() {
    const valid = items.filter(it => it.name.trim());
    if (valid.length === 0) {
      setMsg("至少填一个食物"); return;
    }
    setBusy(true); setMsg(null);
    try {
      await healthApi.logMeal({ mealType, items: valid });
      setMsg("✓ 已写入");
      setItems([{ name: "" }]);
      window.dispatchEvent(new CustomEvent("health-data-changed"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="health-card health-quick" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <h3>🍱 饮食</h3>
      <label className="health-quick-meal-type">
        <span>餐次</span>
        <select value={mealType ?? ""} onChange={e => setMealType((e.target.value || undefined) as MealEntry["mealType"])}>
          <option value="breakfast">早餐</option>
          <option value="lunch">午餐</option>
          <option value="dinner">晚餐</option>
          <option value="snack">加餐</option>
        </select>
      </label>
      <div className="health-meal-items">
        {items.map((it, i) => (
          <div key={i} className="health-meal-item-row">
            <input className="meal-name" placeholder="食物名（如 鸡胸）"
              value={it.name} onChange={e => patchItem(i, { name: e.target.value })} />
            <input className="meal-num" type="number" placeholder="g"
              value={it.grams ?? ""} onChange={e => patchItem(i, { grams: e.target.value ? parseFloat(e.target.value) : undefined })} />
            <input className="meal-num" type="number" placeholder="kcal"
              value={it.kcal ?? ""} onChange={e => patchItem(i, { kcal: e.target.value ? parseFloat(e.target.value) : undefined })} />
            <input className="meal-num" type="number" placeholder="蛋白 g"
              value={it.proteinG ?? ""} onChange={e => patchItem(i, { proteinG: e.target.value ? parseFloat(e.target.value) : undefined })} />
            {items.length > 1 && (
              <button type="button" className="health-icon-btn"
                onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                aria-label="删除这行">×</button>
            )}
          </div>
        ))}
        <button type="button" className="health-btn-link"
          onClick={() => setItems([...items, { name: "" }])}>+ 加一行</button>
      </div>
      <button type="submit" className="health-btn-primary" disabled={busy}>
        {busy ? "…" : "记录"}
      </button>
      {msg && <div className="health-quick-msg">{msg}</div>}
    </form>
  );
}

interface SetDraft { exercise: string; reps?: string; weightKg?: string; rpe?: string }

function WorkoutQuickLog() {
  const [sessionName, setSessionName] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [sets, setSets] = useState<SetDraft[]>([{ exercise: "" }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patchSet(i: number, patch: Partial<SetDraft>) {
    setSets(sets.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  async function submit() {
    const valid = sets.filter(s => s.exercise.trim())
      .map((s, i) => ({
        exercise: s.exercise.trim(),
        reps: s.reps ? parseInt(s.reps, 10) : undefined,
        weightKg: s.weightKg ? parseFloat(s.weightKg) : undefined,
        rpe: s.rpe ? parseInt(s.rpe, 10) : undefined,
        orderIndex: i,
      }));
    if (valid.length === 0) { setMsg("至少一组动作"); return; }
    setBusy(true); setMsg(null);
    try {
      await healthApi.logWorkout({
        sessionName: sessionName || undefined,
        durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
        sets: valid,
      });
      setMsg("✓ 已写入");
      setSessionName(""); setDurationMin("");
      setSets([{ exercise: "" }]);
      window.dispatchEvent(new CustomEvent("health-data-changed"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="health-card health-quick health-quick--wide" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <h3>🏋️ 训练</h3>
      <div className="health-quick-row-fields">
        <label>
          <span>session 名</span>
          <input placeholder="例：周一上肢" value={sessionName} onChange={e => setSessionName(e.target.value)} />
        </label>
        <label>
          <span>时长 (min)</span>
          <input type="number" placeholder="50" value={durationMin} onChange={e => setDurationMin(e.target.value)} />
        </label>
      </div>
      <div className="health-meal-items">
        {sets.map((s, i) => (
          <div key={i} className="health-meal-item-row">
            <input className="meal-name" placeholder="动作（卧推 / 深蹲）"
              value={s.exercise} onChange={e => patchSet(i, { exercise: e.target.value })} />
            <input className="meal-num" type="number" placeholder="次"
              value={s.reps ?? ""} onChange={e => patchSet(i, { reps: e.target.value })} />
            <input className="meal-num" type="number" step="0.5" placeholder="kg"
              value={s.weightKg ?? ""} onChange={e => patchSet(i, { weightKg: e.target.value })} />
            <input className="meal-num" type="number" min={1} max={10} placeholder="RPE"
              value={s.rpe ?? ""} onChange={e => patchSet(i, { rpe: e.target.value })} />
            {sets.length > 1 && (
              <button type="button" className="health-icon-btn"
                onClick={() => setSets(sets.filter((_, idx) => idx !== i))}>×</button>
            )}
          </div>
        ))}
        <button type="button" className="health-btn-link"
          onClick={() => setSets([...sets, { exercise: "" }])}>+ 加一组</button>
      </div>
      <button type="submit" className="health-btn-primary" disabled={busy}>
        {busy ? "…" : "记录"}
      </button>
      {msg && <div className="health-quick-msg">{msg}</div>}
    </form>
  );
}

function SleepQuickLog() {
  const [duration, setDuration] = useState("");
  const [quality, setQuality] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const min = duration ? parseInt(duration, 10) : undefined;
    const q = quality ? parseInt(quality, 10) : undefined;
    setBusy(true); setMsg(null);
    try {
      await healthApi.logSleep({
        durationMin: min,
        quality: q,
      });
      setMsg("✓ 已写入");
      setDuration(""); setQuality("");
      window.dispatchEvent(new CustomEvent("health-data-changed"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="health-card health-quick" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <h3>😴 睡眠</h3>
      <div className="health-quick-row-fields">
        <label>
          <span>时长 (min)</span>
          <input type="number" placeholder="420" value={duration} onChange={e => setDuration(e.target.value)} />
        </label>
        <label>
          <span>主观打分 (1-10)</span>
          <input type="number" min={1} max={10} placeholder="7" value={quality} onChange={e => setQuality(e.target.value)} />
        </label>
      </div>
      <button type="submit" className="health-btn-primary" disabled={busy || (!duration && !quality)}>
        {busy ? "…" : "记录"}
      </button>
      {msg && <div className="health-quick-msg">{msg}</div>}
    </form>
  );
}

function MoodQuickLog() {
  const [energy, setEnergy] = useState("");
  const [mood, setMood] = useState("");
  const [fatigue, setFatigue] = useState("");
  const [soreness, setSoreness] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      await healthApi.logMood({
        energy: energy ? parseInt(energy, 10) : undefined,
        mood: mood ? parseInt(mood, 10) : undefined,
        fatigue: fatigue ? parseInt(fatigue, 10) : undefined,
        soreness: soreness ? parseInt(soreness, 10) : undefined,
      });
      setMsg("✓ 已写入");
      setEnergy(""); setMood(""); setFatigue(""); setSoreness("");
      window.dispatchEvent(new CustomEvent("health-data-changed"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="health-card health-quick" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <h3>🌤️ 主观（1-10）</h3>
      <div className="health-quick-row-fields">
        <label><span>精力</span><input type="number" min={1} max={10} value={energy} onChange={e => setEnergy(e.target.value)} /></label>
        <label><span>心情</span><input type="number" min={1} max={10} value={mood} onChange={e => setMood(e.target.value)} /></label>
        <label><span>疲劳</span><input type="number" min={1} max={10} value={fatigue} onChange={e => setFatigue(e.target.value)} /></label>
        <label><span>酸痛</span><input type="number" min={1} max={10} value={soreness} onChange={e => setSoreness(e.target.value)} /></label>
      </div>
      <button type="submit" className="health-btn-primary" disabled={busy || (!energy && !mood && !fatigue && !soreness)}>
        {busy ? "…" : "记录"}
      </button>
      {msg && <div className="health-quick-msg">{msg}</div>}
    </form>
  );
}

// ─── 最近条目列表 ──────────────────────────────────────────────
interface TimelineItem { kind: string; at: string; payload: unknown }

function RecentEntries() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/health/timeline?limit=30");
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json() as { items: TimelineItem[] };
      setItems(d.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("health-data-changed", handler);
    return () => window.removeEventListener("health-data-changed", handler);
  }, []);

  return (
    <section className="health-card health-recent">
      <header>
        <h3>最近 30 条</h3>
        <button type="button" className="health-btn-link" onClick={() => void refresh()} disabled={loading}>
          {loading ? "刷新中…" : "刷新"}
        </button>
      </header>
      {err && <div className="health-err">⚠ {err}</div>}
      {!err && items.length === 0 && !loading && <div className="health-empty">还没有记录，去上面打卡吧。</div>}
      <ul className="health-timeline">
        {items.map((it, i) => <TimelineRow key={i} item={it} />)}
      </ul>
    </section>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const at = useMemo(() => {
    try { return new Date(item.at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return item.at; }
  }, [item.at]);

  let icon = "·", summary = "";
  switch (item.kind) {
    case "weight": {
      const w = item.payload as WeightEntry;
      icon = "⚖️";
      summary = `${w.kg} kg${w.bodyFatPct ? ` · 体脂 ${w.bodyFatPct}%` : ""}`;
      break;
    }
    case "workout": {
      const w = item.payload as WorkoutSession & { sets?: WorkoutSet[] };
      icon = "🏋️";
      const setCount = w.sets?.length ?? 0;
      summary = `${w.sessionName ?? "训练"} · ${setCount} 组${w.totalVolume ? ` · ${w.totalVolume} kg 总量` : ""}${w.durationMin ? ` · ${w.durationMin} min` : ""}`;
      break;
    }
    case "meal": {
      const m = item.payload as MealEntry;
      icon = "🍱";
      const names = m.items.map(i => i.name).filter(Boolean).slice(0, 3).join("、");
      summary = `${m.mealType === "breakfast" ? "早餐" : m.mealType === "lunch" ? "午餐" : m.mealType === "dinner" ? "晚餐" : m.mealType === "snack" ? "加餐" : ""} · ${names || "(无)"}`+
        `${m.totalKcal ? ` · ${m.totalKcal} kcal` : ""}${m.totalProteinG ? ` · ${m.totalProteinG}P` : ""}`;
      break;
    }
    case "sleep": {
      const s = item.payload as SleepEntry;
      icon = "😴";
      summary = `${s.durationMin ? `${Math.round(s.durationMin / 60 * 10) / 10}h` : ""}${s.quality ? ` · ${s.quality}/10` : ""}`;
      break;
    }
    case "mood": {
      const m = item.payload as MoodEntry;
      icon = "🌤️";
      const parts: string[] = [];
      if (m.energy != null) parts.push(`精力 ${m.energy}`);
      if (m.mood != null) parts.push(`心情 ${m.mood}`);
      if (m.fatigue != null) parts.push(`疲劳 ${m.fatigue}`);
      if (m.soreness != null) parts.push(`酸痛 ${m.soreness}`);
      summary = parts.join(" · ");
      break;
    }
  }

  return (
    <li className="health-timeline-row">
      <span className="health-timeline-icon" aria-hidden="true">{icon}</span>
      <div className="health-timeline-main">
        <span className="health-timeline-summary">{summary}</span>
        <time className="health-timeline-time">{at}</time>
      </div>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    周计划 / 周报（V0.1 占位）
// ═══════════════════════════════════════════════════════════════

function PlanTab() {
  return (
    <div className="health-plan">
      <section className="health-card health-card--info">
        <h3>🎯 AI 周计划（批次 3 接入）</h3>
        <p>AI 拉过去 14 日全维度数据 → 出下周饮食 + 训练计划。你可整体接受 / 按项调整 / 拒绝。</p>
      </section>
      <section className="health-card health-card--info">
        <h3>📝 周报 / 月报（批次 4 接入）</h3>
        <p>每周日 21:00 自动生成本周复盘：趋势 + 目标进度 + 异常 + 下周建议。Mascot 主动推送。</p>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    Apple Health 接入引导
// ═══════════════════════════════════════════════════════════════

interface NetInfo { lanIp: string; port: number; intakeUrl: string; allCandidates: string[]; note: string }
interface PublicInfo { deployed: boolean; publicHost: string; publicPort: number; intakeUrl: string; healthAutoExportUrl?: string; token: string | null; note: string }

interface IntakeStatus {
  weight:  { latest: WeightEntry | null;  hasData: boolean };
  sleep:   { latest: SleepEntry | null;   hasData: boolean };
  workout: { latest: (WorkoutSession & { sets?: WorkoutSet[] }) | null; hasData: boolean };
  meal:    { latest: MealEntry | null;    hasData: boolean };
  mood:    { latest: MoodEntry | null;    hasData: boolean };
}

function AppleHealthTab() {
  const [net, setNet] = useState<NetInfo | null>(null);
  const [pub, setPub] = useState<PublicInfo | null>(null);
  const [status, setStatus] = useState<IntakeStatus | null>(null);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const [n, p, s] = await Promise.all([
        fetch("/api/health/network-info").then(r => r.json() as Promise<NetInfo>),
        fetch("/api/health/intake/public-info").then(r => r.json() as Promise<PublicInfo>),
        fetch("/api/health/intake/status").then(r => r.json() as Promise<IntakeStatus>),
      ]);
      setNet(n);
      setPub(p);
      setStatus(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { void refresh(); }, []);

  function copyText(text: string, which: "url" | "token") {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="health-apple">
      {err && <div className="health-card health-err">⚠ {err}</div>}

      {/* ─── 公网 URL（推荐 —— 出门也能 sync）─────────── */}
      <section className="health-card">
        <h3>☁️ 公网 URL（推荐 · 出门也能同步）</h3>
        {pub?.deployed && pub.token ? (
          <>
            <label className="health-apple-field">
              <span>Health Auto Export REST URL（推荐）</span>
              <code className="health-apple-url">{pub.healthAutoExportUrl ?? pub.intakeUrl.replace("/from-apple", "/health-auto-export")}</code>
              <button type="button" className="health-btn-primary"
                onClick={() => copyText(pub.healthAutoExportUrl ?? pub.intakeUrl.replace("/from-apple", "/health-auto-export"), "url")}>
                {copied === "url" ? "✓ 已复制" : "复制"}
              </button>
            </label>
            <label className="health-apple-field">
              <span>快捷指令 POST URL</span>
              <code className="health-apple-url">{pub.intakeUrl}</code>
              <button type="button" className="health-btn-primary"
                onClick={() => copyText(pub.intakeUrl, "url")}>
                {copied === "url" ? "✓ 已复制" : "复制"}
              </button>
            </label>
            <label className="health-apple-field">
              <span>Bearer Token（鉴权，放快捷指令的「表头」里）</span>
              <code className="health-apple-url">{pub.token}</code>
              <button type="button" className="health-btn-primary"
                onClick={() => copyText(pub.token!, "token")}>
                {copied === "token" ? "✓ 已复制" : "复制"}
              </button>
            </label>
            <p className="health-hint">
              Health Auto Export 里选 REST API / JSON，把 URL 填第一行，Header 添加 <code>authorization</code> = <code>Bearer &lt;复制的 token&gt;</code>。
            </p>
          </>
        ) : (
          <>
            <p className="health-hint">未部署公网 intake 服务。</p>
            <pre className="health-apple-json">cd apps/health-intake && pnpm deploy</pre>
            <p className="health-hint">
              一次性部署：会把 slim 服务推到阿里云 ECS（systemd 守护），生成 token，前端这里自动展示。
            </p>
          </>
        )}
      </section>

      {/* ─── Health Auto Export 自动同步 ───────────── */}
      <section className="health-card">
        <h3>🔁 Health Auto Export 自动同步</h3>
        <ol className="health-apple-list">
          <li>Health Auto Export → Automations → REST API</li>
          <li>Format 选 <code>JSON</code>，Date Range 选 <code>Since Last Sync</code></li>
          <li>Data Types 选 Health Metrics 和 Workouts；想省心就先全选</li>
          <li>Headers 添加 <code>authorization</code>，值是 <code>Bearer &lt;token&gt;</code></li>
          <li>打开 Batch Requests，然后先手动 Run 一次</li>
        </ol>
        <p className="health-hint">
          Rich 会先完整归档原始 JSON，再解析体重、睡眠、饮食、活动和运动。暂时不认识的字段也不会丢。
        </p>
      </section>

      {/* ─── LAN URL（家里 Wi-Fi 备用）──────────────── */}
      <section className="health-card">
        <h3>🏠 LAN URL（家里 Wi-Fi 备用，免鉴权）</h3>
        {net ? (
          <>
            <code className="health-apple-url">{net.intakeUrl}</code>
            <div className="health-actions">
              <button type="button" className="health-btn-link"
                onClick={() => copyText(net.intakeUrl, "url")}>
                复制
              </button>
              <button type="button" className="health-btn-link" onClick={() => void refresh()}>
                重新检测
              </button>
            </div>
            <p className="health-hint">{net.note}</p>
          </>
        ) : (
          <p className="health-hint">读取网络信息中…</p>
        )}
      </section>

      {/* ─── 同步状态 ─────────────────────────────── */}
      <section className="health-card">
        <h3>🩺 当前同步状态</h3>
        {status ? (
          <ul className="health-apple-status">
            <StatusRow icon="⚖️" label="体重" hasData={status.weight.hasData}
              detail={status.weight.latest && `最近 ${status.weight.latest.kg} kg · ${formatTime(status.weight.latest.loggedAt)}`} />
            <StatusRow icon="😴" label="睡眠" hasData={status.sleep.hasData}
              detail={status.sleep.latest && `最近 ${status.sleep.latest.durationMin ? Math.round(status.sleep.latest.durationMin / 60 * 10) / 10 + 'h' : '?'} · ${status.sleep.latest.sleepDate}`} />
            <StatusRow icon="🏋️" label="训练" hasData={status.workout.hasData}
              detail={status.workout.latest && `最近 ${status.workout.latest.sessionName ?? '训练'} · ${formatTime(status.workout.latest.performedAt)}`} />
            <StatusRow icon="🍱" label="饮食" hasData={status.meal.hasData}
              detail={status.meal.latest && `最近 ${status.meal.latest.totalKcal ?? '?'} kcal · ${formatTime(status.meal.latest.consumedAt)}`} />
            <StatusRow icon="🌤️" label="主观" hasData={status.mood.hasData}
              detail={status.mood.latest && `最近 精力 ${status.mood.latest.energy ?? '?'} / 心情 ${status.mood.latest.mood ?? '?'} · ${formatTime(status.mood.latest.loggedAt)}`} />
          </ul>
        ) : (
          <p className="health-hint">读取状态中…</p>
        )}
      </section>

      {/* ─── 快捷指令配置步骤 ────────────────────── */}
      <section className="health-card">
        <h3>🪄 在 iPhone 配置快捷指令（一次性，5 分钟）</h3>

        <details className="health-step" open>
          <summary>① 准备 —— 确认 iPhone 能访问 Rich</summary>
          <div className="health-step-body">
            <ol>
              <li>iPhone 跟 Mac 连**同一个 Wi-Fi**</li>
              <li>iPhone Safari 打开上面那个 URL（应该返回 <code>{"{ingested:{}, errors:[...]}"}</code>，404 / connection refused 就说明防火墙拦了）</li>
              <li>如果不通：Mac → 系统设置 → 网络 → 防火墙 → 关掉，或允许 Electron 入站</li>
            </ol>
          </div>
        </details>

        <details className="health-step">
          <summary>② 打开「快捷指令」app → 新建空白指令</summary>
          <div className="health-step-body">
            <p>命名 <code>Rich · 同步健康</code>。然后按下面顺序加动作：</p>
          </div>
        </details>

        <details className="health-step">
          <summary>③ 加动作 ── 查找健康样本（每个指标各 1 个）</summary>
          <div className="health-step-body">
            <p>下面每行加 1 次「查找健康样本」+ 1 次「获取数值」+ 1 次「设变量」：</p>
            <table className="health-apple-table">
              <thead><tr><th>样本类型</th><th>变量名</th><th>排序</th></tr></thead>
              <tbody>
                <tr><td>体重 (BodyMass)</td><td>体重kg</td><td>最新一条</td></tr>
                <tr><td>体脂率 (BodyFatPercentage)</td><td>体脂</td><td>最新一条</td></tr>
                <tr><td>睡眠分析 (SleepAnalysis)</td><td>睡眠时长</td><td>过去 1 天求和</td></tr>
                <tr><td>静息能量 (BasalEnergyBurned)</td><td>基础卡</td><td>过去 1 天求和</td></tr>
                <tr><td>活动能量 (ActiveEnergyBurned)</td><td>活动卡</td><td>过去 1 天求和</td></tr>
                <tr><td>训练 (Workout)</td><td>训练分钟</td><td>过去 1 天求和</td></tr>
              </tbody>
            </table>
          </div>
        </details>

        <details className="health-step">
          <summary>④ 加动作 ── 字典 + 嵌套字典</summary>
          <div className="health-step-body">
            <p>构造下面这种结构（"字典"动作里加键值对，值类型选"字典"就能嵌套）：</p>
            <pre className="health-apple-json">{`{
  "weight": { "kg": [体重kg] },
  "sleep":  { "durationMin": [睡眠分钟] },
  "workout": { "durationMin": [训练分钟] },
  "meal":   { "totalKcal": [活动卡 + 基础卡] },
  "metadata": { "source": "apple-shortcut" }
}`}</pre>
            <p className="health-hint">每个数字字段都用快捷指令里"变量"动作引用上一步存的变量。</p>
          </div>
        </details>

        <details className="health-step">
          <summary>⑤ 加动作 ── 获取 URL 的内容（POST）</summary>
          <div className="health-step-body">
            <ul>
              <li>URL：上面那个 <code>{net?.intakeUrl ?? "..."}</code></li>
              <li>方法：<code>POST</code></li>
              <li>请求体：<code>JSON</code> → 选择上一步的字典</li>
              <li>表头：<code>content-type</code> = <code>application/json</code></li>
            </ul>
          </div>
        </details>

        <details className="health-step">
          <summary>⑥ 测试 → 自动化</summary>
          <div className="health-step-body">
            <ol>
              <li>右上角 ▶️ 跑一次。回 Rich 看「🩺 当前同步状态」应该有新数据</li>
              <li>底部 tab「自动化」→ <code>+</code> → 创建个人自动化 → 每天 07:00 → 选这个指令 → 关闭"运行前询问"</li>
              <li>之后每天早上 7 点自动 sync</li>
            </ol>
          </div>
        </details>
      </section>

      {/* ─── 出门怎么办 ──────────────────────────── */}
      <section className="health-card health-card--info">
        <h3>🚪 出门换 Wi-Fi 怎么办</h3>
        <p>
          上面这个 URL 是 LAN 内网地址，离开家就连不上。两个选项：
        </p>
        <ul>
          <li><strong>简单</strong>：Mac terminal 跑 <code>brew install ngrok && ngrok http 31515</code>，把生成的公网 URL 改到快捷指令里 —— Mac 开着 ngrok 就在跑就能远程 sync</li>
          <li><strong>长远</strong>：让我把 Rich health intake 部署到你阿里云 ECS（同一个 postgres），iPhone 直接走公网。需要单独批次，告诉我可以做</li>
        </ul>
      </section>
    </div>
  );
}

function StatusRow({ icon, label, hasData, detail }: { icon: string; label: string; hasData: boolean; detail: string | null | undefined }) {
  return (
    <li className={`health-apple-status-row${hasData ? " is-ok" : ""}`}>
      <span className="health-apple-status-icon">{icon}</span>
      <span className="health-apple-status-label">{label}</span>
      <span className="health-apple-status-detail">
        {detail || (hasData ? "有数据" : "暂无数据")}
      </span>
      <span className={`health-apple-status-dot${hasData ? " is-ok" : ""}`} aria-hidden="true" />
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

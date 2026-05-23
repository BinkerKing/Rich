import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon.js";
import { TopBar } from "../components/TopBar.js";
import { FooterTaskStrip } from "../components/FooterTaskStrip.js";
import { useStore } from "../state/store.js";
import "./AdminView.css";

type Tab = "engine" | "ops" | "signals" | "manuals" | "cron" | "improvements";

interface OpListItem {
  id: string;
  ts: string;
  op: string;
  model: string;
  elementId?: string;
  scope?: Record<string, unknown>;
  status: "running" | "done" | "error";
  durationMs?: number;
  promptPreview: string;
  outputPreview: string;
  promptLen: number;
  outputLen: number;
  error?: string;
  sessionId?: string;
}

interface OpDetail extends OpListItem {
  prompt: string;
  output?: string;
}

interface SignalItem {
  ts: string;
  type: string;
  manual?: string;
  elementId?: string;
  op?: string;
  adapter?: string;
  data?: Record<string, unknown>;
}

interface ManualItem {
  name: string;
  file: string;
  length: number;
  content: string;
}

const OP_FILTERS = ["", "generate", "refine", "section-refine", "expand", "extend", "path", "review", "analyze-mark"];

export function AdminView() {
  const [tab, setTab] = useState<Tab>("engine");
  return (
    <div className="tree-view admin-shell">
      <TopBar breadcrumb={null} />

      <aside className="learning-sidebar admin-sidebar" aria-label="后台分区">
        <section>
          <div className="sidebar-list">
            <button
              type="button"
              className={`sidebar-node ${tab === "engine" ? "is-active" : ""}`}
              onClick={() => setTab("engine")}
            >
              <span className="sidebar-node__title">AI 引擎监控</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "ops" ? "is-active" : ""}`}
              onClick={() => setTab("ops")}
            >
              <span className="sidebar-node__title">AI 任务历史</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "signals" ? "is-active" : ""}`}
              onClick={() => setTab("signals")}
            >
              <span className="sidebar-node__title">信号日志</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "manuals" ? "is-active" : ""}`}
              onClick={() => setTab("manuals")}
            >
              <span className="sidebar-node__title">知识手册 · 反思</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "cron" ? "is-active" : ""}`}
              onClick={() => setTab("cron")}
            >
              <span className="sidebar-node__title">定时任务监控</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "improvements" ? "is-active" : ""}`}
              onClick={() => setTab("improvements")}
            >
              <span className="sidebar-node__title">系统改造任务</span>
            </button>
          </div>
        </section>
      </aside>

      <main className="tv-main tv-main--home admin-main">
        {tab === "engine" && <EngineTab />}
        {tab === "ops" && <OpsTab />}
        {tab === "signals" && <SignalsTab />}
        {tab === "manuals" && <ManualsTab />}
        {tab === "cron" && <CronTab />}
        {tab === "improvements" && <ImprovementsTab />}
      </main>

      <footer className="tv-footer">
        <div>后台管理 · 仅用于观察系统运行</div>
        <FooterTaskStrip />
      </footer>
    </div>
  );
}

/* ---------------------------------- Tabs ---------------------------------- */

interface EngineStats {
  total: number;
  done: number;
  errored: number;
  running: number;
  successRate: number | null;
  avgDurationMs: number;
  maxDurationMs: number;
  byOp: { op: string; count: number }[];
}
interface EnginePayload {
  ts: string;
  adapters: { name: string; available: boolean }[];
  uptimeSec: number;
  childProcesses: number;
  signalsTotal: number;
  stats: { lastHour: EngineStats; last24h: EngineStats; allTime: EngineStats };
  recentErrors: { id: string; ts: string; op: string; elementId?: string; error?: string }[];
}

function EngineTab() {
  const [data, setData] = useState<EnginePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/engine");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>AI 引擎监控</h1>
        <div className="admin-filters">
          <label>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            自动刷新（5s）
          </label>
          <button type="button" onClick={() => void load()}>立即刷新</button>
        </div>
      </header>

      <div className="admin-engine">
        {loading && !data && <div className="admin-loading">加载中…</div>}
        {data && (
          <>
            <section className="admin-engine__row">
              <EngineCard title="适配器健康" subtitle="codex / claude 是否可用">
                <ul className="admin-adapter-list">
                  {data.adapters.map(a => (
                    <li key={a.name}>
                      <span className={`admin-dot admin-dot--${a.available ? "ok" : "down"}`} aria-hidden="true" />
                      <strong>{a.name}</strong>
                      <em>{a.available ? "可用" : "不可用"}</em>
                    </li>
                  ))}
                </ul>
              </EngineCard>
              <EngineCard title="服务器" subtitle="进程 / 信号">
                <dl className="admin-kv">
                  <dt>已运行</dt><dd>{formatUptime(data.uptimeSec)}</dd>
                  <dt>活跃子进程</dt><dd>{data.childProcesses}</dd>
                  <dt>信号总数</dt><dd>{data.signalsTotal}</dd>
                  <dt>最近刷新</dt><dd className="admin-cell-mono">{formatTs(data.ts)}</dd>
                </dl>
              </EngineCard>
            </section>

            <section className="admin-engine__row">
              <StatsCard title="最近 1 小时" stats={data.stats.lastHour} />
              <StatsCard title="最近 24 小时" stats={data.stats.last24h} />
              <StatsCard title="全部时间" stats={data.stats.allTime} />
            </section>

            <EngineCard title="近期错误" subtitle="按时间倒序，最多 10 条">
              {data.recentErrors.length === 0
                ? <div className="admin-empty admin-empty--inline">最近没有错误。</div>
                : (
                  <table className="admin-table">
                    <thead>
                      <tr><th>时间</th><th>操作</th><th>元</th><th>错误</th></tr>
                    </thead>
                    <tbody>
                      {data.recentErrors.map(e => (
                        <tr key={e.id}>
                          <td className="admin-cell-mono">{formatTs(e.ts)}</td>
                          <td><span className={`admin-op admin-op--${e.op}`}>{e.op}</span></td>
                          <td className="admin-cell-mono">{e.elementId ?? "—"}</td>
                          <td className="admin-cell-truncate">{e.error ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </EngineCard>
          </>
        )}
      </div>
    </div>
  );
}

function EngineCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="admin-engine-card">
      <header>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </header>
      <div className="admin-engine-card__body">{children}</div>
    </div>
  );
}

function StatsCard({ title, stats }: { title: string; stats: EngineStats }) {
  return (
    <div className="admin-engine-card">
      <header><strong>{title}</strong></header>
      <div className="admin-engine-card__body">
        <dl className="admin-kv">
          <dt>调用</dt><dd>{stats.total}</dd>
          <dt>成功 / 失败 / 进行中</dt>
          <dd>
            <span className="admin-stat admin-stat--ok">{stats.done}</span>
            <span className="admin-stat admin-stat--err">{stats.errored}</span>
            <span className="admin-stat admin-stat--run">{stats.running}</span>
          </dd>
          <dt>成功率</dt>
          <dd>{stats.successRate === null ? "—" : `${stats.successRate}%`}</dd>
          <dt>平均耗时</dt><dd>{stats.avgDurationMs ? formatDuration(stats.avgDurationMs) : "—"}</dd>
          <dt>最长耗时</dt><dd>{stats.maxDurationMs ? formatDuration(stats.maxDurationMs) : "—"}</dd>
        </dl>
        {stats.byOp.length > 0 && (
          <div className="admin-op-mini">
            {stats.byOp.slice(0, 8).map(o => (
              <span key={o.op} className={`admin-op admin-op--${o.op}`}>{o.op} · {o.count}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function OpsTab() {
  const [items, setItems] = useState<OpListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOp, setFilterOp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OpDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterOp) params.set("op", filterOp);
      if (filterStatus) params.set("status", filterStatus);
      params.set("limit", "200");
      const res = await fetch(`/api/admin/ops?${params}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filterOp, filterStatus]);

  async function openDetail(id: string) {
    setActiveId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/ops/${encodeURIComponent(id)}`);
      const json = await res.json();
      setDetail(json);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>AI 任务历史</h1>
        <div className="admin-filters">
          <label>
            操作
            <select value={filterOp} onChange={e => setFilterOp(e.target.value)}>
              {OP_FILTERS.map(o => <option key={o} value={o}>{o || "全部"}</option>)}
            </select>
          </label>
          <label>
            状态
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">全部</option>
              <option value="running">running</option>
              <option value="done">done</option>
              <option value="error">error</option>
            </select>
          </label>
          <button type="button" onClick={() => void load()}>刷新</button>
        </div>
      </header>

      <div className="admin-split">
        <div className="admin-table-wrap">
          {loading && <div className="admin-loading">加载中…</div>}
          {!loading && items.length === 0 && <div className="admin-empty">暂无任务记录。先在主界面跑一次 AI 操作，再回来看。</div>}
          {!loading && items.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作</th>
                  <th>模型</th>
                  <th>元 / 范围</th>
                  <th>状态</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    className={activeId === item.id ? "is-active" : ""}
                    onClick={() => void openDetail(item.id)}
                  >
                    <td className="admin-cell-mono">{formatTs(item.ts)}</td>
                    <td><span className={`admin-op admin-op--${item.op}`}>{item.op}</span></td>
                    <td>{item.model}</td>
                    <td className="admin-cell-mono">
                      {item.elementId ?? "—"}
                      {item.scope && <em className="admin-scope">{summarizeScope(item.scope)}</em>}
                    </td>
                    <td><span className={`admin-status admin-status--${item.status}`}>{item.status}</span></td>
                    <td className="admin-cell-mono">{item.durationMs ? formatDuration(item.durationMs) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="admin-detail">
          {!activeId && <div className="admin-empty">点击左侧一行查看完整 prompt 与返回。</div>}
          {activeId && detailLoading && <div className="admin-loading">加载中…</div>}
          {activeId && !detailLoading && detail && <OpDetailView detail={detail} />}
        </aside>
      </div>
    </div>
  );
}

function OpDetailView({ detail }: { detail: OpDetail }) {
  return (
    <div className="admin-detail__inner">
      <header className="admin-detail__head">
        <strong className={`admin-op admin-op--${detail.op}`}>{detail.op}</strong>
        <span className={`admin-status admin-status--${detail.status}`}>{detail.status}</span>
        <span className="admin-cell-mono">{formatTs(detail.ts)}</span>
        {detail.durationMs !== undefined && <span className="admin-cell-mono">{formatDuration(detail.durationMs)}</span>}
        {detail.model && <span>{detail.model}</span>}
      </header>
      {detail.elementId && (
        <div className="admin-detail__meta"><strong>元：</strong><code>{detail.elementId}</code></div>
      )}
      {detail.scope && Object.keys(detail.scope).length > 0 && (
        <div className="admin-detail__meta"><strong>范围：</strong><code>{JSON.stringify(detail.scope)}</code></div>
      )}
      {detail.sessionId && (
        <div className="admin-detail__meta"><strong>Session：</strong><code>{detail.sessionId}</code></div>
      )}
      {detail.error && (
        <div className="admin-detail__error"><strong>错误：</strong>{detail.error}</div>
      )}
      <section>
        <h3>Prompt（{detail.prompt?.length ?? 0} 字符）</h3>
        <pre className="admin-pre">{detail.prompt}</pre>
      </section>
      <section>
        <h3>Output（{detail.output?.length ?? 0} 字符）</h3>
        <pre className="admin-pre">{detail.output || "—"}</pre>
      </section>
    </div>
  );
}

/* ---------------------------------- Signals ---------------------------------- */

function SignalsTab() {
  const [items, setItems] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterType) params.set("type", filterType);
      const res = await fetch(`/api/admin/signals?${params}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [filterType]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const s of items) set.add(s.type);
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>信号日志</h1>
        <div className="admin-filters">
          <label>
            类型
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">全部</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void load()}>刷新</button>
        </div>
      </header>

      <div className="admin-table-wrap admin-table-wrap--full">
        {loading && <div className="admin-loading">加载中…</div>}
        {!loading && items.length === 0 && <div className="admin-empty">还没有信号。</div>}
        {!loading && items.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>元</th>
                <th>操作</th>
                <th>数据</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={`${s.ts}-${i}`}>
                  <td className="admin-cell-mono">{formatTs(s.ts)}</td>
                  <td><span className={`admin-signal admin-signal--${s.type.split(".")[0]}`}>{s.type}</span></td>
                  <td className="admin-cell-mono">{s.elementId ?? "—"}</td>
                  <td>{s.op ?? "—"}</td>
                  <td className="admin-cell-mono admin-cell-truncate">{s.data ? JSON.stringify(s.data).slice(0, 300) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Manuals ---------------------------------- */

function ManualsTab() {
  const [items, setItems] = useState<ManualItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeName, setActiveName] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manuals");
      const json = await res.json();
      setItems(json.items ?? []);
      if (json.items?.length > 0 && !activeName) setActiveName(json.items[0].name);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const active = items.find(m => m.name === activeName);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>知识手册 · 反思结果</h1>
        <div className="admin-filters">
          <button type="button" onClick={() => void load()}>刷新</button>
        </div>
      </header>
      <div className="admin-manuals">
        <div className="admin-manuals-list">
          {loading && <div className="admin-loading">加载中…</div>}
          {!loading && items.map(m => (
            <button
              key={m.name}
              type="button"
              className={`sidebar-node ${activeName === m.name ? "is-active" : ""}`}
              onClick={() => setActiveName(m.name)}
            >
              <span className="sidebar-node__title">{m.name}</span>
              <em className="admin-manual-len">{m.length}</em>
            </button>
          ))}
        </div>
        <div className="admin-manual-detail">
          {!active && <div className="admin-empty">没有手册文件。</div>}
          {active && (
            <>
              <header className="admin-detail__head">
                <strong>{active.name}.md</strong>
                <span className="admin-cell-mono">{active.length} 字符</span>
              </header>
              <pre className="admin-pre admin-manual-pre">{active.content}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- helpers ---------------------------------- */

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch { return iso; }
}
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  return `${s}s`;
}
function summarizeScope(scope: Record<string, unknown>): string {
  const pieces: string[] = [];
  if ("direction" in scope && scope.direction) {
    const d = String(scope.direction);
    pieces.push(d.length > 36 ? d.slice(0, 36) + "…" : d);
  }
  if ("sectionId" in scope && scope.sectionId) pieces.push(`section=${scope.sectionId}`);
  if ("targetRichness" in scope && scope.targetRichness) pieces.push(`r=${scope.targetRichness}`);
  return pieces.length > 0 ? ` · ${pieces.join(" · ")}` : "";
}

/* -------------------------------- Cron Tab -------------------------------- */

interface CronJob {
  id: string;
  name: string;
  prompt_preview: string;
  schedule: string;
  repeat: string | null;
  state: "scheduled" | "paused" | "unknown";
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_delivery_error: string | null;
  deliver: string;
  skills: string[];
  model: string | null;
  provider: string | null;
}

function CronTab() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/cron/jobs");
      const j = await r.json() as { ok: boolean; jobs: CronJob[]; error?: string };
      if (!j.ok) throw new Error(j.error ?? "未知错误");
      setJobs(j.jobs);
      setLastLoaded(new Date().toLocaleString("zh-CN", { hour12: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>定时任务监控</h1>
        <div className="admin-filters">
          <span className="admin-meta">{lastLoaded ? `更新于 ${lastLoaded}` : ""}</span>
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            /> 自动刷新（30s）
          </label>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "加载中…" : "立即刷新"}
          </button>
        </div>
      </header>

      <p className="admin-pane__desc">
        Hermes 的定时任务清单（读自 <code>~/.hermes/cron/jobs.json</code>）。要新增 / 暂停 / 删除任务，
        请按 <kbd>⌘⇧Space</kbd> 唤起 Hermes 对话，比如：
        <em>「帮我每天早上 10 点生成当天的 AI 早报」</em>。
      </p>

      {error && <div className="admin-error">⚠ {error}</div>}

      {jobs.length === 0 && !loading && !error && (
        <div className="admin-empty">
          目前没有任何定时任务。<br />
          可以在 Hermes 对话框里说一句话来添加，例如「每周一晚上 22 点给我生成本周复盘」。
        </div>
      )}

      <div className="cron-list">
        {jobs.map(job => (
          <article key={job.id} className={`cron-card cron-card--${job.state}`}>
            <header className="cron-card__head">
              <div className="cron-card__title">
                <strong>{job.name}</strong>
                <span className={`cron-card__state cron-card__state--${job.state}`}>
                  {job.state === "scheduled" ? "运行中" : job.state === "paused" ? "已暂停" : "未知"}
                </span>
              </div>
              <div className="cron-card__schedule">
                <span className="cron-card__schedule-icon" aria-hidden="true">⏰</span>
                {job.schedule}
                {job.repeat && <span className="cron-card__repeat"> · {job.repeat}</span>}
              </div>
            </header>

            {job.prompt_preview && (
              <div className="cron-card__prompt">
                <span className="cron-card__label">指令</span>
                <p>{job.prompt_preview}</p>
              </div>
            )}

            <div className="cron-card__meta">
              <div>
                <span className="cron-card__label">下次执行</span>
                <em>{job.next_run_at ? formatTs(job.next_run_at) : "—"}</em>
              </div>
              <div>
                <span className="cron-card__label">上次执行</span>
                <em>{job.last_run_at ? formatTs(job.last_run_at) : "—"}</em>
              </div>
              <div>
                <span className="cron-card__label">上次结果</span>
                <em className={job.last_status === "error" ? "is-error" : ""}>
                  {job.last_status ?? "—"}
                </em>
              </div>
              <div>
                <span className="cron-card__label">输出去向</span>
                <em>{job.deliver}</em>
              </div>
            </div>

            {(job.skills.length > 0 || job.model) && (
              <footer className="cron-card__footer">
                {job.skills.length > 0 && (
                  <div className="cron-card__skills">
                    <span className="cron-card__label">挂载技能</span>
                    {job.skills.map(s => <span key={s} className="cron-card__chip">{s}</span>)}
                  </div>
                )}
                {job.model && (
                  <div className="cron-card__model">
                    <span className="cron-card__label">模型</span>
                    <em>{job.provider ? `${job.provider} · ` : ""}{job.model}</em>
                  </div>
                )}
              </footer>
            )}

            {job.last_delivery_error && (
              <div className="cron-card__error">⚠ 投递失败：{job.last_delivery_error}</div>
            )}

            <div className="cron-card__id" title={job.id}>ID: {job.id.slice(0, 16)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Improvements Tab ---------------------------- */

type ImpStatus = "pending" | "ready_to_verify" | "verified" | "rejected";
type ImpPriority = "low" | "medium" | "high";

interface Improvement {
  id: string;
  title: string;
  description: string;
  reason: string;
  status: ImpStatus;
  priority?: ImpPriority;
  category?: string;
  createdBy: "hermes" | "user";
  relatedFiles?: string[];
  verifications: Array<{ ts: string; result: "pass" | "fail"; notes?: string }>;
  requestedAt: string;
  updatedAt: string;
  /** 当前接管人 agent-id；undefined = 未认领 */
  assignedAgentId?: string;
  assignedAt?: string;
}

const STATUS_LABEL: Record<ImpStatus, string> = {
  pending: "待改造",
  ready_to_verify: "已改造 · 待验证",
  verified: "已验证",
  rejected: "验证未通过",
};

function ImprovementsTab() {
  const [items, setItems] = useState<Improvement[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<ImpStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<ImpPriority>("medium");
  /** 本机 Rich.app 的 agent-id（点"认领"时默认用它）；启动时从 /api/agent-id 拉一次。 */
  const [myAgentId, setMyAgentId] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/agent-id");
        if (r.ok) {
          const { agentId } = await r.json() as { agentId: string };
          setMyAgentId(agentId);
        }
      } catch { /* 失败就让按钮 disabled，下面会处理 */ }
    })();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const r = await fetch(`/api/improvements${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as { items: Improvement[]; counts: Record<string, number> };
      setItems(j.items);
      setCounts(j.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [statusFilter]);

  async function patchStatus(id: string, status: ImpStatus, notes?: string) {
    const body: Record<string, unknown> = { status };
    if (notes) body.verificationNotes = notes;
    await fetch(`/api/improvements/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function removeItem(id: string) {
    if (!confirm("确定删除？审计痕迹会丢失，更建议把状态改成已验证或未通过。")) return;
    await fetch(`/api/improvements/${id}`, { method: "DELETE" });
    await load();
  }

  /** 认领：抢到了就刷新；被别人占着就弹 toast 提示。 */
  async function claimItem(id: string) {
    if (!myAgentId) { alert("还没拿到本机 agent-id，刷新一下页面再试"); return; }
    const r = await fetch(`/api/improvements/${id}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: myAgentId }),
    });
    if (r.status === 409) {
      const { conflict } = await r.json() as { conflict?: { currentAgentId: string; assignedAt: string } };
      alert(`已被「${conflict?.currentAgentId ?? "未知"}」认领\n时间：${conflict?.assignedAt ?? "—"}`);
    } else if (!r.ok) {
      const { error: err } = await r.json().catch(() => ({ error: r.statusText }));
      alert(`认领失败：${err}`);
    }
    await load();
  }

  /** 释放：用户主动放弃自己持有的认领。 */
  async function releaseItem(id: string, currentAssignee: string | undefined) {
    if (!myAgentId) { alert("还没拿到本机 agent-id"); return; }
    // 如果不是自己持有的，问一下要不要强制释放（用于其它机器 crash 卡住时手动 unstick）
    const force = currentAssignee !== myAgentId;
    if (force && !confirm(`这条任务现在被「${currentAssignee}」认领，确定要强制释放吗？\n（一般只在对方机器卡死时用）`)) return;
    await fetch(`/api/improvements/${id}/release`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(force ? { force: true } : { agentId: myAgentId }),
    });
    await load();
  }

  async function submitNew() {
    if (!newTitle.trim()) return;
    await fetch("/api/improvements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        reason: newReason.trim() || undefined,
        description: newDescription.trim() || undefined,
        priority: newPriority,
        createdBy: "user",
      }),
    });
    setNewTitle("");
    setNewReason("");
    setNewDescription("");
    setShowNew(false);
    await load();
  }

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>系统改造任务</h1>
        <div className="admin-filters">
          <button type="button" onClick={() => setShowNew(s => !s)}>
            {showNew ? "取消" : "+ 新建"}
          </button>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "加载中…" : "刷新"}
          </button>
        </div>
      </header>

      <p className="admin-pane__desc">
        当 Hermes 想做某事但发现 Rich 缺能力时，会通过 MCP 工具 <code>create_improvement</code> 在这里
        建一条「待改造」。你改完后点「已改造」按钮，Hermes 下次会自己来验证（或你直接跟 Hermes 说
        <em>「id=imp-xxx 改好了帮我验证」</em>）。
      </p>

      <nav className="imp-filters">
        {(["all", "pending", "ready_to_verify", "verified", "rejected"] as const).map(s => (
          <button
            key={s}
            type="button"
            className={`imp-filter${statusFilter === s ? " is-active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "全部" : STATUS_LABEL[s]}
            {s !== "all" && counts[s] != null && <span className="imp-filter__count">{counts[s]}</span>}
          </button>
        ))}
      </nav>

      {showNew && (
        <div className="imp-new">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="任务标题，例如：新增 attach_mindmap MCP 工具"
          />
          <textarea
            value={newReason}
            onChange={e => setNewReason(e.target.value)}
            placeholder="为什么需要这个改造？缺什么能力 / 受阻于什么？"
            rows={2}
          />
          <textarea
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="详细描述（可选）"
            rows={3}
          />
          <div className="imp-new-row">
            <label>
              优先级
              <select value={newPriority} onChange={e => setNewPriority(e.target.value as ImpPriority)}>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>
            <button type="button" className="imp-primary" onClick={() => void submitNew()} disabled={!newTitle.trim()}>
              建立任务
            </button>
          </div>
        </div>
      )}

      {error && <div className="admin-error">⚠ {error}</div>}

      {items.length === 0 && !loading && !error && (
        <div className="admin-empty">
          目前没有改造任务。<br />
          Hermes 在 chat 里碰到能力缺口时会自动建一条。或者点上面「+ 新建」手动建。
        </div>
      )}

      <div className="imp-list">
        {items.map(item => (
          <article key={item.id} className={`imp-card imp-card--${item.status}`}>
            <header className="imp-card__head">
              <div className="imp-card__title">
                <strong>{item.title}</strong>
                <span className={`imp-status imp-status--${item.status}`}>{STATUS_LABEL[item.status]}</span>
              </div>
              <div className="imp-card__meta">
                {item.priority && <span className={`imp-prio imp-prio--${item.priority}`}>P · {item.priority}</span>}
                {item.category && <span className="imp-cat">{item.category}</span>}
                <span className="imp-by">由 {item.createdBy === "hermes" ? "Hermes" : "你"} 发起</span>
                {item.assignedAgentId ? (
                  <span
                    className={`imp-assignee${item.assignedAgentId === myAgentId ? " is-mine" : ""}`}
                    title={`认领时间：${item.assignedAt ? formatTs(item.assignedAt) : "—"}`}
                  >
                    🔒 接管人：{item.assignedAgentId}
                    {item.assignedAgentId === myAgentId && <em> · 本机</em>}
                  </span>
                ) : (
                  <span className="imp-assignee imp-assignee--free">🔓 未认领</span>
                )}
              </div>
            </header>

            {item.reason && (
              <div className="imp-card__section">
                <span className="imp-card__label">原因</span>
                <p>{item.reason}</p>
              </div>
            )}
            {item.description && (
              <div className="imp-card__section">
                <span className="imp-card__label">描述</span>
                <p>{item.description}</p>
              </div>
            )}
            {item.relatedFiles && item.relatedFiles.length > 0 && (
              <div className="imp-card__section">
                <span className="imp-card__label">相关文件</span>
                <ul className="imp-files">
                  {item.relatedFiles.map(f => <li key={f}><code>{f}</code></li>)}
                </ul>
              </div>
            )}

            {item.verifications.length > 0 && (
              <div className="imp-card__section">
                <span className="imp-card__label">验证记录</span>
                <ul className="imp-verifs">
                  {item.verifications.map((v, i) => (
                    <li key={i} className={`imp-verif imp-verif--${v.result}`}>
                      <span className="imp-verif__ts">{formatTs(v.ts)}</span>
                      <span className="imp-verif__result">{v.result === "pass" ? "✓ 通过" : "✗ 未通过"}</span>
                      {v.notes && <span className="imp-verif__notes">{v.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <footer className="imp-card__footer">
              <div className="imp-card__times">
                创建 {formatTs(item.requestedAt)} · 更新 {formatTs(item.updatedAt)} · ID {item.id}
              </div>
              <div className="imp-card__actions">
                {/* Agent 认领 / 释放：跨机 Agent 互斥用 */}
                {!item.assignedAgentId && (
                  <button type="button" className="imp-claim" onClick={() => void claimItem(item.id)}>
                    认领
                  </button>
                )}
                {item.assignedAgentId && (
                  <button type="button" className="imp-release" onClick={() => void releaseItem(item.id, item.assignedAgentId)}>
                    {item.assignedAgentId === myAgentId ? "释放" : "强制释放"}
                  </button>
                )}
                {item.status === "pending" && (
                  <button type="button" onClick={() => void patchStatus(item.id, "ready_to_verify")}>
                    标记已改造
                  </button>
                )}
                {item.status === "ready_to_verify" && (
                  <>
                    <button type="button" className="imp-primary" onClick={() => {
                      const notes = prompt("验证通过的说明（可选）", "");
                      void patchStatus(item.id, "verified", notes ?? undefined);
                    }}>
                      验证通过
                    </button>
                    <button type="button" className="imp-danger" onClick={() => {
                      const notes = prompt("验证不通过的原因 / 还差什么", "");
                      if (notes == null) return;
                      void patchStatus(item.id, "rejected", notes);
                    }}>
                      不通过
                    </button>
                  </>
                )}
                {(item.status === "verified" || item.status === "rejected") && (
                  <button type="button" onClick={() => void patchStatus(item.id, "ready_to_verify")}>
                    重新待验证
                  </button>
                )}
                <button type="button" className="imp-ghost" onClick={() => void removeItem(item.id)}>
                  删除
                </button>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}

// satisfy lint
void Icon;

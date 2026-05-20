import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon.js";
import { TopBar } from "../components/TopBar.js";
import { SystemPanel } from "../components/SystemPanel.js";
import { FooterTaskStrip } from "../components/FooterTaskStrip.js";
import { useStore } from "../state/store.js";
import "./AdminView.css";

type Tab = "engine" | "ops" | "signals" | "manuals";

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
  const systemMode = useStore(s => s.systemMode);
  const elements = useStore(s => s.elements);
  return (
    <div className="tree-view admin-shell">
      <TopBar breadcrumb={<span className="now">后台</span>} />

      <aside className="learning-sidebar admin-sidebar" aria-label="后台分区">
        <section>
          <div className="sidebar-label">后台分区</div>
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
          </div>
        </section>
      </aside>

      <main className="tv-main tv-main--home admin-main">
        {tab === "engine" && <EngineTab />}
        {tab === "ops" && <OpsTab />}
        {tab === "signals" && <SignalsTab />}
        {tab === "manuals" && <ManualsTab />}
      </main>

      <SystemPanel mode={systemMode} elements={elements} onSelect={() => undefined} />

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

// satisfy lint
void Icon;

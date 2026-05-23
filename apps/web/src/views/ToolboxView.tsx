import { useEffect, useMemo, useState } from "react";
import { TopBar } from "../components/TopBar.js";
import "./ToolboxView.css";

/**
 * Toolbox — user-defined small utility tools.
 *
 * Each tool card shows:
 *   - Name + description
 *   - A form auto-generated from the tool's input schema
 *   - Manual "立即执行" button
 *   - Recent invocations (this tool's history)
 *
 * Below the grid: a unified "全部调用记录" timeline (across all tools),
 * with cancel buttons for scheduled-but-not-yet-fired invocations.
 *
 * Hermes invokes tools via MCP (mcp_rich_invoke_toolbox_tool) and the
 * results show up here in real time via /api/events SSE.
 */

type FieldKind = "string" | "number" | "boolean" | "enum" | "unknown";

interface SchemaField {
  kind: FieldKind;
  optional: boolean;
  default?: unknown;
  description?: string;
  options?: string[];
}

interface ToolDef {
  name: string;
  label: string;
  description: string;
  icon?: string;
  category?: string;
  schemaShape: Record<string, SchemaField>;
}

interface Invocation {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "scheduled" | "running" | "completed" | "failed" | "cancelled";
  createdBy: "hermes" | "user";
  scheduledFor?: string;
  startedAt?: string;
  finishedAt?: string;
  result?: string;
  error?: string;
  createdAt: string;
}

function statusLabel(s: Invocation["status"]): string {
  return s === "scheduled" ? "已排期"
    : s === "running" ? "执行中"
    : s === "completed" ? "已完成"
    : s === "failed" ? "失败"
    : "已取消";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export function ToolboxView() {
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [tRes, iRes] = await Promise.all([
        fetch("/api/toolbox/tools").then(r => r.json()),
        fetch("/api/toolbox/invocations?limit=100").then(r => r.json()),
      ]);
      setTools(tRes.tools ?? []);
      setInvocations(iRes.items ?? []);
      setCounts(iRes.counts ?? {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);
  // Auto-refresh every 3 seconds while there are scheduled or running items —
  // covers the case where a scheduled lock fires in 10min and we want to see
  // it flip to completed without manual refresh.
  useEffect(() => {
    const hasActive = invocations.some(i => i.status === "scheduled" || i.status === "running");
    if (!hasActive) return;
    const t = window.setInterval(() => { void loadAll(); }, 3000);
    return () => window.clearInterval(t);
  }, [invocations]);

  const grouped = useMemo(() => {
    const map = new Map<string, Invocation[]>();
    for (const inv of invocations) {
      const list = map.get(inv.toolName) ?? [];
      list.push(inv);
      map.set(inv.toolName, list);
    }
    return map;
  }, [invocations]);

  async function invoke(toolName: string, args: Record<string, unknown>) {
    const r = await fetch("/api/toolbox/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: toolName, args }),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      alert(`调用失败：${b.error ?? r.status}`);
      return;
    }
    await loadAll();
  }

  async function cancel(id: string) {
    await fetch(`/api/toolbox/invocations/${id}/cancel`, { method: "POST" });
    await loadAll();
  }

  return (
    <div className="toolbox-shell">
      {/* TopBar breadcrumb intentionally null — page already has an in-view
       *  H1 title, redundant label in the chrome strip looks cluttered. */}
      <TopBar breadcrumb={null} />
      <main className="toolbox-main">
        <header className="toolbox-head">
          <h1>工具箱</h1>
          <p>
            小工具集合 · Hermes 可通过 <code>invoke_toolbox_tool</code> 自动触发，
            你也可以在这里手动跑或取消排期。
          </p>
          <div className="toolbox-stats">
            {Object.entries(counts).map(([s, n]) => (
              <span key={s} className={`toolbox-stat toolbox-stat--${s}`}>
                {statusLabel(s as Invocation["status"])} · <strong>{n}</strong>
              </span>
            ))}
            <button type="button" onClick={() => void loadAll()} disabled={loading}>
              {loading ? "加载中…" : "刷新"}
            </button>
          </div>
        </header>

        <section className="toolbox-grid">
          {tools.map(tool => (
            <ToolCard
              key={tool.name}
              tool={tool}
              invocations={grouped.get(tool.name) ?? []}
              onInvoke={(args) => invoke(tool.name, args)}
              onCancel={cancel}
            />
          ))}
        </section>

        <section className="toolbox-history">
          <h2>全部调用记录</h2>
          {invocations.length === 0 ? (
            <p className="toolbox-empty">还没有调用记录。在上方任一工具点「立即执行」试试。</p>
          ) : (
            <ol className="toolbox-history-list">
              {invocations.map(inv => (
                <li key={inv.id} className={`toolbox-history-item toolbox-history-item--${inv.status}`}>
                  <div className="toolbox-history-head">
                    <span className="toolbox-history-tool">{inv.toolName}</span>
                    <span className="toolbox-history-status">{statusLabel(inv.status)}</span>
                    <span className="toolbox-history-by">由 {inv.createdBy === "hermes" ? "Hermes" : "你"}</span>
                    <span className="toolbox-history-ts">{formatTime(inv.createdAt)}</span>
                    {inv.status === "scheduled" && (
                      <button type="button" className="toolbox-cancel" onClick={() => void cancel(inv.id)}>
                        取消
                      </button>
                    )}
                  </div>
                  <div className="toolbox-history-meta">
                    {inv.scheduledFor && <span>排期执行 · {formatTime(inv.scheduledFor)}</span>}
                    {Object.keys(inv.args).length > 0 && (
                      <code className="toolbox-history-args">{JSON.stringify(inv.args)}</code>
                    )}
                  </div>
                  {inv.result && <div className="toolbox-history-result">{inv.result}</div>}
                  {inv.error && <div className="toolbox-history-error">⚠ {inv.error}</div>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

/* ─── ToolCard with auto-generated form ──────────────────────────────── */

function ToolCard({
  tool, invocations, onInvoke, onCancel,
}: {
  tool: ToolDef;
  invocations: Invocation[];
  onInvoke: (args: Record<string, unknown>) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  // Initialise the form with each field's default value.
  const initial = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(tool.schemaShape)) {
      if (field.default !== undefined) out[key] = field.default;
    }
    return out;
  }, [tool]);
  const [args, setArgs] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await onInvoke(args); }
    finally { setBusy(false); }
  }

  const recent = invocations.slice(0, 3);
  const scheduled = invocations.filter(i => i.status === "scheduled");

  return (
    <article className="tool-card">
      <header className="tool-card__head">
        <h3>{tool.label}</h3>
        {tool.category && <span className="tool-card__category">{tool.category}</span>}
      </header>
      <p className="tool-card__desc">{tool.description}</p>

      <form className="tool-form" onSubmit={submit}>
        {Object.entries(tool.schemaShape).map(([key, field]) => (
          <FormField
            key={key}
            name={key}
            field={field}
            value={args[key]}
            onChange={(v) => setArgs(a => ({ ...a, [key]: v }))}
          />
        ))}
        <button type="submit" className="tool-form__submit" disabled={busy}>
          {busy ? "执行中…" : "立即执行"}
        </button>
      </form>

      {scheduled.length > 0 && (
        <div className="tool-card__scheduled">
          <span className="tool-card__sublabel">已排期</span>
          {scheduled.map(s => (
            <div key={s.id} className="tool-scheduled">
              <span>{s.scheduledFor ? formatTime(s.scheduledFor) : "—"}</span>
              <button type="button" onClick={() => void onCancel(s.id)}>取消</button>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="tool-card__recent">
          <span className="tool-card__sublabel">最近调用</span>
          <ul>
            {recent.map(r => (
              <li key={r.id} className={`tool-recent tool-recent--${r.status}`}>
                <span>{statusLabel(r.status)}</span>
                <span>{formatTime(r.createdAt)}</span>
                {r.error && <em>{r.error.slice(0, 40)}</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/* ─── Form field — switches on field.kind ────────────────────────────── */

function FormField({
  name, field, value, onChange,
}: {
  name: string;
  field: SchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (field.description?.split("。")[0]) || name;
  if (field.kind === "boolean") {
    return (
      <label className="tool-field tool-field--bool">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }
  if (field.kind === "enum" && field.options) {
    return (
      <label className="tool-field">
        <span>{label}</span>
        <select value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </label>
    );
  }
  if (field.kind === "number") {
    return (
      <label className="tool-field">
        <span>{label}</span>
        <input
          type="number"
          value={value == null ? "" : String(value)}
          onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </label>
    );
  }
  // string + unknown fallback
  return (
    <label className="tool-field">
      <span>{label}</span>
      <input
        type="text"
        value={value == null ? "" : String(value)}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

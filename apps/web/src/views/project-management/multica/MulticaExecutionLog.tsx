import { useEffect, useState, type ReactNode } from "react";
import { api, type MulticaRun, type MulticaRunMessage } from "../../../api/client.js";

export function MulticaExecutionLog({ projectId, issueId, active }: { projectId: string; issueId: string; active: boolean }): ReactNode {
  const [runs, setRuns] = useState<MulticaRun[]>([]);
  const [messages, setMessages] = useState<Record<string, MulticaRunMessage[]>>({});
  const [opened, setOpened] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void api.getMulticaRuns(projectId, issueId).then(value => { if (!cancelled) setRuns(value); }).catch(value => setError(String(value)));
    return () => { cancelled = true; };
  }, [active, issueId, projectId]);

  async function open(run: MulticaRun): Promise<void> {
    const next = opened === run.id ? undefined : run.id;
    setOpened(next);
    if (!next) return;
    const previous = messages[run.id] ?? [];
    const fresh = await api.getMulticaRunMessages(projectId, issueId, run.id, previous.at(-1)?.sequence);
    setMessages(current => ({ ...current, [run.id]: [...previous, ...fresh.filter(message => !previous.some(item => item.id === message.id))] }));
  }

  async function cancel(runId: string): Promise<void> {
    await api.cancelMulticaRun(projectId, issueId, runId);
    setRuns(await api.getMulticaRuns(projectId, issueId));
  }

  if (!active) return null;
  return <div className="multica-execution-log">{error && <p className="multica-error-copy">{error}</p>}{runs.length === 0 ? <p className="multica-empty-copy">暂无执行记录</p> : runs.map(run => <article key={run.id}><button type="button" className="multica-execution-log__run" onClick={() => void open(run)}><span>{opened === run.id ? "▾" : "▸"}</span><strong>{run.id.slice(0, 8)}</strong><em className={`run-${run.status}`}>{run.status}</em></button>{opened === run.id && <div className="multica-execution-log__messages">{(messages[run.id] ?? []).map(message => <pre key={message.id}><b>{message.sequence} · {message.role ?? message.type ?? "event"}</b>{renderContent(message.content)}</pre>)}{["queued", "running"].includes(run.status) && <button type="button" onClick={() => void cancel(run.id)}>取消执行</button>}</div>}</article>)}</div>;
}

function renderContent(content: unknown): string { return typeof content === "string" ? content : JSON.stringify(content, null, 2); }

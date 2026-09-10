import { useEffect, useRef } from "react";
import { stepScopeIds, checkpointSatisfied, pendingStepCheckpoints, type WorkbenchTask } from "@ke/domain";
import { recordStepTarget, stepRecordEntries } from "./stepRecordEntries.js";

export function StepRecords({ task, executing, onSelectStep }: { task: WorkbenchTask; executing: boolean; onSelectStep: (id: string) => void }) {
  const panel = useRef<HTMLElement>(null);
  const entries = stepRecordEntries(task);
  const latest = entries[0];
  const activeId = task.commands.at(-1)?.activeStepId;
  const scope = activeId ? stepScopeIds(task, activeId) : new Set<string>();
  const scoped = (task.checkpoints ?? []).filter(item => scope.has(item.stepId));
  const inherited = activeId ? pendingStepCheckpoints(task, activeId).filter(item => !scope.has(item.stepId)) : [];
  const pending = [...scoped, ...inherited].filter(item => item.required && !checkpointSatisfied(item)).length;
  const missing = activeId && !scoped.length;
  const activeTarget = recordStepTarget(task, activeId);
  const needsAction = Boolean(activeId && (pending > 0 || missing));
  useEffect(() => { if (executing && panel.current) panel.current.scrollTop = 0; }, [executing, latest?.id, latest?.text]);
  return <section ref={panel} className="tw-execution-records"><div className="tw-execution-records__state"><span className={`tw-step__light is-${executing ? "running" : "todo"}`} />{executing ? "Codex 执行中 · 最新记录在上" : "执行记录 · 最新在上"}</div>
    {needsAction && activeId && <div className="tw-record-action"><p>{pending ? `当前步骤有 ${pending} 项待确认` : "当前步骤尚未保存确认项"}</p><button onClick={() => onSelectStep(activeId)}>{pending ? "查看并填写确认项" : "前往步骤梳理确认项"}</button></div>}
    {!entries.length && <p className="tw-empty-note">{executing ? "指令已提交，等待 Codex 返回活动。" : "暂无执行记录。点击播放开始。"}</p>}
    {entries.map(entry => {
      const target = recordStepTarget(task, entry.stepId);
      const live = executing && target?.id === activeTarget?.id;
      return <article key={entry.id} className={live ? "is-live" : ""}>{live ? <><header>{target ? <button className="tw-record-step" onClick={() => onSelectStep(target.id)}>{target.label}</button> : <b>任务</b>}<time>{new Date(entry.at).toLocaleTimeString("zh-CN", { hour12: false })}</time></header><p className="tw-record-live-text">{entry.text}</p></> : <details className="tw-record-details"><summary aria-label={`展开${target?.label ?? "任务"}的执行记录`}><b>{target?.label ?? "任务"}</b><time>{new Date(entry.at).toLocaleTimeString("zh-CN", { hour12: false })}</time></summary><p>{entry.text}</p></details>}</article>;
    })}
  </section>;
}

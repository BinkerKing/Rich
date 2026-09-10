import { useState } from "react";
import { stepScopeIds, checkpointSatisfied, pendingStepCheckpoints, type WorkbenchCheckpoint, type WorkbenchStep, type WorkbenchTask } from "@ke/domain";
import { ResourceText } from "./ResourceText.js";

export function StepCheckpoints({ task, step, disabled, onReview, onSave }: {
  task: WorkbenchTask; step: WorkbenchStep; disabled: boolean; onReview: () => void;
  onSave: (id: string, answer: string, answerMode: "option" | "text") => Promise<void>;
}) {
  const scope = stepScopeIds(task, step.id);
  const own = (task.checkpoints ?? []).filter(item => scope.has(item.stepId));
  const inherited = pendingStepCheckpoints(task, step.id).filter(item => item.stepId !== step.id);
  const items = [...inherited, ...own];
  const pending = items.filter(item => item.required && !checkpointSatisfied(item)).length;
  return <section className="tw-checkpoints"><header><h3>步骤确认项{pending > 0 && <small> · {pending} 项待满足</small>}</h3><button disabled={disabled} onClick={onReview}>梳理确认项</button></header>
    {!items.length && <p className="tw-empty-note">尚未列出确认项，暂不能执行。请先梳理关键前置条件。</p>}
    {items.map(item => <Checkpoint key={JSON.stringify(item)} item={item} source={item.stepId === step.id ? "" : `${scope.has(item.stepId) ? "子步骤" : "上级步骤"}：${task.steps.find(entry => entry.id === item.stepId)?.title ?? item.stepId}`} disabled={disabled} onSave={onSave} />)}
    {pending > 0 && <p className="tw-checkpoints__pending">必填确认项未满足，暂不能执行。选择“不具备”等答案不会解除阻塞。</p>}
  </section>;
}

function Checkpoint({ item, source, disabled, onSave }: { item: WorkbenchCheckpoint; source: string; disabled: boolean; onSave: (id: string, answer: string, answerMode: "option" | "text") => Promise<void> }) {
  const initialMode = item.answerMode ?? (item.options.length ? "option" : "text");
  const [mode, setMode] = useState<"option" | "text">(initialMode);
  const [choice, setChoice] = useState(initialMode === "option" ? item.answer ?? "" : "");
  const [custom, setCustom] = useState(initialMode === "text" ? item.answer ?? "" : "");
  const value = mode === "text" ? custom : choice;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const satisfied = checkpointSatisfied(item);
  return <details className="tw-checkpoint" open={!satisfied}><summary><span className={`tw-step__light is-${satisfied ? "done" : "blocked"}`} /><strong>{item.title}</strong><small>{source ? `${source} · ` : ""}{item.phase === "before" ? "前置" : "执行中"} · {item.required ? "必填" : "可选"} · {satisfied ? "已确认" : item.answer ? "条件未满足" : "待确认"}</small><span className="tw-checkpoint__chevron" aria-hidden="true">⌄</span></summary><form className="tw-checkpoint__form" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError("");
    try { await onSave(item.id, value, mode); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setSaving(false); }
  }}>
    <div className="tw-checkpoint__flow" aria-label="确认流程"><span>{item.phase === "before" ? "前置条件" : "执行中"}</span><i>→</i><strong>填写答复</strong><i>→</i><span>{satisfied ? "可继续" : "继续此步骤"}</span></div>
    {item.description && <details className="tw-checkpoint__context"><summary>为什么需要确认</summary><p><ResourceText text={item.description} /></p></details>}
    {item.options.length > 0 && <div className="tw-checkpoint__modes" role="group" aria-label={`${item.title}的答复方式`}><button type="button" aria-pressed={mode === "option"} disabled={disabled || saving} onClick={() => setMode("option")}>选择选项</button><button type="button" aria-pressed={mode === "text"} disabled={disabled || saving} onClick={() => setMode("text")}>自行填写</button></div>}
    <div className="tw-checkpoint__answer">{mode === "option" ? <select id={`checkpoint-${item.id}`} aria-label={item.title} value={value} disabled={disabled || saving} onChange={event => setChoice(event.target.value)}><option value="">请选择…</option>{item.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <textarea id={`checkpoint-${item.id}`} aria-label={item.title} rows={2} placeholder="填写缺少的信息或确认内容…" value={value} disabled={disabled || saving} onChange={event => setCustom(event.target.value)} />}
    <button type="submit" disabled={disabled || saving || !value.trim() || (value === item.answer && mode === initialMode)}>{saving ? "保存中…" : item.answer ? "更新答复" : "确认"}</button></div>{error && <p role="alert" className="tw-error-text">{error}</p>}
  </form></details>;
}

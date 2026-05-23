// apps/web/src/components/NewPlanModal.tsx
import { useMemo, useState, type ReactNode } from "react";
import { planScopes } from "@ke/domain";
import type { Plan } from "@ke/domain";
import "./NewPlanModal.css";

interface Props {
  onCreate: (plan: Omit<Plan, "id" | "createdAt">) => void;
  onCancel: () => void;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewPlanModal({ onCreate, onCancel }: Props): ReactNode {
  const today = useMemo(() => new Date(), []);
  const defaultStart = ymd(today);
  const defaultEnd = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 3);
    return ymd(d);
  }, [today]);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [mode, setMode] = useState<"ai" | "manual">("manual");

  const handleSubmit = (): void => {
    const t = title.trim();
    if (!t) return;
    onCreate({
      title: t,
      start,
      end,
      scopes: planScopes(start, end),
      status: "active",
      source: mode === "ai" ? "ai-decompose" : "user",
    });
  };

  return (
    <div className="np-back" onClick={onCancel}>
      <div className="np-modal" onClick={e => e.stopPropagation()}>
        <div className="np-modal__head">
          <div className="np-modal__title">新建计划</div>
          <button className="np-modal__close" onClick={onCancel}>×</button>
        </div>

        <label className="np-field">
          <span className="np-field__label">计划标题</span>
          <input className="np-field__input" autoFocus
            placeholder="例：3 个月减 10 斤 / 读完《思考快与慢》"
            value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleSubmit(); }} />
        </label>

        <div className="np-row">
          <label className="np-field np-field--half">
            <span className="np-field__label">开始</span>
            <input className="np-field__input" type="date"
              value={start} onChange={e => setStart(e.target.value)} />
          </label>
          <label className="np-field np-field--half">
            <span className="np-field__label">结束</span>
            <input className="np-field__input" type="date"
              value={end} onChange={e => setEnd(e.target.value)} />
          </label>
        </div>

        <div className="np-modes">
          <label className={`np-mode ${mode === "ai" ? "is-active" : ""}`}>
            <input type="radio" name="np-mode" value="ai"
              checked={mode === "ai"} onChange={() => setMode("ai")} />
            <div>
              <div className="np-mode__title">让 Rich 协助拆解</div>
              <div className="np-mode__sub">推荐 · 进入 HQ 对话，AI 帮你梳理月/周/日任务</div>
            </div>
          </label>
          <label className={`np-mode ${mode === "manual" ? "is-active" : ""}`}>
            <input type="radio" name="np-mode" value="manual"
              checked={mode === "manual"} onChange={() => setMode("manual")} />
            <div>
              <div className="np-mode__title">我自己手动添加</div>
              <div className="np-mode__sub">先建空架子，自己加目标和任务</div>
            </div>
          </label>
        </div>

        <div className="np-foot">
          <button className="np-btn" onClick={onCancel}>取消</button>
          <button className="np-btn is-primary" disabled={!title.trim()} onClick={handleSubmit}>
            {mode === "ai" ? "下一步 →" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState, type ReactNode } from "react";
import type { Element } from "@ke/domain";
import { api } from "../api/client.js";
import { useStore } from "../state/store.js";
import "./DraftPrdModal.css";

interface PrdSections {
  overview: string; targetUsers: string;
  coreFeatures: string[]; userStories: string[];
  acceptance: string[]; nonFunctional: string;
  outOfScope: string[]; risks: string[];
}

interface Props {
  practice: Element;
  children: Element[];
  onClose: () => void;
}

/**
 * 🪄 AI 起草 PRD 弹窗。3 个状态：
 *   input    – 收集额外上下文（可选）
 *   loading  – Hermes 在跑 30-60s，可取消
 *   preview  – 8 个 section 全部可编辑
 *   error    – 报错 + 重试
 */
export function DraftPrdModal({ practice, children, onClose }: Props): ReactNode {
  const [step, setStep] = useState<"input" | "loading" | "preview" | "error">("input");
  const [extraContext, setExtraContext] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<PrdSections | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydrate = useStore(s => s.hydrate);

  const generate = async (): Promise<void> => {
    setStep("loading");
    setError("");
    abortRef.current = new AbortController();
    try {
      const r = await fetch("/api/ai/draft-prd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice: { title: practice.title, subtitle: practice.subtitle, content: practice.content },
          children: children.map(c => ({ type: c.type, title: c.title, subtitle: c.subtitle, content: c.content })),
          extraContext: extraContext.trim() || undefined,
        }),
        signal: abortRef.current.signal,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const body = await r.json() as { result: { title: string; sections: PrdSections } };
      setTitle(body.result.title);
      setSections(body.result.sections);
      setStep("preview");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") { setStep("input"); return; }
      setError(err.message ?? String(e));
      setStep("error");
    }
  };

  const confirmCreate = async (): Promise<void> => {
    if (!sections || !title.trim()) return;
    try {
      // 找 / 建 "PRD" 分组，再把 PRD 元挂到分组下（新结构：practice → group → 子元）
      const state = useStore.getState();
      const childIds = state.relations
        .filter(r => r.kind === "child" && r.from === practice.id)
        .map(r => r.to);
      const directChildren = childIds
        .map(id => state.elements.get(id))
        .filter((e): e is Element => !!e);
      let prdGroup = directChildren.find(c => c.type === "group" && c.title === "PRD");
      if (!prdGroup) {
        prdGroup = await api.createPracticeGroup({ practiceId: practice.id, title: "PRD" });
      }
      await api.createPracticeChild({
        parentId: prdGroup.id,
        type: "product-design",
        title: title.trim(),
        subtitle: sections.overview.slice(0, 60),
        content: sections,
      });
      await hydrate();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  return (
    <div className="dpm-back" onClick={onClose}>
      <div className={`dpm-modal dpm-modal--${step}`} onClick={e => e.stopPropagation()}>
        <div className="dpm-head">
          <div className="dpm-title">🪄 AI 起草 PRD</div>
          <button className="dpm-close" onClick={onClose}>×</button>
        </div>

        {step === "input" && (
          <div className="dpm-body">
            <div className="dpm-context">
              基于项目「{practice.title}」+ 已有 {children.length} 个子元生成
            </div>
            <label className="dpm-label">额外要求（可选）</label>
            <textarea className="dpm-textarea" rows={3}
              placeholder="例：MVP 阶段，先解决付费用户的核心痛点；移动端优先"
              value={extraContext}
              onChange={e => setExtraContext(e.target.value)} />
            <div className="dpm-foot">
              <button className="dpm-btn" onClick={onClose}>取消</button>
              <button className="dpm-btn is-primary" onClick={() => void generate()}>开始起草</button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="dpm-body dpm-loading">
            <div className="dpm-spinner" />
            <div>Hermes 正在起草 PRD…</div>
            <div className="dpm-hint">通常 30-60 秒</div>
            <button className="dpm-btn" onClick={() => abortRef.current?.abort()}>取消</button>
          </div>
        )}

        {step === "error" && (
          <div className="dpm-body">
            <div className="dpm-error">起草失败：{error}</div>
            <div className="dpm-foot">
              <button className="dpm-btn" onClick={onClose}>关闭</button>
              <button className="dpm-btn is-primary" onClick={() => setStep("input")}>重试</button>
            </div>
          </div>
        )}

        {step === "preview" && sections && (
          <div className="dpm-body dpm-preview">
            <input className="dpm-prd-title"
              value={title}
              onChange={e => setTitle(e.target.value)} />
            <Section name="项目概述" value={sections.overview}
              onChange={v => setSections({ ...sections, overview: v })} />
            <Section name="目标用户 + 痛点" value={sections.targetUsers}
              onChange={v => setSections({ ...sections, targetUsers: v })} />
            <ListSection name="核心功能" items={sections.coreFeatures}
              onChange={items => setSections({ ...sections, coreFeatures: items })} />
            <ListSection name="用户故事" items={sections.userStories}
              onChange={items => setSections({ ...sections, userStories: items })} />
            <ListSection name="验收标准" items={sections.acceptance}
              onChange={items => setSections({ ...sections, acceptance: items })} />
            <Section name="非功能需求" value={sections.nonFunctional}
              onChange={v => setSections({ ...sections, nonFunctional: v })} />
            <ListSection name="范围外" items={sections.outOfScope}
              onChange={items => setSections({ ...sections, outOfScope: items })} />
            <ListSection name="风险" items={sections.risks}
              onChange={items => setSections({ ...sections, risks: items })} />

            <div className="dpm-foot">
              <button className="dpm-btn" onClick={onClose}>取消</button>
              <button className="dpm-btn" onClick={() => void generate()}>↻ 重新生成</button>
              <button className="dpm-btn is-primary"
                disabled={!title.trim()}
                onClick={() => void confirmCreate()}>确认 创建 PRD</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }): ReactNode {
  return (
    <div className="dpm-sec">
      <div className="dpm-sec__name">{name}</div>
      <textarea className="dpm-sec__text" rows={3} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ListSection({ name, items, onChange }: { name: string; items: string[]; onChange: (items: string[]) => void }): ReactNode {
  return (
    <div className="dpm-sec">
      <div className="dpm-sec__name">{name}</div>
      {items.map((it, i) => (
        <div key={i} className="dpm-sec__row">
          <input className="dpm-sec__input" value={it}
            onChange={e => {
              const next = [...items]; next[i] = e.target.value; onChange(next);
            }} />
          <button className="dpm-sec__del"
            onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className="dpm-sec__add" onClick={() => onChange([...items, ""])}>+ 加一条</button>
    </div>
  );
}

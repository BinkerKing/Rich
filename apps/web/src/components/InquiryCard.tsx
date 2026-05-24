import { useState, type ReactNode } from "react";
import type { Element } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import "./InquiryCard.css";

/**
 * AI 提问 inquiry 元的 content 结构。AI 在 draft/adjust 时如果不确定就生成这种条目。
 * 用户回答完后，status 从 todo → done，content 里 selectedOption + customAnswer 落地。
 */
interface InquiryContent {
  question: string;
  options: Array<{ label: string; description?: string }>;
  context?: string;
  importance?: "blocker" | "nice-to-know";
  /** 用户选的选项索引 (0-based)；选了"自定义"是 -1 */
  selectedOption?: number;
  /** 选 -1 时填的自由文本 */
  customAnswer?: string;
  /** 关联到哪个元（element id） */
  relatedTo?: string;
  askedAt?: string;
  answeredAt?: string;
}

interface Props {
  inquiry: Element;
  /** 是否在弹窗里嵌入式渲染（true = 内嵌, false = 独立卡片用于列表） */
  embedded?: boolean;
  /** 答完之后的回调（外层用来刷新或关闭） */
  onAnswered?: () => void;
}

/**
 * 一条提问的交互卡：展示问题 + 选项 + 自定义输入 + 提交按钮。
 * 已回答（status = done）的进入只读态，显示已选答案。
 */
export function InquiryCard({ inquiry, embedded, onAnswered }: Props): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const content = (inquiry.content ?? {}) as InquiryContent;
  const answered = inquiry.status === "done";

  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    typeof content.selectedOption === "number" ? content.selectedOption : null,
  );
  const [customText, setCustomText] = useState(content.customAnswer ?? "");
  const [saving, setSaving] = useState(false);

  const isCustom = selectedIdx === -1;
  const canSubmit = selectedIdx !== null && (!isCustom || customText.trim().length > 0);

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const nextContent: InquiryContent = {
        ...content,
        selectedOption: selectedIdx ?? undefined,
        customAnswer: isCustom ? customText.trim() : undefined,
        answeredAt: new Date().toISOString(),
      };
      await api.patchElement(inquiry.id, {
        content: nextContent as unknown,
        status: "done",
      });
      await hydrate();
      onAnswered?.();
    } catch (e) {
      alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const reopen = async (): Promise<void> => {
    setSaving(true);
    try {
      await api.patchElement(inquiry.id, { status: "todo" });
      await hydrate();
    } catch (e) {
      alert(`重置失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`inq-card ${embedded ? "inq-card--embedded" : ""} ${answered ? "is-answered" : ""}`}>
      <div className="inq-card__head">
        <span className={`inq-card__importance inq-card__importance--${content.importance ?? "nice-to-know"}`}>
          {content.importance === "blocker" ? "⚠ 必答" : "提问"}
        </span>
        {content.context && <span className="inq-card__context">{content.context}</span>}
        {answered && <span className="inq-card__status-badge">✓ 已回答</span>}
      </div>

      <div className="inq-card__question">{content.question || inquiry.title}</div>

      <div className="inq-card__options">
        {content.options?.map((opt, i) => {
          const isSel = selectedIdx === i;
          return (
            <button key={i}
              type="button"
              className={`inq-card__option ${isSel ? "is-selected" : ""}`}
              disabled={answered}
              onClick={() => !answered && setSelectedIdx(i)}>
              <div className="inq-card__option-radio">{isSel ? "●" : "○"}</div>
              <div className="inq-card__option-body">
                <div className="inq-card__option-label">{opt.label}</div>
                {opt.description && <div className="inq-card__option-desc">{opt.description}</div>}
              </div>
            </button>
          );
        })}
        <button
          type="button"
          className={`inq-card__option inq-card__option--custom ${selectedIdx === -1 ? "is-selected" : ""}`}
          disabled={answered}
          onClick={() => !answered && setSelectedIdx(-1)}>
          <div className="inq-card__option-radio">{selectedIdx === -1 ? "●" : "○"}</div>
          <div className="inq-card__option-body">
            <div className="inq-card__option-label">其他 / 自定义</div>
            <div className="inq-card__option-desc">如果以上都不合适，自己写一个</div>
          </div>
        </button>
      </div>

      {isCustom && !answered && (
        <textarea
          className="inq-card__custom-text"
          rows={2}
          placeholder="写下你的答案……"
          value={customText}
          onChange={e => setCustomText(e.target.value)} />
      )}

      {answered && (
        <div className="inq-card__answer">
          <span className="inq-card__answer-label">你的答案：</span>
          <span className="inq-card__answer-text">
            {isCustom ? customText : (content.options?.[selectedIdx ?? 0]?.label ?? "—")}
          </span>
          {content.answeredAt && (
            <span className="inq-card__answered-at">
              · {new Date(content.answeredAt).toLocaleString("zh-CN")}
            </span>
          )}
        </div>
      )}

      <div className="inq-card__actions">
        {answered ? (
          <button type="button" className="inq-card__btn-secondary" disabled={saving} onClick={() => void reopen()}>
            重新回答
          </button>
        ) : (
          <button type="button" className="inq-card__btn-primary"
            disabled={!canSubmit || saving}
            onClick={() => void submit()}>
            {saving ? "提交中…" : "提交答案"}
          </button>
        )}
      </div>
    </div>
  );
}

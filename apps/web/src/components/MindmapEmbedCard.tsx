import { useState } from "react";
import type { MindmapEmbedBlock, MindmapEmbedCover } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import "./MindmapEmbedCard.css";

interface Props {
  /** The embed block this card represents. */
  block: MindmapEmbedBlock;
  /** Host element id — needed to call retry / toggle / detach. */
  elementId?: string;
}

/**
 * Long-bar embed card rendered inside the "PPT 展示图" section. One card per
 * deck the element participates in. The element id is THIS element; the deck
 * id is `block.deckRootId`. Per-deck disable flags + per-deck cover image
 * live inline on the block, so multiple cards on the same element don't
 * compete for state.
 */
export function MindmapEmbedCard({ block, elementId }: Props) {
  const openMindmap = useStore(s => s.openMindmap);
  const hydrate = useStore(s => s.hydrate);
  const elements = useStore(s => s.elements);
  const startImageGenTask = useStore(s => s.startImageGenTask);
  const [retryOpen, setRetryOpen] = useState(false);
  const [retryHint, setRetryHint] = useState("");
  const [busy, setBusy] = useState(false);

  const deckRootId = block.deckRootId ?? elementId ?? "";
  const isDeckRoot = deckRootId === elementId;
  const isChild = block.origin === "child-of-deck";
  const isHidden = Boolean(block.hidden);
  const imageDisabled = Boolean(block.imageDisabled);
  const textDisabled = Boolean(block.textDisabled);
  const cover = block.cover;
  const hasCoverState = Boolean(cover); // pending/generating/ready/failed

  // 主元 = the deck-root element this card belongs to. Show its title so the
  // user can tell which deck this card is for, especially when multiple cards
  // appear on the same element.
  const deckRootEl = deckRootId ? elements.get(deckRootId) : undefined;
  const deckRootTitle = deckRootEl?.title ?? (isDeckRoot ? "本元" : "（未找到主元）");

  const handleOpen = () => openMindmap(deckRootId);

  const handleToggleHidden = async () => {
    if (!elementId) return;
    try { await api.toggleMindmapHidden(elementId, deckRootId); await hydrate(); }
    catch (e) { window.alert(e instanceof Error ? e.message : String(e)); }
  };
  const handleToggleImageDisabled = async () => {
    if (!elementId) return;
    try { await api.toggleMindmapImageDisabled(elementId, deckRootId); await hydrate(); }
    catch (e) { window.alert(e instanceof Error ? e.message : String(e)); }
  };
  const handleToggleTextDisabled = async () => {
    if (!elementId) return;
    try { await api.toggleMindmapTextDisabled(elementId, deckRootId); await hydrate(); }
    catch (e) { window.alert(e instanceof Error ? e.message : String(e)); }
  };
  const handleDetach = async () => {
    if (!elementId) return;
    const msg = isDeckRoot
      ? "移除整个 PPT？这会同时清理子元里属于这份 PPT 的卡片。"
      : "把本元从这份 PPT 中移除？子树关系不变,只是不再属于该 PPT。";
    if (!window.confirm(msg)) return;
    try { await api.detachMindmap(elementId, deckRootId); await hydrate(); }
    catch (e) { window.alert(e instanceof Error ? e.message : String(e)); }
  };

  const handleRetrySubmit = async () => {
    if (!elementId) return;
    setBusy(true);
    try {
      // Kick off the image gen.
      await api.retryMindmapCover(elementId, deckRootId, retryHint);
      // Mirror it as a task so the user can watch progress in the task list
      // / footer strip just like other AI ops.
      const elTitle = elements.get(elementId)?.title ?? elementId;
      const deckTitle = elements.get(deckRootId)?.title ?? deckRootId;
      const taskTitle = elementId === deckRootId
        ? `生成封面 · ${elTitle}`
        : `生成封面 · ${elTitle}(${deckTitle} PPT)`;
      startImageGenTask({ elementId, deckRootId, title: taskTitle, hint: retryHint });
      await hydrate();
      setRetryOpen(false);
      setRetryHint("");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const date = block.generatedAt?.slice(0, 10);
  const originLabel = block.origin === "ai-from-prose" ? "AI · 文稿生成"
    : block.origin === "child-of-deck" ? "PPT · 子节点"
    : "元 · 一键转换";

  return (
    <div className={`mm-embed${isHidden ? " mm-embed--hidden" : ""}`}>
      <div className="mm-embed__visual">{renderCover(cover)}</div>
      <div className="mm-embed__body">
        <div className="mm-embed__meta">
          <span className="mm-embed__chip">{originLabel}</span>
          {date && <span className="mm-embed__date">{date}</span>}
          {block.aiModel && <span className="mm-embed__model">{block.aiModel}</span>}
          {isHidden && (
            <span className="mm-embed__hidden-tag">
              {isDeckRoot ? "已隐藏" : "本卡在此 PPT 中已隐藏"}
            </span>
          )}
        </div>
        <div className="mm-embed__title">
          {isDeckRoot ? "本元是这份 PPT 的主元" : `所属 PPT 主元：${deckRootTitle}`}
        </div>
        {block.caption && <div className="mm-embed__caption">{block.caption}</div>}
        <div className="mm-embed__hint">
          {isChild
            ? "本元作为节点出现在该 PPT 中。下面的开关只影响这份 PPT 的展示。"
            : "PPT 的素材来自此元的子树。改任意子元都会自动反映到 PPT 上。"}
        </div>
        <div className="mm-embed__actions">
          {isDeckRoot && (
            <button type="button" className="mm-embed__primary" onClick={handleOpen} disabled={!deckRootId}>
              打开 MindPPT →
            </button>
          )}
          <button
            type="button" className="mm-embed__secondary"
            onClick={() => setRetryOpen(true)} disabled={!elementId}
            title={hasCoverState ? "重新让 AI 生成本卡的概述图" : "让 AI 生成本卡的概述图"}
          >
            {hasCoverState ? "重生封面" : "生成图片"}
          </button>
          <button
            type="button"
            className={`mm-embed__toggle${imageDisabled ? " is-off" : ""}`}
            onClick={handleToggleImageDisabled} disabled={!elementId}
            title="PPT 播放时是否显示本节点的图片"
          >
            {imageDisabled ? "已禁用图片" : "禁用图片"}
          </button>
          <button
            type="button"
            className={`mm-embed__toggle${textDisabled ? " is-off" : ""}`}
            onClick={handleToggleTextDisabled} disabled={!elementId}
            title="PPT 播放时是否显示本节点的文字"
          >
            {textDisabled ? "已禁用文字" : "禁用文字"}
          </button>
          {isDeckRoot ? (
            <button
              type="button" className="mm-embed__secondary"
              onClick={handleDetach} disabled={!elementId}
              title="移除整个 PPT — 这会同时清理子元里属于这份 PPT 的卡片"
            >
              移除 PPT
            </button>
          ) : (
            <button
              type="button"
              className={`mm-embed__toggle${isHidden ? " is-off" : ""}`}
              onClick={handleToggleHidden} disabled={!elementId}
              title={isHidden ? "重新让本元出现在这份 PPT 的播放器中" : "在这份 PPT 的播放器中隐藏本元(可恢复)"}
            >
              {isHidden ? "在此 PPT 中显示" : "在此 PPT 中隐藏"}
            </button>
          )}
        </div>
      </div>
      {retryOpen && (
        <RetryModal
          hint={retryHint}
          onHintChange={setRetryHint}
          busy={busy}
          onCancel={() => { setRetryOpen(false); setRetryHint(""); }}
          onSubmit={handleRetrySubmit}
        />
      )}
    </div>
  );
}

/** Inside the embed card's left visual slot:
 *   • cover.status === "ready" → <img>
 *   • cover.status === "pending" / "generating" / "failed" → state badge
 *   • cover === undefined → "no image yet, click 生成图片" */
function renderCover(cover?: MindmapEmbedCover) {
  if (!cover) {
    return (
      <div className="mm-embed__placeholder mm-embed__placeholder--idle">
        <div className="mm-embed__nodes mm-embed__nodes--decorative" aria-hidden="true">
          <span className="mm-embed__node mm-embed__node--root" />
          <span className="mm-embed__node mm-embed__node--c1" />
          <span className="mm-embed__node mm-embed__node--c2" />
          <span className="mm-embed__node mm-embed__node--c3" />
        </div>
        <em className="mm-embed__placeholder-text">尚未生成图片 · 点「生成图片」</em>
      </div>
    );
  }
  if (cover.status === "ready" && cover.src) {
    return <img className="mm-embed__cover" src={cover.src} alt={cover.alt ?? ""} loading="lazy" />;
  }
  const stateText = cover.status === "generating" ? "AI 正在生成图片…"
    : cover.status === "pending" ? "排队中…"
    : cover.status === "failed" ? "生成失败"
    : "等待生成…";
  return (
    <div className={`mm-embed__placeholder mm-embed__placeholder--${cover.status}`}>
      <span aria-hidden="true">{cover.status === "failed" ? "⚠" : "✦"}</span>
      <em>{stateText}</em>
      {cover.status === "failed" && cover.error && <small>{cover.error}</small>}
    </div>
  );
}

interface RetryProps {
  hint: string;
  onHintChange: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function RetryModal({ hint, onHintChange, busy, onCancel, onSubmit }: RetryProps) {
  return (
    <div className="mm-retry-modal" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="mm-retry-modal__panel" onClick={e => e.stopPropagation()}>
        <header className="mm-retry-modal__head">
          <strong>重新生成封面</strong>
          <button type="button" className="mm-retry-modal__close" onClick={onCancel} aria-label="关闭">×</button>
        </header>
        <div className="mm-retry-modal__body">
          <p className="mm-retry-modal__hint">写下对封面图的具体要求(可选),AI 会按这个方向重新生成。例如:</p>
          <ul className="mm-retry-modal__examples">
            <li>"用一台老式打字机和报纸的组合,色调更暖一点"</li>
            <li>"减少图标数量,只保留一个机器人"</li>
            <li>"换成水彩画风格,放一个 AI 大脑符号"</li>
          </ul>
          <textarea
            value={hint}
            onChange={e => onHintChange(e.target.value)}
            placeholder="留空 = 用默认 prompt 重试一次"
            rows={4}
            disabled={busy}
            autoFocus
          />
          <div className="mm-retry-modal__actions">
            <button type="button" onClick={onCancel} disabled={busy}>取消</button>
            <button type="button" className="mm-retry-modal__primary" onClick={onSubmit} disabled={busy}>
              {busy ? "重新派任务中…" : "开始生成"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

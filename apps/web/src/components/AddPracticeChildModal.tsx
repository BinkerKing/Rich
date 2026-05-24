import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Element } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import "./AddPracticeChildModal.css";

type ChildType = "knowledge" | "requirement" | "feature" | "dev-task" | "revision";

interface Props {
  practice: Element;
  /** Group 元 (已 ensured 存在)。新元会挂在 group 下面。 */
  group: Element;
  childType: ChildType;
  /** 同分组现有元的标题——给 AI 做去重提示 + 序号推断 */
  existingTitles: string[];
  /** 入口标签（"知识点"/"场景分析"/"功能说明"/"开发任务"） */
  groupLabel: string;
  onClose: () => void;
}

/**
 * 项目实战里 新增子元 的弹框。两条路径：
 * - 直接新建：把 direction 当 title 直接 save（最多取前 40 字）
 * - 让 Rich 帮我写：调 /api/ai/draft-child，AI 基于方向生成 title+subtitle+content
 *
 * UX 细节：
 * - direction 用 textarea 而不是 input —— 写方向通常一两句
 * - AI 路径有 loading + cancel + 失败重试三态
 * - ⌘+Enter 快捷键 = 让 Rich 帮我写（默认推 AI 路径，因为这是项目实战的卖点）
 */
export function AddPracticeChildModal({
  practice, group, childType, existingTitles, groupLabel, onClose,
}: Props): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const [direction, setDirection] = useState("");
  const [mode, setMode] = useState<"input" | "loading" | "error">("input");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // ESC 关闭（loading 时改成 cancel）
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (mode === "loading") {
        abortRef.current?.abort();
        setMode("input");
        return;
      }
      // 在 textarea 内的 ESC 也关弹框（用户已经看完了，不需要清空）
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  const canSubmit = direction.trim().length > 0;

  // 直接新建：把方向当 title（截前 40 字），无 content
  const createManual = async (): Promise<void> => {
    if (!canSubmit) return;
    const titleRaw = direction.trim();
    const title = titleRaw.length > 40 ? titleRaw.slice(0, 40) : titleRaw;
    try {
      await api.createPracticeChild({
        parentId: group.id,
        type: childType,
        title,
      });
      await hydrate();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode("error");
    }
  };

  // 让 Rich 帮我写：调 AI，生成完整 title + subtitle + content
  const createWithAI = async (): Promise<void> => {
    if (!canSubmit) return;
    setMode("loading");
    setError("");
    abortRef.current = new AbortController();
    try {
      const r = await fetch("/api/ai/draft-child", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice: {
            title: practice.title,
            subtitle: practice.subtitle,
            content: practice.content,
          },
          groupType: childType,
          existingTitles,
          direction: direction.trim(),
        }),
        signal: abortRef.current.signal,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const body = await r.json() as {
        result: {
          title: string;
          subtitle?: string;
          content?: Record<string, unknown>;
          inquiries?: Array<{
            question: string;
            options: Array<{ label: string; description?: string }>;
            context?: string;
            importance?: "blocker" | "nice-to-know";
          }>;
        };
      };
      const created = await api.createPracticeChild({
        parentId: group.id,
        type: childType,
        title: body.result.title,
        subtitle: body.result.subtitle || undefined,
        content: body.result.content ?? {},
      });

      // 如果 AI 出了不确定点 → 在 "提问" 分组下挂成独立的 inquiry 元
      if (body.result.inquiries && body.result.inquiries.length > 0) {
        await persistInquiries(practice.id, created.id, body.result.inquiries);
      }

      await hydrate();
      onClose();
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") { setMode("input"); return; }
      setError(err.message ?? String(e));
      setMode("error");
    }
  };

  return (
    <div className="apc" onClick={onClose} role="dialog" aria-modal="true">
      <div className="apc__card" onClick={e => e.stopPropagation()}>
        <header className="apc__head">
          <div className="apc__title">+ 新增 {groupLabel}</div>
          <button type="button" className="apc__close" aria-label="关闭" onClick={onClose}>×</button>
        </header>

        {mode === "input" && (
          <div className="apc__body">
            <label className="apc__label">方向 / 想法</label>
            <textarea
              ref={textareaRef}
              className="apc__textarea"
              rows={5}
              placeholder={PLACEHOLDER[childType]}
              value={direction}
              onChange={e => setDirection(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void createWithAI();
                }
              }} />
            <div className="apc__hint">
              <strong>直接新建</strong> = 把上面这句当成标题直接存；
              <strong>让 Rich 帮我写</strong> = AI 基于方向生成完整内容。
              <span className="apc__shortcut">⌘ + Enter 等于"让 Rich 帮我写"</span>
            </div>

            <div className="apc__footer">
              <button type="button" className="apc__btn" onClick={onClose}>取消</button>
              <div style={{ flex: 1 }} />
              <button type="button" className="apc__btn"
                disabled={!canSubmit}
                onClick={() => void createManual()}>
                直接新建
              </button>
              <button type="button" className="apc__btn apc__btn--ai"
                disabled={!canSubmit}
                onClick={() => void createWithAI()}>
                🪄 让 Rich 帮我写
              </button>
            </div>
          </div>
        )}

        {mode === "loading" && (
          <div className="apc__body apc__loading">
            <div className="apc__spinner" />
            <div className="apc__loading-text">Rich 正在写…</div>
            <div className="apc__hint">通常 15-40 秒</div>
            <button type="button" className="apc__btn" onClick={() => abortRef.current?.abort()}>
              取消
            </button>
          </div>
        )}

        {mode === "error" && (
          <div className="apc__body">
            <div className="apc__error">写失败：{error}</div>
            <div className="apc__footer">
              <button type="button" className="apc__btn" onClick={onClose}>关闭</button>
              <div style={{ flex: 1 }} />
              <button type="button" className="apc__btn apc__btn--ai" onClick={() => setMode("input")}>
                重试
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AI 给出的 inquiries[] → 落地成一组 inquiry 元，挂在 practice 下的 "提问" 分组里。
 * 如果 "提问" 分组不存在就先建一个。每条 inquiry 的 relatedTo 指向刚建的主元 id。
 */
async function persistInquiries(
  practiceId: string,
  relatedToId: string,
  inquiries: Array<{
    question: string;
    options: Array<{ label: string; description?: string }>;
    context?: string;
    importance?: "blocker" | "nice-to-know";
  }>,
): Promise<void> {
  const state = useStore.getState();
  const directChildIds = state.relations
    .filter(r => r.kind === "child" && r.from === practiceId)
    .map(r => r.to);
  const directChildren = directChildIds
    .map(id => state.elements.get(id))
    .filter((e): e is Element => !!e);
  let inquiryGroup = directChildren.find(c => c.type === "group" && c.title === "提问");
  if (!inquiryGroup) {
    inquiryGroup = await api.createPracticeGroup({ practiceId, title: "提问" });
  }

  const askedAt = new Date().toISOString();
  for (const inq of inquiries) {
    const titleRaw = inq.question.trim();
    const title = titleRaw.length > 60 ? titleRaw.slice(0, 60) + "…" : titleRaw;
    await api.createPracticeChild({
      parentId: inquiryGroup.id,
      type: "inquiry",
      title,
      subtitle: inq.context || undefined,
      content: {
        question: inq.question,
        options: inq.options,
        context: inq.context,
        importance: inq.importance ?? "nice-to-know",
        relatedTo: relatedToId,
        askedAt,
      },
    });
  }
}

const PLACEHOLDER: Record<ChildType, string> = {
  knowledge: "例：SSE 流式渲染的核心做法 / 怎么处理 React 的 hydrate mismatch",
  requirement: "例：场景 5：用户切换设备后，希望看到上次未读完的对话",
  feature: "例：批量删除 + 撤销 5 秒；空状态文案；快捷键 ⌘K 打开搜索",
  "dev-task": "例：把 chat history 接上 SSE / 给 mascot 加 thinking 表情",
  revision: "例：Mascot 在小屏上太小，建议放大到 96px / 流程图箭头太细看不清，加粗一档",
};

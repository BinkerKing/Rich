import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import "./ChildElementModal.css";

/** type → 中文名（兼容老数据 concept/case/product-design/step）。 */
const TYPE_DISPLAY: Record<string, string> = {
  knowledge: "知识点",
  requirement: "场景分析",
  feature: "功能说明",
  prd: "PRD",
  "dev-task": "开发任务",
  revision: "整改建议",
  inquiry: "提问",
  group: "分组",
  concept: "知识点",
  case: "场景分析",
  "product-design": "PRD",
  step: "开发任务",
};
function displayType(t: string): string {
  return TYPE_DISPLAY[t] ?? t;
}

interface Props {
  elementId: string;
  onClose: () => void;
}

/**
 * 子元详情弹窗。
 *
 * 这是 ChildElementDrawer 的"展示版"——对标 AI 早报的 NewsModal：居中浮层、
 * 暗背景、ESC 关闭、可点空白处关闭。在项目实战 总览页 点 知识点 / 需求分析 /
 * PRD / 开发任务 的子元 时弹出。
 *
 * 设计选择：
 * - 标题 / 副标题：直接 inline editable input；blur 时保存（最小阻力）
 * - 内容：智能渲染——string 显示成段落，object 按 key 拆 section（PRD 等
 *   结构化数据看起来友好）
 * - 状态：仅 dev-task / step 展示 todo/doing/done chip 组
 * - 底部：删除（红） + 关闭
 *
 * 与 ChildElementDrawer 的区别：drawer 是侧滑编辑面板（适合修内容 JSON），
 * 这里是阅读优先的浮层（适合快速查看 + 轻编辑）。
 */
export function ChildElementModal({ elementId, onClose }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const el = elements.get(elementId);

  const [title, setTitle] = useState(el?.title ?? "");
  const [subtitle, setSubtitle] = useState(el?.subtitle ?? "");
  const [status, setStatus] = useState<"todo" | "doing" | "done">(el?.status ?? "todo");
  const [saving, setSaving] = useState(false);

  // 调整态——点"调整"按钮时进入，由 AI 基于方向重写整个元
  const [adjustMode, setAdjustMode] = useState<"off" | "input" | "loading" | "error">("off");
  const [adjustDirection, setAdjustDirection] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const adjustAbortRef = useRef<AbortController | null>(null);
  const adjustTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      // 防止打字时被 ESC 关掉
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("input, textarea")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 元变了（很少见，但 hydrate 后可能换 id 引用），同步表单
  useEffect(() => {
    setTitle(el?.title ?? "");
    setSubtitle(el?.subtitle ?? "");
    setStatus(el?.status ?? "todo");
  }, [el?.id]);

  if (!el) return null;

  const isTask = el.type === "dev-task" || el.type === "step";

  const saveField = async (patch: Record<string, unknown>): Promise<void> => {
    setSaving(true);
    try {
      await api.patchElement(el.id, patch);
      await hydrate();
    } catch (e) {
      alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!confirm(`确认删除「${el.title}」？此操作不可撤销。`)) return;
    try {
      await api.deleteElement(el.id);
      await hydrate();
      onClose();
    } catch (e) {
      alert(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const setTaskStatus = (s: "todo" | "doing" | "done"): void => {
    setStatus(s);
    void saveField({ status: s });
  };

  // 调整：找出这个元所在的 practice（element → group → practice）。
  // 仅项目实战的子元类型支持调整。
  const ADJUST_TYPES = new Set(["knowledge", "requirement", "feature", "prd", "dev-task", "revision"]);
  // inquiry 不参与调整 —— 它是 AI 提的问，由用户答；不该让 AI 自己改自己的问题
  const canAdjust = ADJUST_TYPES.has(el.type);
  const practice = (() => {
    if (!canAdjust) return undefined;
    // 走 child 关系反向找：el ← group ← practice
    const parentRel = relations.find(r => r.kind === "child" && r.to === el.id);
    if (!parentRel) return undefined;
    const parent = elements.get(parentRel.from);
    if (!parent) return undefined;
    if (parent.type === "practice") return parent;
    if (parent.type !== "group") return undefined;
    const grandparentRel = relations.find(r => r.kind === "child" && r.to === parent.id);
    if (!grandparentRel) return undefined;
    const grandparent = elements.get(grandparentRel.from);
    return grandparent?.type === "practice" ? grandparent : undefined;
  })();

  const openAdjust = (): void => {
    setAdjustDirection("");
    setAdjustError("");
    setAdjustMode("input");
    setTimeout(() => adjustTextareaRef.current?.focus(), 50);
  };

  const submitAdjust = async (): Promise<void> => {
    const dir = adjustDirection.trim();
    if (!dir || !practice) return;
    setAdjustMode("loading");
    setAdjustError("");
    adjustAbortRef.current = new AbortController();
    try {
      const r = await fetch("/api/ai/adjust-child", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice: {
            title: practice.title,
            subtitle: practice.subtitle,
            content: practice.content,
          },
          groupType: el.type,
          current: {
            title: el.title,
            subtitle: el.subtitle,
            content: el.content,
          },
          direction: dir,
        }),
        signal: adjustAbortRef.current.signal,
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
      // PATCH 整版替换
      await api.patchElement(el.id, {
        title: body.result.title,
        subtitle: body.result.subtitle ?? "",
        content: body.result.content ?? {},
      });

      // AI 提出的不确定点 → 在 practice 的 "提问" 分组下挂 inquiry 元
      if (practice && body.result.inquiries && body.result.inquiries.length > 0) {
        const state = useStore.getState();
        const directIds = state.relations
          .filter(r => r.kind === "child" && r.from === practice.id)
          .map(r => r.to);
        const directChildren = directIds
          .map(id => state.elements.get(id))
          .filter((x): x is NonNullable<typeof x> => !!x);
        let inquiryGroup = directChildren.find(c => c.type === "group" && c.title === "提问");
        if (!inquiryGroup) {
          inquiryGroup = await api.createPracticeGroup({ practiceId: practice.id, title: "提问" });
        }
        const askedAt = new Date().toISOString();
        for (const inq of body.result.inquiries) {
          const titleRaw = inq.question.trim();
          const inqTitle = titleRaw.length > 60 ? titleRaw.slice(0, 60) + "…" : titleRaw;
          await api.createPracticeChild({
            parentId: inquiryGroup.id,
            type: "inquiry",
            title: inqTitle,
            subtitle: inq.context || undefined,
            content: {
              question: inq.question,
              options: inq.options,
              context: inq.context,
              importance: inq.importance ?? "nice-to-know",
              relatedTo: el.id,
              askedAt,
            },
          });
        }
      }

      await hydrate();
      // 退出调整态——元已经更新，重新拉的 el 会显示新内容
      setAdjustMode("off");
      setAdjustDirection("");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") { setAdjustMode("input"); return; }
      setAdjustError(err.message ?? String(e));
      setAdjustMode("error");
    }
  };

  return (
    <div className="cem" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cem__card" onClick={e => e.stopPropagation()}>
        <span className="cem__esc">ESC</span>
        <button type="button" className="cem__close" aria-label="关闭" onClick={onClose}>×</button>

        <header className="cem__head">
          <div className={`cem__type-chip type-${el.type}`}>{displayType(el.type)}</div>
          <input className="cem__title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== el.title) void saveField({ title: title.trim() }); }}
            placeholder="标题" />
          <input className="cem__subtitle"
            value={subtitle}
            onChange={e => setSubtitle(e.target.value)}
            onBlur={() => { if (subtitle !== (el.subtitle ?? "")) void saveField({ subtitle }); }}
            placeholder="副标题（可选）" />
          {isTask && (
            <div className="cem__status">
              {(["todo", "doing", "done"] as const).map(s => (
                <button key={s} type="button"
                  className={`cem__status-chip cem__status-chip--${s} ${status === s ? "is-active" : ""}`}
                  onClick={() => setTaskStatus(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </header>

        {adjustMode === "off" && (
          <div className="cem__body">
            <ContentRender content={el.content} />
          </div>
        )}

        {adjustMode === "input" && (
          <div className="cem__body cem__adjust">
            <div className="cem__adjust-label">
              🪄 让 Rich 调整这个元 —— 写下你的方向
            </div>
            <textarea
              ref={adjustTextareaRef}
              className="cem__adjust-textarea"
              rows={4}
              placeholder="例：把 painPoint 写得更具体，加点数据 / 标题不变，content 里的 example 换一个更贴近项目的 / 整段改成更简洁的语言"
              value={adjustDirection}
              onChange={e => setAdjustDirection(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitAdjust();
                }
              }} />
            <div className="cem__adjust-hint">
              AI 会基于"当前内容 + 这个方向"整版重写。原有 content 字段结构保留，只改值。<br />
              ⌘ + Enter 直接提交
            </div>
          </div>
        )}

        {adjustMode === "loading" && (
          <div className="cem__body cem__adjust-loading">
            <div className="cem__spinner" />
            <div>Rich 正在调整…</div>
            <div className="cem__adjust-hint">通常 15-40 秒</div>
            <button type="button" className="cem__btn-secondary"
              onClick={() => adjustAbortRef.current?.abort()}>
              取消
            </button>
          </div>
        )}

        {adjustMode === "error" && (
          <div className="cem__body">
            <div className="cem__adjust-error">调整失败：{adjustError}</div>
            <div className="cem__adjust-error-actions">
              <button type="button" className="cem__btn-secondary" onClick={() => setAdjustMode("off")}>放弃</button>
              <button type="button" className="cem__btn-secondary" onClick={() => setAdjustMode("input")}>重试</button>
            </div>
          </div>
        )}

        <div className="cem__footer">
          {adjustMode === "off" && (
            <>
              <button type="button" className="cem__del" onClick={() => void remove()}>删除元</button>
              <div style={{ flex: 1 }} />
              {saving && <span className="cem__saving">保存中…</span>}
              {canAdjust && practice && (
                <button type="button" className="cem__adjust-btn" onClick={openAdjust}>
                  🪄 调整
                </button>
              )}
              <button type="button" className="cem__done" onClick={onClose}>完成</button>
            </>
          )}
          {adjustMode === "input" && (
            <>
              <button type="button" className="cem__btn-secondary" onClick={() => setAdjustMode("off")}>
                取消调整
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="cem__done"
                disabled={!adjustDirection.trim()}
                onClick={() => void submitAdjust()}>
                🪄 提交调整
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 智能内容渲染：
 * - undefined / null / 空 → 占位提示
 * - string → 当 markdown-lite 段落渲染（保留换行）
 * - object → 按 key 拆 section，value 递归
 *   - string value → 段落
 *   - string[] → 项目列表
 *   - 其他 → 折叠 JSON
 */
function ContentRender({ content }: { content: unknown }): ReactNode {
  if (content == null || content === "") {
    return <div className="cem__empty">尚无详细内容。点击标题或副标题可直接编辑；如需补充结构化内容，去知识树打开此元。</div>;
  }
  if (typeof content === "string") {
    return <div className="cem__text">{content.split("\n").map((line, i) => <p key={i}>{line || " "}</p>)}</div>;
  }
  if (typeof content === "object" && !Array.isArray(content)) {
    const entries = Object.entries(content as Record<string, unknown>);
    return (
      <>
        {entries.map(([key, value]) => (
          <section key={key} className="cem__sec">
            <h3 className="cem__sec-title">{prettifyKey(key)}</h3>
            <SectionValue value={value} />
          </section>
        ))}
      </>
    );
  }
  if (Array.isArray(content)) {
    return <SectionValue value={content} />;
  }
  return <pre className="cem__json">{JSON.stringify(content, null, 2)}</pre>;
}

function SectionValue({ value }: { value: unknown }): ReactNode {
  if (value == null || value === "") return <div className="cem__sec-empty">（空）</div>;
  if (typeof value === "string") {
    return <div className="cem__text">{value.split("\n").map((line, i) => <p key={i}>{line || " "}</p>)}</div>;
  }
  if (Array.isArray(value)) {
    if (value.every(v => typeof v === "string")) {
      return (
        <ul className="cem__list">
          {(value as string[]).map((v, i) => <li key={i}>{v}</li>)}
        </ul>
      );
    }
    // 对象数组（如 acceptance: [{ criterion, expected }]）—— 每个 item 递归渲染
    return (
      <div className="cem__sub">
        {value.map((item, i) => (
          <div key={i} className="cem__sub-item">
            <SectionValue value={item} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    // 嵌套对象 —— 按 key 递归拆 sub-section，每个 sub-key 当小标题
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="cem__sub">
        {entries.map(([key, v]) => (
          <div key={key} className="cem__sub-sec">
            <div className="cem__sub-key">{prettifyKey(key)}</div>
            <SectionValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

// 把 camelCase / kebab / snake 的 key 转中文标题。常见 PRD 字段直接给中文映射，
// 其他 fallback 到 key 本身。
const KEY_LABEL: Record<string, string> = {
  // PRD
  overview: "项目概述",
  targetUsers: "目标用户 + 痛点",
  coreFeatures: "核心功能",
  userStories: "用户故事",
  acceptance: "验收标准",
  nonFunctional: "非功能需求",
  outOfScope: "范围外",
  risks: "风险",
  // 需求分析（AI 起草的场景常见字段）
  scenario: "场景描述",
  painPoint: "痛点",
  painPoints: "痛点",
  richResponse: "Rich 的响应",
  expectedResponse: "期望响应",
  trigger: "触发条件",
  context: "上下文",
  goal: "目标",
  goals: "目标",
  // 知识点 / 通用
  summary: "摘要",
  definition: "定义",
  example: "举例",
  examples: "举例",
  why: "为什么",
  how: "怎么做",
  notes: "备注",
  // 开发任务
  criterion: "判定标准",
  expected: "期望结果",
  steps: "步骤",
  doneWhen: "完成判定",
  estimate: "预估耗时",
  // 整改建议
  suggestion: "建议内容",
  analysis: "分析（影响 / 风险 / 是否值得）",
  plan: "整改方案",
  relatedTo: "关联元",
  decision: "决定",
  impact: "影响范围",
  risk: "风险",
  // 提问（context 已在上方定义，这里不重复）
  question: "问题",
  options: "选项",
  selectedOption: "已选",
  customAnswer: "自定义答案",
  importance: "重要性",
  askedAt: "提出时间",
  answeredAt: "回答时间",
  // 嵌套常见 key
  historyView: "历史视图",
  view: "视图",
  layout: "布局",
};
function prettifyKey(key: string): string {
  return KEY_LABEL[key] ?? key;
}

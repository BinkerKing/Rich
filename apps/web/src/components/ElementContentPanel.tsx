import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Element, ElementType, RichnessLevel } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import { elementTypeLabel } from "./elementLabels.js";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import "./components.css";

type ContentRecord = Record<string, unknown>;

interface ContextTarget {
  x: number;
  y: number;
  title: string;
  text: string;
}

interface Props {
  element: Element;
  childrenCount: number;
  currentLevel: number;
  onOpenChildren: () => void;
}

// ──────── helpers ────────

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ContentRecord) : {};
}
function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function asTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
function asObjectList(value: unknown): ContentRecord[] {
  return Array.isArray(value)
    ? value.filter((x): x is ContentRecord => Boolean(x) && typeof x === "object" && !Array.isArray(x))
    : [];
}

function formatRelativeTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const deltaSec = Math.round((Date.now() - t) / 1000);
  if (deltaSec < 60) return "刚刚";
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)} 分钟前`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)} 小时前`;
  if (deltaSec < 86400 * 30) return `${Math.floor(deltaSec / 86400)} 天前`;
  return new Date(t).toISOString().slice(0, 10);
}

// ──────── MetaStrip ────────

function RichnessGauge({ level }: { level: RichnessLevel }) {
  return (
    <span className="richness-gauge" aria-label={`内容深度 ${level}/5`} title={`内容深度 ${level}/5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= level ? "is-on" : ""} />
      ))}
    </span>
  );
}

function MetaStrip({ element }: { element: Element }) {
  const [versionCount, setVersionCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.listVersions(element.id).then(list => {
      if (!cancelled) setVersionCount(list.length);
    }).catch(() => {
      if (!cancelled) setVersionCount(null);
    });
    return () => { cancelled = true; };
  }, [element.id]);

  const typeLabel = elementTypeLabel(element.type as ElementType);
  const richness = element.metadata.richness as RichnessLevel;
  const updated = formatRelativeTime(element.metadata.updatedAt);
  const model = element.metadata.aiModel;
  const tags = element.tags ?? [];
  const difficulty = element.difficulty;

  return (
    <div className="meta-strip" role="group" aria-label="元信息">
      <span className={`meta-chip meta-chip--type type-${element.type}`}>{typeLabel}</span>
      <RichnessGauge level={richness} />
      {difficulty && (
        <span className="meta-chip meta-chip--difficulty" title="难度">
          难度 · {difficulty === "low" ? "低" : difficulty === "mid" ? "中" : "高"}
        </span>
      )}
      {element.domain && <span className="meta-chip meta-chip--domain" title="领域">{element.domain}</span>}
      {tags.slice(0, 4).map(tag => (
        <span key={tag} className="meta-chip meta-chip--tag">#{tag}</span>
      ))}
      {updated && (
        <span className="meta-time" title={element.metadata.updatedAt}>
          {model ? `${model} · ` : ""}{updated}更新
        </span>
      )}
      {versionCount !== null && versionCount > 0 && (
        <span
          className="meta-history"
          title={element.metadata.aiSessionId ?? ""}
        >
          ↻ {versionCount} 个历史版本
        </span>
      )}
    </div>
  );
}

// ──────── shared body utilities ────────

interface BodyUtils {
  bindContext: (title: string, text: string, className?: string) => {
    className: string;
    onContextMenu: (event: MouseEvent<HTMLElement>) => void;
    title: string;
  };
  renderActionableText: (title: string, text: ReactNode, rawText: string) => ReactNode;
  renderActionableList: (items: string[], kind: string, className: string) => ReactNode;
  childrenCount: number;
  onOpenChildren: () => void;
}

// ──────── ConceptBody ────────

function ConceptBody({ element, u }: { element: Element; u: BodyUtils }) {
  const c = asRecord(element.content);
  const oneSentence = asText(c.oneSentence);
  const coreExplain = asText(c.coreExplain);
  const whyMatters = asText(c.whyMatters);
  const beginner = asText(c.beginnerExplain);
  const keyPoints = asTextList(c.keyPoints);
  const goals = asTextList(c.learningGoals);
  const examples = asTextList(c.examples);
  const misconceptions = asTextList(c.misconceptions);
  const mechanisms = asObjectList(c.mechanisms);
  const exercises = asObjectList(c.exercises);
  const nextSteps = asTextList(c.nextSteps);
  const learningPoints = [...goals, ...keyPoints].slice(0, 6);

  return (
    <>
      <article className="content-section">
        <h3>1. 定义</h3>
        {oneSentence
          ? u.renderActionableText("定义", oneSentence, oneSentence)
          : <p className="content-empty">尚无一句话定义。可点击「细化」让 AI 生成。</p>}
        {beginner && (
          <div {...u.bindContext("小白理解版", beginner, "callout knowledge-actionable")}>
            <strong>小白理解版</strong>
            <p>{beginner}</p>
          </div>
        )}
        <h3>2. 核心解释</h3>
        {coreExplain
          ? u.renderActionableText("核心解释", coreExplain, coreExplain)
          : <p className="content-empty">尚无核心解释。</p>}
        {whyMatters && (
          <>
            <h3>3. 为什么重要</h3>
            {u.renderActionableText("为什么重要", whyMatters, whyMatters)}
          </>
        )}
      </article>

      <article className="content-section content-section--wide">
        {mechanisms.length > 0 && (
          <>
            <h3>4. 关键机制</h3>
            <ol className="mechanism-flow">
              {mechanisms.map((step, i) => (
                <li key={i} {...u.bindContext("关键机制", asText(step.label) ?? "")}>
                  <span className="mechanism-step-num">{i + 1}</span>
                  <div>
                    <strong>{asText(step.label) ?? "（未命名）"}</strong>
                    {asText(step.description) && <p>{asText(step.description)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        {learningPoints.length > 0 && (
          <>
            <h3>5. 学习重点</h3>
            {u.renderActionableList(learningPoints, "学习重点", "check-list")}
          </>
        )}
        {exercises.length > 0 && (
          <>
            <h3>6. 练习</h3>
            <ul className="exercise-list">
              {exercises.map((ex, i) => (
                <li key={i} {...u.bindContext("练习", asText(ex.prompt) ?? "")}>
                  <p>{asText(ex.prompt)}</p>
                  {asText(ex.hint) && <em>提示：{asText(ex.hint)}</em>}
                </li>
              ))}
            </ul>
          </>
        )}
      </article>

      <aside className="content-section content-section--side">
        {examples.length > 0 && (
          <>
            <h3>例子</h3>
            {u.renderActionableList(examples.slice(0, 4), "例子", "dot-list")}
          </>
        )}
        {misconceptions.length > 0 && (
          <>
            <h3>常见误区</h3>
            {u.renderActionableList(misconceptions.slice(0, 4), "常见误区", "warn-list")}
          </>
        )}
        <h3>下一步</h3>
        {nextSteps.length > 0
          ? u.renderActionableList(nextSteps.slice(0, 3), "下一步", "dot-list")
          : <p className="content-empty">尚未给出明确下一步。</p>}
        {u.childrenCount > 0 && (
          <button className="next-button" type="button" onClick={u.onOpenChildren}>
            查看下层 {u.childrenCount} 个方向
            <span>→</span>
          </button>
        )}
      </aside>
    </>
  );
}

// ──────── TopicBody ────────

function TopicBody({ element, u }: { element: Element; u: BodyUtils }) {
  const c = asRecord(element.content);
  const intro = asText(c.intro);
  const beginner = asText(c.beginnerExplain);
  const goals = asTextList(c.learningGoals);
  const modules = asObjectList(c.coreModules);
  const recommendedPaths = asTextList(c.recommendedPaths);

  return (
    <>
      <article className="content-section">
        <h3>1. 主题引言</h3>
        {intro
          ? u.renderActionableText("引言", intro, intro)
          : <p className="content-empty">主题尚无引言。</p>}
        {beginner && (
          <div {...u.bindContext("小白理解版", beginner, "callout knowledge-actionable")}>
            <strong>小白理解版</strong>
            <p>{beginner}</p>
          </div>
        )}
        {goals.length > 0 && (
          <>
            <h3>2. 学习目标</h3>
            {u.renderActionableList(goals, "学习目标", "check-list")}
          </>
        )}
      </article>

      <article className="content-section content-section--wide">
        <h3>3. 核心模块</h3>
        {modules.length > 0 ? (
          <table className="knowledge-table">
            <thead>
              <tr><th>模块</th><th>说明</th><th>学习重点</th></tr>
            </thead>
            <tbody>
              {modules.map((row, i) => (
                <tr key={asText(row.id) ?? i} {...u.bindContext(asText(row.title) ?? "模块", asText(row.description) ?? "")}>
                  <td>{asText(row.title) ?? asText(row.id) ?? "未命名"}</td>
                  <td>{asText(row.description) ?? "—"}</td>
                  <td>{asText(row.focus) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="content-empty">尚未定义核心模块。</p>}
      </article>

      <aside className="content-section content-section--side">
        {recommendedPaths.length > 0 && (
          <>
            <h3>推荐学习路径</h3>
            {u.renderActionableList(recommendedPaths, "推荐路径", "dot-list")}
          </>
        )}
        {u.childrenCount > 0 && (
          <button className="next-button" type="button" onClick={u.onOpenChildren}>
            进入第一层 {u.childrenCount} 个模块
            <span>→</span>
          </button>
        )}
      </aside>
    </>
  );
}

// ──────── StepBody ────────

function StepBody({ element, u }: { element: Element; u: BodyUtils }) {
  const c = asRecord(element.content);
  const goal = asText(c.goal) ?? asText(c.oneSentence);
  const preconditions = asTextList(c.preconditions);
  const steps = asObjectList(c.steps);
  const completionCriteria = asTextList(c.completionCriteria);
  const commonFailures = asTextList(c.commonFailures);
  const nextAction = asText(c.nextAction);

  return (
    <>
      <article className="content-section">
        <h3>1. 步骤目标</h3>
        {goal
          ? u.renderActionableText("步骤目标", goal, goal)
          : <p className="content-empty">尚无目标说明。</p>}
        {preconditions.length > 0 && (
          <>
            <h3>2. 前置条件</h3>
            {u.renderActionableList(preconditions, "前置条件", "check-list")}
          </>
        )}
      </article>

      <article className="content-section content-section--wide">
        <h3>3. 操作步骤</h3>
        {steps.length > 0 ? (
          <ol className="step-list">
            {steps.map((step, i) => {
              const n = typeof step.n === "number" ? step.n : i + 1;
              const action = asText(step.action) ?? "（未填）";
              const check = asText(step.check);
              return (
                <li key={i} {...u.bindContext(`步骤 ${n}`, action)}>
                  <span className="step-num">{n}</span>
                  <div>
                    <p>{action}</p>
                    {check && <em>验证：{check}</em>}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : <p className="content-empty">尚未拆分操作步骤。</p>}
      </article>

      <aside className="content-section content-section--side">
        {completionCriteria.length > 0 && (
          <>
            <h3>完成标准</h3>
            {u.renderActionableList(completionCriteria, "完成标准", "check-list")}
          </>
        )}
        {commonFailures.length > 0 && (
          <>
            <h3>常见失败点</h3>
            {u.renderActionableList(commonFailures, "失败点", "warn-list")}
          </>
        )}
        {nextAction && (
          <>
            <h3>下一步动作</h3>
            {u.renderActionableText("下一步动作", nextAction, nextAction)}
          </>
        )}
      </aside>
    </>
  );
}

// ──────── PracticeBody ────────

function PracticeBody({ element, u }: { element: Element; u: BodyUtils }) {
  const c = asRecord(element.content);
  const productPositioning = asText(c.productPositioning);
  const targetAudience = asText(c.targetAudience);
  const needs = asTextList(c.needs);
  const competitors = asObjectList(c.competitors);
  const mvpFeatures = asTextList(c.mvpFeatures);
  const implementationPath = asTextList(c.implementationPath);
  // Practice elements often also carry concept-like fields when AI mixes them
  const oneSentence = asText(c.oneSentence);
  const fallbackPositioning = productPositioning ?? oneSentence;

  return (
    <>
      <article className="content-section">
        <h3>1. 产品定位</h3>
        {fallbackPositioning
          ? u.renderActionableText("产品定位", fallbackPositioning, fallbackPositioning)
          : <p className="content-empty">尚无定位描述。</p>}
        {targetAudience && (
          <>
            <h3>2. 目标用户</h3>
            {u.renderActionableText("目标用户", targetAudience, targetAudience)}
          </>
        )}
        {needs.length > 0 && (
          <>
            <h3>3. 用户需求</h3>
            {u.renderActionableList(needs, "用户需求", "check-list")}
          </>
        )}
      </article>

      <article className="content-section content-section--wide">
        <h3>4. MVP 功能</h3>
        {mvpFeatures.length > 0
          ? u.renderActionableList(mvpFeatures, "MVP 功能", "check-list")
          : <p className="content-empty">尚未拆分 MVP 功能。</p>}
        {implementationPath.length > 0 && (
          <>
            <h3>5. 实现路径</h3>
            <ol className="step-list">
              {implementationPath.map((stage, i) => (
                <li key={i} {...u.bindContext("实现路径", stage)}>
                  <span className="step-num">{i + 1}</span>
                  <div><p>{stage}</p></div>
                </li>
              ))}
            </ol>
          </>
        )}
      </article>

      <aside className="content-section content-section--side">
        {competitors.length > 0 && (
          <>
            <h3>竞品</h3>
            <ul className="warn-list">
              {competitors.map((cmp, i) => (
                <li key={i} {...u.bindContext("竞品", `${asText(cmp.name)}: ${asText(cmp.takeaway)}`)}>
                  <strong>{asText(cmp.name) ?? "未命名"}</strong>
                  {asText(cmp.takeaway) && <p>{asText(cmp.takeaway)}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        {u.childrenCount > 0 && (
          <button className="next-button" type="button" onClick={u.onOpenChildren}>
            查看下层 {u.childrenCount} 个分支
            <span>→</span>
          </button>
        )}
      </aside>
    </>
  );
}

// ──────── Generic fallback body for unsupported types ────────

function GenericBody({ element, u }: { element: Element; u: BodyUtils }) {
  const c = asRecord(element.content);
  const oneSentence = asText(c.oneSentence) ?? asText(c.intro);
  const coreExplain = asText(c.coreExplain) ?? asText(c.description);
  return (
    <article className="content-section">
      <h3>定义</h3>
      {oneSentence
        ? u.renderActionableText("定义", oneSentence, oneSentence)
        : <p className="content-empty">尚无描述。</p>}
      {coreExplain && (
        <>
          <h3>说明</h3>
          {u.renderActionableText("说明", coreExplain, coreExplain)}
        </>
      )}
      <p className="content-empty">
        元类型「{element.type}」当前没有专属布局，已用通用模板。
      </p>
    </article>
  );
}

// ──────── Main panel ────────

export function ElementContentPanel({ element, childrenCount, currentLevel, onOpenChildren }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const refine = useStore(s => s.refine);
  const expand = useStore(s => s.expand);
  const extend = useStore(s => s.extend);
  const generatePaths = useStore(s => s.generatePaths);
  const inflightForThis = useStore(s => {
    for (const op of s.inflight.values()) {
      if (op.elementId === element.id) return op;
    }
    return null;
  });

  useEffect(() => {
    if (!isFullscreen && !contextTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
        setContextTarget(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, contextTarget]);

  useEffect(() => {
    if (!contextTarget) return;
    const close = () => setContextTarget(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextTarget]);

  useEffect(() => {
    if (!lastAction) return;
    const timer = window.setTimeout(() => setLastAction(null), 1600);
    return () => window.clearTimeout(timer);
  }, [lastAction]);

  function openContextMenu(event: MouseEvent<HTMLElement>, title: string, text: string) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 224;
    setContextTarget({
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
      title, text,
    });
  }

  async function runContextAction(action: string) {
    if (!contextTarget) return;
    setContextTarget(null);
    switch (action) {
      case "细化":
        setLastAction(`AI 正在细化 · ${element.title}`);
        await refine(element.id, 3);
        setLastAction(`细化完成 · ${element.title}`);
        return;
      case "延伸": {
        const direction = window.prompt(`朝什么方向延伸「${element.title}」？`, contextTarget.title);
        if (!direction || !direction.trim()) return;
        setLastAction(`AI 正在延伸 · ${element.title}`);
        await extend(element.id, direction.trim(), 3);
        setLastAction(`延伸完成 · ${element.title}`);
        return;
      }
      case "展开分支":
        setLastAction(`AI 正在展开 · ${element.title}`);
        await expand(element.id, 4);
        setLastAction(`展开完成 · ${element.title}`);
        return;
      case "生成路径":
        setLastAction(`AI 正在生成路径 · ${element.title}`);
        await generatePaths(element.id);
        setLastAction(`路径已生成 · ${element.title}`);
        return;
      default:
        setLastAction(`${action} · ${contextTarget.title}`);
    }
  }

  const u: BodyUtils = {
    bindContext: (title, text, className = "knowledge-actionable") => ({
      className,
      onContextMenu: (event: MouseEvent<HTMLElement>) => openContextMenu(event, title, text),
      title: "右击打开元信息操作",
    }),
    renderActionableText: (title, text, rawText) => (
      <p {...u.bindContext(title, rawText)}>{text}</p>
    ),
    renderActionableList: (items, kind, className) => (
      <ul className={className}>
        {items.map(item => (
          <li key={item} {...u.bindContext(kind, item)}>{item}</li>
        ))}
      </ul>
    ),
    childrenCount,
    onOpenChildren,
  };

  const renderBody = () => {
    // Dispatch by element.type, but fall back to ConceptBody when the AI
    // gave us concept-shaped content (oneSentence/coreExplain) on a non-concept
    // element. This happens because the expand/generate prompts sometimes
    // emit concept fields for practice/step elements.
    const c = asRecord(element.content);
    const hasConceptShape = asText(c.oneSentence) !== null || asText(c.coreExplain) !== null;
    const hasTopicShape = asText(c.intro) !== null || asObjectList(c.coreModules).length > 0;
    const hasStepShape = asText(c.goal) !== null || asObjectList(c.steps).length > 0;
    const hasPracticeShape = asText(c.productPositioning) !== null || asTextList(c.mvpFeatures).length > 0;

    switch (element.type) {
      case "topic":
        if (hasTopicShape) return <TopicBody element={element} u={u} />;
        if (hasConceptShape) return <ConceptBody element={element} u={u} />;
        return <GenericBody element={element} u={u} />;
      case "concept":
        return <ConceptBody element={element} u={u} />;
      case "step":
        if (hasStepShape) return <StepBody element={element} u={u} />;
        return hasConceptShape ? <ConceptBody element={element} u={u} /> : <GenericBody element={element} u={u} />;
      case "practice":
      case "project":
        if (hasPracticeShape) return <PracticeBody element={element} u={u} />;
        return hasConceptShape ? <ConceptBody element={element} u={u} /> : <GenericBody element={element} u={u} />;
      default:
        return hasConceptShape ? <ConceptBody element={element} u={u} /> : <GenericBody element={element} u={u} />;
    }
  };

  const renderContextMenu = () => contextTarget && typeof document !== "undefined"
    ? createPortal(
        <div
          className="knowledge-context-menu"
          style={{ left: contextTarget.x, top: contextTarget.y }}
          role="menu"
          onClick={event => event.stopPropagation()}
        >
          <div className="knowledge-context-menu__head">
            <strong>{contextTarget.title}</strong>
            <span>{contextTarget.text}</span>
          </div>
          {["细化", "延伸", "展开分支", "生成路径"].map(action => (
            <button
              key={action}
              type="button"
              role="menuitem"
              disabled={inflightForThis !== null}
              onClick={() => void runContextAction(action)}
            >
              {action}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  const renderPanel = (fullscreen = false) => (
    <section className={`element-content${fullscreen ? " is-fullscreen" : ""}`} aria-hidden={!fullscreen && isFullscreen ? true : undefined}>
      <header className="element-content__head">
        <div className="node-glyph" aria-hidden="true">
          <Icon name={iconForElement(element.type, element.title)} />
        </div>
        <div className="element-head-main">
          <div className="element-title-row">
            <h2>{element.title}</h2>
            <span className="level-badge">L{currentLevel}</span>
          </div>
          {element.subtitle && <p>{element.subtitle}</p>}
          <MetaStrip element={element} />
        </div>
        <div className="element-content__actions">
          {inflightForThis && (
            <span className="element-inflight-badge" title={inflightForThis.delta.slice(-200)}>
              AI {inflightForThis.kind} 中…
            </span>
          )}
          <button
            className="quiet-button"
            type="button"
            disabled={inflightForThis !== null}
            onClick={() => void runContextAction("细化")}
          >细化</button>
          <button
            className="quiet-button"
            type="button"
            disabled={inflightForThis !== null}
            onClick={() => void runContextAction("展开分支")}
          >展开</button>
          <button
            className="quiet-button"
            type="button"
            disabled={inflightForThis !== null}
            onClick={() => void runContextAction("延伸")}
          >延伸</button>
          <button
            aria-label={fullscreen ? "还原元信息详情框" : "放大元信息详情框"}
            className="quiet-button quiet-button--icon"
            title={fullscreen ? "还原" : "放大"}
            type="button"
            onClick={() => setIsFullscreen(value => !value)}
          >
            <Icon name="expand" />
          </button>
        </div>
      </header>

      <div className="element-content__grid">
        {renderBody()}
      </div>
    </section>
  );

  return (
    <>
      {renderPanel(false)}
      {renderContextMenu()}
      {lastAction && typeof document !== "undefined"
        ? createPortal(<div className="knowledge-action-toast">{lastAction}</div>, document.body)
        : null}
      {isFullscreen && typeof document !== "undefined"
        ? createPortal(renderPanel(true), document.body)
        : null}
    </>
  );
}

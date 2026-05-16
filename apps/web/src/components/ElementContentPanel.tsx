import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Element } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import { useStore } from "../state/store.js";
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

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ContentRecord
    : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function moduleRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ContentRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map(item => ({
      title: asText(item.title) ?? asText(item.id) ?? "未命名模块",
      description: asText(item.description) ?? asText(item.summary) ?? "等待补充",
      focus: asText(item.focus) ?? asText(item.learningFocus) ?? "建立理解",
    }));
}

function contentSections(element: Element) {
  const content = asRecord(element.content);
  const goals = asTextList(content.learningGoals);
  const keyPoints = asTextList(content.keyPoints);
  const examples = asTextList(content.examples);
  const misconceptions = asTextList(content.misconceptions);
  const nextSteps = asTextList(content.nextSteps);

  return {
    oneSentence: asText(content.oneSentence) ?? asText(content.intro),
    coreExplain: asText(content.coreExplain) ?? asText(content.description),
    whyMatters: asText(content.whyMatters),
    beginner: asText(content.beginnerExplain) ?? asText(content.simpleExplain),
    modules: moduleRows(content.coreModules),
    goals,
    keyPoints,
    examples,
    misconceptions,
    nextSteps,
  };
}

function fallbackBeginner(element: Element, oneSentence: string | null) {
  if (oneSentence) return `可以先把「${element.title}」理解为：${oneSentence}`;
  return `先抓住「${element.title}」的核心含义，再沿着它的下层方向逐步展开。`;
}

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
  const sections = contentSections(element);
  const learningPoints = [
    ...sections.goals,
    ...sections.keyPoints,
    ...(sections.whyMatters ? [sections.whyMatters] : []),
  ].slice(0, 6);
  const examples = sections.examples.length > 0
    ? sections.examples
    : [`用一个真实问题检验你是否理解「${element.title}」。`];
  const misconceptions = sections.misconceptions.length > 0
    ? sections.misconceptions
    : [`不要只记住名词，要能说清「${element.title}」在整体结构里的作用。`];
  const nextSteps = sections.nextSteps.length > 0
    ? sections.nextSteps
    : childrenCount > 0
      ? [`查看下层 ${childrenCount} 个方向。`]
      : ["继续细化这个元，补充更具体的分支。"];

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
      title,
      text,
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
        const direction = window.prompt(
          `朝什么方向延伸「${element.title}」？`,
          contextTarget.title,
        );
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

  const bindContext = (title: string, text: string, className = "knowledge-actionable") => ({
    className,
    onContextMenu: (event: MouseEvent<HTMLElement>) => openContextMenu(event, title, text),
    title: "右击打开元信息操作",
  });

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

  const renderActionableList = (items: string[], kind: string, className: string) => (
    <ul className={className}>
      {items.map(item => (
        <li key={item} {...bindContext(kind, item)}>{item}</li>
      ))}
    </ul>
  );

  const renderKnowledgeList = (items: string[]) => (
    <div className="knowledge-list">
      {items.map(point => (
        <span key={point} {...bindContext("知识组成", point)}>{point}</span>
      ))}
    </div>
  );

  const renderActionableText = (title: string, text: ReactNode, rawText: string) => (
    <p {...bindContext(title, rawText)}>{text}</p>
  );

  const renderPanel = (fullscreen = false) => (
    <section className={`element-content${fullscreen ? " is-fullscreen" : ""}`} aria-hidden={!fullscreen && isFullscreen ? true : undefined}>
      <header className="element-content__head">
        <div className="node-glyph" aria-hidden="true">
          <Icon name={iconForElement(element.type, element.title)} />
        </div>
        <div>
          <div className="element-title-row">
            <h2>{element.title}</h2>
            <span>L{currentLevel}</span>
            <span>{element.type}</span>
          </div>
          {element.subtitle && <p>{element.subtitle}</p>}
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
        <article className="content-section">
          <h3>1. 定义</h3>
          {renderActionableText("定义", sections.oneSentence ?? `${element.title} 是当前知识树中的一个关键知识元。`, sections.oneSentence ?? `${element.title} 是当前知识树中的一个关键知识元。`)}

          <div {...bindContext("小白理解版", sections.beginner ?? fallbackBeginner(element, sections.oneSentence), "callout knowledge-actionable")}>
            <strong>小白理解版</strong>
            <p>{sections.beginner ?? fallbackBeginner(element, sections.oneSentence)}</p>
          </div>

          <h3>2. 核心解释</h3>
          {renderActionableText("核心解释", sections.coreExplain ?? `围绕「${element.title}」继续展开时，需要先理解它的边界、组成和适用场景。`, sections.coreExplain ?? `围绕「${element.title}」继续展开时，需要先理解它的边界、组成和适用场景。`)}
        </article>

        <article className="content-section content-section--wide">
          <h3>3. 知识组成</h3>
          {sections.modules.length > 0 ? (
            <table className="knowledge-table">
              <thead>
                <tr>
                  <th>组成</th>
                  <th>作用</th>
                  <th>学习重点</th>
                </tr>
              </thead>
              <tbody>
                {sections.modules.map(row => (
                  <tr key={row.title} {...bindContext(row.title, `${row.description}；${row.focus}`)}>
                    <td>{row.title}</td>
                    <td>{row.description}</td>
                    <td>{row.focus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            renderKnowledgeList(learningPoints.length > 0
              ? learningPoints
              : ["概念边界", "关键机制", "典型应用", "下一层分支"])
          )}

          <h3>4. 学习重点</h3>
          {renderActionableList((learningPoints.length > 0 ? learningPoints : [
              `理解「${element.title}」解决什么问题`,
              `区分它和相邻知识元的关系`,
              "能用自己的话复述核心机制",
              "能找到一个真实应用场景",
            ]), "学习重点", "check-list")}
        </article>

        <aside className="content-section content-section--side">
          <h3>5. 例子</h3>
          {renderActionableList(examples.slice(0, 4), "例子", "dot-list")}

          <h3>6. 常见误区</h3>
          {renderActionableList(misconceptions.slice(0, 4), "常见误区", "warn-list")}

          <h3>7. 下一步可展开</h3>
          <button className="next-button" type="button" onClick={onOpenChildren}>
            {nextSteps[0]}
            <span>→</span>
          </button>
        </aside>
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

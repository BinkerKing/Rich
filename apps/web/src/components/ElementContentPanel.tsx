import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Element, ElementType, RichnessLevel } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import { elementTypeLabel } from "./elementLabels.js";
import { ContextRail } from "./ContextRail.js";
import { HistoryModal } from "./HistoryModal.js";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import "./components.css";

type ContentRecord = Record<string, unknown>;

interface ContextTarget { x: number; y: number; title: string; text: string }

interface Props {
  element: Element;
  childrenCount: number;
  currentLevel: number;
  onOpenChildren: () => void;
  onSelect?: (id: string) => void;
}

// ──────── primitive helpers ────────

function asRecord(v: unknown): ContentRecord {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as ContentRecord) : {};
}
function asText(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function asTextList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
}
function asObjectList(v: unknown): ContentRecord[] {
  return Array.isArray(v)
    ? v.filter((x): x is ContentRecord => Boolean(x) && typeof x === "object" && !Array.isArray(x))
    : [];
}

function formatRelativeTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`;
  return new Date(t).toISOString().slice(0, 10);
}

// ──────── Visual primitives (used by all bodies) ────────

interface SectionDef { id: string; label: string }

function BodyShell({
  sections,
  children,
}: {
  sections: SectionDef[];
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const articleRef = useRef<HTMLElement | null>(null);

  // Scroll-spy: find which section is currently in view
  useEffect(() => {
    if (sections.length === 0) return;
    const root = articleRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { root: root.closest(".element-content__scroll") as globalThis.Element | null, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    for (const def of sections) {
      const node = document.getElementById(`section-${def.id}`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [sections]);

  function jumpTo(id: string) {
    const node = document.getElementById(`section-${id}`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="body-layout">
      {sections.length > 1 && (
        <aside className="body-toc" aria-label="本元目录">
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={activeId === s.id ? "is-active" : ""}
                  onClick={() => jumpTo(s.id)}
                >
                  <span className="toc-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="toc-label">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      )}
      <article ref={articleRef} className="body-article">
        {children}
      </article>
    </div>
  );
}

function SectionBlock({
  id, num, title, children,
}: { id: string; num: number; title: string; children: ReactNode }) {
  return (
    <section id={`section-${id}`} className="body-section">
      <h2 className="body-section-h">
        <span className="body-section-num">{String(num).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

type CalloutKind = "tip" | "insight" | "example" | "warning" | "info";
function Callout({ kind, title, children }: { kind: CalloutKind; title?: string; children: ReactNode }) {
  const icons: Record<CalloutKind, string> = {
    tip: "💡", insight: "💎", example: "✦", warning: "⚠", info: "ⓘ",
  };
  return (
    <div className={`callout callout--${kind}`}>
      <span className="callout-icon" aria-hidden="true">{icons[kind]}</span>
      <div className="callout-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

function Lead({ text }: { text: string }) {
  return <p className="body-lead">{text}</p>;
}

function Prose({ text }: { text: string }) {
  // Split paragraphs on \n\n
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return <>{paragraphs.map((p, i) => <p key={i} className="body-prose">{p}</p>)}</>;
}

// ──────── MetaStrip ────────

function RichnessGauge({ level }: { level: RichnessLevel }) {
  return (
    <span className="richness-gauge" aria-label={`内容深度 ${level}/5`} title={`内容深度 ${level}/5`}>
      {[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= level ? "is-on" : ""} />)}
    </span>
  );
}

function MetaStrip({ element, onOpenHistory }: { element: Element; onOpenHistory: () => void }) {
  const [versionCount, setVersionCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.listVersions(element.id)
      .then(list => { if (!cancelled) setVersionCount(list.length); })
      .catch(() => { if (!cancelled) setVersionCount(null); });
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
        <span className="meta-chip meta-chip--difficulty">
          难度 · {difficulty === "low" ? "低" : difficulty === "mid" ? "中" : "高"}
        </span>
      )}
      {element.domain && <span className="meta-chip meta-chip--domain">{element.domain}</span>}
      {tags.slice(0, 4).map(tag => (
        <span key={tag} className="meta-chip meta-chip--tag">#{tag}</span>
      ))}
      {updated && (
        <span className="meta-time" title={element.metadata.updatedAt}>
          {model ? `${model} · ` : ""}{updated}更新
        </span>
      )}
      {versionCount !== null && versionCount > 0 && (
        <button type="button" className="meta-history is-clickable" onClick={onOpenHistory} title="点击查看历史版本">
          ↻ {versionCount} 个历史版本
        </button>
      )}
    </div>
  );
}

// ──────── Type-specific body components ────────

interface BodyProps { element: Element; childrenCount: number; onOpenChildren: () => void }

function ConceptBody({ element, childrenCount, onOpenChildren }: BodyProps) {
  const c = asRecord(element.content);
  const oneSentence = asText(c.oneSentence);
  const coreExplain = asText(c.coreExplain);
  const whyMatters = asText(c.whyMatters);
  const beginner = asText(c.beginnerExplain);
  const mechanisms = asObjectList(c.mechanisms);
  const examples = asTextList(c.examples);
  const misconceptions = asTextList(c.misconceptions);
  const keyPoints = asTextList(c.keyPoints);
  const goals = asTextList(c.learningGoals);
  const nextSteps = asTextList(c.nextSteps);
  const studyFocus = [...goals, ...keyPoints].slice(0, 6);

  // build dynamic section list
  const sections: SectionDef[] = useMemo(() => {
    const out: SectionDef[] = [];
    if (oneSentence || beginner) out.push({ id: "what", label: "是什么" });
    if (coreExplain) out.push({ id: "how", label: "核心解释" });
    if (whyMatters) out.push({ id: "why", label: "为什么重要" });
    if (mechanisms.length > 0) out.push({ id: "mechanism", label: "关键机制" });
    if (examples.length > 0) out.push({ id: "examples", label: "典型例子" });
    if (misconceptions.length > 0) out.push({ id: "warning", label: "易混点" });
    if (studyFocus.length > 0) out.push({ id: "focus", label: "学习重点" });
    out.push({ id: "next", label: "下一步" });
    return out;
  }, [oneSentence, beginner, coreExplain, whyMatters, mechanisms.length, examples.length, misconceptions.length, studyFocus.length]);

  return (
    <BodyShell sections={sections}>
      <SectionBlock id="what" num={1} title="是什么">
        {oneSentence ? <Lead text={oneSentence} /> : <p className="content-empty">尚无一句话定义。可点击「细化」让 AI 生成。</p>}
        {beginner && <Callout kind="tip" title="小白理解版">{beginner}</Callout>}
      </SectionBlock>

      {coreExplain && (
        <SectionBlock id="how" num={2} title="核心解释">
          <Prose text={coreExplain} />
        </SectionBlock>
      )}

      {whyMatters && (
        <SectionBlock id="why" num={coreExplain ? 3 : 2} title="为什么重要">
          <Callout kind="insight" title="关键洞察"><Prose text={whyMatters} /></Callout>
        </SectionBlock>
      )}

      {mechanisms.length > 0 && (
        <SectionBlock id="mechanism" num={sections.findIndex(s => s.id === "mechanism") + 1} title="关键机制">
          <ol className="mechanism-flow mechanism-flow--prose">
            {mechanisms.map((step, i) => (
              <li key={i}>
                <span className="mechanism-step-num">{i + 1}</span>
                <div>
                  <strong>{asText(step.label) ?? "未命名"}</strong>
                  {asText(step.description) && <p>{asText(step.description)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </SectionBlock>
      )}

      {examples.length > 0 && (
        <SectionBlock id="examples" num={sections.findIndex(s => s.id === "examples") + 1} title="典型例子">
          <div className="example-grid">
            {examples.map((ex, i) => (
              <Callout key={i} kind="example" title={`例 ${i + 1}`}>{ex}</Callout>
            ))}
          </div>
        </SectionBlock>
      )}

      {misconceptions.length > 0 && (
        <SectionBlock id="warning" num={sections.findIndex(s => s.id === "warning") + 1} title="常见易混点">
          {misconceptions.map((m, i) => (
            <Callout key={i} kind="warning">{m}</Callout>
          ))}
        </SectionBlock>
      )}

      {studyFocus.length > 0 && (
        <SectionBlock id="focus" num={sections.findIndex(s => s.id === "focus") + 1} title="学习重点">
          <ul className="check-list">
            {studyFocus.map(p => <li key={p}>{p}</li>)}
          </ul>
        </SectionBlock>
      )}

      <SectionBlock id="next" num={sections.length} title="下一步">
        {nextSteps.length > 0 ? (
          <ul className="dot-list">{nextSteps.map(s => <li key={s}>{s}</li>)}</ul>
        ) : null}
        {childrenCount > 0 && (
          <button className="cta-button" type="button" onClick={onOpenChildren}>
            进入下层 · {childrenCount} 个方向
            <span>→</span>
          </button>
        )}
      </SectionBlock>
    </BodyShell>
  );
}

function TopicBody({ element, childrenCount, onOpenChildren }: BodyProps) {
  const c = asRecord(element.content);
  const intro = asText(c.intro);
  const beginner = asText(c.beginnerExplain);
  const goals = asTextList(c.learningGoals);
  const modules = asObjectList(c.coreModules);
  const recommendedPaths = asTextList(c.recommendedPaths);

  const sections: SectionDef[] = useMemo(() => [
    { id: "intro", label: "主题介绍" },
    ...(goals.length > 0 ? [{ id: "goals", label: "学完能做什么" }] : []),
    ...(modules.length > 0 ? [{ id: "modules", label: "核心模块" }] : []),
    ...(recommendedPaths.length > 0 ? [{ id: "paths", label: "推荐路径" }] : []),
  ], [goals.length, modules.length, recommendedPaths.length]);

  return (
    <BodyShell sections={sections}>
      <SectionBlock id="intro" num={1} title="主题介绍">
        {intro ? (
          <>
            <Lead text={intro.split("\n")[0]} />
            {intro.includes("\n") && <Prose text={intro.split("\n").slice(1).join("\n")} />}
          </>
        ) : <p className="content-empty">尚无主题介绍。</p>}
        {beginner && <Callout kind="tip" title="小白理解版">{beginner}</Callout>}
      </SectionBlock>

      {goals.length > 0 && (
        <SectionBlock id="goals" num={2} title="学完能做什么">
          <ul className="check-list check-list--big">
            {goals.map(g => <li key={g}>{g}</li>)}
          </ul>
        </SectionBlock>
      )}

      {modules.length > 0 && (
        <SectionBlock id="modules" num={sections.findIndex(s => s.id === "modules") + 1} title="核心模块">
          <div className="module-grid">
            {modules.map((m, i) => (
              <article key={asText(m.id) ?? i} className="module-card">
                <header>{asText(m.title) ?? asText(m.id) ?? "未命名"}</header>
                <p>{asText(m.description) ?? "—"}</p>
                {asText(m.focus) && <em>学习重点：{asText(m.focus)}</em>}
              </article>
            ))}
          </div>
        </SectionBlock>
      )}

      {recommendedPaths.length > 0 && (
        <SectionBlock id="paths" num={sections.findIndex(s => s.id === "paths") + 1} title="推荐路径">
          <ul className="dot-list">
            {recommendedPaths.map(p => <li key={p}>{p}</li>)}
          </ul>
        </SectionBlock>
      )}

      {childrenCount > 0 && (
        <button className="cta-button" type="button" onClick={onOpenChildren}>
          进入第一层 · {childrenCount} 个模块
          <span>→</span>
        </button>
      )}
    </BodyShell>
  );
}

function StepBody({ element, childrenCount, onOpenChildren }: BodyProps) {
  const c = asRecord(element.content);
  const goal = asText(c.goal) ?? asText(c.oneSentence);
  const preconditions = asTextList(c.preconditions);
  const steps = asObjectList(c.steps);
  const completionCriteria = asTextList(c.completionCriteria);
  const commonFailures = asTextList(c.commonFailures);
  const nextAction = asText(c.nextAction);

  const sections: SectionDef[] = [
    { id: "goal", label: "步骤目标" },
    ...(preconditions.length > 0 ? [{ id: "pre", label: "前置条件" }] : []),
    ...(steps.length > 0 ? [{ id: "steps", label: "操作步骤" }] : []),
    ...(completionCriteria.length > 0 ? [{ id: "criteria", label: "完成标准" }] : []),
    ...(commonFailures.length > 0 ? [{ id: "fail", label: "常见失败" }] : []),
    ...(nextAction ? [{ id: "next", label: "下一步" }] : []),
  ];

  return (
    <BodyShell sections={sections}>
      <SectionBlock id="goal" num={1} title="步骤目标">
        {goal ? <Lead text={goal} /> : <p className="content-empty">尚无目标说明。</p>}
      </SectionBlock>

      {preconditions.length > 0 && (
        <SectionBlock id="pre" num={2} title="前置条件">
          <ul className="check-list">{preconditions.map(p => <li key={p}>{p}</li>)}</ul>
        </SectionBlock>
      )}

      {steps.length > 0 && (
        <SectionBlock id="steps" num={sections.findIndex(s => s.id === "steps") + 1} title="操作步骤">
          <ol className="recipe-list">
            {steps.map((s, i) => {
              const n = typeof s.n === "number" ? s.n : i + 1;
              const action = asText(s.action) ?? "（未填）";
              const check = asText(s.check);
              return (
                <li key={i}>
                  <span className="recipe-num">{n}</span>
                  <div>
                    <p className="recipe-action">{action}</p>
                    {check && <Callout kind="info" title="验证">{check}</Callout>}
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionBlock>
      )}

      {completionCriteria.length > 0 && (
        <SectionBlock id="criteria" num={sections.findIndex(s => s.id === "criteria") + 1} title="完成标准">
          <Callout kind="insight">
            <ul className="check-list">{completionCriteria.map(c => <li key={c}>{c}</li>)}</ul>
          </Callout>
        </SectionBlock>
      )}

      {commonFailures.length > 0 && (
        <SectionBlock id="fail" num={sections.findIndex(s => s.id === "fail") + 1} title="常见失败点">
          {commonFailures.map((f, i) => <Callout key={i} kind="warning">{f}</Callout>)}
        </SectionBlock>
      )}

      {nextAction && (
        <SectionBlock id="next" num={sections.length} title="下一步动作">
          <Prose text={nextAction} />
          {childrenCount > 0 && (
            <button className="cta-button" type="button" onClick={onOpenChildren}>
              查看下层 · {childrenCount} 个分支
              <span>→</span>
            </button>
          )}
        </SectionBlock>
      )}
    </BodyShell>
  );
}

function PracticeBody({ element, childrenCount, onOpenChildren }: BodyProps) {
  const c = asRecord(element.content);
  const productPositioning = asText(c.productPositioning);
  const targetAudience = asText(c.targetAudience);
  const needs = asTextList(c.needs);
  const competitors = asObjectList(c.competitors);
  const mvpFeatures = asTextList(c.mvpFeatures);
  const implementationPath = asTextList(c.implementationPath);
  const oneSentence = asText(c.oneSentence);
  const pitch = productPositioning ?? oneSentence;

  const sections: SectionDef[] = [
    { id: "pitch", label: "项目定位" },
    ...(needs.length > 0 ? [{ id: "needs", label: "核心需求" }] : []),
    ...(mvpFeatures.length > 0 ? [{ id: "mvp", label: "MVP 功能" }] : []),
    ...(implementationPath.length > 0 ? [{ id: "impl", label: "实现路径" }] : []),
    ...(competitors.length > 0 ? [{ id: "competitors", label: "竞品" }] : []),
  ];

  return (
    <BodyShell sections={sections}>
      <SectionBlock id="pitch" num={1} title="项目定位">
        {pitch ? <Lead text={pitch} /> : <p className="content-empty">尚无定位描述。</p>}
        {targetAudience && <Callout kind="info" title="目标用户">{targetAudience}</Callout>}
      </SectionBlock>

      {needs.length > 0 && (
        <SectionBlock id="needs" num={2} title="核心需求">
          <ul className="check-list">{needs.map(n => <li key={n}>{n}</li>)}</ul>
        </SectionBlock>
      )}

      {mvpFeatures.length > 0 && (
        <SectionBlock id="mvp" num={sections.findIndex(s => s.id === "mvp") + 1} title="MVP 功能">
          <div className="mvp-grid">
            {mvpFeatures.map((feat, i) => (
              <article key={i} className="mvp-card">
                <span className="mvp-num">F{i + 1}</span>
                <p>{feat}</p>
              </article>
            ))}
          </div>
        </SectionBlock>
      )}

      {implementationPath.length > 0 && (
        <SectionBlock id="impl" num={sections.findIndex(s => s.id === "impl") + 1} title="实现路径">
          <ol className="phase-timeline">
            {implementationPath.map((phase, i) => (
              <li key={i}>
                <span className="phase-num">阶段 {i + 1}</span>
                <p>{phase}</p>
              </li>
            ))}
          </ol>
        </SectionBlock>
      )}

      {competitors.length > 0 && (
        <SectionBlock id="competitors" num={sections.findIndex(s => s.id === "competitors") + 1} title="竞品">
          <table className="competitor-table">
            <thead><tr><th>竞品</th><th>可借鉴</th></tr></thead>
            <tbody>
              {competitors.map((cmp, i) => (
                <tr key={i}>
                  <td><strong>{asText(cmp.name) ?? "未命名"}</strong></td>
                  <td>{asText(cmp.takeaway) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>
      )}

      {childrenCount > 0 && (
        <button className="cta-button" type="button" onClick={onOpenChildren}>
          查看下层 · {childrenCount} 个分支
          <span>→</span>
        </button>
      )}
    </BodyShell>
  );
}

function GenericBody({ element, childrenCount, onOpenChildren }: BodyProps) {
  const c = asRecord(element.content);
  const oneSentence = asText(c.oneSentence) ?? asText(c.intro);
  const coreExplain = asText(c.coreExplain) ?? asText(c.description);
  const sections: SectionDef[] = [{ id: "what", label: "内容" }];
  return (
    <BodyShell sections={sections}>
      <SectionBlock id="what" num={1} title="内容">
        {oneSentence ? <Lead text={oneSentence} /> : <p className="content-empty">尚无描述。</p>}
        {coreExplain && <Prose text={coreExplain} />}
        <Callout kind="info">元类型「{element.type}」尚无专属布局，已用通用模板。</Callout>
        {childrenCount > 0 && (
          <button className="cta-button" type="button" onClick={onOpenChildren}>
            查看下层 · {childrenCount} 个分支
            <span>→</span>
          </button>
        )}
      </SectionBlock>
    </BodyShell>
  );
}

// ──────── Main panel ────────

export function ElementContentPanel({ element, childrenCount, currentLevel, onOpenChildren, onSelect }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const refine = useStore(s => s.refine);
  const expand = useStore(s => s.expand);
  const extend = useStore(s => s.extend);
  const inflightForThis = useStore(s => {
    for (const op of s.inflight.values()) if (op.elementId === element.id) return op;
    return null;
  });

  useEffect(() => {
    if (!isFullscreen && !contextTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsFullscreen(false); setContextTarget(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, contextTarget]);

  useEffect(() => {
    if (!lastAction) return;
    const t = window.setTimeout(() => setLastAction(null), 1600);
    return () => window.clearTimeout(t);
  }, [lastAction]);

  async function runQuickAction(action: "细化" | "展开" | "延伸") {
    setLastAction(`AI 正在${action} · ${element.title}`);
    try {
      if (action === "细化") await refine(element.id, 3);
      else if (action === "展开") await expand(element.id, 4);
      else if (action === "延伸") {
        const dir = window.prompt(`朝什么方向延伸「${element.title}」？`, "类似概念对比");
        if (!dir || !dir.trim()) { setLastAction(null); return; }
        await extend(element.id, dir.trim(), 3);
      }
      setLastAction(`${action}完成 · ${element.title}`);
    } catch (e) {
      setLastAction(`${action}失败：${String(e)}`);
    }
  }

  const renderBody = () => {
    const c = asRecord(element.content);
    const hasConcept = asText(c.oneSentence) !== null || asText(c.coreExplain) !== null;
    const hasTopic = asText(c.intro) !== null || asObjectList(c.coreModules).length > 0;
    const hasStep = asText(c.goal) !== null || asObjectList(c.steps).length > 0;
    const hasPractice = asText(c.productPositioning) !== null || asTextList(c.mvpFeatures).length > 0;
    const props = { element, childrenCount, onOpenChildren };
    switch (element.type) {
      case "topic":
        if (hasTopic) return <TopicBody {...props} />;
        if (hasConcept) return <ConceptBody {...props} />;
        return <GenericBody {...props} />;
      case "concept":
        return <ConceptBody {...props} />;
      case "step":
        if (hasStep) return <StepBody {...props} />;
        return hasConcept ? <ConceptBody {...props} /> : <GenericBody {...props} />;
      case "practice":
      case "project":
        if (hasPractice) return <PracticeBody {...props} />;
        return hasConcept ? <ConceptBody {...props} /> : <GenericBody {...props} />;
      default:
        return hasConcept ? <ConceptBody {...props} /> : <GenericBody {...props} />;
    }
  };

  const renderPanel = (fullscreen = false) => (
    <section
      className={`element-content element-content--type-${element.type}${fullscreen ? " is-fullscreen" : ""}`}
      aria-hidden={!fullscreen && isFullscreen ? true : undefined}
    >
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
          <MetaStrip element={element} onOpenHistory={() => setHistoryOpen(true)} />
        </div>
        <div className="element-content__actions">
          {inflightForThis && (
            <span className="element-inflight-badge" title={inflightForThis.delta.slice(-200)}>
              AI {inflightForThis.kind} 中…
            </span>
          )}
          <button className="quiet-button" type="button" disabled={inflightForThis !== null} onClick={() => void runQuickAction("细化")}>细化</button>
          <button className="quiet-button" type="button" disabled={inflightForThis !== null} onClick={() => void runQuickAction("展开")}>展开</button>
          <button className="quiet-button" type="button" disabled={inflightForThis !== null} onClick={() => void runQuickAction("延伸")}>延伸</button>
          <button
            aria-label={fullscreen ? "还原" : "放大"}
            className="quiet-button quiet-button--icon"
            type="button"
            onClick={() => setIsFullscreen(v => !v)}
          >
            <Icon name="expand" />
          </button>
        </div>
      </header>

      <div className="element-content__scroll">
        <div className="element-content__three-col">
          <div className="three-col-body">
            {renderBody()}
          </div>
          <aside className="three-col-context" aria-label="上下文信息">
            <ContextRail element={element} onSelect={onSelect ?? (() => undefined)} />
          </aside>
        </div>
      </div>
    </section>
  );

  return (
    <>
      {renderPanel(false)}
      {lastAction && typeof document !== "undefined"
        ? createPortal(<div className="knowledge-action-toast">{lastAction}</div>, document.body)
        : null}
      {isFullscreen && typeof document !== "undefined"
        ? createPortal(renderPanel(true), document.body)
        : null}
      {historyOpen && <HistoryModal element={element} onClose={() => setHistoryOpen(false)} />}
    </>
  );
}

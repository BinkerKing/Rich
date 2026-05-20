import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Element, ElementType, RichnessLevel, QARecord } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import { elementTypeLabel } from "./elementLabels.js";
import { ContextRail } from "./ContextRail.js";
import { HistoryModal } from "./HistoryModal.js";
import { AnnotationLayer } from "./AnnotationLayer.js";
import { AskPopup } from "./AskPopup.js";
import { EmbeddedTaskList } from "./EmbeddedTaskList.js";
import { MermaidDiagram } from "./MermaidDiagram.js";
import { renderSectionBlocks } from "./SectionRenderer.js";
import type { DynamicSection } from "@ke/domain";
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
  /** Rendered learning-sidebar to embed inside the panel ONLY when fullscreen
   *  (in the inline layout the LearningSidebar is already shown beside the panel,
   *  so we don't want to double it up). */
  leftSidebarFullscreen?: ReactNode;
  /** Imperative open signal — when this number changes, the detail panel
   *  enters fullscreen. Used by the knowledge map's right-click "打开". */
  openSignal?: number;
  /** Hide the fullscreen toggle (expand/restore) icon. Used when the panel is
   *  opened from outside the tree view (e.g. 早报 深入了解) where shrinking back
   *  to the inline tree layout wouldn't make sense. */
  hideFullscreenToggle?: boolean;
  /** Called after a successful delete. Lets the caller navigate elsewhere
   *  (e.g. 早报 视图) since the now-deleted element can't be shown anymore. */
  onAfterDelete?: () => void;
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
  elementId,
  contentVersion,
}: {
  sections: SectionDef[];
  children: ReactNode;
  /** When given, mount the AnnotationLayer scoped to this body's article. */
  elementId?: string;
  contentVersion?: unknown;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const articleRef = useRef<HTMLElement | null>(null);

  // Scroll-spy: find which section is currently in view.
  // Scope to THIS body's article, so multiple instances (e.g. inline + fullscreen)
  // don't fight over the same section IDs.
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
      const node = root.querySelector(`#section-${CSS.escape(def.id)}`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [sections]);

  function jumpTo(id: string) {
    const root = articleRef.current;
    if (!root) return;
    const node = root.querySelector(`#section-${CSS.escape(id)}`) as HTMLElement | null;
    if (!node) return;
    const scroller = node.closest(".element-content__scroll") as HTMLElement | null;
    if (!scroller) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const nodeTop = node.getBoundingClientRect().top;
    const scrollerTop = scroller.getBoundingClientRect().top;
    const target = scroller.scrollTop + (nodeTop - scrollerTop) - 8;
    scroller.scrollTo({ top: target, behavior: "smooth" });
  }

  const hasTOC = sections.length >= 1;
  return (
    <div className={`body-layout${hasTOC ? "" : " body-layout--no-toc"}`}>
      {hasTOC && (
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
      {elementId && (
        <AnnotationLayer elementId={elementId} articleRef={articleRef} contentVersion={contentVersion} />
      )}
    </div>
  );
}

/**
 * Context exposed to SectionBlock so each section can:
 *  - render the Q&A cards anchored to it
 *  - open the ask popup with its anchor when right-clicked
 *  - delete its own QAs
 */
export interface QAContextValue {
  qaForSection: (sectionId: string) => QARecord[];
  qaForAnnotation: (annotationId: string) => QARecord[];
  openAsk: (info: { sectionId: string; sectionTitle: string; contextText: string; x: number; y: number }) => void;
  openAskForAnnotation: (info: { annotationId: string; markedText: string; x: number; y: number }) => void;
  deleteQA: (id: string) => void;
}
export const QAContext = createContext<QAContextValue | null>(null);

function SectionBlock({
  id, num, title, children,
}: { id: string; num: number; title: string; children: ReactNode }) {
  const qaCtx = useContext(QAContext);
  const sectionRef = useRef<HTMLElement | null>(null);
  const qaList = qaCtx?.qaForSection(id) ?? [];

  // Pull a short text snippet from the section's text-bearing children to send
  // to the AI as context. We grab the section's rendered textContent up to ~600 chars.
  function sendAsk(e: MouseEvent<HTMLElement>) {
    if (!qaCtx) return;
    // Don't fire on right-clicks targeting nested context menus or annotations —
    // the AnnotationLayer handles those (marks + their own menu).
    const t = e.target as HTMLElement;
    if (t.closest(".ke-annotation, .ke-annotation-menu, .section-context-menu")) return;
    // If the user has text selected, the AnnotationLayer should win (so the
    // user can highlight / underline). Don't show the section-level ask menu
    // in that case to avoid two overlapping menus.
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    e.preventDefault();
    const text = sectionRef.current?.textContent?.replace(/\s+/g, " ").trim().slice(0, 600) ?? "";
    qaCtx.openAsk({ sectionId: id, sectionTitle: title, contextText: text, x: e.clientX, y: e.clientY });
  }

  return (
    <section id={`section-${id}`} className="body-section" ref={sectionRef} onContextMenu={sendAsk}>
      <h2 className="body-section-h">
        <span className="body-section-num">{String(num).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
      {qaList.map(qa => (
        <article key={qa.id} className="inline-qa">
          <header className="inline-qa__head">
            <span className="inline-qa__badge">答疑</span>
            <span>{qa.aiModel ?? "AI"}</span>
            <button
              type="button"
              className="inline-qa__delete"
              aria-label="删除答疑"
              title="删除答疑"
              onClick={() => qaCtx?.deleteQA(qa.id)}
            >×</button>
          </header>
          <div className="inline-qa__q">Q：{qa.question}</div>
          <div className="inline-qa__a">{qa.answer}</div>
        </article>
      ))}
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

/** The element's glyph icon — clickable to toggle favorite. When favorited,
 *  the icon switches to a gold star and the chip itself takes a gold tint. */
function FavoriteGlyph({ element }: { element: Element }) {
  const isFavorited = useStore(s => s.favorites.includes(element.id));
  const toggleFavorite = useStore(s => s.toggleFavorite);
  return (
    <button
      type="button"
      className={`node-glyph node-glyph--favoritable${isFavorited ? " is-favorited" : ""}`}
      title={isFavorited ? "取消收藏" : "加入收藏夹"}
      aria-pressed={isFavorited}
      onClick={e => { e.stopPropagation(); toggleFavorite(element.id); }}
    >
      <Icon name={isFavorited ? "spark" : iconForElement(element.type, element.title)} />
    </button>
  );
}

function RichnessGauge({ level }: { level: RichnessLevel }) {
  return (
    <span className="richness-gauge" aria-label={`内容深度 ${level}/5`} title={`内容深度 ${level}/5`}>
      {[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= level ? "is-on" : ""} />)}
    </span>
  );
}

// Element types offered in the inline type picker. Matches the home-page
// manual creation set; other esoteric types stay editable via direct API.
const TYPE_OPTIONS: Array<{ value: ElementType; label: string }> = [
  { value: "topic" as ElementType,    label: "主题元" },
  { value: "concept" as ElementType,  label: "概念元" },
  { value: "practice" as ElementType, label: "实战元" },
  { value: "project" as ElementType,  label: "项目元" },
  { value: "step" as ElementType,     label: "步骤元" },
  { value: "report" as ElementType,   label: "报告元" },
  { value: "guide" as ElementType,    label: "攻略元" },
];
const DIFFICULTY_OPTIONS: Array<{ value: "low" | "mid" | "high" | null; label: string }> = [
  { value: null,  label: "未设置" },
  { value: "low", label: "低" },
  { value: "mid", label: "中" },
  { value: "high", label: "高" },
];

function MetaStrip({ element, onOpenHistory }: { element: Element; onOpenHistory: () => void }) {
  const [versionCount, setVersionCount] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState<"type" | "difficulty" | null>(null);
  const editElement = useStore(s => s.editElement);
  useEffect(() => {
    let cancelled = false;
    api.listVersions(element.id)
      .then(list => { if (!cancelled) setVersionCount(list.length); })
      .catch(() => { if (!cancelled) setVersionCount(null); });
    return () => { cancelled = true; };
  }, [element.id]);

  // Close picker on outside click or Escape.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      // Click events: ignore clicks that originated inside a picker (the
      // picker has data-meta-picker; chip click toggles open/close itself).
      if (e instanceof MouseEvent) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-meta-picker]")) return;
      }
      setPickerOpen(null);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("click", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("click", close);
    };
  }, [pickerOpen]);

  const typeLabel = elementTypeLabel(element.type as ElementType);
  const richness = element.metadata.richness as RichnessLevel;
  const created = formatRelativeTime(element.metadata.createdAt);
  const updated = formatRelativeTime(element.metadata.updatedAt);
  const sameTime = element.metadata.createdAt === element.metadata.updatedAt;
  const model = element.metadata.aiModel;
  const author = element.metadata.generatedBy === "user" ? "用户" : (model ?? "AI");
  const tags = element.tags ?? [];
  const difficulty = element.difficulty;

  return (
    <div className="meta-strip" role="group" aria-label="元信息">
      <span className="meta-chip-wrap">
        <button
          type="button"
          className={`meta-chip meta-chip--type meta-chip--editable type-${element.type}`}
          title="点击修改元类型"
          onClick={e => { e.stopPropagation(); setPickerOpen(pickerOpen === "type" ? null : "type"); }}
        >
          {typeLabel}
          <em className="meta-chip__caret" aria-hidden="true">▾</em>
        </button>
        {pickerOpen === "type" && (
          <div className="meta-picker" data-meta-picker role="menu" aria-label="选择元类型">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`meta-picker__opt${element.type === opt.value ? " is-current" : ""}`}
                onClick={() => {
                  void editElement(element.id, { type: opt.value });
                  setPickerOpen(null);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </span>
      <RichnessGauge level={richness} />
      <span className="meta-chip-wrap">
        <button
          type="button"
          className="meta-chip meta-chip--difficulty meta-chip--editable"
          title="点击修改难度"
          onClick={e => { e.stopPropagation(); setPickerOpen(pickerOpen === "difficulty" ? null : "difficulty"); }}
        >
          难度 · {difficulty ? (difficulty === "low" ? "低" : difficulty === "mid" ? "中" : "高") : "未设置"}
          <em className="meta-chip__caret" aria-hidden="true">▾</em>
        </button>
        {pickerOpen === "difficulty" && (
          <div className="meta-picker" data-meta-picker role="menu" aria-label="选择难度">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                className={`meta-picker__opt${difficulty === opt.value ? " is-current" : ""}${!difficulty && opt.value === null ? " is-current" : ""}`}
                onClick={() => {
                  void editElement(element.id, { difficulty: opt.value });
                  setPickerOpen(null);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </span>
      {/* difficulty rendered via editable chip above */}
      {element.domain && <span className="meta-chip meta-chip--domain">{element.domain}</span>}
      {tags.slice(0, 4).map(tag => (
        <span key={tag} className="meta-chip meta-chip--tag">#{tag}</span>
      ))}
      <span className="meta-author" title={`generatedBy=${element.metadata.generatedBy}${model ? ` · model=${model}` : ""}`}>
        {author}
      </span>
      {created && (
        <span className="meta-time" title={element.metadata.createdAt}>
          创建 {created}
        </span>
      )}
      {!sameTime && updated && (
        <span className="meta-time" title={element.metadata.updatedAt}>
          更新 {updated}
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

interface BodyProps {
  element: Element;
  childrenCount: number;
  onOpenChildren: () => void;
  /** Called when a child element is picked from the children popover. */
  onSelectChild?: (id: string) => void;
}

/**
 * Shared CTA that replaces the plain "查看下层 · N 个 →" buttons. Click reveals
 * a small popover listing each direct child element; clicking a child either
 * jumps to its detail (via onSelectChild) or, falling back to the legacy
 * behavior, sets it as center (onOpenChildren).
 */
function ChildrenCTA({
  element, childrenCount, onOpenChildren, onSelectChild,
}: {
  element: Element;
  childrenCount: number;
  onOpenChildren: () => void;
  onSelectChild?: (id: string) => void;
}) {
  const relations = useStore(s => s.relations);
  const elements = useStore(s => s.elements);
  const [open, setOpen] = useState(false);
  const children = useMemo(() => {
    return relations
      .filter(r => r.kind === "child" && r.from === element.id)
      .map(r => elements.get(r.to))
      .filter((e): e is Element => Boolean(e));
  }, [relations, elements, element.id]);

  if (childrenCount <= 0) return null;

  return (
    <div className="children-cta-wrap">
      <button
        type="button"
        className={`cta-button${open ? " is-open" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        {open ? "收起下层" : `查看下层 · ${childrenCount} 个`}
        <span>{open ? "▾" : "→"}</span>
      </button>
      {open && (
        <ul className="children-cta-list" role="menu">
          {children.map(c => (
            <li key={c.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (onSelectChild) onSelectChild(c.id);
                  else onOpenChildren();
                }}
              >
                <span className="mini-icon"><Icon name={iconForElement(c.type, c.title)} /></span>
                <span className="children-cta-list__title">{c.title}</span>
                <span className="children-cta-list__type">{elementTypeLabel(c.type as ElementType)}</span>
              </button>
            </li>
          ))}
          <li className="children-cta-list__center">
            <button type="button" onClick={() => { setOpen(false); onOpenChildren(); }}>
              全部进入下层 · 把当前元设为中心
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

interface ExtraSectionData { id: string; title: string; body: string; order?: number }

interface DiagramData { id: string; title: string; caption?: string; mermaid: string }

/** Pull the optional `sections` array (dynamic AI-chosen layout). */
function collectSections(content: unknown): DynamicSection[] {
  const arr = (content as Record<string, unknown>)?.sections;
  if (!Array.isArray(arr)) return [];
  const out: DynamicSection[] = [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i] as Record<string, unknown>;
    if (typeof s.title !== "string" || !Array.isArray(s.blocks)) continue;
    out.push({
      id: typeof s.id === "string" ? s.id : `sec-${i}`,
      title: s.title,
      blocks: s.blocks as DynamicSection["blocks"],
    });
  }
  return out;
}

/** AI-driven dynamic body: pure sections, no hardcoded section list. */
function SectionsBody({ element, childrenCount, onOpenChildren, onSelectChild }: BodyProps) {
  const sections = useMemo(() => collectSections(element.content), [element.content]);
  const tocSections: SectionDef[] = useMemo(
    () => sections.map(s => ({ id: s.id, label: s.title })),
    [sections],
  );
  return (
    <BodyShell sections={tocSections} elementId={element.id} contentVersion={element.metadata.updatedAt}>
      {sections.map((s, i) => (
        <SectionBlock key={s.id} id={s.id} num={i + 1} title={s.title}>
          {renderSectionBlocks(s)}
        </SectionBlock>
      ))}
      {childrenCount > 0 && (
        <ChildrenCTA element={element} childrenCount={childrenCount} onOpenChildren={onOpenChildren} onSelectChild={onSelectChild} />
      )}
    </BodyShell>
  );
}

/** Pull and normalize the optional `diagrams` array. */
function collectDiagrams(content: unknown): DiagramData[] {
  const arr = asObjectList((content as Record<string, unknown>)?.diagrams);
  const out: DiagramData[] = [];
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i];
    const id = asText(d.id);
    const title = asText(d.title);
    const mermaid = asText(d.mermaid);
    if (!title || !mermaid) continue;
    out.push({ id: id ?? `diagram-${i}`, title, mermaid, caption: asText(d.caption) ?? undefined });
  }
  return out;
}

/** Pull and normalize the optional `extraSections` array off any content shape. */
function collectExtraSections(content: unknown): ExtraSectionData[] {
  const arr = asObjectList((content as Record<string, unknown>)?.extraSections);
  const out: ExtraSectionData[] = [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    const id = asText(s.id);
    const title = asText(s.title);
    const body = asText(s.body);
    if (!title || !body) continue;
    const order = typeof s.order === "number" ? (s.order as number) : undefined;
    out.push({ id: id ?? `extra-${i}`, title, body, order });
  }
  out.sort((a, b) => (a.order ?? 1e6) - (b.order ?? 1e6));
  return out;
}

/** Inline section rendered for each user-added extra section. */
function ExtraSectionBlock({ section, num }: { section: ExtraSectionData; num: number }) {
  return (
    <SectionBlock id={section.id} num={num} title={section.title}>
      <Prose text={section.body} />
    </SectionBlock>
  );
}

function ConceptBody({ element, childrenCount, onOpenChildren, onSelectChild }: BodyProps) {
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
  const extras = useMemo(() => collectExtraSections(element.content), [element.content]);
  const diagrams = useMemo(() => collectDiagrams(element.content), [element.content]);

  // build dynamic section list
  const sections: SectionDef[] = useMemo(() => {
    const out: SectionDef[] = [];
    if (oneSentence || beginner) out.push({ id: "what", label: "是什么" });
    if (coreExplain) out.push({ id: "how", label: "核心解释" });
    if (whyMatters) out.push({ id: "why", label: "为什么重要" });
    if (diagrams.length > 0) out.push({ id: "diagrams", label: "流程图" });
    if (mechanisms.length > 0) out.push({ id: "mechanism", label: "关键机制" });
    if (examples.length > 0) out.push({ id: "examples", label: "典型例子" });
    if (misconceptions.length > 0) out.push({ id: "warning", label: "易混点" });
    if (studyFocus.length > 0) out.push({ id: "focus", label: "学习重点" });
    for (const ex of extras) out.push({ id: ex.id, label: ex.title });
    out.push({ id: "next", label: "下一步" });
    return out;
  }, [oneSentence, beginner, coreExplain, whyMatters, mechanisms.length, examples.length, misconceptions.length, studyFocus.length, extras, diagrams.length]);

  return (
    <BodyShell sections={sections} elementId={element.id} contentVersion={element.metadata.updatedAt}>
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

      {diagrams.length > 0 && (
        <SectionBlock id="diagrams" num={sections.findIndex(s => s.id === "diagrams") + 1} title="流程图">
          {diagrams.map(d => (
            <MermaidDiagram key={d.id} title={d.title} caption={d.caption} code={d.mermaid} />
          ))}
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
          <ol className="example-list">
            {examples.map((ex, i) => (
              <li key={i} className="example-item">
                <span className="example-num">{String(i + 1).padStart(2, "0")}</span>
                <p>{ex}</p>
              </li>
            ))}
          </ol>
        </SectionBlock>
      )}

      {misconceptions.length > 0 && (
        <SectionBlock id="warning" num={sections.findIndex(s => s.id === "warning") + 1} title="常见易混点">
          <div className="warn-grid">
            {misconceptions.map((m, i) => (
              <div key={i} className="warn-card">
                <span className="warn-card__bar" aria-hidden="true" />
                <p>{m}</p>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      {studyFocus.length > 0 && (
        <SectionBlock id="focus" num={sections.findIndex(s => s.id === "focus") + 1} title="学习重点">
          <ul className="check-list check-list--grid">
            {studyFocus.map(p => <li key={p}>{p}</li>)}
          </ul>
        </SectionBlock>
      )}

      {extras.map(ex => (
        <ExtraSectionBlock key={ex.id} section={ex} num={sections.findIndex(s => s.id === ex.id) + 1} />
      ))}

      <SectionBlock id="next" num={sections.length} title="下一步">
        {nextSteps.length > 0 ? (
          <ul className="dot-list">{nextSteps.map(s => <li key={s}>{s}</li>)}</ul>
        ) : null}
        {childrenCount > 0 && (
          <ChildrenCTA element={element} childrenCount={childrenCount} onOpenChildren={onOpenChildren} onSelectChild={onSelectChild} />
        )}
      </SectionBlock>
    </BodyShell>
  );
}

function TopicBody({ element, childrenCount, onOpenChildren, onSelectChild }: BodyProps) {
  const c = asRecord(element.content);
  const intro = asText(c.intro);
  const beginner = asText(c.beginnerExplain);
  const goals = asTextList(c.learningGoals);
  const modules = asObjectList(c.coreModules);
  const recommendedPaths = asTextList(c.recommendedPaths);

  const extras = useMemo(() => collectExtraSections(element.content), [element.content]);
  const diagrams = useMemo(() => collectDiagrams(element.content), [element.content]);
  const sections: SectionDef[] = useMemo(() => [
    { id: "intro", label: "主题介绍" },
    ...(goals.length > 0 ? [{ id: "goals", label: "学完能做什么" }] : []),
    ...(diagrams.length > 0 ? [{ id: "diagrams", label: "流程图" }] : []),
    ...(modules.length > 0 ? [{ id: "modules", label: "核心模块" }] : []),
    ...(recommendedPaths.length > 0 ? [{ id: "paths", label: "推荐路径" }] : []),
    ...extras.map(ex => ({ id: ex.id, label: ex.title })),
  ], [goals.length, modules.length, recommendedPaths.length, extras, diagrams.length]);

  return (
    <BodyShell sections={sections} elementId={element.id} contentVersion={element.metadata.updatedAt}>
      <SectionBlock id="intro" num={1} title="主题介绍">
        {intro ? (() => {
          const firstLine = intro.split("\n")[0] ?? "";
          const stop = firstLine.search(/[。!?！？]/);
          const lead = stop >= 0 ? firstLine.slice(0, stop + 1) : firstLine;
          const rest = (stop >= 0 ? firstLine.slice(stop + 1) + "\n" : "") + intro.split("\n").slice(1).join("\n");
          return (
            <>
              <Lead text={lead} />
              {rest.trim() && <Prose text={rest.trim()} />}
            </>
          );
        })() : <p className="content-empty">尚无主题介绍。</p>}
        {beginner && <Callout kind="tip" title="小白理解版">{beginner}</Callout>}
      </SectionBlock>

      {goals.length > 0 && (
        <SectionBlock id="goals" num={2} title="学完能做什么">
          <ul className="check-list check-list--big">
            {goals.map(g => <li key={g}>{g}</li>)}
          </ul>
        </SectionBlock>
      )}

      {diagrams.length > 0 && (
        <SectionBlock id="diagrams" num={sections.findIndex(s => s.id === "diagrams") + 1} title="流程图">
          {diagrams.map(d => (
            <MermaidDiagram key={d.id} title={d.title} caption={d.caption} code={d.mermaid} />
          ))}
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

      {extras.map(ex => (
        <ExtraSectionBlock key={ex.id} section={ex} num={sections.findIndex(s => s.id === ex.id) + 1} />
      ))}

      {childrenCount > 0 && (
        <ChildrenCTA element={element} childrenCount={childrenCount} onOpenChildren={onOpenChildren} onSelectChild={onSelectChild} />
      )}
    </BodyShell>
  );
}

function StepBody({ element, childrenCount, onOpenChildren, onSelectChild }: BodyProps) {
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
    <BodyShell sections={sections} elementId={element.id} contentVersion={element.metadata.updatedAt}>
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
          <div className="warn-grid">
            {commonFailures.map((f, i) => (
              <div key={i} className="warn-card">
                <span className="warn-card__bar" aria-hidden="true" />
                <p>{f}</p>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      {nextAction && (
        <SectionBlock id="next" num={sections.length} title="下一步动作">
          <Prose text={nextAction} />
          {childrenCount > 0 && (
            <ChildrenCTA element={element} childrenCount={childrenCount} onOpenChildren={onOpenChildren} onSelectChild={onSelectChild} />
          )}
        </SectionBlock>
      )}
    </BodyShell>
  );
}

function PracticeBody({ element, childrenCount, onOpenChildren, onSelectChild }: BodyProps) {
  const c = asRecord(element.content);
  // Practice canonical fields, with graceful fallbacks from concept-shape content
  // (some AI generations produce oneSentence/whyMatters/keyPoints/nextSteps).
  const pitch = asText(c.productPositioning) ?? asText(c.pitch) ?? asText(c.oneSentence);
  const why = asText(c.why) ?? asText(c.whyMatters);
  const targetAudience = asText(c.targetAudience);
  const needs = asTextList(c.needs).length > 0 ? asTextList(c.needs) : asTextList(c.keyPoints);
  const competitors = asObjectList(c.competitors);
  const mvpFeatures = asTextList(c.mvpFeatures);
  const successCriteria = asTextList(c.successCriteria);
  const implementationPath = asTextList(c.implementationPath).length > 0
    ? asTextList(c.implementationPath)
    : asTextList(c.nextSteps);

  const sections: SectionDef[] = [
    { id: "pitch", label: "项目定位" },
    ...(why ? [{ id: "why", label: "为什么做" }] : []),
    ...(needs.length > 0 ? [{ id: "needs", label: "核心需求" }] : []),
    ...(mvpFeatures.length > 0 ? [{ id: "mvp", label: "MVP 功能" }] : []),
    ...(implementationPath.length > 0 ? [{ id: "impl", label: "实现路径" }] : []),
    ...(successCriteria.length > 0 ? [{ id: "success", label: "成功标准" }] : []),
    ...(competitors.length > 0 ? [{ id: "competitors", label: "竞品" }] : []),
  ];

  let n = 0;
  const next = () => ++n;

  return (
    <BodyShell sections={sections} elementId={element.id} contentVersion={element.metadata.updatedAt}>
      <SectionBlock id="pitch" num={next()} title="项目定位">
        {pitch ? <Lead text={pitch} /> : <p className="content-empty">尚无项目定位。点「细化」让 AI 补全实战元结构。</p>}
        {targetAudience && <Callout kind="info" title="目标用户">{targetAudience}</Callout>}
      </SectionBlock>

      {why && (
        <SectionBlock id="why" num={next()} title="为什么做">
          <Callout kind="insight">{why}</Callout>
        </SectionBlock>
      )}

      {needs.length > 0 && (
        <SectionBlock id="needs" num={next()} title="核心需求">
          <ul className="check-list">{needs.map(item => <li key={item}>{item}</li>)}</ul>
        </SectionBlock>
      )}

      {mvpFeatures.length > 0 && (
        <SectionBlock id="mvp" num={next()} title="MVP 功能">
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
        <SectionBlock id="impl" num={next()} title="实现路径">
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

      {successCriteria.length > 0 && (
        <SectionBlock id="success" num={next()} title="成功标准">
          <ul className="check-list">{successCriteria.map(item => <li key={item}>{item}</li>)}</ul>
        </SectionBlock>
      )}

      {competitors.length > 0 && (
        <SectionBlock id="competitors" num={next()} title="竞品">
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
        <ChildrenCTA element={element} childrenCount={childrenCount} onOpenChildren={onOpenChildren} onSelectChild={onSelectChild} />
      )}
    </BodyShell>
  );
}

function ProductDesignBody({ element, childrenCount, onOpenChildren, onSelectChild }: BodyProps) {
  const c = asRecord(element.content);
  const designQuestion = asText(c.designQuestion);
  const positioning = asText(c.positioning);
  const targetAudience = asText(c.targetAudience);
  const needs = asTextList(c.needs);
  const competitors = asObjectList(c.competitors);
  const decisions = asObjectList(c.decisions);
  const mvpScope = asTextList(c.mvpScope);
  const outOfScope = asTextList(c.outOfScope);
  const architectureNote = asText(c.architectureNote);

  const sections: SectionDef[] = [
    { id: "question", label: "设计问题" },
    ...(positioning || targetAudience ? [{ id: "positioning", label: "定位与用户" }] : []),
    ...(needs.length > 0 ? [{ id: "needs", label: "用户需求" }] : []),
    ...(decisions.length > 0 ? [{ id: "decisions", label: "设计决策" }] : []),
    ...(mvpScope.length > 0 || outOfScope.length > 0 ? [{ id: "scope", label: "范围划定" }] : []),
    ...(architectureNote ? [{ id: "arch", label: "架构说明" }] : []),
    ...(competitors.length > 0 ? [{ id: "competitors", label: "竞品参考" }] : []),
  ];

  let n = 0;
  const next = () => ++n;

  return (
    <BodyShell sections={sections} elementId={element.id} contentVersion={element.metadata.updatedAt}>
      <SectionBlock id="question" num={next()} title="设计问题">
        {designQuestion ? <Lead text={designQuestion} /> : <p className="content-empty">尚未明确这块设计要回答什么。</p>}
      </SectionBlock>

      {(positioning || targetAudience) && (
        <SectionBlock id="positioning" num={next()} title="定位与用户">
          {positioning && <Prose text={positioning} />}
          {targetAudience && <Callout kind="info" title="目标用户">{targetAudience}</Callout>}
        </SectionBlock>
      )}

      {needs.length > 0 && (
        <SectionBlock id="needs" num={next()} title="用户需求">
          <ul className="check-list">{needs.map(item => <li key={item}>{item}</li>)}</ul>
        </SectionBlock>
      )}

      {decisions.length > 0 && (
        <SectionBlock id="decisions" num={next()} title="设计决策">
          <div className="decision-list">
            {decisions.map((d, i) => {
              const topic = asText(d.topic) ?? `决策 ${i + 1}`;
              const choice = asText(d.choice);
              const rationale = asText(d.rationale);
              const alternatives = asTextList(d.alternatives);
              return (
                <article key={i} className="decision-card">
                  <header><strong>{topic}</strong>{choice && <span>采用：{choice}</span>}</header>
                  {rationale && <p>{rationale}</p>}
                  {alternatives.length > 0 && (
                    <ul className="dot-list">
                      {alternatives.map(alt => <li key={alt}>备选：{alt}</li>)}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </SectionBlock>
      )}

      {(mvpScope.length > 0 || outOfScope.length > 0) && (
        <SectionBlock id="scope" num={next()} title="范围划定">
          {mvpScope.length > 0 && (
            <Callout kind="tip" title="MVP 范围">
              <ul className="check-list">{mvpScope.map(item => <li key={item}>{item}</li>)}</ul>
            </Callout>
          )}
          {outOfScope.length > 0 && (
            <Callout kind="warning" title="不做">
              <ul className="dot-list">{outOfScope.map(item => <li key={item}>{item}</li>)}</ul>
            </Callout>
          )}
        </SectionBlock>
      )}

      {architectureNote && (
        <SectionBlock id="arch" num={next()} title="架构说明">
          <Prose text={architectureNote} />
        </SectionBlock>
      )}

      {competitors.length > 0 && (
        <SectionBlock id="competitors" num={next()} title="竞品参考">
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
        <ChildrenCTA element={element} childrenCount={childrenCount} onOpenChildren={onOpenChildren} onSelectChild={onSelectChild} />
      )}
    </BodyShell>
  );
}

function GenericBody({ element, childrenCount, onOpenChildren, onSelectChild }: BodyProps) {
  const c = asRecord(element.content);
  const oneSentence = asText(c.oneSentence) ?? asText(c.intro);
  const coreExplain = asText(c.coreExplain) ?? asText(c.description);
  const sections: SectionDef[] = [{ id: "what", label: "内容" }];
  return (
    <BodyShell sections={sections} elementId={element.id} contentVersion={element.metadata.updatedAt}>
      <SectionBlock id="what" num={1} title="内容">
        {oneSentence ? <Lead text={oneSentence} /> : <p className="content-empty">尚无描述。</p>}
        {coreExplain && <Prose text={coreExplain} />}
        <Callout kind="info">元类型「{element.type}」尚无专属布局，已用通用模板。</Callout>
        {childrenCount > 0 && (
          <ChildrenCTA element={element} childrenCount={childrenCount} onOpenChildren={onOpenChildren} onSelectChild={onSelectChild} />
        )}
      </SectionBlock>
    </BodyShell>
  );
}

// ──────── Main panel ────────

type ActionKind = "细化" | "展开" | "延伸" | "反馈";
interface ActionSpec {
  hint: string;
  placeholder: string;
  optional: boolean;
}
const ACTION_SPECS: Record<ActionKind, ActionSpec> = {
  "细化": {
    hint: "细化方向（可留空 = 全面细化）：例 补充 mechanisms / 加几个真实例子 / 重点讲为什么重要。",
    placeholder: "想让 AI 重点改哪一块？",
    optional: true,
  },
  "展开": {
    hint: "展开方向（可留空 = 让 AI 自由展开）：例 我想了解 skill 相关 / 部署相关 / 调试技巧。指定方向时可能展开多层。",
    placeholder: "你想往哪个方向往下深入？",
    optional: true,
  },
  "延伸": {
    hint: "延伸方向（必填）：横向新增与本元相关、平行的兄弟元。例 类似概念对比 / AI 领域类比 / 工程化版本。",
    placeholder: "朝什么方向延伸？",
    optional: false,
  },
  "反馈": {
    hint: "反馈（必填）：哪里讲得不好 / 想怎么改。反馈会进日志（AI 自学习用），并立即让 AI 据此整改这个元。",
    placeholder: "这个元有什么问题？",
    optional: false,
  },
};

export function ElementContentPanel({ element, childrenCount, currentLevel, onOpenChildren, onSelect, leftSidebarFullscreen, openSignal, hideFullscreenToggle, onAfterDelete }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Open imperatively when the parent bumps openSignal (e.g. right-click "打开").
  useEffect(() => {
    if (typeof openSignal === "number" && openSignal > 0) setIsFullscreen(true);
  }, [openSignal]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionKind | null>(null);
  const [pendingInput, setPendingInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Q&A state: list of QAs for the current element + active ask popup, if any.
  const [qaList, setQaList] = useState<QARecord[]>([]);
  const [askPopup, setAskPopup] = useState<{
    anchor: { type: "section"; sectionId: string } | { type: "annotation"; annotationId: string };
    scopeLabel: string;
    contextText: string;
    x: number; y: number;
  } | null>(null);

  // Load QAs whenever the element changes.
  useEffect(() => {
    let cancelled = false;
    setQaList([]);
    api.listQA(element.id)
      .then(list => { if (!cancelled) setQaList(list); })
      .catch(() => { if (!cancelled) setQaList([]); });
    return () => { cancelled = true; };
  }, [element.id]);

  const qaCtxValue = useMemo<QAContextValue>(() => ({
    qaForSection: (sectionId) =>
      qaList.filter(q => q.anchor && q.anchor.type === "section" && q.anchor.sectionId === sectionId),
    qaForAnnotation: (annotationId) =>
      qaList.filter(q => q.anchor && q.anchor.type === "annotation" && q.anchor.annotationId === annotationId),
    openAsk: (info) => setAskPopup({
      anchor: { type: "section", sectionId: info.sectionId },
      scopeLabel: `章节：${info.sectionTitle}`,
      contextText: info.contextText,
      x: info.x, y: info.y,
    }),
    openAskForAnnotation: (info) => setAskPopup({
      anchor: { type: "annotation", annotationId: info.annotationId },
      scopeLabel: `标记：${info.markedText.slice(0, 30)}${info.markedText.length > 30 ? "…" : ""}`,
      contextText: info.markedText,
      x: info.x, y: info.y,
    }),
    deleteQA: async (id: string) => {
      try {
        await api.deleteQA(id);
        setQaList(list => list.filter(q => q.id !== id));
      } catch { /* ignore */ }
    },
  }), [qaList]);
  const refine = useStore(s => s.refine);
  const expand = useStore(s => s.expand);
  const extend = useStore(s => s.extend);
  const feedback = useStore(s => s.feedback);
  const sectionFeedback = useStore(s => s.sectionFeedback);
  const editElement = useStore(s => s.editElement);
  const deleteElement = useStore(s => s.deleteElement);
  const refreshElement = useStore(s => s.refreshElement);

  // Background image engine polling: when the element has image-placeholder
  // blocks marked pending/generating, refresh every 4s until they all clear.
  // Stops on its own once no pending placeholders remain.
  useEffect(() => {
    const c = element.content as { sections?: Array<{ blocks: Array<{ style?: string; status?: string }> }> } | undefined;
    const hasPending = c?.sections?.some(s => s.blocks.some(
      b => b.style === "image-placeholder" && (b.status === "pending" || b.status === "generating"),
    )) ?? false;
    if (!hasPending) return undefined;
    const id = window.setInterval(() => { void refreshElement(element.id); }, 4000);
    return () => window.clearInterval(id);
  }, [element, refreshElement]);
  const allRelations = useStore(s => s.relations);
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

  function openAction(action: ActionKind) {
    if (pendingAction === action) {
      cancelAction();
      return;
    }
    setPendingAction(action);
    setPendingInput("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelAction() {
    setPendingAction(null);
    setPendingInput("");
  }

  async function handleDelete() {
    // Count descendants via local relations so the warning is meaningful.
    const childIndex = new Map<string, string[]>();
    for (const r of allRelations) {
      if (r.kind !== "child") continue;
      const list = childIndex.get(r.from) ?? [];
      list.push(r.to);
      childIndex.set(r.from, list);
    }
    const subtree = new Set<string>();
    const queue = [element.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (subtree.has(cur)) continue;
      subtree.add(cur);
      for (const child of childIndex.get(cur) ?? []) queue.push(child);
    }
    const descCount = subtree.size - 1;
    const msg = descCount > 0
      ? `删除「${element.title}」及其 ${descCount} 个后代元？\n此操作不可撤销。`
      : `删除「${element.title}」？\n此操作不可撤销。`;
    if (!window.confirm(msg)) return;
    // Navigate AWAY first so the parent view (TreeView) doesn't try to render
    // the now-deleted element. Without this, deleteElement clears centerId in
    // the store, TreeView re-renders against the null centerId, and the user
    // sees a blank screen for one frame before onAfterDelete kicks in.
    onAfterDelete?.();
    try {
      await deleteElement(element.id);
    } catch (e) {
      window.alert(`删除失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function submitAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    const spec = ACTION_SPECS[action];
    const raw = pendingInput.trim();
    if (!spec.optional && !raw) return;
    setPendingAction(null);
    setPendingInput("");
    setLastAction(`AI 正在${action} · ${element.title}`);
    try {
      const dir = raw || undefined;
      if (action === "细化") await refine(element.id, 3, dir, "codex");
      else if (action === "展开") await expand(element.id, 4, dir, "codex");
      else if (action === "延伸") await extend(element.id, raw, 3, "codex");
      else if (action === "反馈") await feedback(element.id, raw, "codex");
      setLastAction(`${action}完成 · ${element.title}`);
    } catch (e) {
      setLastAction(`${action}失败：${String(e)}`);
    }
  }

  const renderBody = () => {
    const c = asRecord(element.content);
    const hasConcept = asText(c.oneSentence) !== null || asText(c.coreExplain) !== null;
    const hasStep = asText(c.goal) !== null || asObjectList(c.steps).length > 0;
    const props = { element, childrenCount, onOpenChildren, onSelectChild: onSelect };

    // Dynamic sections take priority: if AI emitted a `sections[]` array,
    // use it verbatim and ignore the per-type layout. Lets travel / fitness /
    // recipe / other non-canonical elements be rendered properly.
    const dyn = collectSections(element.content);
    if (dyn.length > 0) return <SectionsBody {...props} />;

    // Dispatch by declared type. Each body component is responsible for
    // gracefully rendering its own structure (even when fields are missing),
    // so a practice element never looks like a concept just because the AI
    // happened to fill its content with concept-shape keys.
    switch (element.type) {
      case "topic":
        return <TopicBody {...props} />;
      case "concept":
        return <ConceptBody {...props} />;
      case "step":
      case "exercise":
        return hasStep ? <StepBody {...props} /> : <ConceptBody {...props} />;
      case "practice":
      case "project":
        return <PracticeBody {...props} />;
      case "product-design":
        return <ProductDesignBody {...props} />;
      default:
        return hasConcept ? <ConceptBody {...props} /> : <GenericBody {...props} />;
    }
  };

  const renderPanel = (fullscreen = false) => (
    <section
      className={`element-content element-content--type-${element.type}${fullscreen ? " is-fullscreen" : ""}`}
      aria-hidden={!fullscreen && isFullscreen ? true : undefined}
    >
      <header
        className="element-content__head"
        title="双击此处放大 / 还原"
        onDoubleClick={(e) => {
          // Ignore double-clicks on interactive descendants (buttons / inputs / links).
          const target = e.target as HTMLElement;
          if (target.closest("button, input, textarea, a, [role='button'], .meta-strip")) return;
          setIsFullscreen(v => !v);
        }}
      >
        <FavoriteGlyph element={element} />

        <div className="element-head-main">
          <div className="element-title-row">
            <EditableField
              value={element.title}
              kind="title"
              placeholder="（标题）"
              onSave={(next) => editElement(element.id, { title: next })}
            />
            <span className="level-badge">L{currentLevel}</span>
          </div>
          <EditableField
            value={element.subtitle ?? ""}
            kind="subtitle"
            placeholder="（点击添加说明）"
            allowEmpty
            onSave={(next) => editElement(element.id, { subtitle: next })}
          />
          <MetaStrip element={element} onOpenHistory={() => setHistoryOpen(true)} />
        </div>
        <div className="element-content__actions">
          {inflightForThis && (
            <span className="element-inflight-badge" title={inflightForThis.delta.slice(-200)}>
              AI {inflightForThis.kind} 中…
            </span>
          )}
          {([
            { name: "细化" as ActionKind, mod: "refine" },
            { name: "展开" as ActionKind, mod: "expand" },
            { name: "延伸" as ActionKind, mod: "extend" },
            { name: "反馈" as ActionKind, mod: "feedback" },
          ]).map(({ name, mod }) => (
            <button
              key={name}
              className={`quiet-button quiet-button--${mod}${pendingAction === name ? " is-active" : ""}`}
              type="button"
              disabled={inflightForThis !== null}
              onClick={() => openAction(name)}
              title={name === "反馈" ? "对该元提反馈，AI 会立即整改并记录到日志" : undefined}
            >{name}</button>
          ))}
          <button
            aria-label="删除元"
            title="删除该元（连同所有子元）"
            className="quiet-button quiet-button--icon quiet-button--delete"
            type="button"
            onClick={() => void handleDelete()}
          >×</button>
          {!hideFullscreenToggle && (
            <button
              aria-label={fullscreen ? "还原" : "放大"}
              className="quiet-button quiet-button--icon"
              type="button"
              onClick={() => setIsFullscreen(v => !v)}
            >
              <Icon name="expand" />
            </button>
          )}
        </div>
      </header>

      {pendingAction && (
        <div className={`action-input action-input--${
          pendingAction === "细化" ? "refine"
          : pendingAction === "展开" ? "expand"
          : pendingAction === "延伸" ? "extend"
          : "feedback"
        }`}>
          <div className="action-input__hint">
            <strong>{pendingAction}</strong>
            <span>{ACTION_SPECS[pendingAction].hint}</span>
          </div>
          {pendingAction === "细化" && (
            <div className="action-input__chips" role="group" aria-label="常用细化快捷">
              {[
                "用动态 sections 重写，按这个元的天然结构选样式",
                "用流程图说明整体流程",
                "添加一个状态切换流程图",
                "添加章节：场景使用方法",
                "添加章节：最佳实践",
                "添加章节：注意事项",
                "添加章节：与相关概念对比",
                "补充 mechanisms",
                "加几个真实例子",
                "重点讲为什么重要",
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  className="action-chip"
                  onClick={() => setPendingInput(preset)}
                >{preset}</button>
              ))}
            </div>
          )}
          <div className="action-input__row">
            <textarea
              ref={inputRef}
              value={pendingInput}
              onChange={e => setPendingInput(e.target.value)}
              placeholder={ACTION_SPECS[pendingAction].placeholder}
              rows={2}
              onKeyDown={e => {
                if (e.key === "Escape") cancelAction();
                else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitAction();
                }
              }}
            />
            <div className="action-input__buttons">
              <button
                type="button"
                className="quiet-button"
                disabled={!ACTION_SPECS[pendingAction].optional && !pendingInput.trim()}
                onClick={() => void submitAction()}
              >执行</button>
              <button type="button" className="quiet-button quiet-button--ghost" onClick={cancelAction}>取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="element-content__scroll">
        <div className={`element-content__three-col${fullscreen && leftSidebarFullscreen ? " has-nav" : ""}`}>
          {fullscreen && leftSidebarFullscreen && (
            <aside className="three-col-nav" aria-label="学习导航">
              {leftSidebarFullscreen}
            </aside>
          )}
          <div className="three-col-body">
            {renderBody()}
          </div>
          <aside className="three-col-context" aria-label="上下文信息">
            <EmbeddedTaskList elementId={element.id} />
            <ContextRail element={element} onSelect={onSelect ?? (() => undefined)} />
          </aside>
        </div>
      </div>
    </section>
  );

  return (
    <QAContext.Provider value={qaCtxValue}>
      {renderPanel(false)}
      {lastAction && typeof document !== "undefined"
        ? createPortal(<div className="knowledge-action-toast">{lastAction}</div>, document.body)
        : null}
      {isFullscreen && typeof document !== "undefined"
        ? createPortal(renderPanel(true), document.body)
        : null}
      {historyOpen && <HistoryModal element={element} onClose={() => setHistoryOpen(false)} />}
      {askPopup && (
        <AskPopup
          elementId={element.id}
          anchor={askPopup.anchor}
          scopeLabel={askPopup.scopeLabel}
          contextText={askPopup.contextText}
          position={{ x: askPopup.x, y: askPopup.y }}
          onClose={() => setAskPopup(null)}
          onDone={(qa) => setQaList(list => [...list, qa])}
          onFeedback={(fbText) => askPopup.anchor.type === "section"
            ? sectionFeedback(element.id, askPopup.anchor.sectionId, fbText, "codex")
            : feedback(element.id, fbText, "codex")}
        />
      )}
    </QAContext.Provider>
  );
}

/* ---------- Editable title / subtitle (used by the panel head) ---------- */

function EditableField({
  value,
  kind,
  placeholder,
  allowEmpty = false,
  onSave,
}: {
  value: string;
  kind: "title" | "subtitle";
  placeholder?: string;
  allowEmpty?: boolean;
  onSave: (next: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) { el.focus(); el.select(); }
    }
  }, [editing]);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(true);
  }

  async function commit() {
    const next = draft.trim();
    const original = (value ?? "").trim();
    if (next === original) { setEditing(false); return; }
    if (!next && !allowEmpty) { setEditing(false); setDraft(value); return; }
    setSaving(true);
    try { await onSave(next); }
    catch { /* error already surfaced by store */ }
    finally { setSaving(false); setEditing(false); }
  }
  function cancel() { setDraft(value); setEditing(false); }

  const isEmpty = !value;
  const display = isEmpty ? (placeholder ?? "") : value;

  // While viewing, render the ORIGINAL h2/p so all existing styles (font size,
  // weight, family, theme overrides) still match. The pencil button is a
  // sibling so it doesn't disturb the title/subtitle box itself.
  if (!editing) {
    if (kind === "title") {
      return (
        <>
          <h2 className={`editable-title ${isEmpty ? "is-empty" : ""}`}>{display}</h2>
          <button
            type="button"
            className="editable-pencil editable-pencil--title"
            title="修改标题"
            aria-label="修改标题"
            onClick={startEdit}
          >
            <Icon name="pencil" />
          </button>
        </>
      );
    }
    return (
      <p className={`editable-subtitle ${isEmpty ? "is-empty" : ""}`}>
        {display}
        <button
          type="button"
          className="editable-pencil editable-pencil--subtitle"
          title="修改说明"
          aria-label="修改说明"
          onClick={startEdit}
        >
          <Icon name="pencil" />
        </button>
      </p>
    );
  }

  // In editing mode swap the visual element for an input/textarea but keep
  // the same outer tag so layout doesn't jump.
  if (kind === "title") {
    return (
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        className="editable-title-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
          else if (e.key === "Enter") { e.preventDefault(); void commit(); }
        }}
        disabled={saving}
        placeholder={placeholder}
      />
    );
  }
  return (
    <textarea
      ref={inputRef as React.Ref<HTMLTextAreaElement>}
      className="editable-subtitle-input"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === "Escape") { e.preventDefault(); cancel(); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commit(); }
      }}
      disabled={saving}
      placeholder={placeholder}
      rows={2}
    />
  );
}

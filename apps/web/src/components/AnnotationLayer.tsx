import { useContext, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Annotation, AnnotationKind } from "@ke/domain";
import { api } from "../api/client.js";
import { useStore } from "../state/store.js";
import { QAContext } from "./ElementContentPanel.js";
import "./AnnotationLayer.css";

interface Props {
  elementId: string;
  /** Container whose descendants will be annotated. Must be stable. */
  articleRef: RefObject<HTMLElement | null>;
  /** Re-apply marks when content changes (e.g. after refine). Pass the element.content or an updatedAt. */
  contentVersion: unknown;
}

type Menu =
  | { kind: "selection"; x: number; y: number; text: string; before: string; after: string }
  | { kind: "annotation"; x: number; y: number; annotationId: string }
  | null;

const CONTEXT_LEN = 30;

function readContext(node: Node, offset: number, side: "before" | "after"): string {
  // Walk back through previous text nodes' textContent up to CONTEXT_LEN chars.
  const article = (node as Element).closest?.(".body-article") ?? null;
  const walker = document.createTreeWalker(article ?? document.body, NodeFilter.SHOW_TEXT);
  const order: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) order.push(n as Text);
  const idx = order.indexOf(node as Text);
  if (idx < 0) return "";
  if (side === "before") {
    let collected = (node.textContent ?? "").slice(0, offset);
    for (let i = idx - 1; i >= 0 && collected.length < CONTEXT_LEN; i--) {
      collected = (order[i].textContent ?? "") + collected;
    }
    return collected.slice(-CONTEXT_LEN);
  } else {
    let collected = (node.textContent ?? "").slice(offset);
    for (let i = idx + 1; i < order.length && collected.length < CONTEXT_LEN; i++) {
      collected += order[i].textContent ?? "";
    }
    return collected.slice(0, CONTEXT_LEN);
  }
}

/** Apply a single annotation: find the first match (preferring matching context) and wrap it. */
function applyAnnotation(article: HTMLElement, ann: Annotation) {
  if (!ann.text) return;
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const parent = n.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".ke-annotation")) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".body-toc, .qa-panel, .three-col-context, .ke-annotation-analysis")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const text = ann.text;
  // Best-effort: find a text node containing the marked text (whole substring within one text node).
  let node: Text | null = null;
  let nodeIndex = -1;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const t = current as Text;
    const i = t.textContent?.indexOf(text) ?? -1;
    if (i >= 0) {
      // If we have context, prefer the occurrence whose neighborhood matches.
      if (!ann.contextBefore && !ann.contextAfter) {
        node = t; nodeIndex = i; break;
      }
      const before = readContext(t, i, "before");
      const after = readContext(t, i + text.length, "after");
      const ok = (!ann.contextBefore || before.endsWith(ann.contextBefore.slice(-Math.min(10, ann.contextBefore.length))))
        && (!ann.contextAfter || after.startsWith(ann.contextAfter.slice(0, Math.min(10, ann.contextAfter.length))));
      if (ok) { node = t; nodeIndex = i; break; }
      // First match as fallback if nothing better is found
      if (!node) { node = t; nodeIndex = i; }
    }
  }
  if (!node || nodeIndex < 0) return;
  const range = document.createRange();
  range.setStart(node, nodeIndex);
  range.setEnd(node, nodeIndex + text.length);
  const span = document.createElement("span");
  span.className = `ke-annotation ke-annotation--${ann.kind}`;
  span.dataset.annotationId = ann.id;
  span.dataset.annotationKind = ann.kind;
  try {
    range.surroundContents(span);
  } catch {
    // Range crosses boundaries; skip silently. v2 could split nodes.
    return;
  }

  // Inline analysis: render a panel directly after the block containing the mark.
  if (ann.analysis?.body) {
    // Walk up to the nearest direct child of `.body-section` (or the section itself).
    let block: HTMLElement = span;
    while (block.parentElement && block.parentElement !== article) {
      const parent: HTMLElement = block.parentElement;
      if (parent.classList.contains("body-section") || parent === article) break;
      block = parent;
    }
    if (block && block !== article) {
      const panel = document.createElement("aside");
      panel.className = "ke-annotation-analysis";
      panel.dataset.annotationId = ann.id;
      const head = document.createElement("header");
      const badge = document.createElement("span");
      badge.className = "ke-annotation-analysis__badge";
      badge.textContent = "深入分析";
      head.appendChild(badge);
      if (ann.analysis.title) {
        const ttl = document.createElement("strong");
        ttl.textContent = ann.analysis.title;
        head.appendChild(ttl);
      }
      panel.appendChild(head);
      // Render body as paragraphs split on blank lines.
      const paragraphs = ann.analysis.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      for (const p of paragraphs) {
        const para = document.createElement("p");
        para.textContent = p;
        panel.appendChild(para);
      }
      block.insertAdjacentElement("afterend", panel);
    }
  }
}

/** Remove all wrapper spans and inline analysis panels we previously injected. */
function clearAnnotations(article: HTMLElement) {
  article.querySelectorAll<HTMLElement>(".ke-annotation-analysis").forEach(p => p.remove());
  const marks = article.querySelectorAll<HTMLSpanElement>(".ke-annotation");
  marks.forEach(m => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

export function AnnotationLayer({ elementId, articleRef, contentVersion }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [menu, setMenu] = useState<Menu>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const annotationsRef = useRef<Annotation[]>([]);
  annotationsRef.current = annotations;
  const analyzeMarkAction = useStore(s => s.analyzeMark);
  const qaCtx = useContext(QAContext);

  // Load on element change.
  useEffect(() => {
    let cancelled = false;
    setAnnotations([]);
    api.listAnnotations(elementId)
      .then(list => { if (!cancelled) setAnnotations(list); })
      .catch(() => { if (!cancelled) setAnnotations([]); });
    return () => { cancelled = true; };
  }, [elementId]);

  // Cross-instance sync: when ANY AnnotationLayer mutates annotations for the
  // same element (e.g. user marks in fullscreen while inline panel is alive),
  // refetch so both views show the same set of marks.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ elementId: string }>).detail;
      if (!detail || detail.elementId !== elementId) return;
      api.listAnnotations(elementId).then(setAnnotations).catch(() => undefined);
    };
    window.addEventListener("ke-annotations-changed", handler);
    return () => window.removeEventListener("ke-annotations-changed", handler);
  }, [elementId]);

  function broadcastChange() {
    window.dispatchEvent(new CustomEvent("ke-annotations-changed", { detail: { elementId } }));
  }

  // Re-apply marks whenever annotations or content change.
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    clearAnnotations(article);
    // Defer so React's render commits first.
    const t = window.setTimeout(() => {
      for (const a of annotations) applyAnnotation(article, a);
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (article) clearAnnotations(article);
    };
  }, [annotations, contentVersion, articleRef]);

  // Right-click handler for selection-based mark + click on existing mark to remove.
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const existing = target?.closest?.(".ke-annotation") as HTMLElement | null;
      if (existing) {
        e.preventDefault();
        setMenu({ kind: "annotation", x: e.clientX, y: e.clientY, annotationId: existing.dataset.annotationId ?? "" });
        return;
      }
      const sel = window.getSelection();
      const text = sel?.toString() ?? "";
      if (!text.trim() || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!article.contains(range.commonAncestorContainer)) return;
      const before = readContext(range.startContainer, range.startOffset, "before");
      const after = readContext(range.endContainer, range.endOffset, "after");
      e.preventDefault();
      setMenu({ kind: "selection", x: e.clientX, y: e.clientY, text, before, after });
    };
    const onClickAway = () => setMenu(null);
    article.addEventListener("contextmenu", onContext);
    window.addEventListener("click", onClickAway);
    window.addEventListener("scroll", onClickAway, true);
    return () => {
      article.removeEventListener("contextmenu", onContext);
      window.removeEventListener("click", onClickAway);
      window.removeEventListener("scroll", onClickAway, true);
    };
  }, [articleRef]);

  async function addMark(kind: AnnotationKind) {
    if (!menu || menu.kind !== "selection") return;
    setMenu(null);
    try {
      const created = await api.createAnnotation({
        elementId,
        kind,
        text: menu.text,
        contextBefore: menu.before,
        contextAfter: menu.after,
      });
      setAnnotations(list => [...list, created]);
      window.getSelection()?.removeAllRanges();
      broadcastChange();
    } catch { /* surface later */ }
  }

  async function removeMark() {
    if (!menu || menu.kind !== "annotation") return;
    const id = menu.annotationId;
    setMenu(null);
    try {
      await api.deleteAnnotation(id);
      setAnnotations(list => list.filter(a => a.id !== id));
      broadcastChange();
    } catch { /* ignore */ }
  }

  function askMark() {
    if (!menu || menu.kind !== "annotation") return;
    const id = menu.annotationId;
    const ann = annotations.find(a => a.id === id);
    const x = menu.x;
    const y = menu.y;
    setMenu(null);
    if (!ann || !qaCtx) return;
    // Find the section that contains the mark so the answer renders inline
    // under that section (we surface the marked text as scope label).
    const article = articleRef.current;
    const span = article?.querySelector<HTMLElement>(`.ke-annotation[data-annotation-id="${ann.id}"]`);
    const section = span?.closest<HTMLElement>(".body-section");
    const sectionId = section?.id?.replace(/^section-/, "");
    if (sectionId) {
      qaCtx.openAsk({
        sectionId,
        sectionTitle: `标记「${ann.text.slice(0, 24)}${ann.text.length > 24 ? "…" : ""}」`,
        contextText: `用户标记的文字：${ann.text}\n上下文：${ann.contextBefore ?? ""}【${ann.text}】${ann.contextAfter ?? ""}`,
        x, y,
      });
    } else {
      qaCtx.openAskForAnnotation({ annotationId: id, markedText: ann.text, x, y });
    }
  }

  async function analyzeMark() {
    if (!menu || menu.kind !== "annotation") return;
    const id = menu.annotationId;
    const ann = annotations.find(a => a.id === id);
    setMenu(null);
    if (!ann) return;
    setAnalyzing(id);
    try {
      await analyzeMarkAction({
        elementId,
        annotationId: id,
        markedText: ann.text,
        contextBefore: ann.contextBefore,
        contextAfter: ann.contextAfter,
        model: "codex",
      });
    } finally {
      setAnalyzing(null);
    }
  }

  if (!menu) return null;
  return createPortal(
    <div
      className="ke-annotation-menu"
      style={{ left: menu.x, top: menu.y }}
      onClick={e => e.stopPropagation()}
      role="menu"
    >
      {menu.kind === "selection" && (
        <>
          <button type="button" role="menuitem" onClick={() => void addMark("highlight")}>
            <span className="swatch swatch--highlight" /> 高亮
          </button>
          <button type="button" role="menuitem" onClick={() => void addMark("underline")}>
            <span className="swatch swatch--underline" /> 下划线
          </button>
        </>
      )}
      {menu.kind === "annotation" && (
        <>
          <button type="button" role="menuitem" onClick={() => void analyzeMark()}>
            <span className="swatch swatch--analyze" aria-hidden="true" /> 深入分析
          </button>
          <button type="button" role="menuitem" onClick={() => askMark()}>
            <span className="swatch swatch--ask" aria-hidden="true" /> 答疑
          </button>
          <button type="button" role="menuitem" onClick={() => void removeMark()}>
            ✕ 取消标记
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

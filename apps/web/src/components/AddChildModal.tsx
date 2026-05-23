import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Element, Relation } from "@ke/domain";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
import "./AddChildModal.css";

interface Props {
  /** The element under which we're adding / binding a child. */
  parent: Element;
  elements: Map<string, Element>;
  relations: Relation[];
  onClose: () => void;
  onCreate: (title: string) => Promise<void> | void;
  /** Bind an existing top-level element as a child of `parent`. */
  onBind: (elementId: string) => Promise<void> | void;
}

/**
 * Dual-mode child adder for the knowledge tree's right-click "新增下级元":
 *   1. **新建**:  type a title, create a fresh empty element under parent.
 *   2. **绑定已有元**: search top-level elements (those without an incoming
 *      child edge) and click one to attach it under parent. After binding it
 *      stops being a top-level element.
 *
 * Bindable candidates exclude:
 *   - parent itself (no self-loop)
 *   - parent's existing descendants (would create a cycle / orphan subtree)
 */
export function AddChildModal({ parent, elements, relations, onClose, onCreate, onBind }: Props) {
  const [tab, setTab] = useState<"create" | "bind">("create");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Top-level elements = no incoming child edge. Also exclude parent and any
  // of parent's descendants so the user can't accidentally form a cycle.
  const candidates = useMemo(() => {
    const childIds = new Set<string>();
    for (const r of relations) if (r.kind === "child") childIds.add(r.to);
    // Walk parent's subtree to exclude.
    const subtree = new Set<string>([parent.id]);
    const stack = [parent.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const r of relations) {
        if (r.kind === "child" && r.from === id && !subtree.has(r.to)) {
          subtree.add(r.to);
          stack.push(r.to);
        }
      }
    }
    return Array.from(elements.values())
      .filter(el => !childIds.has(el.id) && !subtree.has(el.id))
      .sort((a, b) => (b.metadata?.updatedAt ?? "").localeCompare(a.metadata?.updatedAt ?? ""));
  }, [elements, relations, parent.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, 30);
    return candidates.filter(el => {
      return el.title.toLowerCase().includes(q)
        || (el.subtitle ?? "").toLowerCase().includes(q)
        || el.id.toLowerCase().includes(q);
    }).slice(0, 50);
  }, [candidates, query]);

  async function handleCreate() {
    const t = title.trim();
    if (!t) { setError("标题不能为空"); return; }
    setBusy(true); setError(null);
    try { await onCreate(t); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function handleBind(elementId: string) {
    setBusy(true); setError(null);
    try { await onBind(elementId); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="ac-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ac-modal__panel" onClick={e => e.stopPropagation()}>
        <header className="ac-modal__head">
          <div>
            <strong>新增下级元</strong>
            <em>挂在「{parent.title}」下</em>
          </div>
          <button type="button" className="ac-modal__close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <nav className="ac-modal__tabs">
          <button type="button" className={tab === "create" ? "is-active" : ""} onClick={() => setTab("create")}>
            ✎ 新建一个空元
          </button>
          <button type="button" className={tab === "bind" ? "is-active" : ""} onClick={() => setTab("bind")}>
            🔗 绑定已有一级元
          </button>
        </nav>

        {tab === "create" ? (
          <div className="ac-modal__body">
            <p className="ac-modal__hint">手动创建一个空白下级元,之后可以在元详情页里继续编辑或让 AI 细化。</p>
            <input
              autoFocus
              type="text"
              placeholder="新元标题"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && title.trim()) void handleCreate(); }}
              disabled={busy}
            />
            <div className="ac-modal__actions">
              <button type="button" onClick={onClose} disabled={busy}>取消</button>
              <button type="button" className="ac-modal__primary" onClick={handleCreate} disabled={busy || !title.trim()}>
                {busy ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        ) : (
          <div className="ac-modal__body">
            <p className="ac-modal__hint">
              选一个**还没有父元**的一级元(主题/独立子树根)挂到「{parent.title}」下。
              绑定后它就成了「{parent.title}」的子节点,不再出现在知识树首页的"已有主题"。
              <br />
              候选元 {candidates.length} 个(已自动排除 {parent.title} 自己及其子孙)。
            </p>
            <input
              autoFocus
              type="text"
              placeholder="按标题 / 副标题 / id 搜索…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={busy}
            />
            <div className="ac-modal__results">
              {filtered.length === 0 ? (
                <div className="ac-modal__empty">
                  {query.trim() ? "没匹配到一级元" : "目前没有可绑定的一级元"}
                </div>
              ) : (
                filtered.map(el => (
                  <button
                    key={el.id}
                    type="button"
                    className={`ac-modal__candidate ${elementTypeClass(el.type)}`}
                    onClick={() => void handleBind(el.id)}
                    disabled={busy}
                  >
                    <span className="ac-modal__candidate-type">{elementTypeLabel(el.type)}</span>
                    <strong>{el.title}</strong>
                    {el.subtitle && <em>{el.subtitle}</em>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {error && <div className="ac-modal__error">{error}</div>}
      </div>
    </div>,
    document.body,
  );
}

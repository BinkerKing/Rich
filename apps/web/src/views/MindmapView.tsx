import { useEffect, useMemo, useState } from "react";
import type { MindmapDeckView } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import { TopBar } from "../components/TopBar.js";
import { FooterTaskStrip } from "../components/FooterTaskStrip.js";
import { MindmapPlayer } from "../components/MindmapPlayer.js";
import "./MindmapView.css";

/**
 * Top-level view for the Mindmap PPT subsystem. Every deck IS an element
 * with a `mindmap-embed` section — so the list is just "all elements that
 * have been marked as a PPT", and opening a deck just resolves the indented
 * markdown from that element's current subtree.
 *
 * Two creation paths in the modal:
 *   • from existing element — attach the embed section (no AI)
 *   • from prose — AI generates the element tree, then attaches the section
 */
export function MindmapView() {
  const deckId = useStore(s => s.mindmapDeckId);
  const openMindmap = useStore(s => s.openMindmap);
  const closeMindmap = useStore(s => s.closeMindmap);

  const [decks, setDecks] = useState<MindmapDeckView[]>([]);
  const [activeDeck, setActiveDeck] = useState<MindmapDeckView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (deckId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.listMindmaps();
        if (!cancelled) setDecks(list);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [deckId]);

  useEffect(() => {
    if (!deckId) { setActiveDeck(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const d = await api.getMindmap(deckId);
        if (!cancelled) setActiveDeck(d);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [deckId]);

  useEffect(() => {
    if (!deckId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMindmap(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deckId, closeMindmap]);

  if (deckId && activeDeck) {
    return (
      <div className="tree-view mindmap-shell mindmap-shell--player">
        <header className="tv-topbar mindmap-player-topbar" aria-label="导图 PPT 顶栏" />
        <main className="mindmap-player-wrap">
          <MindmapPlayer source={activeDeck.source} />
        </main>
        <footer className="tv-footer">
          <div>{activeDeck.title} · 来源 {originLabel(activeDeck.origin)}{activeDeck.aiModel ? ` · ${activeDeck.aiModel}` : ""} · 共 {activeDeck.childCount} 个子元 · 按 ESC 返回</div>
          <FooterTaskStrip />
        </footer>
      </div>
    );
  }

  return (
    <div className="tree-view mindmap-shell">
      <TopBar breadcrumb={null} />
      <main className="tv-main mindmap-main">
        {loadError && <div className="mindmap-error">加载失败：{loadError}</div>}
        {decks.length === 0 ? (
          <div className="mindmap-empty">
            还没有导图。可在元右键选择「生成导图 PPT」生成。
          </div>
        ) : (
          <div className="mindmap-grid">
            {decks.map(d => (
              <button key={d.id} type="button" className="mindmap-card" onClick={() => openMindmap(d.id)}>
                <span className="mindmap-card__origin">{originLabel(d.origin)}</span>
                <strong className="mindmap-card__title">{d.title}</strong>
                {d.subtitle && <em className="mindmap-card__sub">{d.subtitle}</em>}
                <span className="mindmap-card__meta">
                  {(d.generatedAt ?? "").slice(0, 10)}
                  {d.childCount > 0 && <span> · {d.childCount} 个子元</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
      <footer className="tv-footer">
        <div>导图 PPT · 共 {decks.length} 份</div>
        <FooterTaskStrip />
      </footer>
      {creating && (
        <CreateMindmapModal
          onClose={() => setCreating(false)}
          onCreated={(deck) => { setCreating(false); setDecks(prev => [deck, ...prev.filter(d => d.id !== deck.id)]); openMindmap(deck.id); }}
        />
      )}
    </div>
  );
}

function originLabel(origin: MindmapDeckView["origin"]): string {
  if (origin === "ai-from-prose") return "AI · 文稿生成";
  return "元 · 一键转换";
}

interface CreateProps { onClose: () => void; onCreated: (deck: MindmapDeckView) => void; }

function CreateMindmapModal({ onClose, onCreated }: CreateProps) {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const [tab, setTab] = useState<"element" | "prose">("element");
  const [pickedElementId, setPickedElementId] = useState<string>("");
  const [prose, setProse] = useState("");
  const [titleHint, setTitleHint] = useState("");
  const [audience, setAudience] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Eligible elements = those with at least one child (single leaves don't
  // make a meaningful deck) AND those that don't already have a PPT section.
  const elementChoices = useMemo(() => {
    const hasChild = new Set(relations.filter(r => r.kind === "child").map(r => r.from));
    const alreadyPpt = new Set<string>();
    for (const el of elements.values()) {
      const sections = (el.content as { sections?: Array<{ blocks?: Array<{ style?: string }> }> } | null | undefined)?.sections ?? [];
      for (const s of sections) {
        for (const b of s.blocks ?? []) {
          if ((b as { style?: string }).style === "mindmap-embed") { alreadyPpt.add(el.id); break; }
        }
        if (alreadyPpt.has(el.id)) break;
      }
    }
    return Array.from(elements.values())
      .filter(el => hasChild.has(el.id) && !alreadyPpt.has(el.id))
      .sort((a, b) => (b.metadata?.updatedAt ?? "").localeCompare(a.metadata?.updatedAt ?? ""))
      .slice(0, 80);
  }, [elements, relations]);

  async function submitFromElement() {
    if (!pickedElementId) { setError("先选一个元"); return; }
    setBusy(true); setError(null);
    try {
      const deck = await api.attachMindmap(pickedElementId);
      await hydrate(); // refresh elements so the new PPT section is visible
      onCreated(deck);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitFromProse() {
    if (prose.trim().length < 30) { setError("文稿太短,至少 30 字"); return; }
    setBusy(true); setError(null);
    try {
      const stream = api.generateMindmapStream({
        prose, titleHint: titleHint.trim() || undefined,
        audience: audience.trim() || undefined,
      });
      for await (const ev of stream) {
        if (ev.type === "error") throw new Error(ev.message);
        if (ev.type === "done") {
          // Server completes generation + tree materialization async after
          // the SSE "done" event (it then emits "materialized"). Re-list
          // and pick the newest deck.
          await hydrate();
          const list = await api.listMindmaps();
          if (list[0]) onCreated(list[0]);
          return;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mindmap-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mindmap-modal__panel" onClick={e => e.stopPropagation()}>
        <header className="mindmap-modal__head">
          <h2>新建导图 PPT</h2>
          <button type="button" className="mindmap-modal__close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <nav className="mindmap-modal__tabs">
          <button type="button" className={tab === "element" ? "is-active" : ""} onClick={() => setTab("element")}>从已有元生成</button>
          <button type="button" className={tab === "prose" ? "is-active" : ""} onClick={() => setTab("prose")}>从文稿生成（AI）</button>
        </nav>
        {tab === "element" ? (
          <div className="mindmap-modal__body">
            <p className="mindmap-modal__hint">选一个元,它的子树就是 PPT 的内容。会在元里补一个「PPT 展示图」章节。</p>
            <select value={pickedElementId} onChange={e => setPickedElementId(e.target.value)} disabled={busy}>
              <option value="">—— 选一个元 ——</option>
              {elementChoices.map(el => (
                <option key={el.id} value={el.id}>{el.title}</option>
              ))}
            </select>
            <div className="mindmap-modal__actions">
              <button type="button" onClick={onClose} disabled={busy}>取消</button>
              <button type="button" className="mindmap-modal__primary" onClick={submitFromElement} disabled={busy || !pickedElementId}>
                {busy ? "生成中…" : "生成导图"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mindmap-modal__body">
            <p className="mindmap-modal__hint">AI 会先把文稿拆成一棵元树,再把根元标记成 PPT。生成完可在知识树里继续编辑这些元。</p>
            <input
              type="text" placeholder="标题倾向（可选）"
              value={titleHint} onChange={e => setTitleHint(e.target.value)} disabled={busy}
            />
            <input
              type="text" placeholder="目标受众 / 风格（可选）"
              value={audience} onChange={e => setAudience(e.target.value)} disabled={busy}
            />
            <textarea
              placeholder="把原文粘贴进来（≥ 30 字）"
              value={prose} onChange={e => setProse(e.target.value)} rows={10} disabled={busy}
            />
            <div className="mindmap-modal__actions">
              <button type="button" onClick={onClose} disabled={busy}>取消</button>
              <button type="button" className="mindmap-modal__primary" onClick={submitFromProse} disabled={busy || prose.trim().length < 30}>
                {busy ? "AI 生成中…" : "AI 生成元树 + 导图"}
              </button>
            </div>
          </div>
        )}
        {error && <div className="mindmap-modal__error">{error}</div>}
      </div>
    </div>
  );
}

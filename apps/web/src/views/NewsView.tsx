import { useEffect, useMemo, useState } from "react";
import type { Element } from "@ke/domain";
import { useStore } from "../state/store.js";
import { TopBar } from "../components/TopBar.js";
import { FooterTaskStrip } from "../components/FooterTaskStrip.js";
import { renderSectionBlocks } from "../components/SectionRenderer.js";
import "./NewsView.css";

/** 8 categories shown in the left rail. `"_today"` is a virtual filter (今日重点
 *  = today's items marked impact:major), all the rest match a `category:X` tag. */
type Category = { id: string; label: string };
const CATEGORIES: Category[] = [
  { id: "_today", label: "今日早报" },
  { id: "能力突破", label: "能力突破" },
  { id: "应用产品", label: "应用产品" },
  { id: "大模型", label: "大模型" },
  { id: "工具与开源", label: "工具与开源" },
  { id: "热门 SKILL", label: "热门 SKILL" },
  { id: "研究论文", label: "研究论文" },
  { id: "政策与安全", label: "政策与安全" },
  { id: "投融资", label: "投融资" },
];

// Today, as ISO yyyy-mm-dd. Evaluated once on module load — fine for a
// single browsing session; refresh the page to advance past midnight.
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function tagValue(el: Element, prefix: string): string | undefined {
  return el.tags?.find(t => t.startsWith(prefix))?.slice(prefix.length);
}
function isReport(el: Element): boolean {
  // Only count individual news items, not the daily-roundup parents (those
  // are containers grouping a day's items — shown via the date sidebar).
  return el.type === "report"
    && (el.tags?.includes("ai-news") ?? false)
    && !(el.tags?.includes("daily-roundup") ?? false);
}
function dateOf(el: Element): string {
  return (el.metadata?.createdAt ?? "").slice(0, 10);
}

/** Two-part group title: a relative label (今天 / 昨天 / ...) plus the exact iso date. */
function dateGroupParts(iso: string): { label: string; iso: string } {
  if (!iso) return { label: "未知日期", iso: "" };
  if (iso === TODAY_ISO) return { label: "今天", iso };
  const today = new Date(TODAY_ISO);
  const d = new Date(iso);
  const days = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 1) return { label: "昨天", iso };
  if (days >= 2 && days <= 6) return { label: "本周早些时候", iso };
  return { label: iso, iso: "" };
}

export function NewsView() {
  const elements = useStore(s => s.elements);
  const [activeCategory, setActiveCategory] = useState<string>("_today");
  const [openId, setOpenId] = useState<string | null>(null);

  const allNews = useMemo(
    () => Array.from(elements.values()).filter(isReport)
      .sort((a, b) => (b.metadata?.createdAt ?? "").localeCompare(a.metadata?.createdAt ?? "")),
    [elements],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { _today: 0 };
    for (const cat of CATEGORIES) c[cat.id] = 0;
    for (const el of allNews) {
      if (dateOf(el) === TODAY_ISO) c._today += 1;
      const cat = tagValue(el, "category:");
      if (cat && c[cat] !== undefined) c[cat] += 1;
    }
    return c;
  }, [allNews]);

  const filtered = useMemo(() => {
    if (activeCategory === "_today") return allNews.filter(el => dateOf(el) === TODAY_ISO);
    return allNews.filter(el => tagValue(el, "category:") === activeCategory);
  }, [allNews, activeCategory]);

  // Two grouping axes:
  // - 今日重点: group today's items by category
  // - Other category: group that category's items by date
  const grouped = useMemo<Array<[string, Element[]]>>(() => {
    if (activeCategory === "_today") {
      const byCat = new Map<string, Element[]>();
      for (const el of filtered) {
        const cat = tagValue(el, "category:") ?? "未分类";
        const list = byCat.get(cat) ?? [];
        list.push(el);
        byCat.set(cat, list);
      }
      // Order by the CATEGORIES rail order so the page reads top-to-bottom in
      // the same sequence as the sidebar.
      const order = CATEGORIES.map(c => c.id);
      return Array.from(byCat.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    }
    const byDate = new Map<string, Element[]>();
    for (const el of filtered) {
      const d = dateOf(el);
      const list = byDate.get(d) ?? [];
      list.push(el);
      byDate.set(d, list);
    }
    return Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered, activeCategory]);

  const groupByCategory = activeCategory === "_today";

  const openItem = openId ? elements.get(openId) ?? null : null;

  // ESC closes the modal.
  useEffect(() => {
    if (!openItem) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openItem]);

  const activeLabel = CATEGORIES.find(c => c.id === activeCategory)?.label ?? "今日重点";

  return (
    <div className="tree-view news-shell">
      <TopBar breadcrumb={null} />

      <aside className="learning-sidebar news-sidebar" aria-label="新闻分类">
        <section>
          <div className="sidebar-list">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`sidebar-node news-cat${activeCategory === cat.id ? " is-active" : ""}`}
                onClick={() => { setActiveCategory(cat.id); setOpenId(null); }}
              >
                <span className="sidebar-node__title">{cat.label}</span>
                <span className="news-cat__count">{counts[cat.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="tv-main news-main">
        <header className="news-page-head">
          <h1>{activeLabel}</h1>
          {activeCategory === "_today" ? (
            <span className="news-page-head__date">{TODAY_ISO}</span>
          ) : (
            <span className="news-page-head__date">历史归档 · 共 {filtered.length} 条</span>
          )}
          {activeCategory === "_today" && <GenerateTodayButton />}
        </header>
        {filtered.length === 0 ? (
          <div className="news-empty">该分类暂无新闻</div>
        ) : (
          <div className="news-feed">
            {grouped.map(([key, items]) => {
              const header = groupByCategory ? (
                <h3 className="news-feed__group-title">
                  <strong>{key}</strong>
                  <span className="news-feed__group-count">{items.length} 条</span>
                </h3>
              ) : (() => {
                const parts = dateGroupParts(key);
                return (
                  <h3 className="news-feed__group-title">
                    <strong>{parts.label}</strong>
                    {parts.iso && <em>{parts.iso}</em>}
                    <span className="news-feed__group-count">{items.length} 条</span>
                  </h3>
                );
              })();
              return (
                <section key={key}>
                  {header}
                  <div className="news-feed__grid">
                    {items.map(el => <NewsCard key={el.id} item={el} onOpen={() => setOpenId(el.id)} />)}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <footer className="tv-footer">
        <div>共 {allNews.length} 条 · 当前分类 {filtered.length} 条 · 按 ESC 关闭详情</div>
        <FooterTaskStrip />
      </footer>

      {openItem && <NewsModal item={openItem} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function GenerateTodayButton() {
  const generate = useStore(s => s.generateDailyNews);
  const runningTask = useStore(s => s.tasks.find(t => t.kind === "daily-news" && t.status === "running"));
  const running = Boolean(runningTask);
  return (
    <button
      type="button"
      className="news-generate-btn"
      disabled={running}
      onClick={() => void generate()}
      title="让 AI 抓取今日真实 AI 新闻并生成早报（约 30–90 秒）"
    >
      {running ? "AI 正在抓取生成…" : "生成今日早报"}
    </button>
  );
}

function NewsCard({ item, onOpen }: { item: Element; onOpen: () => void }) {
  // News-card visual badges:
  //   - Gold ring when this element is in favorites
  //   - Red ring + pulse when a refine task is currently running for it
  // Both pull straight from the global store so the card updates live
  // (refine kicks off → red ring within ~1 SSE tick; refine done → ring fades).
  const isFavorite = useStore(s => s.favorites.includes(item.id));
  const latestRefineStatus = useStore(s => s.tasks.find(
    t => t.kind === "refine" && t.elementId === item.id,
  )?.status);
  const isRefining = latestRefineStatus === "running";
  const isRefined = latestRefineStatus === "done";
  const stateClass =
    (isRefining ? " is-refining" : "") +
    (!isRefining && isRefined ? " is-refined" : "") +
    (isFavorite ? " is-favorite" : "");
  const category = tagValue(item, "category:") ?? "未分类";
  const impact = tagValue(item, "impact:");
  const source = primarySource(item);
  const date = dateOf(item);
  return (
    <article className={`news-card${stateClass}`} onClick={onOpen}>
      <header className="news-card__head">
        <span className="news-card__cat" data-category={category}>{category}</span>
        {impact === "major" && <span className="news-card__impact">🔥 重大</span>}
      </header>
      <h3 className="news-card__title">{item.title}</h3>
      {item.subtitle && <p className="news-card__sub">{item.subtitle}</p>}
      <footer className="news-card__foot">
        {source?.cite && <span>来源 · {source.cite}</span>}
        <span>{date}</span>
      </footer>
      {isRefining && <span className="news-card__state news-card__state--refining">细化中</span>}
      {!isRefining && isRefined && <span className="news-card__state news-card__state--refined">已细化</span>}
    </article>
  );
}

function NewsModal({ item, onClose }: { item: Element; onClose: () => void }) {
  const enterFromNews = useStore(s => s.enterFromNews);
  const refine = useStore(s => s.refine);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const isFavorite = useStore(s => s.favorites.includes(item.id));
  const isRefining = useStore(s => s.tasks.some(
    t => t.kind === "refine" && t.elementId === item.id && t.status === "running",
  ));
  const content = item.content as { sections?: Array<{ id: string; title: string; blocks: unknown[] }> };
  const sections = content?.sections ?? [];
  const category = tagValue(item, "category:") ?? "未分类";
  const impact = tagValue(item, "impact:");
  const date = dateOf(item);

  // "深入了解" → fire a refine task and close the modal. The card outside
  // immediately shows the red "is-refining" ring, so the user sees Rich
  // is working without staring at a spinner inside the modal.
  function onDeepDive() {
    onClose();
    void refine(item.id);
  }
  // "编辑元" → existing flow: enter the element in TreeView for full editing.
  function onEditElement() {
    onClose();
    void enterFromNews(item.id);
  }
  // "收藏" → toggle favorite. Card outside gets the gold border immediately
  // via the store-derived isFavorite flag.
  function onToggleFavorite() {
    toggleFavorite(item.id);
  }

  return (
    <div className="news-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="news-modal__card" onClick={e => e.stopPropagation()}>
        <span className="news-modal__esc-hint">ESC</span>
        <button type="button" className="news-modal__close" aria-label="关闭" onClick={onClose}>×</button>
        <header className="news-modal__head">
          <h1>{item.title}</h1>
          {item.subtitle && <p className="news-modal__sub">{item.subtitle}</p>}
          <div className="news-modal__meta">
            <span className="news-card__cat" data-category={category}>{category}</span>
            {impact === "major" && <span>🔥 重大</span>}
            <span>{date}</span>
          </div>
        </header>
        <div className="news-modal__body">
          {sections.map(s => (
            <section key={s.id}>
              {renderSectionBlocks(s as never)}
            </section>
          ))}
        </div>
        <div className="news-modal__footer">
          <button
            type="button"
            className={`news-modal__fav${isFavorite ? " is-on" : ""}`}
            onClick={onToggleFavorite}
            title={isFavorite ? "取消收藏" : "收藏这条早报"}
          >
            {isFavorite ? "★ 已收藏" : "☆ 收藏"}
          </button>
          <button
            type="button"
            className="news-modal__deep-dive"
            onClick={onDeepDive}
            disabled={isRefining}
            title="触发细化任务，让 AI 把这条新闻挖深一层"
          >
            {isRefining ? "细化中…" : "深入了解"}
          </button>
          <button
            type="button"
            className="news-modal__deep"
            onClick={onEditElement}
            title="进入这条新闻对应的元，进行编辑 / 展开 / 标注"
          >
            编辑元 →
          </button>
        </div>
      </div>
    </div>
  );
}

function primarySource(item: Element): { cite?: string; url?: string; publishedAt?: string } | undefined {
  const sections = (item.content as { sections?: Array<{ blocks: Array<{ source?: { cite?: string } }> }> })?.sections ?? [];
  for (const s of sections) {
    for (const b of s.blocks) {
      if (b.source) return b.source;
    }
  }
  return undefined;
}

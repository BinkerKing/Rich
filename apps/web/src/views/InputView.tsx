import { useEffect, useMemo, useState } from "react";
import type { RichnessLevel } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api, type AnalyzeInputResult, type AttachOption } from "../api/client.js";
import { Icon } from "../components/Icon.js";
import { TopBar } from "../components/TopBar.js";
import { SystemPanel } from "../components/SystemPanel.js";
import { FooterTaskStrip } from "../components/FooterTaskStrip.js";
import { elementTypeClass, elementTypeLabel } from "../components/elementLabels.js";
import { elementDragProps, useDropTarget } from "../lib/elementDnd.js";
import "./InputView.css";

type SpecMap = Record<string, { label: string; structure: string; content: string }>;

type Mode = "manual" | "ai-search" | RichnessLevel;
type ManualType = "topic" | "project" | "report" | "practice" | "guide";

const MANUAL_TYPES: { value: ManualType; label: string; hint: string }[] = [
  { value: "topic",    label: "主题元", hint: "学习一个主题 / 知识方向" },
  { value: "project",  label: "项目元", hint: "推进一个具体项目" },
  { value: "report",   label: "报告元", hint: "收集 / 整理外部信息的报告" },
  { value: "practice", label: "实战元", hint: "围绕一个产出 / 作品练手" },
  { value: "guide",    label: "攻略元", hint: "整理一份旅游 / 游戏 / 学习攻略" },
];

/** Top row = 3 high-level intents. "direct" is a pseudo-mode: clicking it sets
 *  `mode` to a numeric richness (default 中档 = 3), revealing / activating the
 *  richness sub-row below. */
type TopIntent = "ai-search" | "manual" | "direct";
const TOP_MODES: { value: TopIntent; label: string; hint: string }[] = [
  { value: "ai-search", label: "AI 搜索",   hint: "AI 先帮你判断该挂在哪里，你再决定" },
  { value: "manual",    label: "手动生成", hint: "直接用标题建一个空的元，不调用 AI" },
  { value: "direct",    label: "直接生成", hint: "跳过 AI 搜索，按下方丰富度直接新建主题树" },
];

const RICHNESS_MODES: { value: RichnessLevel; label: string; hint: string }[] = [
  { value: 1, label: "低档", hint: "AI 直接新建主题树 · 骨架级" },
  { value: 2, label: "中档", hint: "AI 直接新建主题树 · 中等" },
  { value: 3, label: "高档", hint: "AI 直接新建主题树 · 完整" },
  { value: 4, label: "深度", hint: "AI 直接新建主题树 · 深度" },
  { value: 5, label: "专家", hint: "AI 直接新建主题树 · 专家" },
];

export function InputView() {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<Mode>("ai-search");
  const [manualType, setManualType] = useState<ManualType>("topic");
  // Richness used by AI 搜索 — applied to whichever option the user accepts
  // (new-topic → tree depth; attach-direct/with-bridge → leaf content depth).
  const [aiSearchRichness, setAiSearchRichness] = useState<RichnessLevel>(3);
  // Global keyword search shares the same input as "AI 定位": as the user
  // types, we live-show existing matches below. Pressing the button still
  // triggers AI flow. No second box.
  // Multi-select state for the 已有主题 grid. When `multiMode` is on:
  //   - Clicking a card toggles its membership in `selectedIds` (no navigation)
  //   - Right-click any card → batch action menu over the current selection
  //     (or the single card if nothing is selected yet)
  // When off, clicks navigate as before; right-click acts on just that card.
  const [multiMode, setMultiMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [topicMenu, setTopicMenu] = useState<{ x: number; y: number; targets: string[] } | null>(null);
  // Favorites + quickNav live in the global store so the element-detail star
  // toggle (in tree view) stays in sync with this page.
  const favorites = useStore(s => s.favorites);
  const setFavorites = useStore(s => s.setFavorites);
  const quickNav = useStore(s => s.quickNav);
  const setQuickNav = useStore(s => s.setQuickNav);
  // User-defined ordering of topic cards. Saved as element id sequence;
  // unknown ids (newly created topics) auto-append to the end at render time.
  const [topicOrder, setTopicOrder] = useState<string[]>(() => loadTopicOrder());
  useEffect(() => { saveTopicOrder(topicOrder); }, [topicOrder]);
  const [topicDragOverId, setTopicDragOverId] = useState<string | null>(null);
  function reorderTopics(srcId: string, targetId: string, existingIds: string[]) {
    if (srcId === targetId) return;
    setTopicOrder(() => {
      // Build a full snapshot of current order (saved + any not-yet-tracked
      // ids appended), then move srcId to the slot before targetId.
      const orderedSaved = topicOrder.filter(id => existingIds.includes(id));
      const orderedSet = new Set(orderedSaved);
      const full = [...orderedSaved];
      for (const id of existingIds) if (!orderedSet.has(id)) full.push(id);
      const without = full.filter(id => id !== srcId);
      const insertAt = without.indexOf(targetId);
      if (insertAt === -1) return [...without, srcId];
      without.splice(insertAt, 0, srcId);
      return without;
    });
  }
  function removeFavorite(id: string) {
    setFavorites(favorites.filter(x => x !== id));
  }
  function removeQuickNav(id: string) {
    setQuickNav(quickNav.filter(x => x !== id));
  }
  // Drop targets:
  //   - favDrop: 收藏夹 grid in main area — accepts topic cards
  //   - quickDrop: 快速导航 left rail — accepts favorite items
  const favDrop = useDropTarget("__favorites__", id => {
    if (!favorites.includes(id)) setFavorites([...favorites, id]);
  });
  const quickDrop = useDropTarget("__quicknav__", id => {
    if (!quickNav.includes(id)) setQuickNav([...quickNav, id]);
  });
  const [favDragOverId, setFavDragOverId] = useState<string | null>(null);
  const [quickDragOverId, setQuickDragOverId] = useState<string | null>(null);
  function insertFavoriteBefore(srcId: string, targetId: string) {
    if (srcId === targetId) return;
    const without = favorites.filter(x => x !== srcId);
    const idx = without.indexOf(targetId);
    if (idx === -1) {
      if (!favorites.includes(srcId)) setFavorites([...favorites, srcId]);
      return;
    }
    without.splice(idx, 0, srcId);
    setFavorites(without);
  }
  function insertQuickNavBefore(srcId: string, targetId: string) {
    if (srcId === targetId) return;
    const without = quickNav.filter(x => x !== srcId);
    const idx = without.indexOf(targetId);
    if (idx === -1) {
      if (!quickNav.includes(srcId)) setQuickNav([...quickNav, srcId]);
      return;
    }
    without.splice(idx, 0, srcId);
    setQuickNav(without);
  }
  const [specs, setSpecs] = useState<SpecMap | null>(null);
  // Analysis sessions live in the global store as tabs. Each AI 搜索 submission
  // adds a tab; tabs persist across view switches; user closes them via × or
  // by accepting an option from a tab.
  const homeAnalyses = useStore(s => s.homeAnalyses);
  const homeActiveAnalysisId = useStore(s => s.homeActiveAnalysisId);
  const startHomeAnalysis = useStore(s => s.startHomeAnalysis);
  const setHomeAnalysisResult = useStore(s => s.setHomeAnalysisResult);
  const setHomeAnalysisError = useStore(s => s.setHomeAnalysisError);
  const markHomeAnalysisViewed = useStore(s => s.markHomeAnalysisViewed);
  const closeHomeAnalysis = useStore(s => s.closeHomeAnalysis);
  const setActiveHomeAnalysis = useStore(s => s.setActiveHomeAnalysis);
  const toggleHomeAnalysisCollapsed = useStore(s => s.toggleHomeAnalysisCollapsed);
  // Whether any session is currently running — used to keep the form's
  // scanning border animation alive even after the user submits a 2nd query.
  const anyRunning = homeAnalyses.some(a => a.status === "running");
  const activeAnalysisSession = homeAnalyses.find(a => a.id === homeActiveAnalysisId) ?? null;
  const analysis = activeAnalysisSession?.analysis ?? null;
  const analyzedText = activeAnalysisSession?.analyzedText ?? "";
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getRichnessSpec()
      .then(s => { if (!cancelled) setSpecs(s); })
      .catch(() => { /* keep UI usable without spec */ });
    return () => { cancelled = true; };
  }, []);
  const generate = useStore(s => s.generate);
  const attachUnder = useStore(s => s.attachUnder);
  const createManualElement = useStore(s => s.createManualElement);
  const enterTree = useStore(s => s.enterTree);
  const enterAtElement = useStore(s => s.enterAtElement);
  const deleteElement = useStore(s => s.deleteElement);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const systemMode = useStore(s => s.systemMode);
  const deltaText = useStore(s => s.inflight.get("generate:_")?.delta ?? "");
  const availableTopics = useStore(s => s.availableTopics);
  const lastCenterId = useStore(s => s.lastCenterId);
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = topic.trim();
    if (!raw) return;
    // Manual: create empty element with just the title, no AI involved.
    if (mode === "manual") {
      try { await createManualElement(raw, manualType); setTopic(""); }
      catch (err) { setAnalyzeError(err instanceof Error ? err.message : String(err)); }
      return;
    }
    // AI search: full analyze-input pipeline → user picks attach option.
    if (mode === "ai-search") {
      setAnalyzeError(null);
      // Fire-and-forget: kick off the search in the background, clear the
      // input immediately so the user can start another search in parallel.
      const sessionId = startHomeAnalysis(raw);
      setTopic("");
      void (async () => {
        try {
          const result = await api.analyzeInput(raw, "codex");
          setHomeAnalysisResult(sessionId, result);
        } catch (err) {
          setHomeAnalysisError(sessionId, err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }
    // Otherwise mode is a richness level 1-5: AI directly generates a new
    // standalone topic tree at that richness, skipping the search step.
    void generate(raw, { richness: mode, model: "codex" });
    setTopic("");
  }

  function chooseOption(opt: AttachOption) {
    const userText = analyzedText;
    const cleanTitle = analysis?.topic ?? userText;
    const richness = aiSearchRichness;
    if (opt.kind === "new-topic") {
      void generate(cleanTitle, { richness, model: "codex" });
    } else if (opt.kind === "attach-direct") {
      // Strict-attach: exactly 1 leaf under parent. Richness controls the
      // depth of the new leaf's content (not the tree's structure).
      void attachUnder(opt.parentId, {
        mode: "leaf",
        leafTitle: cleanTitle,
        fullIntent: userText,
        richness,
      }, "codex");
    } else if (opt.kind === "attach-with-bridge") {
      // Vertical chain: bridges (compact) + final leaf at chosen richness.
      void attachUnder(opt.parentId, {
        mode: "chain",
        chain: [...opt.bridges, cleanTitle],
        fullIntent: userText,
        richness,
      }, "codex");
    }
    // Close the current tab once an option is accepted from it.
    if (homeActiveAnalysisId) closeHomeAnalysis(homeActiveAnalysisId);
    setTopic("");
  }

  function cancelAnalysis() {
    if (homeActiveAnalysisId) closeHomeAnalysis(homeActiveAnalysisId);
    setAnalyzeError(null);
  }

  // Close context menu on outside click / Escape.
  useEffect(() => {
    if (!topicMenu) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTopicMenu(null); };
    const onClick = () => setTopicMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [topicMenu]);

  function handleCardClick(elementId: string) {
    if (multiMode) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(elementId)) next.delete(elementId);
        else next.add(elementId);
        return next;
      });
      return;
    }
    void enterTree(elementId);
  }

  function handleCardContext(e: React.MouseEvent, elementId: string) {
    e.preventDefault();
    e.stopPropagation();
    // Targets: if in multi-mode and this card is part of selection (or there
    // are any selections), act on the whole selection. Otherwise just this card.
    const inSel = selectedIds.has(elementId);
    const targets = multiMode && selectedIds.size > 0
      ? (inSel ? Array.from(selectedIds) : [elementId, ...selectedIds])
      : [elementId];
    setTopicMenu({ x: e.clientX, y: e.clientY, targets });
  }

  async function handleDeleteFromMenu() {
    if (!topicMenu) return;
    const ids = topicMenu.targets;
    setTopicMenu(null);
    const titles = ids.map(id => elements.get(id)?.title ?? id).slice(0, 5);
    const more = ids.length > 5 ? ` … 等 ${ids.length} 个` : "";
    const msg = ids.length === 1
      ? `删除「${titles[0]}」及其所有子元？\n此操作不可撤销。`
      : `批量删除 ${ids.length} 个主题（${titles.join("、")}${more}）及其所有子元？\n此操作不可撤销。`;
    if (!window.confirm(msg)) return;
    for (const id of ids) {
      try { await deleteElement(id); }
      catch (err) { window.alert(`删除「${elements.get(id)?.title ?? id}」失败：${err instanceof Error ? err.message : String(err)}`); }
    }
    setSelectedIds(new Set());
  }

  function toggleMultiMode() {
    setMultiMode(v => !v);
    setSelectedIds(new Set());
    setTopicMenu(null);
  }

  const topicStats = availableTopics.map(topic => {
    const desc = countDescendants(topic.id, relations);
    return { topic, desc };
  });
  const totalElements = elements.size;
  // Apply the user-defined drag order; new topics (not yet in saved order)
  // append at the end. No artificial cap on count.
  const visibleTopics = (() => {
    const byId = new Map(topicStats.map(t => [t.topic.id, t] as const));
    const ordered = topicOrder.map(id => byId.get(id)).filter((x): x is typeof topicStats[number] => Boolean(x));
    const inOrderIds = new Set(ordered.map(t => t.topic.id));
    const tail = topicStats.filter(t => !inOrderIds.has(t.topic.id));
    return [...ordered, ...tail];
  })();

  const searchHits = useMemo(
    () => topic.trim() ? searchElements(topic, elements.values(), 12) : [],
    [topic, elements],
  );

  const lastCenter = lastCenterId ? elements.get(lastCenterId) : null;
  const lastCenterRoot = lastCenterId ? rootOf(lastCenterId, relations) : null;
  const lastCenterRootEl = lastCenterRoot ? elements.get(lastCenterRoot) : null;
  const resumeRootEl = lastCenterRootEl ?? topicStats[0]?.topic ?? null;
  const resumeLabel = lastCenter && lastCenterRootEl
    ? `上次停在「${lastCenter.title}」`
    : resumeRootEl
      ? "进入最近的主题继续学习"
      : "";

  return (
    <div className="tree-view home-shell" data-loading={loading ? "true" : undefined}>
      <TopBar breadcrumb={<span className="now">首页</span>} />

      <aside
        className={`learning-sidebar home-left-rail home-quick-rail${quickDragOverId === "__rail__" ? " is-drop-over" : ""}`}
        aria-label="快速导航"
        onDragOver={e => {
          // Accept any of the three drag sources:
          //   - element-id  (topic card from 已有主题) → auto-favorite + quicknav
          //   - favorite-id (card from 收藏夹)        → add to quicknav
          //   - quick-id    (internal reorder/move)  → move to end
          if (!e.dataTransfer.types.includes("application/x-ke-element-id") &&
              !e.dataTransfer.types.includes("application/x-ke-favorite-id") &&
              !e.dataTransfer.types.includes("application/x-ke-quick-id")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={e => {
          if (!e.dataTransfer.types.includes("application/x-ke-element-id") &&
              !e.dataTransfer.types.includes("application/x-ke-favorite-id") &&
              !e.dataTransfer.types.includes("application/x-ke-quick-id")) return;
          e.preventDefault();
          setQuickDragOverId("__rail__");
        }}
        onDragLeave={() => setQuickDragOverId(prev => prev === "__rail__" ? null : prev)}
        onDrop={e => {
          setQuickDragOverId(null);
          const quickSrc = e.dataTransfer.getData("application/x-ke-quick-id");
          const favSrc   = e.dataTransfer.getData("application/x-ke-favorite-id");
          const elSrc    = e.dataTransfer.getData("application/x-ke-element-id");
          if (quickSrc) {
            // Internal reorder → move to end of quicknav.
            e.preventDefault();
            setQuickNav([...quickNav.filter(x => x !== quickSrc), quickSrc]);
            return;
          }
          if (favSrc) {
            e.preventDefault();
            if (!quickNav.includes(favSrc)) setQuickNav([...quickNav, favSrc]);
            return;
          }
          if (elSrc) {
            // Topic card dragged directly → only add to quicknav. Favorites
            // and quicknav are independent collections.
            e.preventDefault();
            if (!quickNav.includes(elSrc)) setQuickNav([...quickNav, elSrc]);
          }
        }}
      >
        <section>
          <div className="sidebar-label">
            快速导航
            <span className="home-fav__count">{quickNav.length}</span>
          </div>
          {quickNav.length === 0 ? (
            <div className="home-fav__empty">
              <Icon name="spark" />
              <strong>把常用主题拖到这里</strong>
              <span>先在元详情页点 ✦ 收藏；然后把下方收藏夹里的卡片拖到这里固定。</span>
            </div>
          ) : (
            <div className="home-fav__list">
              {quickNav.map(id => {
                const el = elements.get(id);
                if (!el) {
                  return (
                    <div key={id} className="home-fav__item home-fav__item--missing">
                      <span className="home-fav__title">（元已删除：{id.slice(0, 18)}…）</span>
                      <button type="button" className="home-fav__remove" onClick={() => removeQuickNav(id)} title="移除">×</button>
                    </div>
                  );
                }
                const isOver = quickDragOverId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`home-fav__item ${elementTypeClass(el.type)}${isOver ? " is-drag-over" : ""}`}
                    onClick={() => void enterTree(id)}
                    title={`进入「${el.title}」 · 可拖动调整位置`}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("application/x-ke-quick-id", id);
                      e.dataTransfer.setData("text/plain", id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={e => {
                      if (!e.dataTransfer.types.includes("application/x-ke-quick-id") &&
                          !e.dataTransfer.types.includes("application/x-ke-favorite-id")) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDragEnter={e => {
                      if (!e.dataTransfer.types.includes("application/x-ke-quick-id") &&
                          !e.dataTransfer.types.includes("application/x-ke-favorite-id")) return;
                      e.preventDefault();
                      setQuickDragOverId(id);
                    }}
                    onDragLeave={() => setQuickDragOverId(prev => prev === id ? null : prev)}
                    onDrop={e => {
                      const quickSrc = e.dataTransfer.getData("application/x-ke-quick-id");
                      const favSrc   = e.dataTransfer.getData("application/x-ke-favorite-id");
                      const srcId    = quickSrc || favSrc;
                      setQuickDragOverId(null);
                      if (!srcId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      insertQuickNavBefore(srcId, id);
                    }}
                  >
                    <span className="home-fav__title">{el.title}</span>
                    <span className="home-fav__type">{elementTypeLabel(el.type)}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="home-fav__remove"
                      onClick={e => { e.stopPropagation(); removeQuickNav(id); }}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); removeQuickNav(id); } }}
                      title="从快速导航移除"
                    >×</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </aside>

      <main className="tv-main tv-main--home">
        <div className="home-cockpit">
          <div className="home-cockpit__halo" aria-hidden="true" />

          {resumeRootEl && (
            <button
              type="button"
              className="home-resume-deck"
              onClick={() => void enterTree(resumeRootEl.id)}
            >
              <span className="home-resume-deck__mark"><Icon name="center" /></span>
              <span className="home-resume-deck__main">
                <em>继续学习</em>
                <strong>{resumeRootEl.title}</strong>
                <small>{resumeLabel}</small>
              </span>
              <span className="home-resume-deck__cta">进入驾驶位 →</span>
            </button>
          )}

          <section className="home-command-deck">
            <div className="home-command-deck__rings" aria-hidden="true">
              <span /><span /><span />
            </div>
            <form className={`home-form${anyRunning ? " is-scanning" : ""}`} onSubmit={submit}>
              <input
                autoFocus
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={
                  mode === "manual" ? "输入标题，将直接建一个空的元"
                  : mode === "ai-search" ? "输入主题、概念、实战目标，或一个想法 — AI 会先帮你判断该挂在哪里"
                  : "输入主题，AI 直接按所选丰富度新建一棵树"
                }
              />
              <button type="submit" disabled={!topic.trim()}>
                {mode === "manual" ? "创建" : mode === "ai-search" ? "AI 定位" : "生成"}
              </button>
            </form>

            <div className="home-mode" aria-label="处理方式">
              <span className="home-mode__label">处理方式</span>
              <div className="home-mode__buttons">
                {TOP_MODES.map(m => {
                  const active = m.value === "ai-search" ? mode === "ai-search"
                    : m.value === "manual" ? mode === "manual"
                    : typeof mode === "number"; // direct
                  const onClick = () => {
                    if (m.value === "direct") setMode(typeof mode === "number" ? mode : 3);
                    else setMode(m.value);
                  };
                  return (
                    <button
                      key={m.value}
                      className={`home-mode__btn home-mode__btn--${m.value}${active ? " is-active" : ""}`}
                      type="button"
                      onClick={onClick}
                      title={m.hint}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(typeof mode === "number" || mode === "ai-search") && (
              <div className="home-mode" aria-label="丰富度">
                <span className="home-mode__label">丰富度</span>
                <div className="home-mode__buttons">
                  {RICHNESS_MODES.map(m => {
                    const currentRichness = mode === "ai-search" ? aiSearchRichness : mode;
                    const active = currentRichness === m.value;
                    return (
                      <button
                        key={String(m.value)}
                        className={`home-mode__btn home-mode__btn--richness${active ? " is-active" : ""}`}
                        type="button"
                        onClick={() => {
                          if (mode === "ai-search") setAiSearchRichness(m.value);
                          else setMode(m.value);
                        }}
                        title={specs?.[String(m.value)]
                          ? `${specs[String(m.value)].label}\n结构：${specs[String(m.value)].structure}\n内容：${specs[String(m.value)].content}`
                          : m.hint}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "manual" && (
              <div className="home-mode" aria-label="元类型">
                <span className="home-mode__label">元类型</span>
                <div className="home-mode__buttons">
                  {MANUAL_TYPES.map(t => (
                    <button
                      key={t.value}
                      className={`home-mode__btn home-mode__btn--type${manualType === t.value ? " is-active" : ""}`}
                      type="button"
                      onClick={() => setManualType(t.value)}
                      title={t.hint}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {topic.trim() && !analysis && searchHits.length > 0 && (
              <div className="home-search-inline" aria-label="已有匹配">
                <div className="home-search-inline__head">
                  <Icon name="search" />
                  <strong>已有 {searchHits.length} 条相关元</strong>
                  <span>点击直接进入，不必让 AI 重建</span>
                </div>
                <div className="home-search-inline__list">
                  {searchHits.map(hit => (
                    <button
                      key={hit.element.id}
                      type="button"
                      className={`home-search-inline__item ${elementTypeClass(hit.element.type)}`}
                      onClick={() => void enterAtElement(hit.element.id)}
                      title="进入对应知识树并定位此元"
                    >
                      <span className="home-search-inline__type">{elementTypeLabel(hit.element.type)}</span>
                      <strong>{hit.element.title}</strong>
                      {hit.element.subtitle && <em>{hit.element.subtitle}</em>}
                      {hit.snippet && <small>{hit.snippet}</small>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {analyzeError && <div className="home-err">解析失败：{analyzeError}</div>}

            {homeAnalyses.length > 0 && (
              <div className="home-analysis-tabs" role="tablist" aria-label="AI 解析记录">
                {homeAnalyses.map(s => {
                  const isActive = s.id === homeActiveAnalysisId;
                  const unread = s.status === "done" && !s.viewed;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      data-status={s.status ?? "done"}
                      className={`home-analysis-tab${isActive ? " is-active" : ""}${unread ? " is-unread" : ""}${s.status === "running" ? " is-running" : ""}${s.status === "error" ? " is-error" : ""}`}
                      onClick={() => {
                        setActiveHomeAnalysis(s.id);
                        if (unread) markHomeAnalysisViewed(s.id);
                      }}
                      title={s.status === "error" ? `失败：${s.error ?? "未知错误"}` : s.analyzedText}
                    >
                      {isActive && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={s.collapsed ? "展开" : "收起"}
                          className="home-analysis-tab__fold"
                          title={s.collapsed ? "展开" : "收起"}
                          onClick={e => { e.stopPropagation(); toggleHomeAnalysisCollapsed(s.id); }}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleHomeAnalysisCollapsed(s.id); } }}
                        >{s.collapsed ? "▸" : "▾"}</span>
                      )}
                      <span className="home-analysis-tab__title">
                        {(s.analysis?.topic ?? s.analyzedText).slice(0, 18)}
                        {(s.analysis?.topic ?? s.analyzedText).length > 18 && "…"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="关闭"
                        className="home-analysis-tab__close"
                        onClick={e => { e.stopPropagation(); closeHomeAnalysis(s.id); }}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); closeHomeAnalysis(s.id); } }}
                      >×</span>
                    </button>
                  );
                })}
              </div>
            )}

            {analysis && !activeAnalysisSession?.collapsed && (
              <AnalysisCard
                analysis={analysis}
                analyzedText={analyzedText}
                onChoose={chooseOption}
                elements={elements}
                onJump={enterAtElement}
              />
            )}

            {loading && (
              <div className="home-streaming">
                <div className="home-streaming__status">AI 正在生成知识树…</div>
                {deltaText && <pre className="home-streaming__preview">{deltaText.slice(-1200)}</pre>}
              </div>
            )}
            {error && <div className="home-err">{error}</div>}
          </section>

          <section className="home-topic-dock" aria-label="已有主题">
            <header>
              <div>
                <span className="home-kicker">EXISTING UNIVERSES</span>
                <h2>已有主题</h2>
              </div>
              <div className="home-topic-dock__head-actions">
                <span>{topicStats.length} 个主题</span>
                <button
                  type="button"
                  className={`home-topic-multi${multiMode ? " is-on" : ""}`}
                  onClick={toggleMultiMode}
                  title={multiMode ? "退出多选" : "进入多选模式（点卡片勾选，右键批量删除）"}
                >
                  {multiMode ? `完成${selectedIds.size > 0 ? ` · 已选 ${selectedIds.size}` : ""}` : "多选"}
                </button>
              </div>
            </header>
            <div className="home-topic-grid">
              {visibleTopics.map(({ topic, desc }, index) => {
                const isSelected = selectedIds.has(topic.id);
                const isDragOver = topicDragOverId === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    className={`home-topic-card ${elementTypeClass(topic.type)}${multiMode ? " is-multi" : ""}${isSelected ? " is-selected" : ""}${isDragOver ? " is-drag-over" : ""}`}
                    data-element-type={topic.type}
                    onClick={() => handleCardClick(topic.id)}
                    onContextMenu={e => handleCardContext(e, topic.id)}
                    {...elementDragProps(topic.id)}
                    onDragOver={e => {
                      if (!e.dataTransfer.types.includes("application/x-ke-element-id")) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDragEnter={e => {
                      if (!e.dataTransfer.types.includes("application/x-ke-element-id")) return;
                      e.preventDefault();
                      setTopicDragOverId(topic.id);
                    }}
                    onDragLeave={() => setTopicDragOverId(prev => prev === topic.id ? null : prev)}
                    onDrop={e => {
                      const srcId = e.dataTransfer.getData("application/x-ke-element-id");
                      setTopicDragOverId(null);
                      if (!srcId || srcId === topic.id) return;
                      // Only reorder if the dragged id is one of the existing topics
                      // (i.e. dropped from the grid itself, not from elsewhere).
                      if (!topicStats.some(t => t.topic.id === srcId)) return;
                      e.preventDefault();
                      reorderTopics(srcId, topic.id, topicStats.map(t => t.topic.id));
                    }}
                  >
                    {multiMode && (
                      <span className="home-topic-card__check" aria-hidden="true">{isSelected ? "✓" : ""}</span>
                    )}
                    <span className="home-topic-card__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="home-topic-card__type">{elementTypeLabel(topic.type)}</span>
                    <strong>{topic.title}</strong>
                    {topic.subtitle && <em>{topic.subtitle}</em>}
                    <small>{desc} 个元 · {topic.domain ?? "通用"}</small>
                  </button>
                );
              })}
              {topicStats.length === 0 && (
                <div className="home-topic-empty">
                  <Icon name="spark" />
                  <strong>还没有主题</strong>
                  <span>从上方输入开始生成第一棵知识树。</span>
                </div>
              )}
            </div>
          </section>

          <section
            className={`home-topic-dock home-fav-dock${favDrop.isOver ? " is-drop-over" : ""}`}
            aria-label="收藏夹"
            onDragOver={e => {
              if (!e.dataTransfer.types.includes("application/x-ke-element-id") &&
                  !e.dataTransfer.types.includes("application/x-ke-favorite-id")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDragEnter={favDrop.bind.onDragEnter}
            onDragLeave={favDrop.bind.onDragLeave}
            onDrop={e => {
              const favSrc = e.dataTransfer.getData("application/x-ke-favorite-id");
              const elSrc  = e.dataTransfer.getData("application/x-ke-element-id");
              if (favSrc) {
                e.preventDefault();
                setFavorites(favorites.includes(favSrc) ? [...favorites.filter(x => x !== favSrc), favSrc] : favorites);
              } else if (elSrc) {
                favDrop.bind.onDrop(e);
              }
            }}
          >
            <header>
              <div>
                <span className="home-kicker">FAVORITES</span>
                <h2>收藏夹</h2>
              </div>
              <span>{favorites.length} 个收藏 · 拖到左侧"快速导航"固定</span>
            </header>
            <div className="home-topic-grid">
              {favorites.length === 0 && (
                <div className="home-topic-empty">
                  <Icon name="spark" />
                  <strong>还没有收藏</strong>
                  <span>在任意元详情页点 ✦ 即可加入收藏夹。</span>
                </div>
              )}
              {favorites.map(id => {
                const el = elements.get(id);
                if (!el) return null;
                const isFavOver = favDragOverId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`home-topic-card ${elementTypeClass(el.type)}${isFavOver ? " is-drag-over" : ""}`}
                    data-element-type={el.type}
                    onClick={() => void enterTree(id)}
                    title={`进入「${el.title}」 · 可拖到快速导航或重排顺序`}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("application/x-ke-favorite-id", id);
                      e.dataTransfer.setData("text/plain", id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={e => {
                      if (!e.dataTransfer.types.includes("application/x-ke-favorite-id") &&
                          !e.dataTransfer.types.includes("application/x-ke-element-id")) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDragEnter={e => {
                      if (!e.dataTransfer.types.includes("application/x-ke-favorite-id") &&
                          !e.dataTransfer.types.includes("application/x-ke-element-id")) return;
                      e.preventDefault();
                      setFavDragOverId(id);
                    }}
                    onDragLeave={() => setFavDragOverId(prev => prev === id ? null : prev)}
                    onDrop={e => {
                      const favSrc = e.dataTransfer.getData("application/x-ke-favorite-id");
                      const elSrc  = e.dataTransfer.getData("application/x-ke-element-id");
                      const srcId  = favSrc || elSrc;
                      setFavDragOverId(null);
                      if (!srcId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      insertFavoriteBefore(srcId, id);
                    }}
                  >
                    <span className="home-topic-card__type">{elementTypeLabel(el.type)}</span>
                    <strong>{el.title}</strong>
                    {el.subtitle && <em>{el.subtitle}</em>}
                    <span
                      role="button"
                      tabIndex={0}
                      className="home-fav__remove home-fav__remove--card"
                      onClick={ev => { ev.stopPropagation(); removeFavorite(id); }}
                      onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.stopPropagation(); removeFavorite(id); } }}
                      title="取消收藏"
                    >×</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      <SystemPanel
        mode={systemMode}
        elements={elements}
        onSelect={() => undefined}
      />

      {topicMenu && (
        <div
          className="home-topic-menu"
          style={{ left: topicMenu.x, top: topicMenu.y }}
          onClick={e => e.stopPropagation()}
          role="menu"
        >
          <button type="button" className="home-topic-menu__item is-danger" onClick={() => void handleDeleteFromMenu()}>
            {topicMenu.targets.length === 1
              ? `删除「${(elements.get(topicMenu.targets[0])?.title ?? "").slice(0, 24)}」`
              : `批量删除 ${topicMenu.targets.length} 个主题`}
          </button>
          <button type="button" className="home-topic-menu__item" onClick={() => setTopicMenu(null)}>
            取消
          </button>
        </div>
      )}

      <footer className="tv-footer">
        <div>共 {topicStats.length} 个已有主题 · {totalElements} 个知识元 · 中央驾驶舱可直接继续或新建</div>
        <FooterTaskStrip />
      </footer>
    </div>
  );
}

function AnalysisCard({
  analysis,
  analyzedText,
  onChoose,
  elements,
  onJump,
}: {
  analysis: AnalyzeInputResult;
  analyzedText: string;
  onChoose: (opt: AttachOption) => void;
  elements: Map<string, import("@ke/domain").Element>;
  onJump: (id: string) => void;
}) {
  const candidatesById = new Map(analysis.candidates.map(c => [c.id, c] as const));
  return (
    <div className="home-analysis">
      {/* Header removed — tab bar above the card already carries the title
       * (suggested topic) and a × close button. */}
      <p className="home-analysis__quote">原文：「{analyzedText}」</p>
      <div className="home-analysis__title">
        <span className="home-analysis__title-label">建议标题</span>
        <strong>{analysis.topic}</strong>
      </div>
      <div className="home-analysis__meta">
        类型：{analysis.type} · 意图：{analysis.intent} · 关键词：{analysis.keywords.join("、")}
      </div>
      <ul className="home-analysis__options">
        {analysis.options.map((opt, i) => {
          const parent = "parentId" in opt ? candidatesById.get(opt.parentId) : null;
          // Build a single horizontal chain of nodes:
          //   - "existing" nodes (from parent.parentPath + parent.title) →
          //     clickable when we can resolve them to an actual element id
          //   - "new" nodes (bridges + the new title) → gold, non-clickable
          const existingTitles = parent ? [...parent.parentPath, parent.title] : [];
          const newTitles =
            opt.kind === "attach-with-bridge" ? [...opt.bridges, analysis.topic]
            : opt.kind === "attach-direct"    ? [analysis.topic]
            : [analysis.topic]; // new-topic
          return (
            <li key={i} className={`home-option home-option--${opt.kind}`}>
              <div className="home-option__main">
                <div className="home-option__head">
                  <span className={`home-option__kind home-option__kind--${opt.kind}`}>
                    {opt.kind === "new-topic" ? "新建主题" : opt.kind === "attach-direct" ? "直接挂载" : "中间补层后挂载"}
                  </span>
                  <span className={`home-option__conf home-option__conf--${opt.confidence}`}>{
                    opt.confidence === "high" ? "置信度 高" : opt.confidence === "medium" ? "置信度 中" : "置信度 低"
                  }</span>
                </div>
                <p className="home-option__reason">{opt.reasoning}</p>
                <button type="button" className="home-option__action" onClick={() => onChoose(opt)}>
                  {opt.kind === "new-topic" ? "新建主题" : "按此挂载"} →
                </button>
              </div>
              <ChainPills
                existingTitles={existingTitles}
                newTitles={newTitles}
                elements={elements}
                onJump={onJump}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function countDescendants(rootId: string, relations: { kind: string; from: string; to: string }[]): number {
  const children: Record<string, string[]> = {};
  for (const r of relations) if (r.kind === "child") (children[r.from] ??= []).push(r.to);
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of children[id] ?? []) stack.push(c);
  }
  return seen.size;
}

function rootOf(id: string, relations: { kind: string; from: string; to: string }[]): string | null {
  let cur = id;
  const seen = new Set<string>();
  while (!seen.has(cur)) {
    seen.add(cur);
    const parent = relations.find(r => r.kind === "child" && r.to === cur)?.from;
    if (!parent) return cur;
    cur = parent;
  }
  return cur;
}

// (Favorites moved to the global Zustand store — see state/store.ts.)

const TOPIC_ORDER_KEY = "ke.topicOrder.v1";
function loadTopicOrder(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOPIC_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}
function saveTopicOrder(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(TOPIC_ORDER_KEY, JSON.stringify(ids)); } catch { /* quota / disabled */ }
}

/** Recursively flattens all string fields inside an element's content into a
 *  single space-joined lowercase string. Used by the global home search to
 *  match against deep nested section blocks. */
function elementSearchHaystack(el: import("@ke/domain").Element): string {
  const parts: string[] = [];
  parts.push(el.title);
  if (el.subtitle) parts.push(el.subtitle);
  if (el.tags) parts.push(...el.tags);
  if (el.domain) parts.push(el.domain);
  const walk = (v: unknown) => {
    if (typeof v === "string") { parts.push(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === "object") { Object.values(v).forEach(walk); }
  };
  walk(el.content);
  return parts.join(" \n ").toLowerCase();
}

export interface SearchHit {
  element: import("@ke/domain").Element;
  score: number;
  snippet: string;
}

/** Score breakdown: title hit = 12 / subtitle = 6 / tag = 4 / body = 1 per
 *  term occurrence. Terms split by whitespace; at least one term must match
 *  somewhere or the element is dropped. */
export function searchElements(
  query: string,
  elements: Iterable<import("@ke/domain").Element>,
  limit = 30,
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  for (const el of elements) {
    const title = el.title.toLowerCase();
    const sub = (el.subtitle ?? "").toLowerCase();
    const tagsStr = (el.tags ?? []).join(" ").toLowerCase();
    const haystack = elementSearchHaystack(el);
    let score = 0;
    let matchedAny = false;
    for (const t of terms) {
      let perTerm = 0;
      if (title.includes(t)) { perTerm += 12; matchedAny = true; }
      if (sub.includes(t)) { perTerm += 6; matchedAny = true; }
      if (tagsStr.includes(t)) { perTerm += 4; matchedAny = true; }
      if (haystack.includes(t)) { perTerm += 1; matchedAny = true; }
      score += perTerm;
    }
    if (!matchedAny) continue;
    // Snippet: find the first body match and grab ~80 chars around it.
    const firstTerm = terms[0];
    let snippet = "";
    const idx = haystack.indexOf(firstTerm);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(haystack.length, idx + firstTerm.length + 80);
      snippet = (start > 0 ? "…" : "") + haystack.slice(start, end).replace(/\s+/g, " ") + (end < haystack.length ? "…" : "");
    }
    hits.push({ element: el, score, snippet });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Horizontal node chain shown on the right side of each AnalysisCard option.
 *  Existing nodes are resolved by title against the live element store —
 *  clickable when matched (click → enterAtElement). New / bridge nodes are
 *  rendered gold and non-clickable. */
function ChainPills({
  existingTitles,
  newTitles,
  elements,
  onJump,
}: {
  existingTitles: string[];
  newTitles: string[];
  elements: Map<string, import("@ke/domain").Element>;
  onJump: (id: string) => void;
}) {
  // Build a quick title→id index so each existing pill can resolve a target.
  const titleToId = (() => {
    const m = new Map<string, string>();
    for (const el of elements.values()) if (!m.has(el.title)) m.set(el.title, el.id);
    return m;
  })();
  return (
    <div className="home-option__chain" aria-label="层级关系">
      {existingTitles.map((title, i) => {
        const id = titleToId.get(title);
        return (
          <span key={`e-${i}`} className="home-option__chain-row">
            {i > 0 && <em className="home-option__chain-sep" aria-hidden="true">→</em>}
            {id ? (
              <button
                type="button"
                className="home-option__chain-node home-option__chain-node--existing"
                onClick={() => onJump(id)}
                title={`已有元，点击跳转到「${title}」`}
              >
                {title}
              </button>
            ) : (
              <span
                className="home-option__chain-node home-option__chain-node--existing is-unresolved"
                title="已有元（未在当前会话索引中匹配）"
              >
                {title}
              </span>
            )}
          </span>
        );
      })}
      {newTitles.map((title, i) => (
        <span key={`n-${i}`} className="home-option__chain-row">
          {(i > 0 || existingTitles.length > 0) && <em className="home-option__chain-sep" aria-hidden="true">→</em>}
          <span
            className="home-option__chain-node home-option__chain-node--new"
            title="新增元（挂载时会创建）"
          >
            {title}
          </span>
        </span>
      ))}
    </div>
  );
}

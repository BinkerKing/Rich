import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store.js";
import { selectCenterView } from "@ke/domain";
import { KnowledgeStructureMap } from "../components/KnowledgeStructureMap.js";
import { LearningSidebar } from "../components/LearningSidebar.js";
import { ElementContentPanel } from "../components/ElementContentPanel.js";
import { Icon } from "../components/Icon.js";
import { LearningScenes, type LearningScene } from "../components/LearningScenes.js";
import { TopBar } from "../components/TopBar.js";
import { FooterTaskStrip } from "../components/FooterTaskStrip.js";
import { centerStyleFor } from "../theme/centerStyle.js";
import "./TreeView.css";

export function TreeView() {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const centerId = useStore(s => s.centerId)!;
  const pathsByCenter = useStore(s => s.pathsByCenter);
  const visible = useStore(s => s.visiblePathKinds);
  const setCenter = useStore(s => s.setCenter);
  const exitToHome = useStore(s => s.exitToHome);
  const moveElement = useStore(s => s.moveElement);
  const reorderChildren = useStore(s => s.reorderChildren);
  const cameFromNews = useStore(s => s.cameFromNews);
  const setAppView = useStore(s => s.setAppView);
  const [selectedId, setSelectedId] = useState(centerId);
  const [scene, setScene] = useState<LearningScene>("tree");
  const [treeExpanded, setTreeExpanded] = useState(false);
  const [detailOpenSignal, setDetailOpenSignal] = useState(0);

  function openDetail(elementId: string) {
    setSelectedId(elementId);
    // Don't exit tree-expanded mode here — the panel is always mounted (just
    // visually hidden when expanded), and it renders its fullscreen view via
    // a portal on document.body. So opening detail does NOT change the
    // underlying tree layout; closing detail returns the user to whatever
    // state they had before (expanded or not).
    setDetailOpenSignal(n => n + 1);
  }

  const view = selectCenterView({ centerId, elements, relations });
  const selected = elements.get(selectedId) ?? view.center;
  // CSS color vars follow the SELECTED element, not the centered topic — so
  // clicking a 实战元 visibly shifts the whole page to red, a 概念元 to teal,
  // etc. (Previously this used view.center, which never changed within a tree
  // so the page hue felt stuck on the topic's preset.)
  const centerStyle = centerStyleFor(selected);
  const paths = useMemo(
    () => (pathsByCenter.get(centerId) ?? []).filter(p => visible.has(p.kind)),
    [centerId, pathsByCenter, visible],
  );

  useEffect(() => {
    setSelectedId(centerId);
  }, [centerId]);

  // When arriving via a news card's 深入了解 link, auto-open the fullscreen
  // detail panel — the user wants the expanded view, not the inline tree.
  useEffect(() => {
    if (cameFromNews) setDetailOpenSignal(n => n + 1);
    // Intentional: only run on the cameFromNews edge from false → true. The
    // panel's openSignal is idempotent (increment forces re-open), so re-firing
    // is safe but unnecessary on every center change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameFromNews]);

  // ESC returns straight to news view when user got here via 深入了解, regardless
  // of whether the fullscreen detail is currently open. The fullscreen panel's
  // own ESC handler also fires (closes it), but since we're navigating away
  // from tree view, the unmount cancels everything cleanly.
  useEffect(() => {
    if (!cameFromNews) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAppView("news");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cameFromNews, setAppView]);

  // Shared handler for HTML5 drag-drop. Behavior depends on whether source
  // and target share a parent, and where on the target card the cursor
  // landed:
  //   * Siblings (same parent) → reorder source before/after target. No
  //     confirm dialog — this is a cheap visual reshuffle, instantly
  //     reversible. Dropping onto the center third also reorders (places
  //     source just before target).
  //   * Different parents → reparent (existing behavior, with confirm).
  const handleDropOnto = (sourceId: string, targetId: string, side: import("../lib/elementDnd.js").DropSide) => {
    if (sourceId === targetId) return;
    const src = elements.get(sourceId);
    const tgt = elements.get(targetId);
    if (!src || !tgt) return;

    const parentOf = (id: string) => relations.find(r => r.kind === "child" && r.to === id)?.from;
    const srcParent = parentOf(sourceId);
    const tgtParent = parentOf(targetId);

    if (srcParent && srcParent === tgtParent) {
      // Reorder among siblings.
      const siblingIds = relations
        .filter(r => r.kind === "child" && r.from === srcParent)
        .map(r => r.to);
      const without = siblingIds.filter(id => id !== sourceId);
      const targetIdx = without.indexOf(targetId);
      if (targetIdx < 0) return;
      const insertAt = side === "after" ? targetIdx + 1 : targetIdx;
      const next = [...without.slice(0, insertAt), sourceId, ...without.slice(insertAt)];
      void reorderChildren(srcParent, next).catch(err => {
        window.alert(`换位置失败：${err instanceof Error ? err.message : String(err)}`);
      });
      return;
    }
    // Cross-parent → reparent. Confirm because it changes hierarchy.
    if (!window.confirm(`把「${src.title}」移到「${tgt.title}」下？`)) return;
    void moveElement(sourceId, targetId).catch(err => {
      window.alert(`移动失败：${err instanceof Error ? err.message : String(err)}`);
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(centerStyle.vars)) {
      if (typeof value === "string") root.style.setProperty(key, value);
    }
  }, [centerStyle.vars]);

  const pathsForElement = (id: string) =>
    paths.filter(p => p.steps.includes(id));

  const childrenCount = relations.filter(relation => relation.kind === "child" && relation.from === selected.id).length;
  const selectedPath = lineageFor(selected.id, elements, relations);
  // Breadcrumb follows the focused element (selected), not just the center,
  // so deep-clicks reveal the full root → L2 → L3 → … chain.
  const centerBreadcrumb = selectedPath.length > 5 ? selectedPath.slice(-5) : selectedPath;
  const currentLevel = selectedPath.length;
  const maxDepth = Math.max(
    1,
    ...Array.from(elements.keys()).map(id => depthFor(id, relations)),
  );
  const treeMap = (
    <KnowledgeStructureMap
      view={view}
      selectedId={selected.id}
      relations={relations}
      elements={elements}
      totalElements={elements.size}
      currentLevel={currentLevel}
      maxDepth={maxDepth}
      pathsForElement={pathsForElement}
      onSelect={setSelectedId}
      onSetCenter={setCenter}
      onDropOnto={handleDropOnto}
      expanded={treeExpanded}
      onToggleExpand={() => setTreeExpanded(v => !v)}
      onOpenDetail={openDetail}
    />
  );

  return (
    <div className="tree-view" style={centerStyle.vars} data-center-style={centerStyle.name}>
      <TopBar
        onBrandClick={exitToHome}
        breadcrumb={
          <>
            {cameFromNews && (
              <button
                type="button"
                className="tv-back-to-news"
                onClick={() => setAppView("news")}
                title="返回早报（也可按 ESC）"
              >
                ← 返回早报
              </button>
            )}
            {centerBreadcrumb.map((item, index) => {
              const isCurrent = index === centerBreadcrumb.length - 1;
              return (
                <button
                  key={item.id}
                  className={isCurrent ? "now" : ""}
                  type="button"
                  title={isCurrent ? "当前查看" : "点击导航到这里"}
                  onClick={() => { setSelectedId(item.id); setCenter(item.id); }}
                >
                  {item.title}
                </button>
              );
            })}
          </>
        }
      />

      <LearningSidebar
        view={view}
        selectedId={selected.id}
        elements={elements}
        relations={relations}
        paths={pathsForElement(selected.id)}
        scene={scene}
        onSelect={setSelectedId}
        onSetCenter={setCenter}
        onOpenDetail={openDetail}
        onSceneChange={setScene}
        onDropOnto={handleDropOnto}
      />
      {scene === "tree" ? (
        <main className={`tv-main${treeExpanded ? " tv-main--tree-expanded" : ""}`}>
          {treeMap}
          {/* Always mount the panel so its openSignal listener works even while
              tree is expanded. CSS hides the inline view in expanded mode; the
              fullscreen view (portal on body) shows up regardless. */}
          <div className="tv-main__panel-slot" data-hidden={treeExpanded ? "true" : undefined}>
            <ElementContentPanel
              element={selected}
              childrenCount={childrenCount}
              currentLevel={currentLevel}
              onOpenChildren={() => setCenter(selected.id)}
              onSelect={setSelectedId}
              openSignal={detailOpenSignal}
              hideFullscreenToggle={cameFromNews}
              onAfterDelete={cameFromNews ? () => setAppView("news") : undefined}
              leftSidebarFullscreen={(
                <LearningSidebar
                  view={view}
                  selectedId={selected.id}
                  elements={elements}
                  relations={relations}
                  paths={pathsForElement(selected.id)}
                  scene={scene}
                  onSelect={setSelectedId}
                  onSetCenter={setCenter}
                  onOpenDetail={openDetail}
                  onSceneChange={setScene}
                  onDropOnto={handleDropOnto}
                  compact
                />
              )}
            />
          </div>
        </main>
      ) : (
        <LearningScenes
          scene={scene}
          selected={selected}
          currentLevel={currentLevel}
          totalElements={elements.size}
          maxDepth={maxDepth}
          childrenCount={childrenCount}
          treeMap={treeMap}
          onOpenChildren={() => setCenter(selected.id)}
        />
      )}

      <footer className="tv-footer">
        <div>当前路径：{selectedPath.map(item => item.title).join("  >  ")}</div>
        <FooterTaskStrip />
      </footer>
    </div>
  );
}

function depthFor(id: string, relations: { kind: string; from: string; to: string }[]) {
  let depth = 1;
  let current = id;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const parent = relations.find(relation => relation.kind === "child" && relation.to === current)?.from;
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

function lineageFor(
  id: string,
  elements: Map<string, { id: string; title: string }>,
  relations: { kind: string; from: string; to: string }[],
) {
  const chain: Array<{ id: string; title: string }> = [];
  let current: string | undefined = id;
  const seen = new Set<string>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const element = elements.get(current);
    if (element) chain.unshift(element);
    current = relations.find(relation => relation.kind === "child" && relation.to === current)?.from;
  }

  return chain.length > 0 ? chain : Array.from(elements.values()).slice(0, 1);
}

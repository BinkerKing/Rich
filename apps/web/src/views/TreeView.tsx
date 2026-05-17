import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store.js";
import { selectCenterView } from "@ke/domain";
import { KnowledgeStructureMap } from "../components/KnowledgeStructureMap.js";
import { LearningSidebar } from "../components/LearningSidebar.js";
import { ElementContentPanel } from "../components/ElementContentPanel.js";
import { Icon } from "../components/Icon.js";
import { LearningScenes, type LearningScene } from "../components/LearningScenes.js";
import { SystemPanel, type SystemPanelMode } from "../components/SystemPanel.js";
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
  const [selectedId, setSelectedId] = useState(centerId);
  const [scene, setScene] = useState<LearningScene>("tree");
  const [systemMode, setSystemMode] = useState<SystemPanelMode>("search");

  const view = selectCenterView({ centerId, elements, relations });
  const centerStyle = centerStyleFor(view.center);
  const selected = elements.get(selectedId) ?? view.center;
  const paths = useMemo(
    () => (pathsByCenter.get(centerId) ?? []).filter(p => visible.has(p.kind)),
    [centerId, pathsByCenter, visible],
  );

  useEffect(() => {
    setSelectedId(centerId);
  }, [centerId]);

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
    />
  );

  return (
    <div className="tree-view" style={centerStyle.vars} data-center-style={centerStyle.name}>
      <header className="tv-topbar">
        <div className="tv-brand">
          <button
            type="button"
            className="tv-home-button"
            title="返回首页"
            aria-label="返回首页"
            onClick={exitToHome}
          >
            <span className="tv-logo" />
            <strong>Know Everything</strong>
          </button>
        </div>
        <nav className="tv-crumb" aria-label="当前位置">
          {centerBreadcrumb.map((item, index) => {
            const isCurrent = index === centerBreadcrumb.length - 1;
            return (
              <button
                key={item.id}
                className={isCurrent ? "now" : ""}
                type="button"
                title={isCurrent ? "当前查看" : "点击切到这里 · 双击设为中心"}
                onClick={() => setSelectedId(item.id)}
                onDoubleClick={() => { setSelectedId(item.id); setCenter(item.id); }}
              >
                {item.title}
              </button>
            );
          })}
        </nav>
        <div className="tv-tools">
          <button className={systemMode === "search" ? "is-active" : ""} type="button" aria-label="搜索" onClick={() => setSystemMode("search")}><Icon name="search" /></button>
          <button className={systemMode === "view" ? "is-active" : ""} type="button" aria-label="视图" onClick={() => setSystemMode("view")}><Icon name="grid" /></button>
          <button className={systemMode === "map" ? "is-active" : ""} type="button" aria-label="知识地图" onClick={() => setSystemMode("map")}><Icon name="map" /></button>
          <button className={systemMode === "notice" ? "is-active" : ""} type="button" aria-label="通知" onClick={() => setSystemMode("notice")}><Icon name="bell" /></button>
          <span>K</span>
        </div>
      </header>

      <LearningSidebar
        view={view}
        selectedId={selected.id}
        elements={elements}
        relations={relations}
        paths={pathsForElement(selected.id)}
        scene={scene}
        onSelect={setSelectedId}
        onSetCenter={setCenter}
        onSceneChange={setScene}
      />
      {scene === "tree" ? (
        <main className="tv-main">
          {treeMap}
          <ElementContentPanel
            element={selected}
            childrenCount={childrenCount}
            currentLevel={currentLevel}
            onOpenChildren={() => setCenter(selected.id)}
          />
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

      <SystemPanel
        mode={systemMode}
        selected={selected}
        elements={elements}
        onSelect={setSelectedId}
      />

      <footer className="tv-footer">
        <div>当前路径：{selectedPath.map(item => item.title).join("  >  ")}</div>
        <div className="footer-actions">
          <button type="button"><Icon name="center" />定位</button>
          <button type="button"><Icon name="calendar" />加入计划</button>
          <button type="button"><Icon name="upload" />导出</button>
        </div>
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

import type { CenterView, Element, LearningPath, Relation } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import type { LearningScene } from "./LearningScenes.js";
import { learningScenes } from "./LearningScenes.js";
import "./components.css";

interface Props {
  view: CenterView;
  selectedId: string;
  elements: Map<string, Element>;
  relations: Relation[];
  paths: LearningPath[];
  scene: LearningScene;
  onSelect: (id: string) => void;
  onSetCenter: (id: string) => void;
  onSceneChange: (scene: LearningScene) => void;
}

export function LearningSidebar({
  view,
  selectedId,
  elements,
  relations,
  paths,
  scene,
  onSelect,
  onSetCenter,
  onSceneChange,
}: Props) {
  const selected = elements.get(selectedId) ?? view.center;
  const centerChain = lineageFor(view.center.id, elements, relations);
  const parentId = directParentId(selectedId, relations);
  const lateral = parentId
    ? directChildren(parentId, elements, relations)
    : directChildren(selectedId, elements, relations);
  const lateralLabel = parentId ? "同级元" : "下级元";

  return (
    <aside className="learning-sidebar">
      <section>
        <h2>学习导航</h2>

        <div className="sidebar-label">上级元</div>
        <div className="ancestor-list">
          {centerChain.map((item, index) => (
            <button
              key={item.id}
              className={item.id === view.center.id ? "is-center" : ""}
              type="button"
              onClick={() => {
                onSelect(item.id);
                onSetCenter(item.id);
              }}
            >
              <span className="mini-icon"><Icon name={iconForElement(item.type, item.title)} /></span>
              <span className="sidebar-node__title">{item.title}</span>
              <em>L{index + 1}</em>
            </button>
          ))}
        </div>

        <div className="sidebar-label">{lateralLabel}</div>
        <div className="sidebar-list">
          {lateral.map(child => (
            <SidebarItem
              key={child.id}
              element={child}
              active={selectedId === child.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="sidebar-label">推荐学习路径</div>
        <div className="path-list">
          {paths.map(path => (
            <button key={path.id} type="button" className={`path-card path-card--${path.color}`}>
              <strong>{path.label}</strong>
              <span>{path.estimatedTime ?? "按当前结构学习"}</span>
            </button>
          ))}
          {paths.length === 0 && (
            <button type="button" className="path-card">
              <strong>当前分支</strong>
              <span>沿下层知识元继续学习</span>
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="sidebar-label">页面场景</div>
        <div className="scene-list">
          {learningScenes.map(item => (
            <button
              key={item.id}
              className={scene === item.id ? "is-active" : ""}
              type="button"
              onClick={() => onSceneChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function directParentId(id: string, relations: Relation[]) {
  return relations.find(relation => relation.kind === "child" && relation.to === id)?.from;
}

function directChildren(id: string, elements: Map<string, Element>, relations: Relation[]) {
  return relations
    .filter(relation => relation.kind === "child" && relation.from === id)
    .map(relation => elements.get(relation.to))
    .filter((element): element is Element => Boolean(element));
}

function lineageFor(id: string, elements: Map<string, Element>, relations: Relation[]) {
  const chain: Element[] = [];
  let current: string | undefined = id;
  const seen = new Set<string>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const element = elements.get(current);
    if (element) chain.unshift(element);
    current = directParentId(current, relations);
  }

  return chain;
}

function SidebarItem({
  element,
  active,
  onSelect,
}: {
  element: Element;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className={`sidebar-node ${active ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelect(element.id)}
    >
      <span className="mini-icon"><Icon name={iconForElement(element.type, element.title)} /></span>
      <span className="sidebar-node__title">{element.title}</span>
    </button>
  );
}

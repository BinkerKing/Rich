import { useState } from "react";
import type { CenterView, Element, LearningPath, Relation } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import type { LearningScene } from "./LearningScenes.js";
import { learningScenes } from "./LearningScenes.js";
import { elementDragProps, useDropTarget } from "../lib/elementDnd.js";
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
  onDropOnto?: (sourceId: string, targetId: string) => void;
  /** Compact mode: hide 推荐学习路径 and 页面场景, keep only hierarchical nav.
   *  Used when embedded inside the fullscreen element-content panel. */
  compact?: boolean;
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
  onDropOnto,
  compact = false,
}: Props) {
  // 上级元 = ancestors of the SELECTED element, excluding the element itself.
  // For the root, this is empty.
  const ancestorChain = lineageFor(selectedId, elements, relations).slice(0, -1);
  const parentId = directParentId(selectedId, relations);
  // 同级元: siblings of the selected element (children of its parent, minus self).
  // For the root, this section is empty (no parent).
  const siblings = parentId
    ? directChildren(parentId, elements, relations).filter(el => el.id !== selectedId)
    : [];
  // 下级元: direct children of the selected element.
  const children = directChildren(selectedId, elements, relations);

  return (
    <aside className="learning-sidebar">
      <section>
        <h2>学习导航</h2>

        {ancestorChain.length > 0 ? (
          <>
            <div className="sidebar-label">上级元</div>
            <div className="ancestor-list">
              {ancestorChain.map((item, index) => (
                <button
                  key={item.id}
                  className={item.id === view.center.id ? "is-center" : ""}
                  type="button"
                  title="点击导航到这里"
                  onClick={() => { onSelect(item.id); onSetCenter(item.id); }}
                >
                  <span className="mini-icon"><Icon name={iconForElement(item.type, item.title)} /></span>
                  <span className="sidebar-node__title">{item.title}</span>
                  <em>L{index + 1}</em>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {siblings.length > 0 && (
          <>
            <div className="sidebar-label">同级元</div>
            <div className="sidebar-list">
              {siblings.map(child => (
                <SidebarItem
                  key={child.id}
                  element={child}
                  active={selectedId === child.id}
                  onSelect={onSelect}
                  onSetCenter={onSetCenter}
                  onDropOnto={onDropOnto}
                />
              ))}
            </div>
          </>
        )}

        {children.length > 0 && (
          <>
            <div className="sidebar-label">下级元</div>
            <div className="sidebar-list">
              {children.map(child => (
                <SidebarItem
                  key={child.id}
                  element={child}
                  active={selectedId === child.id}
                  onSelect={onSelect}
                  onSetCenter={onSetCenter}
                  onDropOnto={onDropOnto}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {!compact && (
        <section>
          <div className="sidebar-label">推荐学习路径</div>
          <PathList paths={paths} elements={elements} onSelect={onSelect} />
        </section>
      )}

      {!compact && (
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
      )}
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

function PathList({
  paths,
  elements,
  onSelect,
}: {
  paths: LearningPath[];
  elements: Map<string, Element>;
  onSelect: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (paths.length === 0) {
    return (
      <div className="path-list">
        <button type="button" className="path-card">
          <strong>当前分支</strong>
          <span>沿下层知识元继续学习</span>
        </button>
      </div>
    );
  }
  return (
    <div className="path-list">
      {paths.map(path => {
        const expanded = expandedId === path.id;
        return (
          <div key={path.id} className="path-card-wrap">
            <button
              type="button"
              className={`path-card path-card--${path.color} ${expanded ? "is-expanded" : ""}`}
              onClick={() => setExpandedId(expanded ? null : path.id)}
              aria-expanded={expanded}
            >
              <strong>{path.label}</strong>
              <span>{path.estimatedTime ?? "按当前结构学习"} · {path.steps.length} 步</span>
            </button>
            {expanded && (
              <ol className="path-steps">
                {path.steps.map((stepId, i) => {
                  const el = elements.get(stepId);
                  return (
                    <li key={`${stepId}-${i}`}>
                      <button
                        type="button"
                        className="path-step-button"
                        onClick={() => onSelect(stepId)}
                        disabled={!el}
                      >
                        <span className="path-step-num">{i + 1}</span>
                        <span className="path-step-title">{el?.title ?? `(缺失: ${stepId})`}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SidebarItem({
  element,
  active,
  onSelect,
  onSetCenter,
  onDropOnto,
}: {
  element: Element;
  active: boolean;
  onSelect: (id: string) => void;
  onSetCenter?: (id: string) => void;
  onDropOnto?: (sourceId: string, targetId: string) => void;
}) {
  const drop = useDropTarget(element.id, src => onDropOnto?.(src, element.id));
  return (
    <button
      className={`sidebar-node ${active ? "is-active" : ""}${drop.isOver ? " is-drop-over" : ""}`}
      type="button"
      title="单击查看 · 双击设为中心元 · 可拖动 · 拖到这里 = 设为新父元"
      onClick={() => onSelect(element.id)}
      onDoubleClick={() => {
        onSelect(element.id);
        onSetCenter?.(element.id);
      }}
      {...elementDragProps(element.id)}
      {...drop.bind}
    >
      <span className="mini-icon"><Icon name={iconForElement(element.type, element.title)} /></span>
      <span className="sidebar-node__title">{element.title}</span>
    </button>
  );
}

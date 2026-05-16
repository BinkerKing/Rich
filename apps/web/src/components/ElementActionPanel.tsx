import type { Element, LearningPath } from "@ke/domain";
import type { LearningScene } from "./LearningScenes.js";
import { learningScenes } from "./LearningScenes.js";
import "./components.css";

interface Props {
  paths: LearningPath[];
  scene: LearningScene;
  onSceneChange: (scene: LearningScene) => void;
}

export function ElementActionPanel({ paths, scene, onSceneChange }: Props) {
  return (
    <aside className="action-panel">
      <section>
        <h2>推荐学习路径</h2>
        <div className="path-list">
          {(paths.length > 0 ? paths : []).map(path => (
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
        <h2>页面场景</h2>
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

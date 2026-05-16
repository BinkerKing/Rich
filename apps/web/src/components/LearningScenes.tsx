import type { Element } from "@ke/domain";
import { ElementContentPanel } from "./ElementContentPanel.js";
import "./LearningScenes.css";

export type LearningScene =
  | "tree"
  | "read"
  | "graft"
  | "practice"
  | "tasks";

export const learningScenes: Array<{ id: LearningScene; label: string }> = [
  { id: "tree", label: "学习树" },
  { id: "read", label: "知识阅读" },
  { id: "graft", label: "AI 接枝" },
  { id: "practice", label: "实战元" },
  { id: "tasks", label: "任务中心" },
];

interface Props {
  scene: LearningScene;
  selected: Element;
  currentLevel: number;
  totalElements: number;
  maxDepth: number;
  childrenCount: number;
  treeMap: React.ReactNode;
  onOpenChildren: () => void;
}

const searchResults = [
  ["强关联", "工作记忆", "位于记忆系统下层，可从当前分支继续展开"],
  ["中关联", "认知负荷", "连接注意控制与记忆系统，需要补齐中间桥接元"],
  ["弱关联", "创意写作", "更适合作为新实战树，后续复盘再考虑融合"],
];

const practiceSteps = [
  ["需求拆解", "把想做的作品拆成目标、受众、输入、输出和约束"],
  ["知识补齐", "补齐做成作品必须掌握的概念、工具和判断标准"],
  ["原型制作", "先做一个最小可运行版本，用结果倒逼学习"],
  ["质量验收", "建立评估表，检查作品是否真的达到可用标准"],
  ["复盘沉淀", "把踩坑、偏好、有效提示词沉淀成经验"],
];

const taskRows = [
  ["已完成", "生成 1992 元测试树", "已合入前端演示数据"],
  ["进行中", "优化学习树视觉层级", "固定视口与内部滚动"],
  ["排队中", "接入 AI 搜索定位", "等待后端任务接口稳定"],
  ["排队中", "生成实战元作品页", "需要实战元 schema"],
  ["观察中", "复盘用户修改偏好", "收集高频反馈"],
];

const styleTokens = [
  ["结构密度", "中高", "适合 1992 元测试树快速定位"],
  ["光感强度", "高", "边界、中心、当前元都有明显发光"],
  ["叙事风格", "学习教练", "先定位，再解释，再给下一步"],
  ["内容颗粒度", "中档", "骨架完整，细节按需展开"],
  ["动效节奏", "克制", "只强化状态，不打断阅读"],
];

export function LearningScenes({
  scene,
  selected,
  currentLevel,
  totalElements,
  maxDepth,
  childrenCount,
  treeMap,
  onOpenChildren,
}: Props) {
  if (scene === "tree") {
    return (
      <main className="tv-main">
        {treeMap}
        <ElementContentPanel
          element={selected}
          childrenCount={childrenCount}
          currentLevel={currentLevel}
          onOpenChildren={onOpenChildren}
        />
      </main>
    );
  }

  return (
    <main className={`scene-main scene-main--${scene}`}>
      <SceneHeader
        title={sceneTitle(scene)}
        eyebrow={`L${currentLevel} · ${selected.title}`}
        totalElements={totalElements}
        maxDepth={maxDepth}
      />
      {scene === "read" && <ReadScene selected={selected} currentLevel={currentLevel} childrenCount={childrenCount} onOpenChildren={onOpenChildren} />}
      {scene === "graft" && <GraftScene selected={selected} />}
      {scene === "practice" && <PracticeScene selected={selected} />}
      {scene === "tasks" && <TasksScene />}
    </main>
  );
}

function sceneTitle(scene: LearningScene) {
  return {
    tree: "学习树",
    read: "知识阅读",
    graft: "AI 接枝搜索",
    practice: "实战元工作台",
    tasks: "任务中心",
  }[scene];
}

function SceneHeader({
  title,
  eyebrow,
  totalElements,
  maxDepth,
}: {
  title: string;
  eyebrow: string;
  totalElements: number;
  maxDepth: number;
}) {
  return (
    <header className="scene-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="scene-stats">
        <strong>{totalElements}</strong><em>元</em>
        <strong>{maxDepth}</strong><em>层</em>
      </div>
    </header>
  );
}

function ReadScene({
  selected,
  currentLevel,
  childrenCount,
  onOpenChildren,
}: {
  selected: Element;
  currentLevel: number;
  childrenCount: number;
  onOpenChildren: () => void;
}) {
  return (
    <div className="scene-read-grid">
      <ElementContentPanel
        element={selected}
        childrenCount={childrenCount}
        currentLevel={currentLevel}
        onOpenChildren={onOpenChildren}
      />
      <aside className="reading-lens">
        <h2>阅读透镜</h2>
        <div className="lens-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {["先用一句话复述", "找上层来源", "看下层方向", "转成一个练习"].map(item => (
          <button key={item} type="button">{item}</button>
        ))}
      </aside>
    </div>
  );
}

function GraftScene({ selected }: { selected: Element }) {
  return (
    <div className="graft-layout">
      <section className="graft-query">
        <div className="graft-input">我突然想了解：认知负荷如何影响学习效率？</div>
        <div className="graft-beam" />
        <div className="graft-node">{selected.title}</div>
      </section>
      <section className="graft-results">
        {searchResults.map(([level, title, reason]) => (
          <article key={title}>
            <span>{level}</span>
            <h2>{title}</h2>
            <p>{reason}</p>
            <button type="button">接入此分支</button>
          </article>
        ))}
      </section>
    </div>
  );
}

function PracticeScene({ selected }: { selected: Element }) {
  return (
    <div className="practice-board">
      <section className="practice-hero">
        <span>实战元</span>
        <h2>围绕「{selected.title}」生成一个可完成的作品</h2>
        <p>从知识元出发，补齐需求、路径、工具、验收标准，最后产出一个独立 HTML 产品页或项目作品。</p>
      </section>
      <section className="practice-steps">
        {practiceSteps.map(([title, desc], index) => (
          <article key={title}>
            <em>{String(index + 1).padStart(2, "0")}</em>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function TasksScene() {
  return (
    <div className="tasks-board">
      {taskRows.map(([status, title, detail]) => (
        <article key={title} className={`task-card task-card--${status}`}>
          <span>{status}</span>
          <h2>{title}</h2>
          <p>{detail}</p>
          <div className="task-progress"><i /></div>
        </article>
      ))}
    </div>
  );
}

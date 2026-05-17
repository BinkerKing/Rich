import { useState } from "react";
import type { RichnessLevel } from "@ke/domain";
import { useStore } from "../state/store.js";
import "./InputView.css";

const RICHNESS_LEVELS: { label: string; value: RichnessLevel }[] = [
  { label: "低档", value: 1 },
  { label: "中档", value: 2 },
  { label: "高档", value: 3 },
  { label: "深度", value: 4 },
  { label: "专家", value: 5 },
];

export function InputView() {
  const [topic, setTopic] = useState("");
  const [intent, setIntent] = useState<"learn" | "practice">("learn");
  const [richness, setRichness] = useState<RichnessLevel>(2);
  const generate = useStore(s => s.generate);
  const enterTree = useStore(s => s.enterTree);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const deltaText = useStore(s => s.inflight.get("generate:_")?.delta ?? "");
  const loadDemoTree = useStore(s => s.loadDemoTree);
  const availableTopics = useStore(s => s.availableTopics);
  const lastCenterId = useStore(s => s.lastCenterId);
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    const prefixed = intent === "practice" ? `项目目标：${topic.trim()}` : topic.trim();
    void generate(prefixed, { richness });
  }

  // For each topic compute a quick stat: how many descendants does it own?
  const topicStats = availableTopics.map(topic => {
    const desc = countDescendants(topic.id, relations);
    return { topic, desc };
  });

  const lastCenter = lastCenterId ? elements.get(lastCenterId) : null;
  const lastCenterRoot = lastCenterId ? rootOf(lastCenterId, relations) : null;
  const lastCenterRootEl = lastCenterRoot ? elements.get(lastCenterRoot) : null;

  return (
    <div className="input-view">
      <header className="home-topbar">
        <div className="brand">
          <div className="logo" />
          <strong>Know Everything</strong>
        </div>
      </header>
      <div className="input-shell">
        <div className="home-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1>你想学习或完成什么？</h1>
        <p className="sub">输入主题、概念，或一个想做出来的项目。</p>

        <div className="segmented" aria-label="输入类型">
          <button className={intent === "learn" ? "is-active" : ""} type="button" onClick={() => setIntent("learn")}>学习主题</button>
          <button className={intent === "practice" ? "is-active" : ""} type="button" onClick={() => setIntent("practice")}>实战目标</button>
        </div>

        <form onSubmit={submit}>
          <input
            autoFocus
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder={intent === "learn" ? "例如：认知心理学 / 光合作用 / React 动画" : "例如：用 AI 做一部 15 分钟短电影"}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !topic.trim()}>
            {loading ? "生成中" : "开始"}
          </button>
        </form>

        <div className="richness-picker" aria-label="内容丰富度">
          {RICHNESS_LEVELS.map(level => (
            <button
              key={level.value}
              className={richness === level.value ? "is-active" : ""}
              type="button"
              onClick={() => setRichness(level.value)}
            >
              {level.label}
            </button>
          ))}
        </div>

        {lastCenterRootEl && lastCenter && (
          <button
            className="resume-card"
            type="button"
            onClick={() => void enterTree(lastCenterRootEl.id)}
          >
            <span className="resume-card__label">继续上次学习</span>
            <strong>{lastCenterRootEl.title}</strong>
            <em>停在「{lastCenter.title}」</em>
          </button>
        )}

        {topicStats.length > 0 && (
          <section className="topic-list">
            <header>已有主题</header>
            <div className="topic-grid">
              {topicStats.map(({ topic, desc }) => (
                <button
                  key={topic.id}
                  type="button"
                  className="topic-card"
                  onClick={() => void enterTree(topic.id)}
                >
                  <strong>{topic.title}</strong>
                  {topic.subtitle && <p>{topic.subtitle}</p>}
                  <em>{desc} 个元 · {topic.domain ?? "通用"}</em>
                </button>
              ))}
            </div>
          </section>
        )}

        <button className="demo-tree-button" type="button" onClick={loadDemoTree}>
          查看 10 层 · 1992 元测试树（仅 UI 演示）
        </button>

        {loading && (
          <div className="streaming">
            <div className="status">AI 正在生成知识树</div>
            {deltaText && <pre className="preview">{deltaText.slice(-1200)}</pre>}
          </div>
        )}
        {error && <div className="err">{error}</div>}
      </div>
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

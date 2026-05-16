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
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const deltaText = useStore(s => s.inflight.get("generate:_")?.delta ?? "");
  const loadDemoTree = useStore(s => s.loadDemoTree);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    const prefixed = intent === "practice" ? `项目目标：${topic.trim()}` : topic.trim();
    void generate(prefixed, { richness });
  }

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

        <button className="demo-tree-button" type="button" onClick={loadDemoTree}>
          查看 10 层 · 1992 元测试树
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

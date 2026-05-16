import { useState } from "react";
import { useStore } from "../state/store.js";
import "./InputView.css";

export function InputView() {
  const [topic, setTopic] = useState("");
  const generate = useStore(s => s.generate);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const deltaText = useStore(s => s.deltaText);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    void generate(topic.trim());
  }

  return (
    <div className="input-view">
      <div className="input-shell">
        <div className="brand">
          <div className="logo" />
          <strong>Know Everything</strong>
        </div>
        <h1>你想了解什么？</h1>
        <p className="sub">输入一个主题、概念，或一个想完成的项目目标。</p>
        <form onSubmit={submit}>
          <input
            autoFocus
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="例如：认知心理学 / 用 AI 写一篇小说 / React 动画…"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !topic.trim()}>
            {loading ? "正在生成知识树…" : "开始 →"}
          </button>
        </form>
        {loading && (
          <div className="streaming">
            <div className="status">AI 正在生成知识树…</div>
            {deltaText && <pre className="preview">{deltaText.slice(-1200)}</pre>}
          </div>
        )}
        {error && <div className="err">{error}</div>}
        <div className="hint">提示：第一阶段无论输入什么，都会返回 "认知心理学" 的示例树。</div>
      </div>
    </div>
  );
}

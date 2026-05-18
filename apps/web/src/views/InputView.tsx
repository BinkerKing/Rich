import { useEffect, useState } from "react";
import type { RichnessLevel } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api, type AnalyzeInputResult, type AttachOption } from "../api/client.js";
import { Icon } from "../components/Icon.js";
import { ThemeSwitch } from "../components/ThemeSwitch.js";
import { EmbeddedTaskList } from "../components/EmbeddedTaskList.js";
import "./InputView.css";

type SpecMap = Record<string, { label: string; structure: string; content: string }>;

const RICHNESS_LEVELS: { label: string; value: RichnessLevel }[] = [
  { label: "低档", value: 1 },
  { label: "中档", value: 2 },
  { label: "高档", value: 3 },
  { label: "深度", value: 4 },
  { label: "专家", value: 5 },
];

export function InputView() {
  const [topic, setTopic] = useState("");
  const [richness, setRichness] = useState<RichnessLevel>(3);
  const [specs, setSpecs] = useState<SpecMap | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeInputResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzedText, setAnalyzedText] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    api.getRichnessSpec()
      .then(s => { if (!cancelled) setSpecs(s); })
      .catch(() => { /* keep UI usable without spec */ });
    return () => { cancelled = true; };
  }, []);
  const generate = useStore(s => s.generate);
  const expand = useStore(s => s.expand);
  const enterTree = useStore(s => s.enterTree);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const deltaText = useStore(s => s.inflight.get("generate:_")?.delta ?? "");
  const availableTopics = useStore(s => s.availableTopics);
  const lastCenterId = useStore(s => s.lastCenterId);
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = topic.trim();
    if (!raw || analyzing) return;
    setAnalyzeError(null);
    setAnalyzing(true);
    setAnalyzedText(raw);
    try {
      const result = await api.analyzeInput(raw, "codex");
      setAnalysis(result);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  function chooseOption(opt: AttachOption) {
    const userText = analyzedText;
    const cleanTitle = analysis?.topic ?? userText;
    if (opt.kind === "new-topic") {
      // Use AI-distilled clean title as the topic so the root element is
      // titled nicely instead of carrying the user's raw paragraph.
      void generate(cleanTitle, { richness, model: "codex" });
    } else if (opt.kind === "attach-direct") {
      const direction = `请在该父元下创建 1 个新元，标题为「${cleanTitle}」，内容要覆盖用户的完整意图：${userText}`;
      void expand(opt.parentId, 1, direction, "codex");
    } else if (opt.kind === "attach-with-bridge") {
      const chain = [...opt.bridges, cleanTitle].join(" → ");
      const direction = `请在该父元下按以下层级链创建：${chain}。每层只创建 1 个元，最深一层的标题恰好为「${cleanTitle}」，并要覆盖用户完整意图：${userText}`;
      void expand(opt.parentId, 1, direction, "codex");
    }
    // Clear the analysis state so the user can submit another topic.
    setAnalysis(null);
    setAnalyzedText("");
    setTopic("");
  }

  function cancelAnalysis() {
    setAnalysis(null);
    setAnalyzedText("");
    setAnalyzeError(null);
  }

  const topicStats = availableTopics.map(topic => {
    const desc = countDescendants(topic.id, relations);
    return { topic, desc };
  });

  const lastCenter = lastCenterId ? elements.get(lastCenterId) : null;
  const lastCenterRoot = lastCenterId ? rootOf(lastCenterId, relations) : null;
  const lastCenterRootEl = lastCenterRoot ? elements.get(lastCenterRoot) : null;

  return (
    <div className="tree-view home-shell" data-loading={loading ? "true" : undefined}>
      <header className="tv-topbar">
        <div className="tv-brand">
          <button type="button" className="tv-home-button" title="首页" aria-label="首页">
            <span className="tv-logo" />
            <strong>Know Everything</strong>
          </button>
        </div>
        <nav className="tv-crumb" aria-label="当前位置">
          <button type="button" className="now">首页</button>
        </nav>
        <div className="tv-tools">
          <button type="button" aria-label="搜索"><Icon name="search" /></button>
          <button type="button" aria-label="视图"><Icon name="grid" /></button>
          <button type="button" aria-label="知识地图"><Icon name="map" /></button>
          <button type="button" aria-label="通知"><Icon name="bell" /></button>
          <button type="button" aria-label="后台" title="后台管理" onClick={() => { window.location.hash = "/admin"; }}><Icon name="gear" /></button>
          <ThemeSwitch />
          <span>K</span>
        </div>
      </header>

      <aside className="learning-sidebar" aria-label="已有内容">
        {lastCenterRootEl && lastCenter && (
          <section>
            <div className="sidebar-label">继续学习</div>
            <button
              type="button"
              className="sidebar-node home-resume"
              onClick={() => void enterTree(lastCenterRootEl.id)}
            >
              <span className="sidebar-node__title">{lastCenterRootEl.title}</span>
              <em className="home-resume__sub">停在「{lastCenter.title}」</em>
            </button>
          </section>
        )}
        {topicStats.length > 0 && (
          <section>
            <div className="sidebar-label">已有主题</div>
            <div className="sidebar-list">
              {topicStats.map(({ topic, desc }) => (
                <button
                  key={topic.id}
                  type="button"
                  className="sidebar-node home-topic"
                  onClick={() => void enterTree(topic.id)}
                >
                  <span className="sidebar-node__title">{topic.title}</span>
                  {topic.subtitle && <span className="home-topic__sub">{topic.subtitle}</span>}
                  <em className="home-topic__meta">{desc} 个元 · {topic.domain ?? "通用"}</em>
                </button>
              ))}
            </div>
          </section>
        )}
      </aside>

      <main className="tv-main tv-main--home">
        <div className="home-hero">
          <h1>你想学习或完成什么？</h1>
          <p className="home-hero__sub">输入主题、概念，或一个想做出来的项目。</p>

          <form className="home-form" onSubmit={submit}>
            <input
              autoFocus
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="输入主题、概念、实战目标，或一个想法 — AI 会先帮你判断该挂在哪里"
              disabled={analyzing}
            />
            <button type="submit" disabled={!topic.trim() || analyzing}>
              {analyzing ? "判断中…" : "开始"}
            </button>
          </form>

          {analyzeError && <div className="home-err">解析失败：{analyzeError}</div>}

          {analysis && (
            <AnalysisCard
              analysis={analysis}
              analyzedText={analyzedText}
              onChoose={chooseOption}
              onCancel={cancelAnalysis}
            />
          )}

          <div className="home-richness" aria-label="内容丰富度">
            <span className="home-richness__label">内容丰富度</span>
            <div className="home-richness__buttons">
              {RICHNESS_LEVELS.map(level => (
                <button
                  key={level.value}
                  className={richness === level.value ? "is-active" : ""}
                  type="button"
                  onClick={() => setRichness(level.value)}
                  title={specs?.[String(level.value)]
                    ? `${specs[String(level.value)].label}\n结构：${specs[String(level.value)].structure}\n内容：${specs[String(level.value)].content}`
                    : level.label}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {specs?.[String(richness)] && (
            <div className="home-spec" role="note">
              <div className="home-spec__title">{specs[String(richness)].label}</div>
              <div className="home-spec__row"><strong>结构</strong><span>{specs[String(richness)].structure}</span></div>
              <div className="home-spec__row"><strong>内容</strong><span>{specs[String(richness)].content}</span></div>
            </div>
          )}

          {loading && (
            <div className="home-streaming">
              <div className="home-streaming__status">AI 正在生成知识树…</div>
              {deltaText && <pre className="home-streaming__preview">{deltaText.slice(-1200)}</pre>}
            </div>
          )}
          {error && <div className="home-err">{error}</div>}
        </div>
      </main>

      <aside className="system-panel" aria-label="任务">
        <header className="system-panel__head">
          <h2>AI 任务</h2>
        </header>
        <EmbeddedTaskList />
      </aside>

      <footer className="tv-footer">
        <div>共 {topicStats.length} 个已有主题 · 输入新主题或在左侧选择继续</div>
        <div className="footer-actions">
          <button type="button"><Icon name="search" />搜索</button>
          <button type="button"><Icon name="upload" />导入</button>
        </div>
      </footer>
    </div>
  );
}

function AnalysisCard({
  analysis,
  analyzedText,
  onChoose,
  onCancel,
}: {
  analysis: AnalyzeInputResult;
  analyzedText: string;
  onChoose: (opt: AttachOption) => void;
  onCancel: () => void;
}) {
  const candidatesById = new Map(analysis.candidates.map(c => [c.id, c] as const));
  return (
    <div className="home-analysis">
      <header className="home-analysis__head">
        <strong>AI 解析结果</strong>
        <button type="button" className="home-analysis__close" onClick={onCancel} aria-label="关闭">×</button>
      </header>
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
          const parentLabel = parent
            ? `${parent.parentPath.length > 0 ? parent.parentPath.join(" > ") + " > " : ""}${parent.title}`
            : null;
          return (
            <li key={i} className={`home-option home-option--${opt.kind}`}>
              <div className="home-option__head">
                <span className={`home-option__kind home-option__kind--${opt.kind}`}>
                  {opt.kind === "new-topic" ? "新建主题" : opt.kind === "attach-direct" ? "直接挂载" : "中间补层后挂载"}
                </span>
                <span className={`home-option__conf home-option__conf--${opt.confidence}`}>{
                  opt.confidence === "high" ? "置信度 高" : opt.confidence === "medium" ? "置信度 中" : "置信度 低"
                }</span>
              </div>
              {opt.kind !== "new-topic" && parentLabel && (
                <div className="home-option__where">挂在：<code>{parentLabel}</code></div>
              )}
              {opt.kind === "attach-with-bridge" && (
                <div className="home-option__bridge">补充层级：<code>{opt.bridges.join(" → ")} → {analyzedText}</code></div>
              )}
              <p className="home-option__reason">{opt.reasoning}</p>
              <button type="button" className="home-option__action" onClick={() => onChoose(opt)}>
                {opt.kind === "new-topic" ? "新建主题" : "按此挂载"} →
              </button>
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

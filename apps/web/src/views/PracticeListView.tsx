import { useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";

interface Props {
  onPickPractice: (id: string) => void;
}

export function PracticeListView({ onPickPractice }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // 只显示打开了"项目实战"开关的 practice 元；其他 practice（知识树里的"实战经验"种子数据）不进列表
  const practices = Array.from(elements.values())
    .filter(e => e.type === "practice")
    .filter(e => (e.tags ?? []).includes("实战项目"));

  // 新结构：practice → group → 实际子元。统计要穿透 group 层。
  const childrenOf = (parentId: string) => {
    const childIds = relations
      .filter(r => r.kind === "child" && r.from === parentId)
      .map(r => r.to);
    return childIds
      .map(id => elements.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e);
  };
  const statsOf = (practiceId: string) => {
    const direct = childrenOf(practiceId);
    // 收集所有 group 的子元 + 未分组的 loose children
    const all: typeof direct = [];
    for (const c of direct) {
      if (c.type === "group") all.push(...childrenOf(c.id));
      else all.push(c);  // 历史孤儿数据
    }
    // 新类型为主，老类型兼容（concept/case/product-design/step）
    const steps = all.filter(c => c.type === "dev-task" || c.type === "step");
    return {
      concepts: all.filter(c => c.type === "knowledge" || c.type === "concept").length,
      cases: all.filter(c => c.type === "requirement" || c.type === "case").length,
      features: all.filter(c => c.type === "feature").length,
      prds: all.filter(c => c.type === "prd" || c.type === "product-design").length,
      steps: steps.length,
      stepsDone: steps.filter(s => s.status === "done").length,
      revisions: all.filter(c => c.type === "revision").length,
      inquiriesPending: all.filter(c => c.type === "inquiry" && (c.status ?? "todo") !== "done").length,
    };
  };

  const createPractice = async (): Promise<void> => {
    const t = newTitle.trim();
    if (!t) return;
    try {
      const el = await api.createPracticeElement({ title: t });
      setNewTitle("");
      setCreating(false);
      await hydrate();
      onPickPractice(el.id);
    } catch (e) {
      alert(`创建失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="pv">
      <div className="pv__head">
        <div className="pv__title">项目实战</div>
        <div className="pv__sub">{practices.length} 个项目</div>
        <div style={{ flex: 1 }} />
        <button className="pv__create" onClick={() => setCreating(true)}>+ 新建项目</button>
      </div>

      {creating && (
        <div className="pv__create-bar">
          <input className="pv__create-input" autoFocus
            placeholder="项目标题（例：做一个 Chrome 插件 / 学完 React Server Components）"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void createPractice();
              if (e.key === "Escape") { setCreating(false); setNewTitle(""); }
            }} />
          <button className="pv__create-btn" onClick={() => void createPractice()} disabled={!newTitle.trim()}>创建</button>
          <button className="pv__create-cancel" onClick={() => { setCreating(false); setNewTitle(""); }}>取消</button>
        </div>
      )}

      <div className="pv__grid">
        {practices.map(p => {
          const s = statsOf(p.id);
          const stepPct = s.steps === 0 ? 0 : Math.round((s.stepsDone / s.steps) * 100);
          return (
            <button key={p.id} className="pv-card" onClick={() => onPickPractice(p.id)}>
              <div className="pv-card__title">{p.title}</div>
              {p.subtitle && <div className="pv-card__sub">{p.subtitle}</div>}
              <div className="pv-card__stats">
                <span className="pv-card__stat pv-card__stat--knowledge"   title="知识点">📚 {s.concepts}</span>
                <span className="pv-card__stat pv-card__stat--requirement" title="场景分析">🎯 {s.cases}</span>
                <span className="pv-card__stat pv-card__stat--feature"     title="功能说明">✨ {s.features}</span>
                <span className="pv-card__stat pv-card__stat--prd"         title="PRD">📄 {s.prds}</span>
                <span className="pv-card__stat pv-card__stat--dev-task"    title="开发任务">⚙️ {s.stepsDone}/{s.steps}</span>
                <span className="pv-card__stat pv-card__stat--revision"    title="整改建议">🔧 {s.revisions}</span>
                {s.inquiriesPending > 0 && (
                  <span className="pv-card__stat pv-card__stat--inquiry"   title="待回答提问">❓ {s.inquiriesPending}</span>
                )}
              </div>
              {s.steps > 0 && (
                <div className="pv-card__bar">
                  <span style={{ width: `${stepPct}%` }} />
                </div>
              )}
            </button>
          );
        })}
        {practices.length === 0 && !creating && (
          <div className="pv__empty">
            还没有实战项目。点上方 <b>+ 新建项目</b>，或让 Hermes 帮你建一个。
          </div>
        )}
      </div>
    </div>
  );
}

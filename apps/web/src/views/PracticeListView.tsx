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

  const practices = Array.from(elements.values()).filter(e => e.type === "practice");

  // 每个 practice 算子元统计
  const statsOf = (practiceId: string) => {
    const childIds = relations
      .filter(r => r.kind === "child" && r.from === practiceId)
      .map(r => r.to);
    const children = childIds
      .map(id => elements.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e);
    const steps = children.filter(c => c.type === "step");
    return {
      concepts: children.filter(c => c.type === "concept").length,
      cases: children.filter(c => c.type === "case").length,
      prds: children.filter(c => c.type === "product-design").length,
      steps: steps.length,
      stepsDone: steps.filter(s => s.status === "done").length,
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
                <span title="知识点">📚 {s.concepts}</span>
                <span title="需求分析">🎯 {s.cases}</span>
                <span title="PRD">📄 {s.prds}</span>
                <span title="开发任务">⚙️ {s.stepsDone}/{s.steps}</span>
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

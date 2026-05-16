import { useStore } from "../state/store.js";
import { selectCenterView } from "@ke/domain";
import { CenterNode } from "../components/CenterNode.js";
import { ChildCard } from "../components/ChildCard.js";
import { GrandPill } from "../components/GrandPill.js";
import { PathChip } from "../components/PathChip.js";
import "./TreeView.css";

export function TreeView() {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const centerId = useStore(s => s.centerId)!;
  const pathsByCenter = useStore(s => s.pathsByCenter);
  const visible = useStore(s => s.visiblePathKinds);
  const setCenter = useStore(s => s.setCenter);
  const togglePath = useStore(s => s.togglePathKind);

  const view = selectCenterView({ centerId, elements, relations });
  const paths = (pathsByCenter.get(centerId) ?? []).filter(p => visible.has(p.kind));

  // Map each element id to the list of currently-visible paths it appears in.
  const pathsForElement = (id: string) =>
    paths.filter(p => p.steps.includes(id));

  return (
    <div className="tree-view">
      <aside className="tv-side">
        <div className="tv-panel-h">起点（当前中心）</div>
        <div>{view.center.title}</div>
        <div className="tv-panel-h" style={{ marginTop: 24 }}>上游</div>
        {view.upstream.length === 0
          ? <div style={{ color: "var(--dim)", fontSize: 12 }}>（无）</div>
          : view.upstream.map(u => <div key={u.id} className="tv-sibling" onClick={() => setCenter(u.id)}>↑ {u.title}</div>)}
      </aside>

      <main className="tv-main">
        <div className="tv-crumb">
          {view.upstream.slice().reverse().map(u => (
            <span key={u.id}><a onClick={() => setCenter(u.id)}>{u.title}</a> › </span>
          ))}
          <a className="now">{view.center.title}</a>
        </div>

        <div className="tv-paths">
          <span style={{ fontSize: 11, color: "var(--muted)" }}>推荐路径</span>
          {(pathsByCenter.get(centerId) ?? []).map(p => (
            <PathChip key={p.id} p={p} visible={visible.has(p.kind)} onToggle={() => togglePath(p.kind)} />
          ))}
        </div>

        <div className="tv-stage">
          <div className="tv-label">L1 · 中心元</div>
          <div className="tv-center-row"><CenterNode el={view.center} /></div>

          <div className="tv-label">下游第 2 层（{view.children.length}）</div>
          <div className="tv-l2-row">
            {view.children.map(c => (
              <ChildCard key={c.id} el={c} onPaths={pathsForElement(c.id)} onSelect={() => setCenter(c.id)} />
            ))}
          </div>

          <div className="tv-label">下游第 3 层</div>
          <div className="tv-l3-row">
            {view.children.map(c => (
              <div key={c.id} className="tv-l3-col">
                {(view.grandchildren[c.id] ?? []).map(g => (
                  <GrandPill key={g.id} el={g} onPaths={pathsForElement(g.id)} onSelect={() => setCenter(g.id)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>

      <aside className="tv-side right">
        <div className="tv-panel-h">同级元</div>
        {view.siblings.map(s => (
          <div key={s.id} className="tv-sibling" onClick={() => setCenter(s.id)}>{s.title}</div>
        ))}
        <div className="tv-sibling active">{view.center.title}</div>

        <div className="tv-panel-h" style={{ marginTop: 24 }}>中心元操作</div>
        <div className="tv-op" title="尚未接入 AI">细化</div>
        <div className="tv-op" title="尚未接入 AI">展开</div>
        <div className="tv-op" title="尚未接入 AI">延伸</div>
        <div className="tv-op" title="尚未接入 AI">实战</div>
        <div className="tv-op" title="尚未接入 AI">推荐路径</div>
      </aside>
    </div>
  );
}

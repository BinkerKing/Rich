import { useMemo } from "react";
import type { Element, LearningPath, Relation } from "@ke/domain";
import { useStore } from "../state/store.js";
import "./components.css";

interface Props {
  element: Element;
  onSelect: (id: string) => void;
}

interface PathParticipation {
  path: LearningPath;
  stepIndex: number;
  totalSteps: number;
}

export function ContextRail({ element, onSelect }: Props) {
  const pathsByCenter = useStore(s => s.pathsByCenter);
  const relations = useStore(s => s.relations);
  const elements = useStore(s => s.elements);

  // 1) Paths that contain this element (any step, any center) ----------------
  const participations = useMemo<PathParticipation[]>(() => {
    const out: PathParticipation[] = [];
    for (const paths of pathsByCenter.values()) {
      for (const path of paths) {
        const idx = path.steps.indexOf(element.id);
        if (idx >= 0) {
          out.push({ path, stepIndex: idx, totalSteps: path.steps.length });
        }
      }
    }
    return out;
  }, [pathsByCenter, element.id]);

  // 2) Lateral relations (kind=related, in either direction) -----------------
  interface LateralRow { other: Element; relation: Relation; direction: "out" | "in" }
  const lateral = useMemo<LateralRow[]>(() => {
    const rows: LateralRow[] = [];
    for (const r of relations) {
      if (r.kind !== "related") continue;
      if (r.from === element.id) {
        const other = elements.get(r.to);
        if (other) rows.push({ other, relation: r, direction: "out" });
      } else if (r.to === element.id) {
        const other = elements.get(r.from);
        if (other) rows.push({ other, relation: r, direction: "in" });
      }
    }
    return rows.sort((a, b) => (b.relation.strength ?? 0) - (a.relation.strength ?? 0));
  }, [relations, elements, element.id]);

  if (participations.length === 0 && lateral.length === 0) {
    // Nothing to show — keep panel cleaner
    return null;
  }

  return (
    <section className="context-rail" aria-label="上下文信息">

      {participations.length > 0 && (
        <div className="rail-block">
          <header><strong>本元参与的学习路径</strong><span>{participations.length}</span></header>
          <ul className="rail-paths">
            {participations.map(({ path, stepIndex, totalSteps }) => (
              <li key={`${path.id}-${stepIndex}`}>
                <span className={`rail-path-color rail-path-color--${path.color}`} />
                <div className="rail-path-info">
                  <strong>{path.label}</strong>
                  <em>第 {stepIndex + 1} / {totalSteps} 步 · {path.estimatedTime ?? path.kind}</em>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lateral.length > 0 && (
        <div className="rail-block">
          <header><strong>横向关联元</strong><span>{lateral.length}</span></header>
          <ul className="rail-lateral">
            {lateral.slice(0, 8).map(({ other, relation, direction }) => (
              <li key={relation.id}>
                <button type="button" onClick={() => onSelect(other.id)}>
                  <span className="rail-lateral-arrow">{direction === "out" ? "→" : "←"}</span>
                  <div className="rail-lateral-info">
                    <strong>{other.title}</strong>
                    {relation.reason && <em>{relation.reason}</em>}
                  </div>
                  {typeof relation.strength === "number" && (
                    <span className="rail-strength" title="关联强度 0-100">{relation.strength}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

    </section>
  );
}

import type { Element } from "@ke/domain";
import "./components.css";

export function CenterNode({ el }: { el: Element }) {
  return (
    <div className="center-node">
      <div className="body">
        <h3>{el.title}</h3>
        <div className="lvl">L1 · 当前元</div>
      </div>
    </div>
  );
}

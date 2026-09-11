import { createPortal } from "react-dom";
import "./RichControlCenter.css";

export type RichLayoutMode = "desktop" | "pad" | "fullscreen";

type RichControlCenterProps = {
  mode: RichLayoutMode;
  onClose: () => void;
  onModeChange: (mode: RichLayoutMode) => void;
};

const modes: Array<{ id: RichLayoutMode; title: string; detail: string; icon: "desktop" | "pad" | "fullscreen" }> = [
  { id: "fullscreen", title: "全屏", detail: "沉浸展示", icon: "fullscreen" },
  { id: "desktop", title: "桌面模式", detail: "完整工作台", icon: "desktop" },
  { id: "pad", title: "PAD 模式", detail: "紧凑小窗口", icon: "pad" },
];

function ModeIcon({ type }: { type: "desktop" | "pad" | "fullscreen" }) {
  if (type === "fullscreen") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" /></svg>;
  return type === "desktop" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 18h6" /></svg>
  );
}

export function RichControlCenter({ mode, onClose, onModeChange }: RichControlCenterProps) {
  const selectMode = (nextMode: RichLayoutMode) => {
    onModeChange(nextMode);
    onClose();
  };

  return createPortal(
    <div className="rich-control-center" role="dialog" aria-modal="true" aria-label="Rich 模式切换" onMouseDown={onClose}>
      <section className="rich-control-center__panel" onMouseDown={event => event.stopPropagation()}>
        <div className="rich-control-center__modes">
          {modes.map(item => (
            <button
              key={item.id}
              type="button"
              className={`rich-control-center__mode ${mode === item.id ? "is-active" : ""}`}
              onClick={() => selectMode(item.id)}
            >
              <span className="rich-control-center__icon"><ModeIcon type={item.icon} /></span>
              <span><strong>{item.title}</strong><small>{item.detail}</small></span>
              {mode === item.id && <span className="rich-control-center__check">✓</span>}
            </button>
          ))}
        </div>
        <button type="button" className="rich-control-center__close" onClick={onClose} aria-label="关闭模式切换">关闭</button>
      </section>
    </div>,
    document.body,
  );
}

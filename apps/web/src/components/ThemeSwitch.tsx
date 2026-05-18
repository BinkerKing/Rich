import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.js";
import { THEMES, useThemeStore, type ThemeId } from "../theme/themeStore.js";
import "./ThemeSwitch.css";

export function ThemeSwitch() {
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const t = event.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const popover = open && pos && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popRef}
          className="theme-switch-popover"
          role="menu"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="theme-switch-popover__title">主题</div>
          {THEMES.map(item => (
            <button
              key={item.id}
              type="button"
              className={`theme-switch-card theme-switch-card--${item.id} ${theme === item.id ? "is-active" : ""}`}
              onClick={() => { setTheme(item.id); setOpen(false); }}
            >
              <div className={`theme-switch-card__swatch theme-switch-card__swatch--${item.id}`}>
                <span /><span /><span />
              </div>
              <div className="theme-switch-card__meta">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              {theme === item.id && <em>当前</em>}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="theme-switch">
      <button
        ref={btnRef}
        className={open ? "is-active" : ""}
        type="button"
        aria-label="主题"
        title="主题"
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="palette" />
      </button>
      {popover}
    </div>
  );
}

export type { ThemeId };

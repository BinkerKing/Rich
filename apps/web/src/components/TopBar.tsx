import type { ReactNode } from "react";
import { useStore } from "../state/store.js";
import { Icon } from "./Icon.js";
import { ThemeSwitch } from "./ThemeSwitch.js";

interface Props {
  /** Breadcrumb content shown between brand and tools. */
  breadcrumb: ReactNode;
  /** Click handler for the brand button. Defaults to going home (clears rootId). */
  onBrandClick?: () => void;
}

/**
 * Shared top bar used by InputView / TreeView / AdminView so all three pages
 * present identical chrome: brand · breadcrumb · 搜索/视图/地图/通知/后台/主题/avatar.
 * Tool buttons read & write store-level systemMode + appView, so clicking any
 * of them from any view produces consistent results.
 */
export function TopBar({ breadcrumb, onBrandClick }: Props) {
  const exitToHome = useStore(s => s.exitToHome);
  const setAppView = useStore(s => s.setAppView);
  const handleBrand = onBrandClick ?? exitToHome;
  // Mirror the Cmd+Esc global hotkey: snap to tree view + clear rootId so
  // the InputView home screen renders regardless of which app view we're in.
  const goHome = () => { setAppView("tree"); exitToHome(); };

  return (
    <header className="tv-topbar">
      <div className="tv-brand">
        <button type="button" className="tv-home-button" title="首页" aria-label="首页" onClick={handleBrand}>
          <span className="tv-logo" />
          <strong>Rich</strong>
        </button>
      </div>
      <nav className="tv-crumb" aria-label="当前位置">{breadcrumb}</nav>
      <div className="tv-tools">
        {/* View switching now lives entirely in the bottom-left MascotDock.
         *  Search / map / notice buttons were removed with the SystemPanel. */}
        <ThemeSwitch />
        <button
          type="button"
          className="tv-home-key"
          aria-label="返回首页"
          title="返回首页（⌘ + Esc）"
          onClick={goHome}
        >
          K
        </button>
      </div>
    </header>
  );
}

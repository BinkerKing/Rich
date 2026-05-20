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
  const appView = useStore(s => s.appView);
  const systemMode = useStore(s => s.systemMode);
  const setSystemMode = useStore(s => s.setSystemMode);
  const exitToHome = useStore(s => s.exitToHome);
  const handleBrand = onBrandClick ?? exitToHome;
  const inTree = appView === "tree";
  // Tool buttons are "active" only when the matching panel is actually visible,
  // i.e. the user is in the tree view. From admin the same click triggers
  // navigation back to tree, but until that lands we don't highlight.
  const activeOf = (m: string) => inTree && systemMode === m ? " is-active" : "";

  return (
    <header className="tv-topbar">
      <div className="tv-brand">
        <button type="button" className="tv-home-button" title="首页" aria-label="首页" onClick={handleBrand}>
          <span className="tv-logo" />
          <strong>Know Everything</strong>
        </button>
      </div>
      <nav className="tv-crumb" aria-label="当前位置">{breadcrumb}</nav>
      <div className="tv-tools">
        <button className={activeOf("view")} type="button" aria-label="视图" title="视图系统" onClick={() => setSystemMode("view")}><Icon name="grid" /></button>
        <button className={activeOf("map")} type="button" aria-label="知识地图" title="知识地图" onClick={() => setSystemMode("map")}><Icon name="map" /></button>
        <button className={activeOf("notice")} type="button" aria-label="通知" title="通知" onClick={() => setSystemMode("notice")}><Icon name="bell" /></button>
        <ThemeSwitch />
        <span>K</span>
      </div>
    </header>
  );
}

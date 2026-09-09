import { useState } from "react";
import "./mindmapFloatingToolbar.css";

export interface MindmapToolbarOption {
  id: string;
  name: string;
  accent?: string;
}

export interface MindmapFloatingToolbarProps {
  themes: readonly MindmapToolbarOption[];
  theme: string;
  lineStyles: readonly MindmapToolbarOption[];
  lineStyle: string;
  layouts: readonly MindmapToolbarOption[];
  layout: string;
  onThemeChange(theme: string): void;
  onLineStyleChange(lineStyle: string): void;
  onLayoutChange(layout: string): void;
  onFitView(): void;
  onExportPng(): void;
}

type OpenMenu = "theme" | "line" | "layout" | "export" | null;

export function MindmapFloatingToolbar({ themes, theme, lineStyles, lineStyle, layouts, layout, onThemeChange, onLineStyleChange, onLayoutChange, onFitView, onExportPng }: MindmapFloatingToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const toggle = (menu: Exclude<OpenMenu, null>) => setOpenMenu(current => current === menu ? null : menu);
  const choose = (callback: (value: string) => void, value: string) => { callback(value); setOpenMenu(null); };

  const optionMenu = (options: readonly MindmapToolbarOption[], value: string, callback: (value: string) => void) => <div className="mindmap-floating-toolbar__panel" role="menu">
    {options.map(option => <button key={option.id} className={option.id === value ? "is-selected" : ""} type="button" role="menuitemradio" aria-checked={option.id === value} onClick={() => choose(callback, option.id)}>{option.accent && <i style={{ backgroundColor: option.accent }} aria-hidden="true" />}{option.name}</button>)}
  </div>;

  return <><aside className="mindmap-floating-toolbar" aria-label="脑图画板工具">
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "theme"} onClick={() => toggle("theme")}>样式</button>{openMenu === "theme" && optionMenu(themes, theme, onThemeChange)}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "line"} onClick={() => toggle("line")}>线条</button>{openMenu === "line" && optionMenu(lineStyles, lineStyle, onLineStyleChange)}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "layout"} onClick={() => toggle("layout")}>布局</button>{openMenu === "layout" && optionMenu(layouts, layout, onLayoutChange)}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "export"} onClick={() => toggle("export")}>导出</button>{openMenu === "export" && <div className="mindmap-floating-toolbar__panel" role="menu"><button type="button" role="menuitem" onClick={() => { onExportPng(); setOpenMenu(null); }}>导出 PNG</button></div>}</div>
  </aside><button className="mindmap-floating-toolbar__fit" type="button" aria-label="定位全图并适应窗口" title="定位全图" onClick={onFitView}><span aria-hidden="true">⌖</span>定位全图</button></>;
}

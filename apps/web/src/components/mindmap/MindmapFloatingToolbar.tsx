import { useEffect, useRef, useState } from "react";
import { menuAfterPointerDown, type FloatingToolbarMenu } from "./mindmapFloatingToolbarMenu.js";
import { panSensitivityFromPercent, panSensitivityPercent } from "./mindmapInteractions.js";
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
  panSensitivity: number;
  onThemeChange(theme: string): void;
  onLineStyleChange(lineStyle: string): void;
  onLayoutChange(layout: string): void;
  onPanSensitivityChange(sensitivity: number): void;
  onFitView(): void;
  onExportPng(): void;
  onOpenCodex(): void;
}

type OpenMenu = FloatingToolbarMenu;

export function MindmapFloatingToolbar({ themes, theme, lineStyles, lineStyle, layouts, layout, panSensitivity, onThemeChange, onLineStyleChange, onLayoutChange, onPanSensitivityChange, onFitView, onExportPng, onOpenCodex }: MindmapFloatingToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const toggle = (menu: Exclude<OpenMenu, null>) => setOpenMenu(current => current === menu ? null : menu);
  const choose = (callback: (value: string) => void, value: string) => { callback(value); setOpenMenu(null); };
  const panSpeed = panSensitivityPercent(panSensitivity);

  useEffect(() => {
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const isInsideToolbar = event.target instanceof Node && toolbarRef.current?.contains(event.target);
      setOpenMenu(current => menuAfterPointerDown(current, Boolean(isInsideToolbar)));
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, []);

  const optionMenu = (options: readonly MindmapToolbarOption[], value: string, callback: (value: string) => void) => <div className="mindmap-floating-toolbar__panel" role="menu">
    {options.map(option => <button key={option.id} className={option.id === value ? "is-selected" : ""} type="button" role="menuitemradio" aria-checked={option.id === value} onClick={() => choose(callback, option.id)}>{option.accent && <i style={{ backgroundColor: option.accent }} aria-hidden="true" />}{option.name}</button>)}
  </div>;

  return <><aside ref={toolbarRef} className="mindmap-floating-toolbar" aria-label="脑图画板工具">
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "theme"} onClick={() => toggle("theme")}>样式</button>{openMenu === "theme" && optionMenu(themes, theme, onThemeChange)}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "line"} onClick={() => toggle("line")}>线条</button>{openMenu === "line" && optionMenu(lineStyles, lineStyle, onLineStyleChange)}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "layout"} onClick={() => toggle("layout")}>布局</button>{openMenu === "layout" && optionMenu(layouts, layout, onLayoutChange)}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "pan"} onClick={() => toggle("pan")}>拖动</button>{openMenu === "pan" && <div className="mindmap-floating-toolbar__panel mindmap-floating-toolbar__pan-control" role="group" aria-label="拖动速度"><span>拖动速度 <output>{panSpeed}</output></span><input aria-label="拖动速度" type="range" min="0" max="100" value={panSpeed} onChange={event => onPanSensitivityChange(panSensitivityFromPercent(Number(event.currentTarget.value)))} /><small><b>0</b><b>100</b></small></div>}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" aria-expanded={openMenu === "export"} onClick={() => toggle("export")}>导出</button>{openMenu === "export" && <div className="mindmap-floating-toolbar__panel" role="menu"><button type="button" role="menuitem" onClick={() => { onExportPng(); setOpenMenu(null); }}>导出 PNG</button></div>}</div>
    <div className="mindmap-floating-toolbar__item"><button type="button" onClick={onOpenCodex}>Codex 对话</button></div>
  </aside><button className="mindmap-floating-toolbar__fit" type="button" aria-label="定位全图并适应窗口" title="定位全图" onClick={onFitView}><span aria-hidden="true">⌖</span></button></>;
}

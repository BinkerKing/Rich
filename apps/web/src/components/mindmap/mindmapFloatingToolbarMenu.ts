export type FloatingToolbarMenu = "theme" | "line" | "layout" | "pan" | "export" | null;

export function menuAfterPointerDown(menu: FloatingToolbarMenu, isInsideToolbar: boolean): FloatingToolbarMenu {
  return isInsideToolbar ? menu : null;
}

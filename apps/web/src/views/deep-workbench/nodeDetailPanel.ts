export const NODE_DETAIL_PANEL_WIDTH_KEY = "rich.deep-workbench.node-detail-panel-width";
export const NODE_DETAIL_PANEL_DEFAULT_WIDTH = 440;
export const NODE_DETAIL_PANEL_MIN_WIDTH = 320;
export const NODE_DETAIL_PANEL_MAX_WIDTH = 720;

export function clampNodeDetailPanelWidth(value: number): number {
  return Math.min(NODE_DETAIL_PANEL_MAX_WIDTH, Math.max(NODE_DETAIL_PANEL_MIN_WIDTH, Math.round(value)));
}

export function loadNodeDetailPanelWidth(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampNodeDetailPanelWidth(parsed) : NODE_DETAIL_PANEL_DEFAULT_WIDTH;
}

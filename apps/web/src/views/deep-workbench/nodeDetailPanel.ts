export const NODE_DETAIL_PANEL_WIDTH_KEY = "rich.deep-workbench.node-detail-panel-width";
export const NODE_DETAIL_PANEL_DEFAULT_WIDTH = 440;
export const NODE_DETAIL_PANEL_MIN_WIDTH = 320;
export const NODE_DETAIL_PANEL_MAX_WIDTH = 1400;

export function nodeDetailPanelMaxWidth(canvasWidth: number): number {
  return Math.floor(canvasWidth * 2 / 3);
}

export function clampNodeDetailPanelWidth(value: number, maxWidth = NODE_DETAIL_PANEL_MAX_WIDTH): number {
  return Math.min(maxWidth, Math.max(NODE_DETAIL_PANEL_MIN_WIDTH, Math.round(value)));
}

export function loadNodeDetailPanelWidth(value: string | null, maxWidth = NODE_DETAIL_PANEL_MAX_WIDTH): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampNodeDetailPanelWidth(parsed, maxWidth) : NODE_DETAIL_PANEL_DEFAULT_WIDTH;
}

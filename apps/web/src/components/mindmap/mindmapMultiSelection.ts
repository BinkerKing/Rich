export const selectionOptions = {
  useLeftKeySelectionRightKeyDrag: true,
  enableCtrlKeyNodeSelection: true,
} as const;

export function nextShiftSelection<T>(selected: T[], node: T, idOf: (node: T) => string): T[] {
  return selected.some(item => idOf(item) === idOf(node))
    ? selected.filter(item => idOf(item) !== idOf(node))
    : [...selected, node];
}

export function applyNodeStyle<T extends { setStyles(style: P): void }, P>(nodes: T[], style: P): void {
  nodes.forEach(node => node.setStyles(style));
}

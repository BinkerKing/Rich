export type StyleMenu = "fontSize" | "borderWidth" | "borderRadius";
export type NodeColorStyle = "color" | "fillColor" | "borderColor";

const options: Record<StyleMenu, number[]> = {
  fontSize: [14, 16, 18, 22, 26],
  borderWidth: [0, 1, 2, 3],
  borderRadius: [0, 8, 16, 28, 48],
};

const colorPresets: Record<NodeColorStyle, string[]> = {
  color: ["#f8fafc", "#f87171", "#fbbf24", "#a3e635", "#38bdf8", "#a78bfa"],
  fillColor: ["#1f2937", "#7f1d1d", "#78350f", "#365314", "#164e63", "#4c1d95"],
  borderColor: ["#f8fafc", "#f87171", "#fbbf24", "#a3e635", "#38bdf8", "#a78bfa"],
};

export function styleMenuOptions(menu: StyleMenu): number[] {
  return options[menu];
}

export function nodeColorPresets(style: NodeColorStyle): string[] {
  return colorPresets[style];
}

export function noteButtonState(hasNote: boolean): { disabled: boolean; label: string } {
  return hasNote
    ? { disabled: true, label: "删除备注内容即可关闭" }
    : { disabled: false, label: "增加备注" };
}

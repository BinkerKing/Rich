export type StyleMenu = "fontSize" | "borderWidth" | "borderRadius";

const options: Record<StyleMenu, number[]> = {
  fontSize: [14, 16, 18, 22, 26],
  borderWidth: [0, 1, 2, 3],
  borderRadius: [0, 8, 16, 28, 48],
};

export function styleMenuOptions(menu: StyleMenu): number[] {
  return options[menu];
}

export function noteButtonState(hasNote: boolean): { disabled: boolean; label: string } {
  return hasNote
    ? { disabled: true, label: "删除备注内容即可关闭" }
    : { disabled: false, label: "增加备注" };
}

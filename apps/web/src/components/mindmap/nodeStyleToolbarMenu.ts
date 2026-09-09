export type StyleMenu = "fontSize" | "borderWidth" | "borderRadius";

const options: Record<StyleMenu, number[]> = {
  fontSize: [14, 16, 18, 22, 26],
  borderWidth: [0, 1, 2, 3],
  borderRadius: [0, 8, 16, 28, 48],
};

export function styleMenuOptions(menu: StyleMenu): number[] {
  return options[menu];
}

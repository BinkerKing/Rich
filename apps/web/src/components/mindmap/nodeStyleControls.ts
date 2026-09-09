export type NodeStyle = {
  color: string;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
};

const defaults: NodeStyle = {
  color: "#f8fafc",
  fillColor: "#18212c",
  borderColor: "#38bdf8",
  borderWidth: 1,
  borderRadius: 12,
  fontSize: 16,
  fontWeight: "normal",
};

export function nodeStyleFromData(data: Record<string, unknown>): NodeStyle {
  return {
    color: typeof data.color === "string" ? data.color : defaults.color,
    fillColor: typeof data.fillColor === "string" ? data.fillColor : defaults.fillColor,
    borderColor: typeof data.borderColor === "string" ? data.borderColor : defaults.borderColor,
    borderWidth: typeof data.borderWidth === "number" ? data.borderWidth : defaults.borderWidth,
    borderRadius: typeof data.borderRadius === "number" ? data.borderRadius : defaults.borderRadius,
    fontSize: typeof data.fontSize === "number" ? data.fontSize : defaults.fontSize,
    fontWeight: data.fontWeight === "bold" ? "bold" : defaults.fontWeight,
  };
}

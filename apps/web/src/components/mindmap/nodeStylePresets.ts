import type { NodeStyle } from "./nodeStyleControls.js";

export type NodeStylePreset = { id: string; name: string; style: NodeStyle };

export function createNodeStylePreset(name: string, style: NodeStyle): NodeStylePreset {
  const trimmedName = name.trim();
  return { id: trimmedName, name: trimmedName, style };
}

export function saveNodeStylePreset(presets: NodeStylePreset[], name: string, style: NodeStyle): NodeStylePreset[] {
  const preset = createNodeStylePreset(name, style);
  const existingIndex = presets.findIndex(item => item.name === preset.name);
  if (existingIndex === -1) return [...presets, preset];
  return presets.map((item, index) => index === existingIndex ? preset : item);
}

export function parseNodeStylePresets(value: string | null): NodeStylePreset[] {
  if (!value) return [];
  try {
    const items: unknown = JSON.parse(value);
    if (!Array.isArray(items)) return [];
    return items.filter(isNodeStylePreset);
  } catch {
    return [];
  }
}

function isNodeStylePreset(value: unknown): value is NodeStylePreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Partial<NodeStylePreset>;
  return typeof preset.id === "string" && typeof preset.name === "string" && preset.name.trim().length > 0 && isNodeStyle(preset.style);
}

function isNodeStyle(value: unknown): value is NodeStyle {
  if (!value || typeof value !== "object") return false;
  const style = value as Partial<NodeStyle>;
  return typeof style.color === "string"
    && typeof style.fillColor === "string"
    && typeof style.borderColor === "string"
    && typeof style.borderWidth === "number"
    && typeof style.borderRadius === "number"
    && typeof style.fontSize === "number"
    && (style.fontWeight === "normal" || style.fontWeight === "bold");
}

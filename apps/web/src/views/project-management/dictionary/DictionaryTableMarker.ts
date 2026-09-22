export const dictionaryTableMarkerOptions = [
  { id: "star", label: "重点", color: "#f5c451" },
  { id: "flag", label: "跟进", color: "#67a9e8" },
  { id: "alert", label: "注意", color: "#fb923c" },
  { id: "bookmark", label: "收藏", color: "#c084fc" },
  { id: "check", label: "已确认", color: "#6bcf9c" },
  { id: "clock", label: "待处理", color: "#94a3b8" },
] as const;

export type DictionaryTableMarker = typeof dictionaryTableMarkerOptions[number]["id"];

export function dictionaryTableMarker(extra?: Record<string, unknown>): DictionaryTableMarker | undefined {
  const marker = extra?.tableMarker;
  return dictionaryTableMarkerOptions.some(option => option.id === marker)
    ? marker as DictionaryTableMarker
    : undefined;
}

export const dictionaryTableMarkerOptions = [
  { id: "star", label: "重点" },
  { id: "flag", label: "跟进" },
  { id: "alert", label: "注意" },
  { id: "bookmark", label: "收藏" },
  { id: "check", label: "已确认" },
  { id: "clock", label: "待处理" },
] as const;

export type DictionaryTableMarker = typeof dictionaryTableMarkerOptions[number]["id"];

export function dictionaryTableMarker(extra?: Record<string, unknown>): DictionaryTableMarker | undefined {
  const marker = extra?.tableMarker;
  return dictionaryTableMarkerOptions.some(option => option.id === marker)
    ? marker as DictionaryTableMarker
    : undefined;
}

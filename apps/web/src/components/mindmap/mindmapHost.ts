export function clearMindmapHost(host: object | null): void {
  if (host) delete (host as { __mindMap?: unknown }).__mindMap;
}

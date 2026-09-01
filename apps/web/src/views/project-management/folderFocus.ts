export function shouldScrollFocusedFolderIntoView(
  focusedPath: string | null,
  nodePath: string,
  autoScrollPath: string | null,
): boolean {
  return focusedPath === nodePath && autoScrollPath === nodePath;
}

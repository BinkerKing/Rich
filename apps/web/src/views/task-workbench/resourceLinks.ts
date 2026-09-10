export function isLocalResource(location: string) {
  return location.startsWith("/") || /^file:\/\//i.test(location);
}

export function resourceLink(location: string): string | undefined {
  if (/^https?:\/\//i.test(location)) return location;
  let target: string;
  if (location.startsWith("/")) {
    target = `file://${location.split("/").map(encodeURIComponent).join("/")}`;
  } else if (/^file:\/\//i.test(location)) {
    try { target = new URL(location).href; } catch { return undefined; }
  } else return undefined;
  // Use Rich's existing desktop link handler to open the original file or directory.
  return `rich://open-external?url=${encodeURIComponent(target)}`;
}

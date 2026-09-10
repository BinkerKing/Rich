import type { ReactNode } from "react";
import { resourceLink } from "./resourceLinks.js";

const localPath = /(?:file:\/\/[^\n，。；;]+|\/(?:Users|Volumes|tmp)\/[^\n，。；;]+)/g;

export function ResourceText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const match of text.matchAll(localPath)) {
    const value = match[0];
    const start = match.index ?? 0;
    const href = resourceLink(value);
    if (!href) continue;
    if (start > from) parts.push(text.slice(from, start));
    parts.push(<a className="tw-inline-resource-link" href={href} target="_blank" rel="noreferrer" key={`${start}:${value}`}>{value}</a>);
    from = start + value.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

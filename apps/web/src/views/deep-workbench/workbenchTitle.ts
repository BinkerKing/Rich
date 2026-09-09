import { titleFromNodeHtml } from "../../components/mindmap/richTextNode.js";

export function workbenchTitleFromRootText(value: unknown): string {
  return titleFromNodeHtml(value);
}

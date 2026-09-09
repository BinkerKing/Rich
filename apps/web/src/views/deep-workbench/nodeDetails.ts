import type { DeepWorkbenchNode } from "./deepWorkbenchModel.js";

export const NODE_DETAILS_FIELD = "detailsHtml";

export function nodeDetails(node: DeepWorkbenchNode): string {
  const value = node.data[NODE_DETAILS_FIELD];
  return typeof value === "string" ? value : "";
}

export function updateNodeDetails(root: DeepWorkbenchNode, nodeId: string, detailsHtml: string): DeepWorkbenchNode {
  if (root.data.uid === nodeId) return { ...root, data: { ...root.data, [NODE_DETAILS_FIELD]: detailsHtml } };
  const children = root.children.map(child => updateNodeDetails(child, nodeId, detailsHtml));
  return children.some((child, index) => child !== root.children[index]) ? { ...root, children } : root;
}

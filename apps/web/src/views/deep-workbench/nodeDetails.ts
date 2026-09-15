import type { DeepWorkbenchNode } from "./deepWorkbenchModel.js";

export const NODE_DETAILS_FIELD = "detailsHtml";
export const NODE_RESOURCES_FIELD = "nodeResources";

export type NodeDetailTable = {
  columns: Array<{ key: string; name: string; width?: number }>;
  rows: Array<{ id: string; [key: string]: unknown }>;
};

export type NodeExternalFile = { id: string; name: string; url: string };

export type NodeResources = {
  flowchartIds: string[];
  table: NodeDetailTable;
  files: NodeExternalFile[];
};

const EMPTY_NODE_RESOURCES: NodeResources = { flowchartIds: [], table: { columns: [], rows: [] }, files: [] };

export function nodeDetails(node: DeepWorkbenchNode): string {
  const value = node.data[NODE_DETAILS_FIELD];
  return typeof value === "string" ? value : "";
}

export function nodeResources(node: DeepWorkbenchNode): NodeResources {
  const value = node.data[NODE_RESOURCES_FIELD];
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_NODE_RESOURCES;
  const resources = value as Partial<NodeResources>;
  return {
    flowchartIds: Array.isArray(resources.flowchartIds) ? resources.flowchartIds.filter((id): id is string => typeof id === "string") : [],
    table: {
      columns: Array.isArray(resources.table?.columns) ? resources.table.columns.filter((column): column is NodeDetailTable["columns"][number] => Boolean(column && typeof column.key === "string" && typeof column.name === "string")) : [],
      rows: Array.isArray(resources.table?.rows) ? resources.table.rows.filter((row): row is NodeDetailTable["rows"][number] => Boolean(row && typeof row.id === "string")) : [],
    },
    files: Array.isArray(resources.files) ? resources.files.filter((file): file is NodeExternalFile => Boolean(file && typeof file.id === "string" && typeof file.name === "string" && typeof file.url === "string")) : [],
  };
}

export function updateNodeDetails(root: DeepWorkbenchNode, nodeId: string, detailsHtml: string): DeepWorkbenchNode {
  if (root.data.uid === nodeId) return { ...root, data: { ...root.data, [NODE_DETAILS_FIELD]: detailsHtml } };
  const children = root.children.map(child => updateNodeDetails(child, nodeId, detailsHtml));
  return children.some((child, index) => child !== root.children[index]) ? { ...root, children } : root;
}

export function updateNodeResources(root: DeepWorkbenchNode, nodeId: string, resources: NodeResources): DeepWorkbenchNode {
  if (root.data.uid === nodeId) return { ...root, data: { ...root.data, [NODE_RESOURCES_FIELD]: resources } };
  const children = root.children.map(child => updateNodeResources(child, nodeId, resources));
  return children.some((child, index) => child !== root.children[index]) ? { ...root, children } : root;
}

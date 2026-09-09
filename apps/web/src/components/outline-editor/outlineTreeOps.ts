import type { OutlineNode } from "./types.ts";

type NodeLocation = {
  node: OutlineNode;
  parent: OutlineNode | null;
  index: number;
};

function clone(root: OutlineNode): OutlineNode {
  return structuredClone(root);
}

function findNode(root: OutlineNode, id: string, parent: OutlineNode | null = null): NodeLocation | null {
  if (root.id === id) return { node: root, parent, index: parent ? parent.children.indexOf(root) : -1 };

  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index]!;
    const found = findNode(child, id, root);
    if (found) return found;
  }

  return null;
}

function emptyNode(createId: () => string): OutlineNode {
  return { id: createId(), text: "", children: [] };
}

export function insertSiblingAfter(root: OutlineNode, nodeId: string, createId: () => string): OutlineNode {
  const result = clone(root);
  const location = findNode(result, nodeId);
  if (!location?.parent) return result;

  location.parent.children.splice(location.index + 1, 0, emptyNode(createId));
  return result;
}

export function appendChild(root: OutlineNode, nodeId: string, createId: () => string): OutlineNode {
  const result = clone(root);
  const location = findNode(result, nodeId);
  if (!location) return result;

  location.node.children.push(emptyNode(createId));
  location.node.expanded = true;
  return result;
}

export function indentNode(root: OutlineNode, nodeId: string): OutlineNode {
  const result = clone(root);
  const location = findNode(result, nodeId);
  if (!location?.parent || location.index === 0) return result;

  const previous = location.parent.children[location.index - 1]!;
  location.parent.children.splice(location.index, 1);
  previous.children.push(location.node);
  previous.expanded = true;
  return result;
}

export function outdentNode(root: OutlineNode, nodeId: string): OutlineNode {
  const result = clone(root);
  const location = findNode(result, nodeId);
  if (!location?.parent) return result;

  const parentLocation = findNode(result, location.parent.id);
  if (!parentLocation?.parent) return result;

  location.parent.children.splice(location.index, 1);
  parentLocation.parent.children.splice(parentLocation.index + 1, 0, location.node);
  return result;
}

export function removeEmptyNode(root: OutlineNode, nodeId: string): OutlineNode {
  const result = clone(root);
  const location = findNode(result, nodeId);
  if (!location?.parent || location.node.text.trim()) return result;

  location.parent.children.splice(location.index, 1, ...location.node.children);
  return result;
}

export function updateNodeText(root: OutlineNode, nodeId: string, text: string): OutlineNode {
  const result = clone(root);
  const location = findNode(result, nodeId);
  if (location) location.node.text = text;
  return result;
}

export function expandAll(root: OutlineNode, expanded = true): OutlineNode {
  const result = clone(root);
  const visit = (node: OutlineNode) => {
    node.expanded = expanded;
    node.children.forEach(visit);
  };

  visit(result);
  return result;
}

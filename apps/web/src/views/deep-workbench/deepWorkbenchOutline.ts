import type { DeepWorkbenchNode } from "./deepWorkbenchModel.js";

type NodeLocation = { node: DeepWorkbenchNode; parent: DeepWorkbenchNode | null; index: number };

function findNode(root: DeepWorkbenchNode, uid: string, parent: DeepWorkbenchNode | null = null): NodeLocation | null {
  if (root.data.uid === uid) return { node: root, parent, index: parent ? parent.children.indexOf(root) : -1 };
  for (const child of root.children) {
    const found = findNode(child, uid, root);
    if (found) return found;
  }
  return null;
}

export function indentOutlineNode(root: DeepWorkbenchNode, uid: string): DeepWorkbenchNode {
  const next = structuredClone(root);
  const target = findNode(next, uid);
  if (!target?.parent || target.index < 1) return next;
  const previous = target.parent.children[target.index - 1];
  target.parent.children.splice(target.index, 1);
  previous.children.push(target.node);
  return next;
}

export function outdentOutlineNode(root: DeepWorkbenchNode, uid: string): DeepWorkbenchNode {
  const next = structuredClone(root);
  const target = findNode(next, uid);
  if (!target?.parent) return next;
  const parent = findNode(next, target.parent.data.uid);
  if (!parent?.parent) return next;
  target.parent.children.splice(target.index, 1);
  parent.parent.children.splice(parent.index + 1, 0, target.node);
  return next;
}

export function insertOutlineSibling(root: DeepWorkbenchNode, uid: string, newUid: string): DeepWorkbenchNode {
  const next = structuredClone(root);
  const target = findNode(next, uid);
  if (!target?.parent) return next;
  target.parent.children.splice(target.index + 1, 0, { data: { uid: newUid, text: "" }, children: [] });
  return next;
}

export function updateOutlineText(root: DeepWorkbenchNode, uid: string, text: string): DeepWorkbenchNode {
  const next = structuredClone(root);
  const target = findNode(next, uid);
  if (target) target.node.data.text = text;
  return next;
}

export function insertOutlineChild(root: DeepWorkbenchNode, uid: string, newUid: string): DeepWorkbenchNode {
  const next = structuredClone(root);
  const target = findNode(next, uid);
  if (target) target.node.children.push({ data: { uid: newUid, text: "" }, children: [] });
  return next;
}

export function setOutlineExpanded(root: DeepWorkbenchNode, uid: string, expand: boolean): DeepWorkbenchNode {
  const next = structuredClone(root);
  const target = findNode(next, uid);
  if (target) target.node.data.expand = expand;
  return next;
}

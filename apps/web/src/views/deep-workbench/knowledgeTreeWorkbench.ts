import type { Element, Relation } from "@ke/domain";
import { createDeepWorkbenchMap, type DeepWorkbenchMap, type DeepWorkbenchNode } from "./deepWorkbenchModel.js";
import { titleFromNodeHtml } from "../../components/mindmap/richTextNode.js";

type NodeIndex = Map<string, { node: DeepWorkbenchNode; parentId: string | null; childIds: string[] }>;

export type KnowledgeTreeChangePlan = {
  renames: Array<{ elementId: string; title: string }>;
  creates: Array<{ draftId: string; parentId: string; title: string }>;
  moves: Array<{ elementId: string; parentId: string }>;
  reorders: Array<{ parentId: string; childIds: string[] }>;
  deletes: string[];
};

export function projectKnowledgeTree(
  rootId: string,
  elements: Iterable<Element>,
  relations: Iterable<Relation>,
  previous?: DeepWorkbenchMap,
): DeepWorkbenchMap {
  const elementsById = new Map(Array.from(elements, element => [element.id, element]));
  const root = elementsById.get(rootId);
  if (!root) throw new Error("knowledge tree root not found");
  const childrenByParent = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.kind !== "child") continue;
    const children = childrenByParent.get(relation.from) ?? [];
    children.push(relation.to);
    childrenByParent.set(relation.from, children);
  }
  const priorData = previous ? indexNodes(previous.root) : new Map();
  const seen = new Set<string>();
  const build = (id: string): DeepWorkbenchNode => {
    const element = elementsById.get(id);
    if (!element) throw new Error(`knowledge tree node not found: ${id}`);
    if (seen.has(id)) throw new Error("knowledge tree contains a child cycle");
    seen.add(id);
    const old = priorData.get(id)?.node.data;
    const children = (childrenByParent.get(id) ?? []).filter(childId => elementsById.has(childId)).map(build);
    seen.delete(id);
    return {
      data: { ...old, uid: id, elementId: id, text: element.title, expand: old?.expand ?? true },
      children,
    };
  };
  const fallback = createDeepWorkbenchMap(root.title, root.id);
  return { ...fallback, ...previous, root: build(rootId) };
}

export function planKnowledgeTreeChanges(
  previous: DeepWorkbenchNode,
  next: DeepWorkbenchNode,
  existingElementIds: ReadonlySet<string>,
): KnowledgeTreeChangePlan {
  const before = indexNodes(previous);
  const after = indexNodes(next);
  const renames: KnowledgeTreeChangePlan["renames"] = [];
  const creates: KnowledgeTreeChangePlan["creates"] = [];
  const moves: KnowledgeTreeChangePlan["moves"] = [];
  const reorders: KnowledgeTreeChangePlan["reorders"] = [];
  const deletes: string[] = [];

  for (const [id, current] of after) {
    const prior = before.get(id);
    const title = titleFromNodeHtml(current.node.data.text);
    if (!existingElementIds.has(id)) {
      if (current.parentId && title) creates.push({ draftId: id, parentId: current.parentId, title });
      continue;
    }
    if (prior && title && title !== titleFromNodeHtml(prior.node.data.text)) renames.push({ elementId: id, title });
    if (prior?.parentId && current.parentId && prior.parentId !== current.parentId) {
      moves.push({ elementId: id, parentId: current.parentId });
    }
    if (!prior) continue;
    if (current.childIds.length > 0 && !sameIds(prior.childIds, current.childIds)) {
      reorders.push({ parentId: id, childIds: current.childIds });
    }
  }

  for (const [id, prior] of before) {
    if (!existingElementIds.has(id) || after.has(id)) continue;
    if (!prior.parentId || after.has(prior.parentId)) deletes.push(id);
  }
  return { renames, creates, moves, reorders, deletes };
}

function indexNodes(root: DeepWorkbenchNode): NodeIndex {
  const index: NodeIndex = new Map();
  const walk = (node: DeepWorkbenchNode, parentId: string | null) => {
    const id = node.data.uid;
    index.set(id, { node, parentId, childIds: node.children.map(child => child.data.uid) });
    node.children.forEach(child => walk(child, id));
  };
  walk(root, null);
  return index;
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

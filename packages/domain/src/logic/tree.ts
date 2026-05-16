import type { Element, ElementId } from "../types/element.js";
import type { Relation } from "../types/relation.js";

export interface CenterView {
  center: Element;
  upstream: Element[];                                   // closest first
  siblings: Element[];
  children: Element[];
  grandchildren: Record<ElementId, Element[]>;           // keyed by child id
}

export interface SelectArgs {
  centerId: ElementId;
  elements: Map<ElementId, Element>;
  relations: Relation[];
  depthUp?: number;       // default 2
  depthDown?: number;     // default 2  (1=children only, 2=+grand)
}

function childrenOf(id: ElementId, rels: Relation[]): ElementId[] {
  return rels.filter(r => r.kind === "child" && r.from === id).map(r => r.to);
}

function parentsOf(id: ElementId, rels: Relation[]): ElementId[] {
  return rels.filter(r => r.kind === "child" && r.to === id).map(r => r.from);
}

export function selectCenterView(args: SelectArgs): CenterView {
  const { centerId, elements, relations, depthUp = 2, depthDown = 2 } = args;
  const center = elements.get(centerId);
  if (!center) throw new Error(`Element not found: ${centerId}`);

  // upstream
  const upstream: Element[] = [];
  let cur = centerId;
  for (let i = 0; i < depthUp; i++) {
    const [p] = parentsOf(cur, relations);
    if (!p) break;
    const el = elements.get(p);
    if (!el) break;
    upstream.push(el);
    cur = p;
  }

  // siblings: other children of immediate parent
  const [immediateParent] = parentsOf(centerId, relations);
  const siblings = immediateParent
    ? childrenOf(immediateParent, relations)
        .filter(id => id !== centerId)
        .map(id => elements.get(id))
        .filter((e): e is Element => Boolean(e))
    : [];

  // children + grandchildren
  const childIds = childrenOf(centerId, relations);
  const children = childIds.map(id => elements.get(id)).filter((e): e is Element => Boolean(e));
  const grandchildren: Record<ElementId, Element[]> = {};
  if (depthDown >= 2) {
    for (const cid of childIds) {
      grandchildren[cid] = childrenOf(cid, relations)
        .map(id => elements.get(id))
        .filter((e): e is Element => Boolean(e));
    }
  }

  return { center, upstream, siblings, children, grandchildren };
}

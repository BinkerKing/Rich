import type { OutlineNode } from "../../components/outline-editor/types.ts";
import type { DeepWorkbenchNode } from "./deepWorkbenchModel.ts";

export function toOutlineNode(node: DeepWorkbenchNode): OutlineNode {
  return {
    id: node.data.uid,
    text: node.data.text,
    ...(node.data.expand === undefined ? {} : { expanded: node.data.expand }),
    children: node.children.map(toOutlineNode),
  };
}

export function fromOutlineNode(node: OutlineNode): DeepWorkbenchNode {
  return {
    data: {
      uid: node.id,
      text: node.text,
      ...(node.expanded === undefined ? {} : { expand: node.expanded }),
    },
    children: node.children.map(fromOutlineNode),
  };
}

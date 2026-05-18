import type { ElementType } from "@ke/domain";

export function elementTypeLabel(type: ElementType): string {
  switch (type) {
    case "topic":
      return "主题元";
    case "concept":
      return "概念元";
    case "practice":
    case "project":
      return "实战元";
    case "product-design":
      return "产品设计元";
    case "step":
    case "exercise":
      return "步骤元";
    default:
      return "知识元";
  }
}

export function elementTypeClass(type: ElementType): string {
  switch (type) {
    case "topic":
      return "element-type--topic";
    case "concept":
      return "element-type--concept";
    case "practice":
    case "project":
      return "element-type--practice";
    case "product-design":
      return "element-type--product-design";
    case "step":
    case "exercise":
      return "element-type--step";
    default:
      return "element-type--knowledge";
  }
}

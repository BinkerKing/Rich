import type { ElementType } from "@ke/domain";

export function elementTypeLabel(type: ElementType): string {
  switch (type) {
    case "topic":
      return "主题元";
    case "concept":
      return "概念元";
    case "practice":
      return "实战元";
    case "project":
      return "项目元";
    case "product-design":
      return "产品设计元";
    case "step":
    case "exercise":
      return "步骤元";
    case "report":
      return "报告元";
    case "guide":
      return "攻略元";
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
      return "element-type--practice";
    case "project":
      return "element-type--project";
    case "product-design":
      return "element-type--product-design";
    case "step":
    case "exercise":
      return "element-type--step";
    case "report":
      return "element-type--report";
    case "guide":
      return "element-type--guide";
    default:
      return "element-type--knowledge";
  }
}

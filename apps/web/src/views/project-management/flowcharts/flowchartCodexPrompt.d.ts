import type { FlowchartData } from "./flowchartModel.js";

export function flowchartCodexPrompt(input: {
  projectId: string;
  flowchartId: string;
  title: string;
  graph: FlowchartData;
  selectedNodeIds: string[];
  request: string;
}): string;

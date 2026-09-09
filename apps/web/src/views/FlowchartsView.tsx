import { FlowchartsWorkspace } from "./project-management/flowcharts/FlowchartsWorkspace.js";
import "./project-management/flowcharts/FlowchartsWorkspace.css";
import "./FlowchartsView.css";

export function FlowchartsView() {
  return <main className="flowcharts-app" aria-label="流程图应用">
    <header><div><p>流程图</p><h1>用一张图，把复杂逻辑讲清楚。</h1><span>独立创建、编辑流程图；项目和脑图节点按需引用。</span></div></header>
    <FlowchartsWorkspace standalone />
  </main>;
}

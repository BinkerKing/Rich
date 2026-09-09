import { FlowchartsWorkspace } from "./project-management/flowcharts/FlowchartsWorkspace.js";
import "./project-management/flowcharts/FlowchartsWorkspace.css";
import "./FlowchartsView.css";

export function FlowchartsView() {
  return <main className="flowcharts-app" aria-label="流程图应用">
    <header><div><p>Flowcharts</p><h1>流程图</h1><span>独立创建流程图；需要时再由项目或节点引用它。</span></div></header>
    <FlowchartsWorkspace />
  </main>;
}

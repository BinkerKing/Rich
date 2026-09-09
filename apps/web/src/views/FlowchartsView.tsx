import { FlowchartsWorkspace } from "./project-management/flowcharts/FlowchartsWorkspace.js";
import "./project-management/flowcharts/FlowchartsWorkspace.css";
import "./FlowchartsView.css";

export function FlowchartsView() {
  return <main className="flowcharts-app" aria-label="流程图应用">
    <FlowchartsWorkspace standalone />
  </main>;
}

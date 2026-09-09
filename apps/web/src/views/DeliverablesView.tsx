import { DeliverablesWorkspace } from "./project-management/deliverables/DeliverablesWorkspace.js";
import "./ProjectsView.css";

export function DeliverablesView() {
  return <main className="flowcharts-app" aria-label="交付物应用"><DeliverablesWorkspace standalone /></main>;
}

import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { DeliverablesWorkspace } from "./project-management/deliverables/DeliverablesWorkspace.js";
import "./ProjectsView.css";
import "./DeliverablesView.css";

export function DeliverablesView() {
  const [migrationVersion, setMigrationVersion] = useState(0);
  useEffect(() => { void api.migrateProjectDeliverables().then(() => setMigrationVersion(version => version + 1)); }, []);
  return <main className="deliverables-app" aria-label="交付物应用"><DeliverablesWorkspace key={migrationVersion} standalone /></main>;
}

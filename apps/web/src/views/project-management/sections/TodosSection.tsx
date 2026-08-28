import type { ReactNode } from "react";
import type { Element } from "@ke/domain";
import type { ProjectManagementSummary } from "../../../api/client.js";
import { MulticaProjectBoard } from "../multica/MulticaProjectBoard.js";

export function TodosSection({ project }: { project: Element; summary: ProjectManagementSummary | null }): ReactNode {
  return <MulticaProjectBoard projectId={project.id} projectTitle={project.title} />;
}

import type { ProjectManagementSearchHit } from "../../api/client.js";
import type { ProjectManagementSearchTarget } from "./ProjectManagementNavigation.js";

/** Single client boundary for API search destinations; future pages extend the API contract, not the search-box UI. */
export function searchTargetFromHit(hit: ProjectManagementSearchHit): ProjectManagementSearchTarget {
  return hit.destination;
}

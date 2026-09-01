import type { Element } from "@ke/domain";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { PathsRepo } from "../../repos/PathsRepo.js";
import type { RelationsRepo } from "../../repos/RelationsRepo.js";
import type { GeneratedTree } from "./generatedTreeValidator.js";

export interface GeneratedTreeWriterDeps {
  elements: ElementsRepo;
  relations: RelationsRepo;
  paths: PathsRepo;
}

function stampGeneratedElement(element: Element, adapterName: string): Element {
  const now = new Date().toISOString();
  return {
    ...element,
    type: element.type === "practice" || element.type === "project" ? "concept" : element.type,
    metadata: {
      ...element.metadata,
      createdAt: now,
      updatedAt: now,
      generatedBy: "ai",
      aiModel: adapterName,
    },
  };
}

/**
 * Owns generated-tree persistence so HTTP routes do not coordinate three
 * repositories. Storage-specific implementations can replace this boundary
 * with one transaction without changing the AI route contract.
 */
export async function writeGeneratedTree(
  deps: GeneratedTreeWriterDeps,
  tree: GeneratedTree,
  adapterName: string,
): Promise<void> {
  for (const element of tree.elements) {
    await deps.elements.put(stampGeneratedElement(element, adapterName));
  }
  await deps.relations.append(tree.relations);

  const pathsByCenter = new Map<string, typeof tree.paths>();
  for (const path of tree.paths) {
    const paths = pathsByCenter.get(path.centerElementId) ?? [];
    paths.push(path);
    pathsByCenter.set(path.centerElementId, paths);
  }
  for (const [centerId, paths] of pathsByCenter) {
    await deps.paths.putForCenter(centerId, paths);
  }
}

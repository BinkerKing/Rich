import type { LearningPath, ElementId } from "@ke/domain";

export interface PathsRepo {
  byCenter(id: ElementId): Promise<LearningPath[]>;
  putForCenter(id: ElementId, paths: LearningPath[]): Promise<void>;
  listAllCenters(): Promise<ElementId[]>;
}

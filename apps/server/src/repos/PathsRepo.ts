import type { LearningPath, ElementId } from "@ke/domain";

export interface PathsRepo {
  byCenter(id: ElementId): Promise<LearningPath[]>;
  /** Replace all paths for `id`. */
  putForCenter(id: ElementId, paths: LearningPath[]): Promise<void>;
  /** Append `paths` to whatever exists for `id` (de-duplicated by path.id). */
  appendForCenter(id: ElementId, paths: LearningPath[]): Promise<void>;
  listAllCenters(): Promise<ElementId[]>;
}

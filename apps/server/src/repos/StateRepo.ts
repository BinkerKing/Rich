import type { ElementId } from "@ke/domain";

export interface CenterChange {
  ts: string;
  from: ElementId | null;
  to: ElementId;
  /** Time spent on `from` before switching, in milliseconds. null if no previous. */
  dwellMs: number | null;
}

export interface StateRepo {
  /** Current center element id, or null if never set. */
  getCenter(): Promise<{ elementId: ElementId | null; updatedAt: string | null }>;
  /** Set the current center. Records the change to history; returns the prior state for callers that want dwell info. */
  setCenter(elementId: ElementId): Promise<CenterChange>;
  /** Most-recent center changes, newest first, capped at `limit` (default 20). */
  recentChanges(limit?: number): Promise<CenterChange[]>;
}

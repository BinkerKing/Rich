/**
 * Signals are user-feedback events that the Reviewer AI consumes to update
 * AI manuals. They form the "evidence trail" of self-evolution.
 */
export type SignalType =
  | "op.completed"        // an AI op finished (durationMs, deltas, bytes)
  | "op.failed"           // AI op emitted error
  | "user.reverted"       // user reverted an element to a prior version
  | "user.repeated_op"    // same op was invoked on same element within window
  | "user.frustrated"     // composite signal (≥ 3 repeated ops on same element in <30 min)
  | "user.changed_center" // user switched the current center element (data: { from, to, dwellMs })
  | "user.feedback";      // explicit user feedback on an element (data: { feedback, autoRefined?, beforeRichness? })

export interface Signal {
  ts: string;                        // ISO 8601 timestamp
  type: SignalType;
  /** Which AI manual this signal targets (e.g. "knowledge"). */
  manual: string;
  /** The element involved, if any. */
  elementId?: string;
  /** The operation involved, if any (e.g. "refine", "expand"). */
  op?: string;
  /** The AI adapter used, if any. */
  adapter?: string;
  /** Free-form details (duration, error message, fromTimestamp for reverts, …). */
  data?: Record<string, unknown>;
}

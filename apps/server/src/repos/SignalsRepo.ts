import type { Signal } from "@ke/domain";

export interface SignalsQuery {
  manual?: string;
  type?: Signal["type"];
  elementId?: string;
  /** ISO timestamp, inclusive lower bound. */
  since?: string;
  limit?: number;
}

export interface SignalsRepo {
  append(s: Signal): Promise<void>;
  list(q?: SignalsQuery): Promise<Signal[]>;
  /** Number of stored signals (cheap, used by /api/health). */
  count(): Promise<number>;
}

/**
 * Persisted state for the "伟大的我" (GreatMe) cockpit view.
 *
 * The shape is owned by the web view (`apps/web/src/views/GreatMeView.tsx`).
 * Server-side we treat it as an opaque JSON blob — validation lives in the
 * route layer (`routes/greatMe.ts`), this repo just persists it under a
 * single key.
 */
export interface GreatMeRepo {
  /** Get the saved blob; null if never saved. */
  get(): Promise<unknown | null>;
  /** Overwrite the saved blob. */
  put(value: unknown): Promise<void>;
}

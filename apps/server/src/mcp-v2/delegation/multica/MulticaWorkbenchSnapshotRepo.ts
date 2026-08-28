export type MulticaConnectionStatus = "connected" | "syncing" | "disconnected";

export interface MulticaWorkbenchSnapshot<T = unknown> {
  richProjectId: string;
  key: string;
  payload: T;
  updatedAt: string;
}

export interface MulticaSyncState {
  richProjectId: string;
  status: MulticaConnectionStatus;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  error?: string;
}

type MaybePromise<T> = T | Promise<T>;

export interface MulticaWorkbenchSnapshotRepo {
  get<T>(richProjectId: string, key: string): MaybePromise<MulticaWorkbenchSnapshot<T> | null>;
  save<T>(snapshot: MulticaWorkbenchSnapshot<T>): MaybePromise<void>;
  deleteByPrefixes(richProjectId: string, prefixes: string[]): MaybePromise<void>;
  getSyncState(richProjectId: string): MaybePromise<MulticaSyncState | null>;
  saveSyncState(state: MulticaSyncState): MaybePromise<void>;
}

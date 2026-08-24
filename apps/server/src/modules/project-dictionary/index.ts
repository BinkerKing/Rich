/**
 * Stable entry point for the project-dictionary domain.
 *
 * HTTP routes and the legacy sync service can depend on these contracts while
 * database-specific implementations are moved behind adapters incrementally.
 */
export type DictionaryDatabaseDialect = "postgresql" | "sqlserver" | "mysql" | "oracle";

export type DictionaryDatabaseCapabilities = {
  dialect: DictionaryDatabaseDialect;
  implemented: boolean;
  supportsSchema: boolean;
  supportsExplain: boolean;
  supportsTransactionalTestWrites: boolean;
};

const CAPABILITIES: Record<DictionaryDatabaseDialect, DictionaryDatabaseCapabilities> = {
  postgresql: {
    dialect: "postgresql",
    implemented: true,
    supportsSchema: true,
    supportsExplain: true,
    supportsTransactionalTestWrites: true,
  },
  sqlserver: {
    dialect: "sqlserver",
    implemented: true,
    supportsSchema: true,
    supportsExplain: true,
    supportsTransactionalTestWrites: true,
  },
  mysql: {
    dialect: "mysql",
    implemented: false,
    supportsSchema: false,
    supportsExplain: false,
    supportsTransactionalTestWrites: false,
  },
  oracle: {
    dialect: "oracle",
    implemented: false,
    supportsSchema: false,
    supportsExplain: false,
    supportsTransactionalTestWrites: false,
  },
};

export function dictionaryDatabaseCapabilities(dialect: DictionaryDatabaseDialect): DictionaryDatabaseCapabilities {
  return CAPABILITIES[dialect];
}

export type DictionaryExecutionJobStatus = "running" | "success" | "error";

export type DictionaryExecutionJob<TResult = unknown> = {
  ok: true;
  id: string;
  projectId: string;
  tableId: string;
  status: DictionaryExecutionJobStatus;
  message: string;
  startedAt: string;
  finishedAt?: string;
  result?: TResult;
  error?: string;
};

export interface DictionaryExecutionJobStore<TResult = unknown> {
  create(job: DictionaryExecutionJob<TResult>): Promise<void>;
  update(
    id: string,
    patch: Pick<DictionaryExecutionJob<TResult>, "status" | "message"> &
      Partial<Pick<DictionaryExecutionJob<TResult>, "finishedAt" | "result" | "error">>,
  ): Promise<DictionaryExecutionJob<TResult> | null>;
  get(projectId: string, tableId: string, id: string): Promise<DictionaryExecutionJob<TResult> | null>;
}

/**
 * Compatibility store for the current single-process server. Its contract is
 * intentionally storage-agnostic so it can later be replaced by a persisted
 * repository without changing route or UI APIs.
 */
export class InMemoryDictionaryExecutionJobStore<TResult = unknown> implements DictionaryExecutionJobStore<TResult> {
  private readonly jobs = new Map<string, DictionaryExecutionJob<TResult>>();

  async create(job: DictionaryExecutionJob<TResult>): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async update(
    id: string,
    patch: Pick<DictionaryExecutionJob<TResult>, "status" | "message"> &
      Partial<Pick<DictionaryExecutionJob<TResult>, "finishedAt" | "result" | "error">>,
  ): Promise<DictionaryExecutionJob<TResult> | null> {
    const current = this.jobs.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.jobs.set(id, next);
    return next;
  }

  async get(projectId: string, tableId: string, id: string): Promise<DictionaryExecutionJob<TResult> | null> {
    const job = this.jobs.get(id);
    return job && job.projectId === projectId && job.tableId === tableId ? job : null;
  }
}

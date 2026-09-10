import type Database from "better-sqlite3";
import type { PgPool } from "../db/postgres.js";
import { requirementFields, requirementVersions, type WorkbenchRequirementVersion, type WorkbenchRequirementSnapshot, type WorkbenchTask } from "@ke/domain";

export const WORKBENCH_SCHEMA = `
CREATE TABLE IF NOT EXISTS workbench_tasks (
  id TEXT PRIMARY KEY, version INTEGER NOT NULL, document TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workbench_versions (
  task_id TEXT NOT NULL, version INTEGER NOT NULL, document TEXT NOT NULL,
  PRIMARY KEY (task_id, version)
);`;

export interface WorkbenchRepo {
  list(): Promise<WorkbenchTask[]>;
  get(id: string): Promise<WorkbenchTask | null>;
  save(task: WorkbenchTask, expectedVersion: number): Promise<boolean>;
  history(id: string): Promise<WorkbenchTask[]>;
  getVersion(id: string, version: number): Promise<WorkbenchTask | null>;
  requirementHistory(id: string): Promise<WorkbenchRequirementVersion[]>;
}
function decode(row: { document: string }): WorkbenchTask { return JSON.parse(row.document); }

export class SqliteWorkbenchRepo implements WorkbenchRepo {
  constructor(private db: Database.Database) {}
  async list() { return (this.db.prepare("SELECT document FROM workbench_tasks").all() as { document: string }[]).map(decode); }
  async get(id: string) {
    const row = this.db.prepare("SELECT document FROM workbench_tasks WHERE id = ?").get(id) as { document: string } | undefined;
    return row ? decode(row) : null;
  }
  async save(task: WorkbenchTask, expectedVersion: number) {
    return this.db.transaction(() => {
      const document = JSON.stringify(task);
      const result = expectedVersion === 0
        ? this.db.prepare("INSERT OR IGNORE INTO workbench_tasks VALUES (?, ?, ?)").run(task.id, task.version, document)
        : this.db.prepare("UPDATE workbench_tasks SET version = ?, document = ? WHERE id = ? AND version = ?").run(task.version, document, task.id, expectedVersion);
      if (!result.changes) return false;
      this.db.prepare("INSERT INTO workbench_versions VALUES (?, ?, ?)").run(task.id, task.version, document);
      return true;
    })();
  }
  async getVersion(id: string, version: number) {
    const row = this.db.prepare("SELECT document FROM workbench_versions WHERE task_id = ? AND version = ?").get(id, version) as { document: string } | undefined;
    return row ? decode(row) : null;
  }
  async requirementHistory(id: string) {
    const fields = [...requirementFields, "version", "updatedAt", "requirementConfirmed", "requirementChangeSummary"].map(field => `json_extract(document, '$.${field}') AS "${field}"`).join(", ");
    return requirementVersions(this.db.prepare(`SELECT ${fields} FROM workbench_versions WHERE task_id = ? ORDER BY version`).all(id) as WorkbenchRequirementSnapshot[]);
  }
  async history(id: string) {
    return (this.db.prepare("SELECT document FROM workbench_versions WHERE task_id = ? ORDER BY version DESC LIMIT 100").all(id) as { document: string }[]).map(decode);
  }
}

export class PostgresWorkbenchRepo implements WorkbenchRepo {
  constructor(private pool: PgPool) {}
  async list() { await this.pool.ready; return (await this.pool.query<{ document: string }>("SELECT document FROM workbench_tasks")).rows.map(decode); }
  async get(id: string) {
    await this.pool.ready;
    const row = (await this.pool.query<{ document: string }>("SELECT document FROM workbench_tasks WHERE id = $1", [id])).rows[0];
    return row ? decode(row) : null;
  }
  async save(task: WorkbenchTask, expectedVersion: number) {
    await this.pool.ready;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const document = JSON.stringify(task);
      const result = expectedVersion === 0
        ? await client.query("INSERT INTO workbench_tasks VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [task.id, task.version, document])
        : await client.query("UPDATE workbench_tasks SET version = $1, document = $2 WHERE id = $3 AND version = $4", [task.version, document, task.id, expectedVersion]);
      if (!result.rowCount) { await client.query("ROLLBACK"); return false; }
      await client.query("INSERT INTO workbench_versions VALUES ($1, $2, $3)", [task.id, task.version, document]);
      await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async getVersion(id: string, version: number) {
    await this.pool.ready;
    const row = (await this.pool.query<{ document: string }>("SELECT document FROM workbench_versions WHERE task_id = $1 AND version = $2", [id, version])).rows[0];
    return row ? decode(row) : null;
  }
  async requirementHistory(id: string) {
    await this.pool.ready;
    const fields = [...requirementFields, "updatedAt", "requirementChangeSummary"].map(field => `document::jsonb->>'${field}' AS "${field}"`).join(", ");
    return requirementVersions((await this.pool.query<WorkbenchRequirementSnapshot>(`SELECT version, (document::jsonb->>'requirementConfirmed')::boolean AS "requirementConfirmed", ${fields} FROM workbench_versions WHERE task_id = $1 ORDER BY version`, [id])).rows);
  }
  async history(id: string) {
    await this.pool.ready;
    return (await this.pool.query<{ document: string }>("SELECT document FROM workbench_versions WHERE task_id = $1 ORDER BY version DESC LIMIT 100", [id])).rows.map(decode);
  }
}

import type Database from "better-sqlite3";
import { workbenchDocumentSchema, type WorkbenchDocument } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";

export const WORKBENCH_DOCUMENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS workbench_documents (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  document TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workbench_document_versions (
  document_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  document TEXT NOT NULL,
  PRIMARY KEY (document_id, version)
);
CREATE TABLE IF NOT EXISTS workbench_document_proposals (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  proposal TEXT NOT NULL
);`;

export interface WorkbenchDocumentProposal {
  id: string;
  documentId: string;
  baseVersion: number;
  summary: string;
  operations: unknown[];
  createdAt: string;
}

export interface WorkbenchDocumentRepo {
  list(): Promise<WorkbenchDocument[]>;
  get(id: string): Promise<WorkbenchDocument | null>;
  save(document: WorkbenchDocument, expectedVersion: number): Promise<boolean>;
  history(id: string): Promise<WorkbenchDocument[]>;
  saveProposal(proposal: WorkbenchDocumentProposal): Promise<void>;
  listProposals(documentId: string): Promise<WorkbenchDocumentProposal[]>;
  getProposal(documentId: string, proposalId: string): Promise<WorkbenchDocumentProposal | null>;
  removeProposal(documentId: string, proposalId: string): Promise<boolean>;
  saveAndRemoveProposal(document: WorkbenchDocument, expectedVersion: number, proposalId: string): Promise<boolean>;
}

function decode(row: { document: string }): WorkbenchDocument {
  return workbenchDocumentSchema.parse(JSON.parse(row.document));
}

export class SqliteWorkbenchDocumentRepo implements WorkbenchDocumentRepo {
  constructor(private readonly db: Database.Database) {}
  async list() { return (this.db.prepare("SELECT document FROM workbench_documents").all() as { document: string }[]).map(decode); }
  async get(id: string) {
    const row = this.db.prepare("SELECT document FROM workbench_documents WHERE id = ?").get(id) as { document: string } | undefined;
    return row ? decode(row) : null;
  }
  async save(document: WorkbenchDocument, expectedVersion: number) {
    return this.db.transaction(() => {
      const serialized = JSON.stringify(workbenchDocumentSchema.parse(document));
      const result = expectedVersion === 0
        ? this.db.prepare("INSERT OR IGNORE INTO workbench_documents (id, version, document) VALUES (?, ?, ?)").run(document.id, document.version, serialized)
        : this.db.prepare("UPDATE workbench_documents SET version = ?, document = ? WHERE id = ? AND version = ?").run(document.version, serialized, document.id, expectedVersion);
      if (!result.changes) return false;
      this.db.prepare("INSERT INTO workbench_document_versions (document_id, version, document) VALUES (?, ?, ?)").run(document.id, document.version, serialized);
      this.db.prepare(`DELETE FROM workbench_document_versions WHERE document_id = ? AND version NOT IN (
        SELECT version FROM workbench_document_versions WHERE document_id = ? ORDER BY version DESC LIMIT 3
      )`).run(document.id, document.id);
      return true;
    })();
  }
  async history(id: string) {
    return (this.db.prepare("SELECT document FROM workbench_document_versions WHERE document_id = ? ORDER BY version DESC LIMIT 3").all(id) as { document: string }[]).map(decode);
  }
  async saveProposal(proposal: WorkbenchDocumentProposal) {
    this.db.prepare("INSERT INTO workbench_document_proposals (id, document_id, proposal) VALUES (?, ?, ?)").run(proposal.id, proposal.documentId, JSON.stringify(proposal));
  }
  async listProposals(documentId: string) {
    return (this.db.prepare("SELECT proposal FROM workbench_document_proposals WHERE document_id = ? ORDER BY rowid").all(documentId) as { proposal: string }[]).map(row => JSON.parse(row.proposal) as WorkbenchDocumentProposal);
  }
  async getProposal(documentId: string, proposalId: string) {
    const row = this.db.prepare("SELECT proposal FROM workbench_document_proposals WHERE id = ? AND document_id = ?").get(proposalId, documentId) as { proposal: string } | undefined;
    return row ? JSON.parse(row.proposal) as WorkbenchDocumentProposal : null;
  }
  async removeProposal(documentId: string, proposalId: string) {
    return Boolean(this.db.prepare("DELETE FROM workbench_document_proposals WHERE id = ? AND document_id = ?").run(proposalId, documentId).changes);
  }
  async saveAndRemoveProposal(document: WorkbenchDocument, expectedVersion: number, proposalId: string) {
    return this.db.transaction(() => {
      const serialized = JSON.stringify(workbenchDocumentSchema.parse(document));
      const result = this.db.prepare("UPDATE workbench_documents SET version = ?, document = ? WHERE id = ? AND version = ?").run(document.version, serialized, document.id, expectedVersion);
      if (!result.changes) return false;
      const removed = this.db.prepare("DELETE FROM workbench_document_proposals WHERE id = ? AND document_id = ?").run(proposalId, document.id);
      if (!removed.changes) throw new Error("提议不存在");
      this.db.prepare("INSERT INTO workbench_document_versions (document_id, version, document) VALUES (?, ?, ?)").run(document.id, document.version, serialized);
      this.db.prepare(`DELETE FROM workbench_document_versions WHERE document_id = ? AND version NOT IN (
        SELECT version FROM workbench_document_versions WHERE document_id = ? ORDER BY version DESC LIMIT 3
      )`).run(document.id, document.id);
      return true;
    })();
  }
}

export class PostgresWorkbenchDocumentRepo implements WorkbenchDocumentRepo {
  constructor(private readonly pool: PgPool) {}
  async list() { await this.pool.ready; return (await this.pool.query<{ document: string }>("SELECT document FROM workbench_documents")).rows.map(decode); }
  async get(id: string) {
    await this.pool.ready;
    const row = (await this.pool.query<{ document: string }>("SELECT document FROM workbench_documents WHERE id = $1", [id])).rows[0];
    return row ? decode(row) : null;
  }
  async save(document: WorkbenchDocument, expectedVersion: number) {
    await this.pool.ready;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const serialized = JSON.stringify(workbenchDocumentSchema.parse(document));
      const result = expectedVersion === 0
        ? await client.query("INSERT INTO workbench_documents (id, version, document) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [document.id, document.version, serialized])
        : await client.query("UPDATE workbench_documents SET version = $1, document = $2 WHERE id = $3 AND version = $4", [document.version, serialized, document.id, expectedVersion]);
      if (!result.rowCount) { await client.query("ROLLBACK"); return false; }
      await client.query("INSERT INTO workbench_document_versions (document_id, version, document) VALUES ($1, $2, $3)", [document.id, document.version, serialized]);
      await client.query(`DELETE FROM workbench_document_versions WHERE document_id = $1 AND version NOT IN (
        SELECT version FROM workbench_document_versions WHERE document_id = $1 ORDER BY version DESC LIMIT 3
      )`, [document.id]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  async history(id: string) {
    await this.pool.ready;
    return (await this.pool.query<{ document: string }>("SELECT document FROM workbench_document_versions WHERE document_id = $1 ORDER BY version DESC LIMIT 3", [id])).rows.map(decode);
  }
  async saveProposal(proposal: WorkbenchDocumentProposal) {
    await this.pool.ready;
    await this.pool.query("INSERT INTO workbench_document_proposals (id, document_id, proposal) VALUES ($1, $2, $3)", [proposal.id, proposal.documentId, JSON.stringify(proposal)]);
  }
  async listProposals(documentId: string) {
    await this.pool.ready;
    return (await this.pool.query<{ proposal: string }>("SELECT proposal FROM workbench_document_proposals WHERE document_id = $1 ORDER BY id", [documentId])).rows.map(row => JSON.parse(row.proposal) as WorkbenchDocumentProposal);
  }
  async getProposal(documentId: string, proposalId: string) {
    await this.pool.ready;
    const row = (await this.pool.query<{ proposal: string }>("SELECT proposal FROM workbench_document_proposals WHERE id = $1 AND document_id = $2", [proposalId, documentId])).rows[0];
    return row ? JSON.parse(row.proposal) as WorkbenchDocumentProposal : null;
  }
  async removeProposal(documentId: string, proposalId: string) {
    await this.pool.ready;
    return Boolean((await this.pool.query("DELETE FROM workbench_document_proposals WHERE id = $1 AND document_id = $2", [proposalId, documentId])).rowCount);
  }
  async saveAndRemoveProposal(document: WorkbenchDocument, expectedVersion: number, proposalId: string) {
    await this.pool.ready;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const serialized = JSON.stringify(workbenchDocumentSchema.parse(document));
      const saved = await client.query("UPDATE workbench_documents SET version = $1, document = $2 WHERE id = $3 AND version = $4", [document.version, serialized, document.id, expectedVersion]);
      if (!saved.rowCount) { await client.query("ROLLBACK"); return false; }
      const removed = await client.query("DELETE FROM workbench_document_proposals WHERE id = $1 AND document_id = $2", [proposalId, document.id]);
      if (!removed.rowCount) throw new Error("提议不存在");
      await client.query("INSERT INTO workbench_document_versions (document_id, version, document) VALUES ($1, $2, $3)", [document.id, document.version, serialized]);
      await client.query(`DELETE FROM workbench_document_versions WHERE document_id = $1 AND version NOT IN (
        SELECT version FROM workbench_document_versions WHERE document_id = $1 ORDER BY version DESC LIMIT 3
      )`, [document.id]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}

import { randomUUID } from "node:crypto";
import { insertCard, moveCard, removeCard, validateDocument, type WorkbenchCard, type WorkbenchDocument } from "@ke/domain";
import type { WorkbenchDocumentProposal, WorkbenchDocumentRepo } from "./repository.js";
import { eventBus } from "../lib/eventBus.js";

export type DocumentOperation =
  | { type: "insert"; card: WorkbenchCard; parentId?: string; index: number }
  | { type: "move"; cardId: string; parentId?: string; index: number }
  | { type: "remove"; cardId: string }
  | { type: "update"; cardId: string; patch: Partial<Pick<WorkbenchCard, "title" | "content" | "properties">> };

export class WorkbenchDocumentService {
  constructor(readonly repo: WorkbenchDocumentRepo) {}
  async create(input: { title: string; conversationId: string }) {
    const now = new Date().toISOString();
    const document: WorkbenchDocument = { id: `document-${randomUUID()}`, conversationId: input.conversationId, title: input.title, version: 1, cards: [], createdAt: now, updatedAt: now };
    if (!await this.repo.save(document, 0)) throw new Error("创建工作台文档发生冲突");
    this.changed(document, "create");
    return document;
  }
  async get(id: string) { const document = await this.repo.get(id); if (!document) throw new Error("工作台文档不存在"); return document; }
  async outline(id: string, expectedVersion: number, input: { operations: DocumentOperation[] }) {
    if (!input.operations.length || !input.operations.every(operation => operation.type === "insert" && operation.card.type === "heading" && operation.card.content === null && Object.keys(operation.card.properties).length === 0)) throw new Error("自动骨架只能创建空标题");
    return this.commit(id, expectedVersion, input.operations);
  }
  async propose(id: string, expectedVersion: number, input: { summary: string; operations: DocumentOperation[] }) {
    await this.get(id);
    if (!input.summary.trim() || !input.operations.length) throw new Error("提议需要说明和操作");
    const proposal: WorkbenchDocumentProposal = { id: `proposal-${randomUUID()}`, documentId: id, baseVersion: expectedVersion, summary: input.summary.trim(), operations: normalizeLegacyOperations(input.operations), createdAt: new Date().toISOString() };
    await this.repo.saveProposal(proposal);
    eventBus.publish("workbench_document.changed", { detail: { documentId: id, proposalId: proposal.id, op: "propose" } });
    return proposal;
  }
  async getProposal(id: string, proposalId: string) { const proposal = await this.repo.getProposal(id, proposalId); if (!proposal) throw new Error("提议不存在"); return proposal; }
  async listProposals(id: string) { await this.get(id); return this.repo.listProposals(id); }
  async acceptProposal(id: string, proposalId: string) {
    const proposal = await this.getProposal(id, proposalId);
    return this.commit(id, proposal.baseVersion, normalizeLegacyOperations(proposal.operations as DocumentOperation[]), proposalId);
  }
  async commitManual(id: string, expectedVersion: number, operations: DocumentOperation[], title?: string) { return this.commit(id, expectedVersion, operations, undefined, title); }
  private async commit(id: string, expectedVersion: number, operations: DocumentOperation[], proposalId?: string, title?: string) {
    const current = await this.get(id);
    if (current.version !== expectedVersion) throw new Error("工作台文档已更新，请重新读取");
    let next = current;
    for (const operation of operations) next = apply(next, operation);
    next = { ...validateDocument({ ...next, ...(title === undefined ? {} : { title }) }), version: current.version + 1, updatedAt: new Date().toISOString() };
    const saved = proposalId
      ? await this.repo.saveAndRemoveProposal(next, current.version, proposalId)
      : await this.repo.save(next, current.version);
    if (!saved) throw new Error("工作台文档已更新，请重新读取");
    this.changed(next, proposalId ? "accept-proposal" : "save");
    return next;
  }
  private changed(document: WorkbenchDocument, op: string) { eventBus.publish("workbench_document.changed", { detail: { documentId: document.id, version: document.version, op } }); }
}

function apply(document: WorkbenchDocument, operation: DocumentOperation): WorkbenchDocument {
  if (operation.type === "insert") return insertCard(document, operation.card, operation);
  if (operation.type === "move") return moveCard(document, operation);
  if (operation.type === "remove") return removeCard(document, operation.cardId);
  const card = document.cards.find(item => item.id === operation.cardId);
  if (!card) throw new Error("卡片不存在");
  return validateDocument({ ...document, cards: document.cards.map(item => item.id === card.id ? { ...item, ...operation.patch } : item) });
}

function normalizeLegacyOperations(operations: DocumentOperation[]): DocumentOperation[] {
  return operations.map((operation, index) => {
    const raw = operation as unknown as Record<string, unknown>;
    if (raw.type !== "insertCard" || !raw.card || typeof raw.card !== "object" || Array.isArray(raw.card)) return operation;
    const card = raw.card as Record<string, unknown>;
    const content = card.content as Record<string, unknown> | undefined;
    if (card.type === "heading" && typeof content?.text === "string") {
      return { type: "insert", index, card: { id: `workbench-card-${randomUUID()}`, type: "heading", order: index, title: content.text, content: null, properties: {} } };
    }
    if (card.type === "markdown" && typeof content?.markdown === "string") {
      return { type: "insert", index, card: { id: `workbench-card-${randomUUID()}`, type: "rich_text", order: index, content: content.markdown, properties: {} } };
    }
    return operation;
  });
}

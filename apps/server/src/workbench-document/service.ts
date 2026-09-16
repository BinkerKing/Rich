import { randomUUID } from "node:crypto";
import { insertCard, moveCard, removeCard, validateDocument, type WorkbenchCard, type WorkbenchDocument } from "@ke/domain";
import type { WorkbenchDocumentProposal, WorkbenchDocumentRepo } from "./repository.js";

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
    const proposal: WorkbenchDocumentProposal = { id: `proposal-${randomUUID()}`, documentId: id, baseVersion: expectedVersion, summary: input.summary.trim(), operations: input.operations, createdAt: new Date().toISOString() };
    await this.repo.saveProposal(proposal);
    return proposal;
  }
  async getProposal(id: string, proposalId: string) { const proposal = await this.repo.getProposal(id, proposalId); if (!proposal) throw new Error("提议不存在"); return proposal; }
  async acceptProposal(id: string, proposalId: string) {
    const proposal = await this.getProposal(id, proposalId);
    const next = await this.commit(id, proposal.baseVersion, proposal.operations as DocumentOperation[]);
    await this.repo.removeProposal(id, proposalId);
    return next;
  }
  private async commit(id: string, expectedVersion: number, operations: DocumentOperation[]) {
    const current = await this.get(id);
    if (current.version !== expectedVersion) throw new Error("工作台文档已更新，请重新读取");
    let next = current;
    for (const operation of operations) next = apply(next, operation);
    next = { ...validateDocument(next), version: current.version + 1, updatedAt: new Date().toISOString() };
    if (!await this.repo.save(next, current.version)) throw new Error("工作台文档已更新，请重新读取");
    return next;
  }
}

function apply(document: WorkbenchDocument, operation: DocumentOperation): WorkbenchDocument {
  if (operation.type === "insert") return insertCard(document, operation.card, operation);
  if (operation.type === "move") return moveCard(document, operation);
  if (operation.type === "remove") return removeCard(document, operation.cardId);
  const card = document.cards.find(item => item.id === operation.cardId);
  if (!card) throw new Error("卡片不存在");
  return validateDocument({ ...document, cards: document.cards.map(item => item.id === card.id ? { ...item, ...operation.patch } : item) });
}

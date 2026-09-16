import { workbenchDocumentSchema, type WorkbenchCard, type WorkbenchDocument } from "../types/workbenchDocument.js";

export interface CardPosition {
  parentId?: string;
  index: number;
}

export function validateDocument(raw: unknown): WorkbenchDocument {
  const document = workbenchDocumentSchema.parse(raw);
  const cardsById = new Map<string, WorkbenchCard>();
  for (const card of document.cards) {
    if (cardsById.has(card.id)) throw new Error("卡片 ID 不可重复");
    cardsById.set(card.id, card);
  }
  for (const card of document.cards) {
    if (card.parentId && !cardsById.has(card.parentId)) throw new Error("父卡片不存在");
    const seen = new Set([card.id]);
    let parentId = card.parentId;
    while (parentId) {
      if (seen.has(parentId)) throw new Error("卡片层级不能形成循环");
      seen.add(parentId);
      parentId = cardsById.get(parentId)?.parentId;
    }
  }
  return { ...document, cards: orderedCards(document.cards) };
}

export function displayNumber(document: WorkbenchDocument, cardId: string): string {
  const valid = validateDocument(document);
  const card = valid.cards.find(item => item.id === cardId);
  if (!card) throw new Error("卡片不存在");
  const parts: number[] = [];
  let current: WorkbenchCard | undefined = card;
  while (current) {
    const siblings = childrenOf(valid.cards, current.parentId);
    parts.unshift(siblings.findIndex(item => item.id === current!.id) + 1);
    current = current.parentId ? valid.cards.find(item => item.id === current!.parentId) : undefined;
  }
  return parts.join(".");
}

export function insertCard(document: WorkbenchDocument, card: WorkbenchCard, position: CardPosition): WorkbenchDocument {
  const valid = validateDocument(document);
  if (valid.cards.some(item => item.id === card.id)) throw new Error("卡片 ID 不可重复");
  if (position.parentId && !valid.cards.some(item => item.id === position.parentId)) throw new Error("父卡片不存在");
  if (position.index < 0) throw new Error("卡片位置无效");
  const next: WorkbenchCard = { ...card, parentId: position.parentId, order: position.index };
  return withPosition(valid, next, position);
}

export function moveCard(document: WorkbenchDocument, move: CardPosition & { cardId: string }): WorkbenchDocument {
  const valid = validateDocument(document);
  const card = valid.cards.find(item => item.id === move.cardId);
  if (!card) throw new Error("卡片不存在");
  if (move.parentId && !valid.cards.some(item => item.id === move.parentId)) throw new Error("父卡片不存在");
  if (move.index < 0) throw new Error("卡片位置无效");
  if (move.parentId && isDescendant(valid.cards, move.parentId, card.id)) throw new Error("卡片层级不能形成循环");

  const without = valid.cards.filter(item => item.id !== card.id);
  const moved = { ...card, parentId: move.parentId, order: move.index };
  return withPosition({ ...valid, cards: without }, moved, move);
}

export function removeCard(document: WorkbenchDocument, cardId: string): WorkbenchDocument {
  const valid = validateDocument(document);
  if (!valid.cards.some(item => item.id === cardId)) throw new Error("卡片不存在");
  const removed = new Set<string>([cardId]);
  for (let index = 0; index < valid.cards.length; index++) {
    for (const card of valid.cards) if (card.parentId && removed.has(card.parentId)) removed.add(card.id);
  }
  return normalize({ ...valid, cards: valid.cards.filter(card => !removed.has(card.id)) });
}

function withPosition(document: WorkbenchDocument, card: WorkbenchCard, position: CardPosition): WorkbenchDocument {
  const siblings = childrenOf(document.cards, position.parentId);
  const insertionIndex = Math.min(position.index, siblings.length);
  const positioned = [...siblings];
  positioned.splice(insertionIndex, 0, card);
  const siblingIds = new Set(positioned.map(item => item.id));
  const cards = [
    ...document.cards.filter(item => !siblingIds.has(item.id)),
    ...positioned.map((item, order) => ({ ...item, parentId: position.parentId, order })),
  ];
  return normalize({ ...document, cards });
}

function normalize(document: WorkbenchDocument): WorkbenchDocument {
  const normalized = document.cards.map(card => ({ ...card }));
  const parents = new Set<string | undefined>(normalized.map(card => card.parentId));
  for (const parentId of parents) {
    childrenOf(normalized, parentId).forEach((card, order) => { card.order = order; });
  }
  return { ...document, cards: orderedCards(normalized) };
}

function childrenOf(cards: WorkbenchCard[], parentId?: string): WorkbenchCard[] {
  return cards.filter(card => card.parentId === parentId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function orderedCards(cards: WorkbenchCard[]): WorkbenchCard[] {
  const result: WorkbenchCard[] = [];
  const append = (parentId?: string) => {
    for (const card of childrenOf(cards, parentId)) {
      result.push(card);
      append(card.id);
    }
  };
  append();
  return result;
}

function isDescendant(cards: WorkbenchCard[], candidateId: string, ancestorId: string): boolean {
  let current = cards.find(card => card.id === candidateId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = cards.find(card => card.id === current?.parentId);
  }
  return candidateId === ancestorId;
}

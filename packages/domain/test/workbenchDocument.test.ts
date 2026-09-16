import { describe, expect, it } from "vitest";
import {
  displayNumber,
  insertCard,
  moveCard,
  removeCard,
  validateDocument,
  type WorkbenchDocument,
} from "../src/index.js";

function document(cards: WorkbenchDocument["cards"]): WorkbenchDocument {
  return {
    id: "document-1",
    conversationId: "conversation-1",
    title: "工作台",
    version: 1,
    cards,
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

function heading(id: string, parentId?: string, order = 0): WorkbenchDocument["cards"][number] {
  return { id, type: "heading", parentId, order, title: id, content: null, properties: {} };
}

function text(id: string, parentId?: string, order = 0): WorkbenchDocument["cards"][number] {
  return { id, type: "rich_text", parentId, order, content: { type: "doc", content: [] }, properties: {} };
}

describe("workbench document card tree", () => {
  it("derives display numbers from hierarchy and sibling order instead of ids", () => {
    const value = document([heading("goal", undefined, 0), heading("scope", "goal", 0), text("detail", "scope", 0)]);

    expect(displayNumber(value, "goal")).toBe("1");
    expect(displayNumber(value, "scope")).toBe("1.1");
    expect(displayNumber(value, "detail")).toBe("1.1.1");
  });

  it("moves a card and normalizes the old and new sibling orders", () => {
    const value = document([heading("first", undefined, 0), heading("second", undefined, 1), text("detail", "second", 0)]);

    const moved = moveCard(value, { cardId: "detail", parentId: undefined, index: 0 });

    expect(moved.cards.map(card => [card.id, card.parentId, card.order])).toEqual([
      ["detail", undefined, 0],
      ["first", undefined, 1],
      ["second", undefined, 2],
    ]);
  });

  it("rejects missing parents and cyclic moves", () => {
    expect(() => validateDocument(document([text("orphan", "missing")] ))).toThrow("父卡片不存在");
    expect(() => moveCard(document([heading("parent"), heading("child", "parent")]), { cardId: "parent", parentId: "child", index: 0 })).toThrow("循环");
  });

  it("inserts into a parent and removes the complete child subtree", () => {
    const inserted = insertCard(document([heading("parent")]), text("child"), { parentId: "parent", index: 0 });
    const withGrandchild = insertCard(inserted, text("grandchild"), { parentId: "child", index: 0 });

    expect(removeCard(withGrandchild, "child").cards).toEqual([heading("parent")]);
  });
});

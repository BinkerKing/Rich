import { describe, expect, it } from "vitest";
import type { Element, Relation } from "@ke/domain";
import { buildMcpServer } from "../src/mcp/server.js";

function makeDeps() {
  const elements = new Map<string, Element>();
  const relations: Relation[] = [];
  return {
    elementsMap: elements,
    relations,
    deps: {
      elements: {
        async list() { return Array.from(elements.values()); },
        async get(id: string) { return elements.get(id) ?? null; },
        async put(el: Element) { elements.set(el.id, el); },
        async listVersions() { return []; },
        async revertTo() { throw new Error("not implemented"); },
        async removeMany(ids: string[]) { for (const id of ids) elements.delete(id); },
      },
      relations: {
        async list() { return relations; },
        async byFrom(id: string) { return relations.filter(r => r.from === id); },
        async byTo(id: string) { return relations.filter(r => r.to === id); },
        async append(rels: Relation[]) { relations.push(...rels); },
        async removeForElements() {},
        async reparent() {},
        async reorderChildren() {},
      },
      paths: {},
      signals: {},
      qa: {},
      annotations: {},
      adapters: [],
      aiDir: "/tmp",
    } as never,
  };
}

function tool(server: unknown, name: string) {
  return (server as { _registeredTools: Record<string, { inputSchema: { safeParse(input: unknown): { success: boolean } }; handler(args: unknown): Promise<unknown> }> })._registeredTools[name];
}

describe("MCP element tools", () => {
  it("lets Hermes create AI news report elements with tags", async () => {
    const { deps, elementsMap } = makeDeps();
    const server = buildMcpServer(deps);
    const create = tool(server, "create_element");

    const input = {
      title: "热门 SKILL 推荐",
      type: "report",
      parent_id: "ai-news.2026-05-23",
      tags: ["ai-news", "category:热门 SKILL", "date:2026-05-23"],
      content: { sections: [] },
    };
    expect(create.inputSchema.safeParse(input).success).toBe(true);

    await create.handler(input);
    const created = Array.from(elementsMap.values())[0];
    expect(created.type).toBe("report");
    expect(created.tags).toEqual(["ai-news", "category:热门 SKILL", "date:2026-05-23"]);
  });

  it("lets Hermes update element type and tags after creation", async () => {
    const { deps, elementsMap } = makeDeps();
    elementsMap.set("el-skill", baseElement("el-skill", "热门 SKILL 推荐"));
    const server = buildMcpServer(deps);
    const update = tool(server, "update_element");

    const input = {
      id: "el-skill",
      type: "report",
      tags: ["ai-news", "category:热门 SKILL", "date:2026-05-23"],
    };
    expect(update.inputSchema.safeParse(input).success).toBe(true);

    await update.handler(input);
    expect(elementsMap.get("el-skill")?.type).toBe("report");
    expect(elementsMap.get("el-skill")?.tags).toEqual(["ai-news", "category:热门 SKILL", "date:2026-05-23"]);
  });

  it("attaches a mindmap embed to an element", async () => {
    const { deps, elementsMap } = makeDeps();
    elementsMap.set("el-topic", baseElement("el-topic", "主元素"));
    const server = buildMcpServer(deps);
    const attach = tool(server, "attach_mindmap");

    const input = { id: "el-topic", deckRootId: "deck-123", caption: "演示脑图" };
    expect(attach.inputSchema.safeParse(input).success).toBe(true);

    await attach.handler(input);
    const sections = sectionsOf(elementsMap.get("el-topic")!);
    const embed = sections.flatMap(s => s.blocks).find(b => (b as { style?: string }).style === "mindmap-embed") as { deckRootId?: string; origin?: string; caption?: string };
    expect(embed).toMatchObject({ deckRootId: "deck-123", origin: "from-element", caption: "演示脑图" });
  });

  it("attaches a ready cover image to a mindmap embed", async () => {
    const { deps, elementsMap } = makeDeps();
    elementsMap.set("el-topic", baseElement("el-topic", "主元素"));
    const server = buildMcpServer(deps);
    const attachMindmap = tool(server, "attach_mindmap");
    const attachCover = tool(server, "attach_cover");
    await attachMindmap.handler({ id: "el-topic", deckRootId: "deck-123" });

    const input = { id: "el-topic", deckRootId: "deck-123", src: "https://example.com/cover.png", alt: "封面", caption: "封面图" };
    expect(attachCover.inputSchema.safeParse(input).success).toBe(true);

    await attachCover.handler(input);
    const embed = sectionsOf(elementsMap.get("el-topic")!).flatMap(s => s.blocks).find(b => (b as { style?: string }).style === "mindmap-embed") as { cover?: unknown };
    expect(embed.cover).toEqual({ status: "ready", src: "https://example.com/cover.png", alt: "封面", caption: "封面图" });
  });
});

function baseElement(id: string, title: string): Element {
  return {
    id,
    type: "concept",
    title,
    tags: [],
    content: { sections: [] },
    metadata: { createdAt: "2026-05-23T00:00:00.000Z", updatedAt: "2026-05-23T00:00:00.000Z", generatedBy: "ai", richness: 1 },
  };
}

function sectionsOf(el: Element): Array<{ blocks: unknown[] }> {
  return ((el.content as { sections?: Array<{ blocks: unknown[] }> }).sections) ?? [];
}

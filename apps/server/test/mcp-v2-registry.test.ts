import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { richSuccess } from "../src/mcp-v2/registry/response.js";
import {
  RichToolRegistry,
  type RichToolRegistration,
} from "../src/mcp-v2/registry/toolRegistry.js";

function fixtureRegistration(
  name: string,
  overrides: Partial<RichToolRegistration> = {},
): RichToolRegistration {
  return {
    name,
    title: `Fixture ${name}`,
    description: `Use ${name} for a registry contract test.`,
    category: "query",
    inputSchema: z.object({ query: z.string().min(1) }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "Find one record", input: { query: "Rich" } }],
    verification: "The returned records are read directly from the repository.",
    handler: async input => richSuccess(name, input),
    ...overrides,
  };
}

describe("MCP 2.0 tool registry", () => {
  it("rejects invalid and duplicate tool names", () => {
    const registry = new RichToolRegistry();

    expect(() => registry.register(fixtureRegistration("project_search"))).toThrow(/rich_/);
    registry.register(fixtureRegistration("rich_context_search"));
    expect(() => registry.register(fixtureRegistration("rich_context_search"))).toThrow(/already registered/);
  });

  it("requires annotations, examples, and verification metadata", () => {
    const registry = new RichToolRegistry();

    expect(() => registry.register(fixtureRegistration("rich_context_missing_annotations", {
      annotations: undefined as never,
    }))).toThrow(/annotations/);
    expect(() => registry.register(fixtureRegistration("rich_context_missing_examples", {
      examples: [],
    }))).toThrow(/example/);
    expect(() => registry.register(fixtureRegistration("rich_context_missing_verification", {
      verification: "",
    }))).toThrow(/verification/);
  });

  it("rejects a forty-first tool", () => {
    const registry = new RichToolRegistry({ maxTools: 40 });
    for (let index = 0; index < 40; index += 1) {
      registry.register(fixtureRegistration(`rich_fixture_tool_${index}`));
    }

    expect(() => registry.register(fixtureRegistration("rich_fixture_tool_40"))).toThrow(/40/);
  });

  it("produces a stable sorted catalog and schema metrics", () => {
    const registry = new RichToolRegistry();
    registry.register(fixtureRegistration("rich_project_manage", {
      category: "manage",
      annotations: { readOnly: false, destructive: true, idempotent: true },
    }));
    registry.register(fixtureRegistration("rich_context_search"));

    const catalog = registry.listDefinitions();
    expect(catalog.map(tool => tool.name)).toEqual([
      "rich_context_search",
      "rich_project_manage",
    ]);
    expect(catalog[0].inputSchema).toMatchObject({ type: "object" });
    expect(catalog[1].annotations.destructive).toBe(true);
    expect(registry.measure()).toMatchObject({ toolCount: 2 });
    expect(registry.measure().schemaBytes).toBeGreaterThan(0);
    expect(registry.listDefinitions()).toEqual(catalog);
  });

  it("validates input before invoking a handler", async () => {
    const handler = vi.fn(async input => richSuccess("rich_context_search", input));
    const registry = new RichToolRegistry();
    registry.register(fixtureRegistration("rich_context_search", { handler }));

    const invalid = await registry.invoke("rich_context_search", { query: "" });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
    expect(handler).not.toHaveBeenCalled();

    const valid = await registry.invoke("rich_context_search", { query: "Rich" });
    expect(valid).toMatchObject({ ok: true, data: { query: "Rich" } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND for an unknown tool", async () => {
    const registry = new RichToolRegistry();
    await expect(registry.invoke("rich_context_missing", {})).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", retryable: false },
    });
  });
});

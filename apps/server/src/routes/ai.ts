import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function aiRoutes(root: string): Hono {
  const r = new Hono();
  // Mock: return canned seed tree regardless of topic input.
  // Real Claude integration happens in a later plan.
  r.post("/generate-tree", async (c) => {
    const raw = await readFile(join(root, "seed.tree.json"), "utf8");
    return c.json(JSON.parse(raw));
  });
  return r;
}

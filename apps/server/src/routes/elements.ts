import { Hono } from "hono";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { PathsRepo } from "../repos/PathsRepo.js";
import type { QARepo } from "../repos/QARepo.js";
import type { AnnotationsRepo } from "../repos/AnnotationsRepo.js";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import { recordSignal } from "../ai/signalRecorder.js";
import { migrateLegacyContentToSections } from "../lib/legacyContentMigration.js";

export interface ElementsRoutesDeps {
  elements: ElementsRepo;
  relations: RelationsRepo;
  paths: PathsRepo;
  qa: QARepo;
  annotations: AnnotationsRepo;
  signals?: SignalsRepo;
}

export function elementsRoutes(deps: ElementsRoutesDeps): Hono {
  const { elements: repo, relations, paths, qa, annotations, signals } = deps;
  const r = new Hono();
  r.get("/", async (c) => c.json(await repo.list()));
  r.get("/:id", async (c) => {
    const el = await repo.get(c.req.param("id"));
    if (!el) return c.json({ error: "not found" }, 404);
    return c.json(el);
  });
  r.get("/:id/history", async (c) => {
    const id = c.req.param("id");
    const el = await repo.get(id);
    if (!el) return c.json({ error: "not found" }, 404);
    const versions = await repo.listVersions(id);
    return c.json(versions);
  });
  // POST a brand-new manually-created element. Used by the home page "手动"
  // mode where the user wants to start an empty topic and fill it in by hand.
  // Body: { title, type?, subtitle? }  — default type = "topic".
  r.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title required" }, 400);
    if (title.length > 120) return c.json({ error: "title too long (max 120)" }, 400);
    const parentId = typeof body.parentId === "string" ? body.parentId.trim() : "";
    // When parentId is given, the new element becomes a child of that parent.
    // Default type changes: child of topic/concept → concept; otherwise topic.
    let parent = null;
    if (parentId) {
      parent = await repo.get(parentId);
      if (!parent) return c.json({ error: "parent not found" }, 404);
    }
    const defaultType = parent ? "concept" : "topic";
    const type = (typeof body.type === "string" ? body.type : defaultType) as
      "topic" | "concept" | "practice" | "project" | "step" | "exercise" | "product-design" | "summary";
    const subtitle = typeof body.subtitle === "string" ? body.subtitle.trim() || undefined : undefined;
    // 项目实战：允许 POST 时一起传入 content / status / tags
    const content = body.content !== undefined ? body.content : {} as Record<string, unknown>;
    const status =
      body.status === "todo" || body.status === "doing" || body.status === "done"
        ? body.status as "todo" | "doing" | "done"
        : undefined;
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 20)
      : undefined;
    const id = slugify(title, await repo.list());
    const now = new Date().toISOString();
    const next = {
      id,
      type,
      title,
      subtitle,
      tags,
      content,
      status,
      metadata: { createdAt: now, updatedAt: now, generatedBy: "user" as const, richness: 1 as const },
    };
    await repo.put(next);
    // If a parent was specified, also create the child relation so the new
    // element shows up under it in the tree.
    let createdRelation = null;
    if (parent) {
      const rel = {
        id: `${parentId}-child-${id}`,
        kind: "child" as const,
        from: parentId,
        to: id,
        createdAt: now,
      };
      await relations.append([rel]);
      createdRelation = rel;
    }
    if (signals) {
      await recordSignal(signals, {
        ts: now, type: "user.edited", manual: "knowledge",
        elementId: id, data: { fields: ["create-manual"], type, parentId: parentId || undefined },
      });
    }
    return c.json({ element: next, relation: createdRelation });
  });

  // PATCH the user-editable surface fields on an element (title + subtitle).
  // Other fields (content, type, tags, …) stay AI-managed.
  r.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const el = await repo.get(id);
    if (!el) return c.json({ error: "not found" }, 404);
    const body = await c.req.json().catch(() => ({}));
    const patch: Partial<typeof el> = {};
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) return c.json({ error: "title cannot be empty" }, 400);
      if (t.length > 120) return c.json({ error: "title too long (max 120)" }, 400);
      patch.title = t;
    }
    if (body.subtitle !== undefined) {
      const s = typeof body.subtitle === "string" ? body.subtitle.trim() : "";
      patch.subtitle = s || undefined;
    }
    if (typeof body.type === "string") {
      const VALID_TYPES = [
        "topic", "concept", "step", "product-design",
        "viewpoint", "question", "case", "tool", "ability",
        "project", "practice", "summary", "relation",
        "dispute", "exercise", "report", "guide",
      ];
      if (!VALID_TYPES.includes(body.type)) {
        return c.json({ error: `invalid type: ${body.type}` }, 400);
      }
      patch.type = body.type as typeof el.type;
    }
    if (body.difficulty !== undefined) {
      if (body.difficulty === null || body.difficulty === "") {
        patch.difficulty = undefined;
      } else if (body.difficulty === "low" || body.difficulty === "mid" || body.difficulty === "high") {
        patch.difficulty = body.difficulty;
      } else {
        return c.json({ error: `invalid difficulty: ${body.difficulty}` }, 400);
      }
    }
    // 项目实战：开发任务的 status 字段 (仅 step 类型有意义)
    if (body.status !== undefined) {
      if (body.status === null || body.status === "") {
        patch.status = undefined;
      } else if (body.status === "todo" || body.status === "doing" || body.status === "done") {
        patch.status = body.status;
      } else {
        return c.json({ error: `invalid status: ${body.status}` }, 400);
      }
    }
    // 允许 patch content（PRD 编辑 / drawer 编辑 用）
    if (body.content !== undefined) {
      patch.content = body.content;
    }
    // 项目实战开关：通过 tags 控制 practice 元是否在 项目实战 列表显示
    if (body.tags !== undefined) {
      if (Array.isArray(body.tags)) {
        patch.tags = body.tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 20);
      } else if (body.tags === null) {
        patch.tags = undefined;
      } else {
        return c.json({ error: "tags must be an array of strings" }, 400);
      }
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "nothing to update" }, 400);
    const next = {
      ...el,
      ...patch,
      metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
    };
    await repo.put(next);
    if (signals) {
      await recordSignal(signals, {
        ts: new Date().toISOString(), type: "user.edited", manual: "knowledge",
        elementId: id, data: { fields: Object.keys(patch) },
      });
    }
    return c.json(next);
  });

  // User-driven section editing. Replaces (or auto-migrates legacy → )
  // content.sections with an arbitrary array. Each entry must look like
  // { id, title, blocks[] } with a string `style` on each block. Other
  // content fields stay untouched so legacy elements keep their oneSentence
  // / coreExplain / ... around as the previous safety net.
  r.put("/:id/sections", async (c) => {
    const id = c.req.param("id");
    const el = await repo.get(id);
    if (!el) return c.json({ error: "not found" }, 404);
    const body = await c.req.json().catch(() => ({}));
    const incoming = body.sections;
    if (!Array.isArray(incoming)) return c.json({ error: "sections must be an array" }, 400);
    // Minimal shape check; we don't validate per-style schemas here — the
    // frontend editor only emits the shapes it knows. AI ops have their
    // own zod validation.
    for (const s of incoming) {
      if (!s || typeof s !== "object") return c.json({ error: "section must be object" }, 400);
      const sec = s as Record<string, unknown>;
      if (typeof sec.id !== "string" || !sec.id) return c.json({ error: "section.id required" }, 400);
      if (typeof sec.title !== "string") return c.json({ error: "section.title required" }, 400);
      if (!Array.isArray(sec.blocks)) return c.json({ error: "section.blocks must be array" }, 400);
      for (const b of sec.blocks) {
        if (!b || typeof b !== "object") return c.json({ error: "block must be object" }, 400);
        if (typeof (b as { style?: unknown }).style !== "string") {
          return c.json({ error: "block.style must be string" }, 400);
        }
      }
    }
    const content = (el.content && typeof el.content === "object")
      ? { ...(el.content as Record<string, unknown>), sections: incoming }
      : { sections: incoming };
    const next = {
      ...el,
      content: content as typeof el.content,
      metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
    };
    await repo.put(next);
    if (signals) {
      await recordSignal(signals, {
        ts: new Date().toISOString(), type: "user.edited", manual: "knowledge",
        elementId: id, data: { fields: ["content.sections"], sectionCount: incoming.length },
      });
    }
    return c.json(next);
  });

  // One-shot migration: convert legacy concept fields (oneSentence, ...)
  // into a sections[] array on first edit. Returns the updated element.
  // Idempotent — if sections already cover those ids, only the missing
  // ones get appended.
  r.post("/:id/sections/migrate", async (c) => {
    const id = c.req.param("id");
    const el = await repo.get(id);
    if (!el) return c.json({ error: "not found" }, 404);
    const migrated = migrateLegacyContentToSections(el.content);
    if (migrated === el.content) return c.json(el); // nothing to do
    const next = {
      ...el,
      content: migrated as typeof el.content,
      metadata: { ...el.metadata, updatedAt: new Date().toISOString() },
    };
    await repo.put(next);
    return c.json(next);
  });

  r.post("/:id/revert", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const timestamp = String(body.timestamp ?? "");
    if (!timestamp) return c.json({ error: "timestamp required" }, 400);
    try {
      const restored = await repo.revertTo(id, timestamp);
      if (signals) {
        await recordSignal(signals, {
          ts: new Date().toISOString(),
          type: "user.reverted",
          manual: "knowledge",
          elementId: id,
          data: { fromTimestamp: timestamp },
        });
      }
      return c.json(restored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("no such version")) return c.json({ error: msg }, 404);
      throw err;
    }
  });

  // ----- subtree delete -----
  // Removes the element, its entire descendant subtree (via child relations),
  // and all attached data (relations, paths centered on it, qa, annotations).
  r.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const el = await repo.get(id);
    if (!el) return c.json({ error: "not found" }, 404);

    // Compute subtree via BFS over child relations.
    const allRelations = await relations.list();
    const childIndex = new Map<string, string[]>();
    for (const rel of allRelations) {
      if (rel.kind !== "child") continue;
      const list = childIndex.get(rel.from) ?? [];
      list.push(rel.to);
      childIndex.set(rel.from, list);
    }
    const toRemove: string[] = [];
    const seen = new Set<string>();
    const queue: string[] = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      toRemove.push(cur);
      for (const child of childIndex.get(cur) ?? []) queue.push(child);
    }

    // Wipe paths centered on any of the removed elements; leave other paths
    // alone (path.steps may still reference removed ids, but the UI tolerates
    // missing steps already).
    for (const removedId of toRemove) {
      await paths.putForCenter(removedId, []);
    }

    // Wipe Q&A + annotations for each removed element.
    await qa.removeForElements(toRemove);
    for (const removedId of toRemove) {
      const annList = await annotations.listForElement(removedId);
      for (const a of annList) await annotations.remove(a.id);
    }

    await relations.removeForElements(toRemove);
    await repo.removeMany(toRemove);
    if (signals) {
      await recordSignal(signals, {
        ts: new Date().toISOString(),
        type: "user.reverted",   // closest existing type; could add user.deleted later
        manual: "knowledge",
        elementId: id,
        data: { op: "delete-subtree", removedIds: toRemove },
      });
    }
    return c.json({ removed: toRemove });
  });

  // ----- move (reparent) -----
  // Body: { newParentId: string | null }. null = make `id` a root.
  r.post("/:id/move", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const newParentId: string | null = body.newParentId == null ? null : String(body.newParentId);

    const el = await repo.get(id);
    if (!el) return c.json({ error: "not found" }, 404);

    if (newParentId) {
      if (newParentId === id) return c.json({ error: "cannot move element under itself" }, 400);
      const parent = await repo.get(newParentId);
      if (!parent) return c.json({ error: "new parent not found" }, 404);

      // Cycle check: newParentId must not be a descendant of id.
      const allRelations = await relations.list();
      const childIndex = new Map<string, string[]>();
      for (const rel of allRelations) {
        if (rel.kind !== "child") continue;
        const list = childIndex.get(rel.from) ?? [];
        list.push(rel.to);
        childIndex.set(rel.from, list);
      }
      const descendants = new Set<string>();
      const queue = [id];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const child of childIndex.get(cur) ?? []) {
          if (descendants.has(child)) continue;
          descendants.add(child);
          queue.push(child);
        }
      }
      if (descendants.has(newParentId)) {
        return c.json({ error: "cannot move element under one of its descendants (cycle)" }, 400);
      }
    }

    await relations.reparent(id, newParentId);
    if (signals) {
      await recordSignal(signals, {
        ts: new Date().toISOString(),
        type: "user.reverted",
        manual: "knowledge",
        elementId: id,
        data: { op: "move", newParentId },
      });
    }
    return c.json({ id, newParentId });
  });

  return r;
}

/** Make a unique kebab id from a (possibly Chinese) title. We strip non-ASCII,
 *  fall back to a timestamp suffix when the title has no Latin chars, and
 *  append a numeric suffix on collision. */
function slugify(title: string, existing: { id: string }[]): string {
  const base = title.toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  let candidate = base || `topic-${Date.now().toString(36)}`;
  // ASCII-only id is friendlier for URLs; if all stripped, use timestamp.
  if (!/[a-z0-9]/.test(candidate)) candidate = `topic-${Date.now().toString(36)}`;
  const taken = new Set(existing.map(e => e.id));
  if (!taken.has(candidate)) return candidate;
  let n = 2;
  while (taken.has(`${candidate}-${n}`)) n += 1;
  return `${candidate}-${n}`;
}

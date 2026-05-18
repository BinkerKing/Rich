#!/usr/bin/env tsx
/**
 * One-shot migration: read existing data/*.json[l] files and bulk-load them
 * into a fresh SQLite database at data/ke.db.
 *
 * Idempotent: re-runs are safe; existing rows with the same primary key are
 * left alone (or replaced for elements/state which are upsert by id).
 *
 * Original JSON files are NOT touched — they remain as a backup so you can
 * point the server back at JsonRepo* by setting KE_STORAGE=json if needed.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { openDb } from "../src/db/sqlite.js";
import { JsonElementsRepo } from "../src/repos/JsonElementsRepo.js";
import { dataDir } from "../src/lib/paths.js";

const ROOT = dataDir();
const DB_PATH = join(ROOT, "ke.db");

async function main() {
  console.log(`[migrate] data dir : ${ROOT}`);
  console.log(`[migrate] db file  : ${DB_PATH}`);
  const db = openDb(DB_PATH);

  // ---- elements (one file per element under data/elements/*.json) ----
  let elementCount = 0;
  try {
    // Reuse JsonElementsRepo so we honour any cache/history quirks.
    const json = new JsonElementsRepo(ROOT);
    const all = await json.list();
    const insert = db.prepare(`
      INSERT INTO elements (id, type, title, subtitle, aliases, tags, domain, difficulty, content, created_at, updated_at, generated_by, ai_model, ai_session_id, richness)
      VALUES (@id, @type, @title, @subtitle, @aliases, @tags, @domain, @difficulty, @content, @created_at, @updated_at, @generated_by, @ai_model, @ai_session_id, @richness)
      ON CONFLICT(id) DO UPDATE SET
        type=excluded.type, title=excluded.title, subtitle=excluded.subtitle,
        aliases=excluded.aliases, tags=excluded.tags, domain=excluded.domain,
        difficulty=excluded.difficulty, content=excluded.content,
        created_at=excluded.created_at, updated_at=excluded.updated_at,
        generated_by=excluded.generated_by, ai_model=excluded.ai_model,
        ai_session_id=excluded.ai_session_id, richness=excluded.richness
    `);
    const tx = db.transaction((els: typeof all) => {
      for (const el of els) {
        insert.run({
          id: el.id, type: el.type, title: el.title,
          subtitle: el.subtitle ?? null,
          aliases: el.aliases ? JSON.stringify(el.aliases) : null,
          tags: el.tags ? JSON.stringify(el.tags) : null,
          domain: el.domain ?? null,
          difficulty: el.difficulty ?? null,
          content: JSON.stringify(el.content),
          created_at: el.metadata.createdAt, updated_at: el.metadata.updatedAt,
          generated_by: el.metadata.generatedBy, ai_model: el.metadata.aiModel ?? null,
          ai_session_id: el.metadata.aiSessionId ?? null,
          richness: el.metadata.richness,
        });
      }
    });
    tx(all);
    elementCount = all.length;
  } catch (err) {
    console.warn("[migrate] elements skipped:", err);
  }
  console.log(`[migrate] elements   : ${elementCount}`);

  // ---- element history (data/elements/.history/<id>/<ts>.json) ----
  let versionCount = 0;
  const historyRoot = join(ROOT, "elements", ".history");
  try {
    const idDirs = await readdir(historyRoot);
    // Preload all version records, then do a synchronous transaction.
    const records: Array<{ elementId: string; ts: string; snapshot: string }> = [];
    for (const elementId of idDirs) {
      const dir = join(historyRoot, elementId);
      const s = await stat(dir).catch(() => null);
      if (!s || !s.isDirectory()) continue;
      const files = await readdir(dir);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        const ts = f.replace(/\.json$/, "");
        const snapshot = await readFile(join(dir, f), "utf8");
        records.push({ elementId, ts, snapshot });
      }
    }
    const ins = db.prepare(`
      INSERT OR IGNORE INTO element_versions (element_id, timestamp, snapshot) VALUES (?, ?, ?)
    `);
    const tx = db.transaction((rs: typeof records) => {
      for (const r of rs) ins.run(r.elementId, r.ts, r.snapshot);
    });
    tx(records);
    versionCount = records.length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] versions skipped:", err);
    }
  }
  console.log(`[migrate] versions   : ${versionCount}`);

  // ---- relations.jsonl ----
  let relCount = 0;
  try {
    const raw = await readFile(join(ROOT, "relations.jsonl"), "utf8");
    const lines = raw.split("\n").filter(l => l.trim());
    const ins = db.prepare(`
      INSERT INTO relations (id, from_id, to_id, kind, strength, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING
    `);
    const tx = db.transaction((rs: typeof lines) => {
      for (const ln of rs) {
        const r = JSON.parse(ln);
        ins.run(r.id, r.from, r.to, r.kind, r.strength ?? null, r.reason ?? null, r.createdAt ?? new Date().toISOString());
        relCount += 1;
      }
    });
    tx(lines);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] relations skipped:", err);
    }
  }
  console.log(`[migrate] relations  : ${relCount}`);

  // ---- paths (data/paths/<id>.json) ----
  let pathCount = 0;
  try {
    const pathsDir = join(ROOT, "paths");
    const files = await readdir(pathsDir);
    // Preload all path entries, then a synchronous transaction.
    const allPaths: Array<{
      id: string; centerElementId: string; kind: string; label: string; color: string;
      steps: string[]; estimatedTime?: string; generatedBy: "ai" | "user"; createdAt: string;
    }> = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const arr = JSON.parse(await readFile(join(pathsDir, f), "utf8")) as typeof allPaths;
      for (const p of arr) allPaths.push(p);
    }
    const ins = db.prepare(`
      INSERT OR REPLACE INTO paths (id, center_id, kind, label, color, steps, estimated_time, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((ps: typeof allPaths) => {
      for (const p of ps) {
        ins.run(
          p.id, p.centerElementId, p.kind, p.label, p.color,
          JSON.stringify(p.steps), p.estimatedTime ?? null, p.createdAt,
          JSON.stringify({ generatedBy: p.generatedBy }),
        );
      }
    });
    tx(allPaths);
    pathCount = allPaths.length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] paths skipped:", err);
    }
  }
  console.log(`[migrate] paths      : ${pathCount}`);

  // ---- signals.jsonl ----
  let sigCount = 0;
  try {
    const raw = await readFile(join(ROOT, "signals.jsonl"), "utf8");
    const lines = raw.split("\n").filter(l => l.trim());
    const ins = db.prepare(`
      INSERT INTO signals (ts, type, manual, element_id, op, adapter, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((rs: typeof lines) => {
      for (const ln of rs) {
        const s = JSON.parse(ln);
        ins.run(s.ts, s.type, s.manual ?? null, s.elementId ?? null, s.op ?? null, s.adapter ?? null,
          s.data ? JSON.stringify(s.data) : null);
        sigCount += 1;
      }
    });
    tx(lines);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] signals skipped:", err);
    }
  }
  console.log(`[migrate] signals    : ${sigCount}`);

  // ---- qa.jsonl ----
  let qaCount = 0;
  try {
    const raw = await readFile(join(ROOT, "qa.jsonl"), "utf8");
    const lines = raw.split("\n").filter(l => l.trim());
    const ins = db.prepare(`
      INSERT OR IGNORE INTO qa (id, element_id, question, answer, created_at, ai_model, ai_session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((rs: typeof lines) => {
      for (const ln of rs) {
        const q = JSON.parse(ln);
        ins.run(q.id, q.elementId, q.question, q.answer, q.createdAt, q.aiModel ?? null, q.aiSessionId ?? null);
        qaCount += 1;
      }
    });
    tx(lines);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] qa skipped:", err);
    }
  }
  console.log(`[migrate] qa         : ${qaCount}`);

  // ---- annotations.jsonl ----
  let annCount = 0;
  try {
    const raw = await readFile(join(ROOT, "annotations.jsonl"), "utf8");
    const lines = raw.split("\n").filter(l => l.trim());
    const ins = db.prepare(`
      INSERT OR IGNORE INTO annotations (id, element_id, kind, text, context_before, context_after, note, analysis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((rs: typeof lines) => {
      for (const ln of rs) {
        const a = JSON.parse(ln);
        ins.run(a.id, a.elementId, a.kind, a.text, a.contextBefore ?? null, a.contextAfter ?? null,
          a.note ?? null, a.analysis ? JSON.stringify(a.analysis) : null, a.createdAt);
        annCount += 1;
      }
    });
    tx(lines);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] annotations skipped:", err);
    }
  }
  console.log(`[migrate] annotations: ${annCount}`);

  // ---- state/current.json + center-history.jsonl ----
  let centerSet = false;
  let histCount = 0;
  try {
    const raw = await readFile(join(ROOT, "state", "current.json"), "utf8");
    const c = JSON.parse(raw) as { elementId: string | null; updatedAt: string | null };
    if (c.elementId && c.updatedAt) {
      db.prepare(`
        INSERT INTO state (key, value, updated_at) VALUES ('center.current', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).run(c.elementId, c.updatedAt);
      centerSet = true;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] state skipped:", err);
    }
  }
  try {
    const raw = await readFile(join(ROOT, "state", "center-history.jsonl"), "utf8");
    const lines = raw.split("\n").filter(l => l.trim());
    const ins = db.prepare(`
      INSERT INTO center_history (ts, from_id, to_id, dwell_ms) VALUES (?, ?, ?, ?)
    `);
    const tx = db.transaction((rs: typeof lines) => {
      for (const ln of rs) {
        const c = JSON.parse(ln);
        ins.run(c.ts, c.from ?? null, c.to, c.dwellMs ?? null);
        histCount += 1;
      }
    });
    tx(lines);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[migrate] center_history skipped:", err);
    }
  }
  console.log(`[migrate] center     : ${centerSet ? "ok" : "—"} | history: ${histCount}`);

  db.close();
  console.log("[migrate] done.");
}

main().catch(err => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});

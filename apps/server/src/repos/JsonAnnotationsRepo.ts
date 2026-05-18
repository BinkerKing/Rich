import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Annotation } from "@ke/domain";
import type { AnnotationsRepo } from "./AnnotationsRepo.js";

export class JsonAnnotationsRepo implements AnnotationsRepo {
  constructor(private root: string) {}

  private file() { return join(this.root, "annotations.jsonl"); }

  async append(a: Annotation): Promise<void> {
    await mkdir(dirname(this.file()), { recursive: true });
    await appendFile(this.file(), JSON.stringify(a) + "\n");
  }

  async remove(id: string): Promise<boolean> {
    let raw: string;
    try { raw = await readFile(this.file(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
    const lines = raw.split("\n").filter(l => l.trim());
    const kept: string[] = [];
    let removed = false;
    for (const ln of lines) {
      const a = JSON.parse(ln) as Annotation;
      if (a.id === id) { removed = true; continue; }
      kept.push(ln);
    }
    if (!removed) return false;
    await writeFile(this.file(), kept.join("\n") + (kept.length ? "\n" : ""));
    return true;
  }

  async update(id: string, patch: Partial<Annotation>): Promise<Annotation | null> {
    let raw: string;
    try { raw = await readFile(this.file(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    const lines = raw.split("\n").filter(l => l.trim());
    let updated: Annotation | null = null;
    const kept = lines.map(ln => {
      const a = JSON.parse(ln) as Annotation;
      if (a.id !== id) return ln;
      updated = { ...a, ...patch, id: a.id, elementId: a.elementId };
      return JSON.stringify(updated);
    });
    if (!updated) return null;
    await writeFile(this.file(), kept.join("\n") + "\n");
    return updated;
  }

  async listForElement(elementId: string): Promise<Annotation[]> {
    let raw: string;
    try { raw = await readFile(this.file(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return raw
      .split("\n")
      .filter(l => l.trim())
      .map(l => JSON.parse(l) as Annotation)
      .filter(a => a.elementId === elementId);
  }
}

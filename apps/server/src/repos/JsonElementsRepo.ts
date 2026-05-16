import { readdir, readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { Element, ElementId } from "@ke/domain";
import { ElementSchema } from "@ke/domain";
import type { ElementsRepo, ElementVersion } from "./ElementsRepo.js";

export class JsonElementsRepo implements ElementsRepo {
  constructor(private root: string) {}

  private dir() { return join(this.root, "elements"); }
  private historyDir(id: ElementId) { return join(this.dir(), ".history", id); }

  async list(): Promise<Element[]> {
    const entries = await readdir(this.dir()).catch(() => []);
    const all = await Promise.all(
      entries.filter(f => f.endsWith(".json") && !f.startsWith("."))
        .map(f => readFile(join(this.dir(), f), "utf8").then(s => JSON.parse(s) as Element))
    );
    return all;
  }

  async get(id: ElementId): Promise<Element | null> {
    try {
      const raw = await readFile(join(this.dir(), `${id}.json`), "utf8");
      return JSON.parse(raw) as Element;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async put(el: Element): Promise<void> {
    const result = ElementSchema.safeParse(el);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
      throw new Error(`JsonElementsRepo.put rejected: ${issues}`);
    }
    await mkdir(this.dir(), { recursive: true });
    // Archive prior version if present.
    const prior = await this.get(el.id);
    if (prior) {
      await mkdir(this.historyDir(el.id), { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const histFile = join(this.historyDir(el.id), `${stamp}.json`);
      await writeFile(histFile, JSON.stringify(prior, null, 2));
    }
    // Atomic write: temp file + rename.
    const final = join(this.dir(), `${el.id}.json`);
    const tmp = `${final}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, JSON.stringify(el, null, 2));
    await rename(tmp, final);
  }

  async listVersions(id: ElementId): Promise<ElementVersion[]> {
    let files: string[];
    try { files = await readdir(this.historyDir(id)); }
    catch { return []; }
    const versions = await Promise.all(
      files.filter(f => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await readFile(join(this.historyDir(id), f), "utf8");
          const stamp = f.replace(/\.json$/, "").replace(/-/g, (m, idx, s) => {
            // restore colons in ISO timestamp: positions 13 and 16 are : in original,
            // and 19 is . — but our replacement is non-injective so we keep the file-name
            // form as the timestamp. Caller compares by exact string anyway.
            return m;
          });
          return { timestamp: f.replace(/\.json$/, ""), element: JSON.parse(raw) as Element };
        }),
    );
    return versions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async revertTo(id: ElementId, timestamp: string): Promise<Element> {
    const histFile = join(this.historyDir(id), `${timestamp}.json`);
    let raw: string;
    try { raw = await readFile(histFile, "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`no such version: ${timestamp}`);
      }
      throw err;
    }
    const snapshot = JSON.parse(raw) as Element;
    // put() will archive the current version before overwriting.
    await this.put(snapshot);
    return snapshot;
  }
}

import { readdir, readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { Element, ElementId } from "@ke/domain";
import { ElementSchema } from "@ke/domain";
import type { ElementsRepo } from "./ElementsRepo.js";

export class JsonElementsRepo implements ElementsRepo {
  constructor(private root: string) {}

  private dir() { return join(this.root, "elements"); }

  async list(): Promise<Element[]> {
    const files = await readdir(this.dir()).catch(() => []);
    const all = await Promise.all(
      files.filter(f => f.endsWith(".json"))
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
    // Validate at the persistence boundary so malformed elements never reach disk.
    const result = ElementSchema.safeParse(el);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
      throw new Error(`JsonElementsRepo.put rejected: ${issues}`);
    }
    await mkdir(this.dir(), { recursive: true });
    // Atomic write: temp file + rename, so a crash mid-write never leaves a
    // partial JSON that would break the next list/get.
    const final = join(this.dir(), `${el.id}.json`);
    const tmp = `${final}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, JSON.stringify(el, null, 2));
    await rename(tmp, final);
  }
}

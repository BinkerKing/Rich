import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Element, ElementId } from "@ke/domain";
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
    await mkdir(this.dir(), { recursive: true });
    await writeFile(join(this.dir(), `${el.id}.json`), JSON.stringify(el, null, 2));
  }
}

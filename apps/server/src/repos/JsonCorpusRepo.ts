import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CorpusTemplate } from "../ai/corpus.js";
import { normalizeCorpusTemplates } from "../ai/corpus.js";
import type { CorpusRepo } from "./CorpusRepo.js";

export class JsonCorpusRepo implements CorpusRepo {
  constructor(private root: string) {}

  private file() { return join(this.root, "ai-corpus-templates.json"); }

  async getAll(): Promise<CorpusTemplate[] | null> {
    try {
      return normalizeCorpusTemplates(JSON.parse(await readFile(this.file(), "utf8")));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async putAll(templates: CorpusTemplate[]): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const tmp = `${this.file()}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, JSON.stringify(templates, null, 2));
    await rename(tmp, this.file());
  }
}

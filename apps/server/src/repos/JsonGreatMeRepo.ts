import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { GreatMeRepo } from "./GreatMeRepo.js";

/**
 * JSON-file backed GreatMeRepo for the legacy `KE_STORAGE=json` mode.
 * One blob per app at data/greatme.json.
 */
export class JsonGreatMeRepo implements GreatMeRepo {
  constructor(private root: string) {}

  private file() { return join(this.root, "greatme.json"); }

  async get(): Promise<unknown | null> {
    try {
      const raw = await readFile(this.file(), "utf8");
      return JSON.parse(raw);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async put(value: unknown): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const tmp = `${this.file()}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, this.file());
  }
}

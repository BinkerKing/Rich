import { readFile, writeFile, appendFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { ElementId } from "@ke/domain";
import type { StateRepo, CenterChange } from "./StateRepo.js";

interface CurrentCenterFile {
  elementId: ElementId | null;
  updatedAt: string | null;
}

export class JsonStateRepo implements StateRepo {
  constructor(private root: string) {}

  private dir() { return join(this.root, "state"); }
  private currentFile() { return join(this.dir(), "current.json"); }
  private historyFile() { return join(this.dir(), "center-history.jsonl"); }

  async getCenter(): Promise<CurrentCenterFile> {
    try {
      const raw = await readFile(this.currentFile(), "utf8");
      return JSON.parse(raw) as CurrentCenterFile;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { elementId: null, updatedAt: null };
      }
      throw err;
    }
  }

  async setCenter(elementId: ElementId): Promise<CenterChange> {
    const prior = await this.getCenter();
    const ts = new Date().toISOString();
    const dwellMs = prior.updatedAt
      ? new Date(ts).getTime() - new Date(prior.updatedAt).getTime()
      : null;
    const change: CenterChange = {
      ts,
      from: prior.elementId,
      to: elementId,
      dwellMs,
    };
    await mkdir(this.dir(), { recursive: true });
    // Atomic write of current state.
    const next: CurrentCenterFile = { elementId, updatedAt: ts };
    const tmp = `${this.currentFile()}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, JSON.stringify(next, null, 2));
    await rename(tmp, this.currentFile());
    // Append-only history.
    await appendFile(this.historyFile(), JSON.stringify(change) + "\n");
    return change;
  }

  async recentChanges(limit = 20): Promise<CenterChange[]> {
    let raw: string;
    try { raw = await readFile(this.historyFile(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const all = raw.split("\n").filter(l => l.trim()).map(l => JSON.parse(l) as CenterChange);
    return all.slice(-limit).reverse();
  }
}

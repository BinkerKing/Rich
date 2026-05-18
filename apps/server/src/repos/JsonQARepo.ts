import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { QARecord } from "@ke/domain";
import type { QARepo } from "./QARepo.js";

export class JsonQARepo implements QARepo {
  constructor(private root: string) {}

  private file() { return join(this.root, "qa.jsonl"); }

  async append(qa: QARecord): Promise<void> {
    await mkdir(dirname(this.file()), { recursive: true });
    await appendFile(this.file(), JSON.stringify(qa) + "\n");
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
      const qa = JSON.parse(ln) as QARecord;
      if (qa.id === id) { removed = true; continue; }
      kept.push(ln);
    }
    if (!removed) return false;
    const { writeFile } = await import("node:fs/promises");
    await writeFile(this.file(), kept.join("\n") + (kept.length ? "\n" : ""));
    return true;
  }

  async removeForElements(elementIds: string[]): Promise<void> {
    if (elementIds.length === 0) return;
    let raw: string;
    try { raw = await readFile(this.file(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    const drop = new Set(elementIds);
    const kept = raw.split("\n").filter(l => l.trim()).filter(l => {
      try { return !drop.has((JSON.parse(l) as QARecord).elementId); }
      catch { return true; }
    });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(this.file(), kept.join("\n") + (kept.length ? "\n" : ""));
  }

  async listForElement(elementId: string): Promise<QARecord[]> {
    let raw: string;
    try { raw = await readFile(this.file(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return raw
      .split("\n")
      .filter(l => l.trim())
      .map(l => JSON.parse(l) as QARecord)
      .filter(qa => qa.elementId === elementId);
  }
}

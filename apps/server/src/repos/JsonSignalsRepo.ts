import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Signal } from "@ke/domain";
import type { SignalsRepo, SignalsQuery } from "./SignalsRepo.js";

export class JsonSignalsRepo implements SignalsRepo {
  constructor(private root: string) {}

  private file() { return join(this.root, "signals.jsonl"); }

  async append(s: Signal): Promise<void> {
    await mkdir(dirname(this.file()), { recursive: true });
    await appendFile(this.file(), JSON.stringify(s) + "\n");
  }

  async list(q: SignalsQuery = {}): Promise<Signal[]> {
    let raw: string;
    try { raw = await readFile(this.file(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    let all = raw.split("\n").filter(l => l.trim()).map(l => JSON.parse(l) as Signal);
    if (q.manual) all = all.filter(s => s.manual === q.manual);
    if (q.type) all = all.filter(s => s.type === q.type);
    if (q.elementId) all = all.filter(s => s.elementId === q.elementId);
    if (q.since) all = all.filter(s => s.ts >= q.since!);
    if (q.limit) all = all.slice(-q.limit);
    return all;
  }

  async count(): Promise<number> {
    return (await this.list()).length;
  }
}

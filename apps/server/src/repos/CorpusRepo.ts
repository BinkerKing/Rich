import type { CorpusTemplate } from "../ai/corpus.js";

export interface CorpusRepo {
  getAll(): Promise<CorpusTemplate[] | null>;
  putAll(templates: CorpusTemplate[]): Promise<void>;
}

import type { Element, Relation, LearningPath } from "@ke/domain";

export interface GenerateTreeResponse {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

const base = "/api";

export const api = {
  async generateTree(topic: string): Promise<GenerateTreeResponse> {
    const r = await fetch(`${base}/ai/generate-tree`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!r.ok) throw new Error(`generate-tree failed: ${r.status}`);
    return r.json();
  },
  async getElement(id: string): Promise<Element | null> {
    const r = await fetch(`${base}/elements/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`getElement failed: ${r.status}`);
    return r.json();
  },
};

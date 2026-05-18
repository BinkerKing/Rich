import type { Element, Relation } from "@ke/domain";
import type { CandidateElement } from "../ai/prompts/analyzeAttachment.js";

/**
 * Score-based search across the element store. AI-extracted keywords are
 * matched (substring) against each element's title / subtitle / tags /
 * aliases. Longer matches contribute more score; titles outweigh tags.
 *
 * Returns the top-N candidates with their parent chain attached, so the
 * downstream AI hierarchy analyzer can reason about where to attach.
 */
export function shortlistByKeywords(
  keywords: string[],
  elements: Element[],
  relations: Relation[],
  limit = 12,
): CandidateElement[] {
  const cleanKeywords = keywords
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length >= 1);
  if (cleanKeywords.length === 0) return [];

  type Scored = { el: Element; score: number };
  const scored: Scored[] = [];

  for (const el of elements) {
    const titleLow = (el.title ?? "").toLowerCase();
    const subtitleLow = (el.subtitle ?? "").toLowerCase();
    const tagsLow = (el.tags ?? []).map(t => t.toLowerCase());
    const aliasesLow = (el.aliases ?? []).map(a => a.toLowerCase());

    let score = 0;
    for (const k of cleanKeywords) {
      // Title matches are strongest, weighted by keyword length × 3.
      if (titleLow.includes(k)) score += k.length * 3;
      if (subtitleLow.includes(k)) score += k.length * 1.5;
      for (const t of tagsLow) if (t.includes(k) || k.includes(t)) score += k.length * 2;
      for (const a of aliasesLow) if (a.includes(k) || k.includes(a)) score += k.length * 2;
    }
    if (score > 0) scored.push({ el, score });
  }

  // Slight boost for shallower elements (topic > concept > deeper) so that
  // a same-score "category" tends to win over a same-score deep leaf.
  const depths = computeDepths(elements, relations);
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = depths.get(a.el.id) ?? 99;
    const db = depths.get(b.el.id) ?? 99;
    return da - db;
  });

  const top = scored.slice(0, limit);
  return top.map(({ el }) => ({
    id: el.id,
    title: el.title,
    type: el.type,
    subtitle: el.subtitle,
    parentPath: parentTitles(el.id, elements, relations),
    tags: el.tags,
  }));
}

/** For each element, depth from its topic root (root=0, immediate child=1, …). */
function computeDepths(elements: Element[], relations: Relation[]): Map<string, number> {
  const parentOf = new Map<string, string>();
  for (const r of relations) if (r.kind === "child") parentOf.set(r.to, r.from);
  const out = new Map<string, number>();
  for (const el of elements) {
    let depth = 0;
    let cur: string | undefined = el.id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const p = parentOf.get(cur);
      if (!p) break;
      depth += 1;
      cur = p;
    }
    out.set(el.id, depth);
  }
  return out;
}

function parentTitles(id: string, elements: Element[], relations: Relation[]): string[] {
  const byId = new Map(elements.map(e => [e.id, e] as const));
  const parentOf = new Map<string, string>();
  for (const r of relations) if (r.kind === "child") parentOf.set(r.to, r.from);
  const chain: string[] = [];
  let cur = parentOf.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const el = byId.get(cur);
    if (el) chain.unshift(el.title);
    cur = parentOf.get(cur);
  }
  return chain;
}

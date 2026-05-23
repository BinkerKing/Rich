/**
 * Convert a legacy concept-style element content (oneSentence / coreExplain /
 * whyMatters / mechanisms / examples / misconceptions / keyPoints /
 * learningGoals / nextSteps / beginnerExplain) into the new `sections[]`
 * shape — WITHOUT calling an AI.
 *
 * The frontend ConceptBody synthesizes virtual sections with these exact ids:
 *   what / how / why / diagrams / mechanism / examples / warning / focus / next
 * Section-feedback addresses sections by id, so we mirror those ids here.
 *
 * Idempotent + non-destructive:
 *   - If the element already has any `sections[]` entries, we MERGE — we
 *     only append sections whose ids don't already exist.
 *   - We don't touch the legacy fields. The frontend prefers sections when
 *     present, but the legacy fields stay around as a safety net (and to
 *     keep history/diff clean).
 */
export function migrateLegacyContentToSections(content: unknown): unknown {
  if (!content || typeof content !== "object") return content;
  const c = content as Record<string, unknown>;

  const existingSections: Array<Record<string, unknown>> = Array.isArray(c.sections)
    ? (c.sections as Array<Record<string, unknown>>)
    : [];
  const existingIds = new Set(existingSections
    .map(s => (s && typeof s === "object" ? (s.id as string | undefined) : undefined))
    .filter((x): x is string => Boolean(x)));

  const built: Array<{ id: string; title: string; blocks: Array<Record<string, unknown>> }> = [];

  // "what" — 一句话 + 小白理解版
  {
    const oneSentence = asText(c.oneSentence);
    const beginner = asText(c.beginnerExplain);
    if ((oneSentence || beginner) && !existingIds.has("what")) {
      const blocks: Array<Record<string, unknown>> = [];
      if (oneSentence) blocks.push({ style: "lead", text: oneSentence });
      if (beginner) blocks.push({ style: "callout", kind: "tip", title: "小白理解版", body: beginner });
      if (blocks.length > 0) built.push({ id: "what", title: "是什么", blocks });
    }
  }
  // "how" — 核心解释
  {
    const coreExplain = asText(c.coreExplain);
    if (coreExplain && !existingIds.has("how")) {
      built.push({ id: "how", title: "核心解释", blocks: [{ style: "prose", text: coreExplain }] });
    }
  }
  // "why" — 为什么重要
  {
    const whyMatters = asText(c.whyMatters);
    if (whyMatters && !existingIds.has("why")) {
      built.push({
        id: "why", title: "为什么重要",
        blocks: [{ style: "callout", kind: "insight", title: "关键洞察", body: whyMatters }],
      });
    }
  }
  // "mechanism" — 关键机制
  {
    const mechanisms = asObjectList(c.mechanisms);
    if (mechanisms.length > 0 && !existingIds.has("mechanism")) {
      built.push({
        id: "mechanism", title: "关键机制",
        blocks: [{ style: "mechanism-flow", steps: mechanisms }],
      });
    }
  }
  // "examples" — 典型例子
  {
    const examples = asTextList(c.examples);
    if (examples.length > 0 && !existingIds.has("examples")) {
      built.push({
        id: "examples", title: "典型例子",
        blocks: [{ style: "example-list", items: examples }],
      });
    }
  }
  // "warning" — 易混点 / 误解
  {
    const misconceptions = asTextList(c.misconceptions);
    if (misconceptions.length > 0 && !existingIds.has("warning")) {
      built.push({
        id: "warning", title: "易混点",
        blocks: [{ style: "warn-cards", items: misconceptions }],
      });
    }
  }
  // "focus" — 学习重点 (合并 learningGoals + keyPoints)
  {
    const goals = asTextList(c.learningGoals);
    const keyPoints = asTextList(c.keyPoints);
    const items = [...goals, ...keyPoints].slice(0, 6);
    if (items.length > 0 && !existingIds.has("focus")) {
      built.push({
        id: "focus", title: "学习重点",
        blocks: [{ style: "dot-list", items }],
      });
    }
  }
  // "next" — 下一步
  {
    const nextSteps = asTextList(c.nextSteps);
    if (nextSteps.length > 0 && !existingIds.has("next")) {
      built.push({
        id: "next", title: "下一步",
        blocks: [{ style: "dot-list", items: nextSteps }],
      });
    }
  }

  if (built.length === 0) return content; // nothing to migrate

  return {
    ...c,
    sections: [...existingSections, ...built],
  };
}

// ----- tiny helpers (mirrors of ElementContentPanel) --------------------

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asTextList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return out;
}
function asObjectList(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of v) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      out.push(item as Record<string, unknown>);
    }
  }
  return out;
}

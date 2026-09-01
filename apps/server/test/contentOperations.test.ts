import { describe, expect, it } from "vitest";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";
import { generateDailyNews } from "../src/ai/content/operations.js";

describe("content generateDailyNews", () => {
  it("returns a validated content-domain news roundup", async () => {
    class NewsAdapter implements AIAdapter {
      readonly name = "claude-code" as const;
      async available() { return true; }
      async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
        yield {
          type: "done",
          fullText: JSON.stringify({
            date: "2026-09-01",
            editorNote: "今天聚焦能真正改变工作方式的 AI 能力与工具。",
            items: ["A", "B", "C"].map((title) => ({
              title: `新闻${title}`,
              subtitle: "面向实际使用的能力更新",
              category: "应用产品",
              impact: "medium",
              sections: [{ id: "summary", title: "摘要", blocks: [{ style: "paragraph", text: "内容" }] }],
            })),
          }),
        };
      }
    }

    const events: unknown[] = [];
    for await (const event of generateDailyNews(new NewsAdapter(), { date: "2026-09-01" })) events.push(event);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "done",
      result: { date: "2026-09-01" },
    });
    expect((events[0] as { result: { items: unknown[] } }).result.items).toHaveLength(3);
  });
});

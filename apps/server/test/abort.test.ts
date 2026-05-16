import { describe, it, expect } from "vitest";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";
import { runStructuredAI } from "../src/ai/runStructuredAI.js";

/**
 * Verifies that:
 * 1. The signal is propagated from runStructuredAI → adapter.stream.
 * 2. When the signal aborts mid-stream, the adapter receives the abort
 *    and we stop emitting events.
 */
class SlowAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  public seenSignal: AbortSignal | undefined;
  async available() { return true; }
  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    this.seenSignal = args.signal;
    for (let i = 0; i < 100; i++) {
      if (args.signal?.aborted) {
        yield { type: "error", message: "aborted" };
        return;
      }
      yield { type: "delta", text: `tick${i}` };
      await new Promise(r => setTimeout(r, 5));
    }
    yield { type: "done", fullText: "{}" };
  }
}

describe("AbortController plumbing", () => {
  it("propagates signal to adapter.stream", async () => {
    const adapter = new SlowAdapter();
    const ac = new AbortController();
    const it = runStructuredAI(adapter, {
      prompt: "x",
      signal: ac.signal,
      validate: () => ({}),
    });
    // Read one event so the adapter actually starts.
    const result = await it[Symbol.asyncIterator]().next();
    expect(result.value?.type).toBe("delta");
    expect(adapter.seenSignal).toBe(ac.signal);
    ac.abort();
  });

  it("aborted signal stops the stream with error event", async () => {
    const adapter = new SlowAdapter();
    const ac = new AbortController();
    const events: string[] = [];
    const it = runStructuredAI(adapter, {
      prompt: "x",
      signal: ac.signal,
      validate: () => ({}),
    });
    let deltaCount = 0;
    for await (const ev of it) {
      events.push(ev.type);
      if (ev.type === "delta") {
        deltaCount++;
        if (deltaCount === 3) ac.abort();
      }
      if (ev.type === "error" || ev.type === "done") break;
    }
    expect(events).toContain("error");
    expect(events).not.toContain("done");
    expect(deltaCount).toBeLessThan(100);
  });
});

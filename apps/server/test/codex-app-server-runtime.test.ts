import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { CodexAppServerRuntime, type CodexAppServerProcess } from "../src/agent-conversations/CodexAppServerRuntime.js";

class FakeProcess implements CodexAppServerProcess {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  kill() { this.killed = true; return true; }
}

function messages(process: FakeProcess): Promise<Array<{ id?: number; method: string; params?: Record<string, unknown> }>> {
  return new Promise(resolve => {
    let buffer = "";
    const seen: Array<{ id?: number; method: string; params?: Record<string, unknown> }> = [];
    process.stdin.on("data", chunk => {
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line) {
          const message = JSON.parse(line) as { id?: number; method: string; params?: Record<string, unknown> };
          seen.push(message);
          if (message.method === "initialize") process.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
          if (message.method === "thread/resume") process.stdout.write(`${JSON.stringify({ id: message.id, result: { thread: { id: "thread-old" } } })}\n`);
          if (message.method === "thread/start") process.stdout.write(`${JSON.stringify({ id: message.id, result: { thread: { id: "thread-new" } } })}\n`);
          if (message.method === "turn/start") {
            const threadId = message.params?.threadId;
            process.stdout.write(`${JSON.stringify({ id: message.id, result: { turn: { id: "turn-1" } } })}\n`);
            process.stdout.write(`${JSON.stringify({ method: "item/agentMessage/delta", params: { threadId, turnId: "turn-1", itemId: "item-1", delta: "hello " } })}\n`);
            process.stdout.write(`${JSON.stringify({ method: "item/agentMessage/delta", params: { threadId, turnId: "turn-1", itemId: "item-1", delta: "world" } })}\n`);
            process.stdout.write(`${JSON.stringify({ method: "turn/completed", params: { threadId, turn: { id: "turn-1", status: "completed" } } })}\n`);
            resolve(seen);
          }
        }
        newline = buffer.indexOf("\n");
      }
    });
  });

}

describe("CodexAppServerRuntime", () => {
  it("initializes once, resumes a thread, and streams agent message deltas", async () => {
    const process = new FakeProcess();
    const sent = messages(process);
    const runtime = new CodexAppServerRuntime({ spawn: () => process });

    const events = [];
    for await (const event of runtime.startTurn({
      conversationId: "conversation-1", turnId: "rich-turn-1", sessionId: "thread-old",
      messages: [{ role: "user", content: "continue" }], capabilityToken: "capability",
    })) events.push(event);

    const calls = await sent;
    expect(calls.map(call => call.method)).toEqual(["initialize", "initialized", "thread/resume", "turn/start"]);
    expect(calls.find(call => call.method === "turn/start")?.params).toMatchObject({ threadId: "thread-old" });
    expect(events).toEqual([
      { type: "delta", text: "hello " },
      { type: "delta", text: "world" },
      { type: "done", fullText: "hello world", sessionId: "thread-old" },
    ]);
  });

  it("starts a new Codex thread when the Rich conversation has no saved thread id", async () => {
    const process = new FakeProcess();
    const sent = messages(process);
    const runtime = new CodexAppServerRuntime({ spawn: () => process });

    const events = [];
    for await (const event of runtime.startTurn({
      conversationId: "conversation-2", turnId: "rich-turn-2",
      messages: [{ role: "user", content: "start" }], capabilityToken: "capability",
    })) events.push(event);

    const calls = await sent;
    expect(calls.map(call => call.method)).toEqual(["initialize", "initialized", "thread/start", "turn/start"]);
    expect(calls.find(call => call.method === "turn/start")?.params).toMatchObject({ threadId: "thread-new" });
    expect(events.at(-1)).toEqual({ type: "done", fullText: "hello world", sessionId: "thread-new" });
  });

  it("interrupts the active Codex turn", async () => {
    const process = new FakeProcess();
    const runtime = new CodexAppServerRuntime({ spawn: () => process });
    const received: Array<{ method: string; params?: Record<string, unknown> }> = [];
    process.stdin.on("data", chunk => {
      for (const line of chunk.toString("utf8").trim().split("\n")) {
        if (!line) continue;
        const message = JSON.parse(line) as { id?: number; method: string; params?: Record<string, unknown> };
        received.push(message);
        if (message.method === "initialize") process.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
        if (message.method === "turn/interrupt") process.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      }
    });

    await runtime.interrupt("thread-1", "turn-1");

    expect(received.map(message => message.method)).toEqual(["initialize", "initialized", "turn/interrupt"]);
    expect(received.at(-1)?.params).toEqual({ threadId: "thread-1", turnId: "turn-1" });
  });
});

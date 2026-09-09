import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { CodexAppServerRuntime, codexAppServerArgs, type CodexAppServerProcess } from "../src/agent-conversations/CodexAppServerRuntime.js";

class FakeProcess extends EventEmitter implements CodexAppServerProcess {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  kill() { this.killed = true; return true; }
}

function messages(process: FakeProcess, options: { generatedImage?: boolean; activity?: boolean } = {}): Promise<Array<{ id?: number; method: string; params?: Record<string, unknown> }>> {
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
            if (options.activity) for (const method of ["item/started", "item/completed"]) process.stdout.write(`${JSON.stringify({ method, params: { threadId, turnId: "turn-1", item: { id: "cmd-1", type: "commandExecution" } } })}\n`);
            if (options.generatedImage) process.stdout.write(`${JSON.stringify({ method: "item/completed", params: { threadId, turnId: "turn-1", completedAtMs: 1, item: { id: "image-1", type: "imageGeneration", status: "completed", result: "generated", savedPath: "/tmp/generated-preview.png" } } })}\n`);
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
  it("streams actual command activity without mixing it into assistant output", async () => {
    const process = new FakeProcess(); const sent = messages(process, { activity: true });
    const runtime = new CodexAppServerRuntime({ spawn: () => process });
    const events = [];
    for await (const event of runtime.startTurn({ conversationId: "c1", turnId: "t1", messages: [{ role: "user", content: "test" }], capabilityToken: "test" })) events.push(event);
    await sent;
    expect(events.filter(event => event.type === "activity")).toEqual([{ type: "activity", text: "开始：执行命令" }, { type: "activity", text: "结束：执行命令" }]);
    expect(events.find(event => event.type === "done")).toMatchObject({ fullText: "hello world" });
  });
  it("marks Rich MCP tools as directly approved", () => {
    expect(codexAppServerArgs("http://127.0.0.1:31515/mcp")).toEqual([
      "app-server",
      "-c", 'mcp_servers.rich.url="http://127.0.0.1:31515/mcp"',
      "-c", 'mcp_servers.rich.default_tools_approval_mode="auto"',
      "--listen", "stdio://",
    ]);
  });

  it("reports an app-server startup exit and allows a later reconnect", async () => {
    let attempt = 0;
    const runtime = new CodexAppServerRuntime({ spawn: () => {
      const process = new FakeProcess();
      attempt += 1;
      process.stdin.on("data", chunk => {
        const request = JSON.parse(chunk.toString("utf8")) as { id?: number; method?: string };
        if (request.method !== "initialize") return;
        if (attempt === 1) {
          process.stderr.write("invalid startup config");
          process.emit("exit", 1, null);
        } else process.stdout.write(`${JSON.stringify({ id: request.id, result: {} })}\n`);
      });
      return process;
    } });

    await expect(Promise.race([
      runtime.checkConnection(),
      new Promise(resolve => setTimeout(() => resolve("timed out"), 25)),
    ])).resolves.toEqual({ server: false, session: false });
    await expect(runtime.checkConnection()).resolves.toEqual({ server: true, session: false });
  });

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

  it("uses maximum execution permissions even when no project folder is set", async () => {
    const process = new FakeProcess();
    const sent = messages(process);
    const runtime = new CodexAppServerRuntime({ spawn: () => process });

    for await (const _event of runtime.startTurn({
      conversationId: "conversation-no-root", turnId: "rich-turn-no-root",
      messages: [{ role: "user", content: "inspect" }], capabilityToken: "capability",
    })) { /* consume */ }

    const calls = await sent;
    expect(calls.find(call => call.method === "thread/start")?.params).toMatchObject({ sandbox: "danger-full-access", approvalPolicy: "never" });
    expect(calls.find(call => call.method === "turn/start")?.params).toMatchObject({ sandboxPolicy: { type: "dangerFullAccess", networkAccess: true }, approvalPolicy: "never" });
  });

  it("streams a generated image file when Codex completes an image-generation item", async () => {
    const process = new FakeProcess();
    const sent = messages(process, { generatedImage: true });
    const runtime = new CodexAppServerRuntime({ spawn: () => process });

    const events = [];
    for await (const event of runtime.startTurn({
      conversationId: "conversation-image", turnId: "rich-turn-image",
      messages: [{ role: "user", content: "generate a preview" }], capabilityToken: "capability",
    })) events.push(event);

    await sent;
    expect(events).toContainEqual({ type: "image", path: "/tmp/generated-preview.png" });
  });

  it("uses the configured project root in a full-access Codex thread", async () => {
    const process = new FakeProcess();
    const sent = messages(process);
    const runtime = new CodexAppServerRuntime({ spawn: () => process });

    for await (const _event of runtime.startTurn({
      conversationId: "conversation-3", turnId: "rich-turn-3", workspaceRoot: "/project/root",
      messages: [{ role: "user", content: "inspect" }], capabilityToken: "capability",
    })) { /* consume */ }

    const calls = await sent;
    expect(calls.find(call => call.method === "thread/start")?.params).toEqual({ cwd: "/project/root", sandbox: "danger-full-access", approvalPolicy: "never" });
    expect(calls.find(call => call.method === "turn/start")?.params).toMatchObject({ cwd: "/project/root", sandboxPolicy: { type: "dangerFullAccess", networkAccess: true }, approvalPolicy: "never" });
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

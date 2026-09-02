import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { resolveCodexBin } from "../ai/codex.js";
import type { AgentRuntimeCapabilities } from "./types.js";
import type { AgentRuntimeEvent, AgentRuntimePort, AgentRuntimeToolResult, AgentRuntimeTurnInput } from "./AgentRuntimePort.js";

export interface CodexAppServerProcess {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  kill(signal?: NodeJS.Signals): boolean;
}

export interface CodexAppServerRuntimeOptions {
  spawn?: () => CodexAppServerProcess;
}

type RpcMessage = { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message?: string } };

class EventQueue<T> {
  private readonly values: T[] = [];
  private resolver?: (value: IteratorResult<T>) => void;
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = undefined;
      resolve({ value, done: false });
      return;
    }
    this.values.push(value);
  }

  close(): void {
    this.closed = true;
    this.resolver?.({ value: undefined as never, done: true });
    this.resolver = undefined;
  }

  async next(): Promise<IteratorResult<T>> {
    const value = this.values.shift();
    if (value !== undefined) return { value, done: false };
    if (this.closed) return { value: undefined as never, done: true };
    return new Promise(resolve => { this.resolver = resolve; });
  }
}

interface ActiveTurn {
  threadId: string;
  queue: EventQueue<AgentRuntimeEvent>;
  fullText: string;
  serverTurnId?: string;
}

const capabilities: AgentRuntimeCapabilities = {
  profiles: ["chat_only"],
  enforcesToolSelection: false,
  enforcesWorkspaceRoot: false,
  supportsResumableToolCalls: false,
};

export class CodexAppServerRuntime implements AgentRuntimePort {
  private process?: CodexAppServerProcess;
  private ready?: Promise<void>;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void }>();
  private readonly active = new Map<string, ActiveTurn>();

  constructor(private readonly options: CodexAppServerRuntimeOptions = {}) {}

  agentRuntimeCapabilities(): AgentRuntimeCapabilities { return capabilities; }

  async checkConnection(sessionId?: string): Promise<{ server: boolean; session: boolean }> {
    try {
      await this.ensureReady();
    } catch {
      return { server: false, session: false };
    }
    if (!sessionId) return { server: true, session: false };
    try {
      await this.request("thread/resume", { threadId: sessionId });
      return { server: true, session: true };
    } catch {
      return { server: true, session: false };
    }
  }

  async *startTurn(input: AgentRuntimeTurnInput): AsyncGenerator<AgentRuntimeEvent, void, AgentRuntimeToolResult | undefined> {
    await this.ensureReady();
    const threadId = await this.ensureThread(input.sessionId);
    const active: ActiveTurn = { threadId, queue: new EventQueue<AgentRuntimeEvent>(), fullText: "" };
    this.active.set(input.turnId, active);
    try {
      const result = await this.request("turn/start", {
        threadId,
        input: input.messages.map(message => ({ type: "text", text: `${message.role}: ${message.content}` })),
      });
      const turn = result.turn as { id?: unknown } | undefined;
      if (turn && typeof turn.id === "string") {
        active.serverTurnId = turn.id;
        this.active.set(turn.id, active);
      }
      while (true) {
        const next = await active.queue.next();
        if (next.done) return;
        yield next.value;
        if (next.value.type === "done" || next.value.type === "error") return;
      }
    } finally {
      this.active.delete(input.turnId);
      if (active.serverTurnId) this.active.delete(active.serverTurnId);
    }
  }

  async interrupt(threadId: string, turnId: string): Promise<void> {
    await this.ensureReady();
    await this.request("turn/interrupt", { threadId, turnId });
  }

  private async ensureThread(sessionId: string | undefined): Promise<string> {
    if (sessionId) {
      await this.request("thread/resume", { threadId: sessionId });
      return sessionId;
    }
    const result = await this.request("thread/start", {});
    const thread = result.thread as { id?: unknown } | undefined;
    if (!thread || typeof thread.id !== "string") throw new Error("Codex app-server did not return a thread id");
    return thread.id;
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.start();
    return this.ready;
  }

  private async start(): Promise<void> {
    this.process = this.options.spawn ? this.options.spawn() : await this.spawnLocal();
    this.process.stdout.setEncoding("utf8");
    let buffer = "";
    this.process.stdout.on("data", chunk => {
      buffer += String(chunk);
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) this.receive(line);
        newline = buffer.indexOf("\n");
      }
    });
    await this.request("initialize", { clientInfo: { name: "rich", title: "Rich", version: "0.1.0" } });
    this.notify("initialized", {});
  }

  private async spawnLocal(): Promise<ChildProcessWithoutNullStreams> {
    const binary = await resolveCodexBin();
    if (!binary) throw new Error("Codex CLI not found (set KE_CODEX_BIN or install codex on PATH)");
    return spawn(binary, ["app-server", "--listen", "stdio://"], { stdio: ["pipe", "pipe", "pipe"] });
  }

  private request(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const response = new Promise<Record<string, unknown>>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.write({ id, method, params });
    return response;
  }

  private notify(method: string, params: Record<string, unknown>): void { this.write({ method, params }); }

  private write(message: RpcMessage): void {
    if (!this.process) throw new Error("Codex app-server is not started");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private receive(line: string): void {
    let message: RpcMessage;
    try { message = JSON.parse(line) as RpcMessage; } catch { return; }
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "Codex app-server request failed"));
      else pending.resolve(message.result ?? {});
      return;
    }
    if (!message.method) return;
    const active = this.activeFor(message.params);
    if (!active) return;
    if (message.method === "item/agentMessage/delta") {
      const text = typeof message.params?.delta === "string" ? message.params.delta : "";
      if (!text) return;
      active.fullText += text;
      active.queue.push({ type: "delta", text });
      return;
    }
    if (message.method === "turn/completed") {
      active.queue.push({ type: "done", fullText: active.fullText, sessionId: active.threadId });
      active.queue.close();
    }
  }

  private activeFor(params: Record<string, unknown> | undefined): ActiveTurn | undefined {
    const nestedTurn = params?.turn as { id?: unknown } | undefined;
    const turnId = typeof params?.turnId === "string"
      ? params.turnId
      : typeof nestedTurn?.id === "string" ? nestedTurn.id : undefined;
    if (turnId) {
      const active = this.active.get(turnId);
      if (active) return active;
    }
    const threadId = typeof params?.threadId === "string" ? params.threadId : undefined;
    if (threadId) {
      const matches = [...new Set(this.active.values())].filter(active => active.threadId === threadId);
      return matches.length === 1 ? matches[0] : undefined;
    }
    return this.active.size === 1 ? this.active.values().next().value : undefined;
  }
}

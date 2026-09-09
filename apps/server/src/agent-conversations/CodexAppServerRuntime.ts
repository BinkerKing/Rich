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
  on?(event: "error", listener: (error: Error) => void): unknown;
  on?(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
}

export interface CodexAppServerRuntimeOptions {
  spawn?: () => CodexAppServerProcess;
  /** Streamable HTTP endpoint exposed by this Rich server for Codex task tools. */
  richMcpUrl?: string;
  requestTimeoutMs?: number;
}

type RpcMessage = { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message?: string } };
type PendingRequest = { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void; timeout: NodeJS.Timeout };

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

export function codexAppServerArgs(richMcpUrl: string): string[] {
  return [
    "app-server",
    "-c", `mcp_servers.rich.url=${JSON.stringify(richMcpUrl)}`,
    "-c", 'mcp_servers.rich.default_tools_approval_mode="auto"',
    "--listen", "stdio://",
  ];
}

export class CodexAppServerRuntime implements AgentRuntimePort {
  private process?: CodexAppServerProcess;
  private ready?: Promise<void>;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
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
    const threadId = await this.ensureThread(input.sessionId, input.workspaceRoot);
    const active: ActiveTurn = { threadId, queue: new EventQueue<AgentRuntimeEvent>(), fullText: "" };
    this.active.set(input.turnId, active);
    try {
      const result = await this.request("turn/start", {
        threadId,
        ...(input.workspaceRoot ? { cwd: input.workspaceRoot } : {}),
        sandboxPolicy: { type: "dangerFullAccess", networkAccess: true },
        approvalPolicy: "never",
        input: input.messages.flatMap(message => [
          { type: "text", text: `${message.role}: ${message.content}` },
          ...(message.imageUrls ?? []).map(url => ({ type: "image", url })),
        ]),
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
    const active = this.active.get(turnId);
    await this.request("turn/interrupt", { threadId: active?.threadId ?? threadId, turnId: active?.serverTurnId ?? turnId });
  }

  private async ensureThread(sessionId: string | undefined, workspaceRoot?: string): Promise<string> {
    if (sessionId) {
      await this.request("thread/resume", { threadId: sessionId });
      return sessionId;
    }
    const result = await this.request("thread/start", {
      ...(workspaceRoot ? { cwd: workspaceRoot } : {}),
      sandbox: "danger-full-access",
      approvalPolicy: "never",
    });
    const thread = result.thread as { id?: unknown } | undefined;
    if (!thread || typeof thread.id !== "string") throw new Error("Codex app-server did not return a thread id");
    return thread.id;
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) {
      const ready = this.start().catch(error => {
        if (this.ready === ready) this.ready = undefined;
        throw error;
      });
      this.ready = ready;
    }
    return this.ready;
  }

  private async start(): Promise<void> {
    const process = this.options.spawn ? this.options.spawn() : await this.spawnLocal();
    this.process = process;
    let stderr = "";
    process.stderr.setEncoding("utf8");
    process.stderr.on("data", chunk => { stderr = `${stderr}${String(chunk)}`.slice(-2_000); });
    process.on?.("error", error => this.failProcess(process, `failed: ${error.message}`, stderr));
    process.on?.("exit", (code, signal) => this.failProcess(process, `exited (${signal ?? `code ${code ?? "unknown"}`})`, stderr));
    process.stdout.setEncoding("utf8");
    let buffer = "";
    process.stdout.on("data", chunk => {
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
    const richMcpUrl = this.options.richMcpUrl ?? `http://127.0.0.1:${Number(process.env.PORT ?? 3001)}/mcp`;
    return spawn(binary, codexAppServerArgs(richMcpUrl), { stdio: ["pipe", "pipe", "pipe"] });
  }

  private request(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const process = this.process;
    if (!process) return Promise.reject(new Error("Codex app-server is not running"));
    const response = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => this.failProcess(process, `did not respond to ${method} within ${this.options.requestTimeoutMs ?? 15_000}ms`, "", true), this.options.requestTimeoutMs ?? 15_000);
      this.pending.set(id, { resolve, reject, timeout });
    });
    try { this.write({ id, method, params }); }
    catch (error) { this.failProcess(process, error instanceof Error ? error.message : String(error), "", true); }
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
      clearTimeout(pending.timeout);
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
    if (message.method === "item/started" || message.method === "item/completed") {
      const item = message.params?.item as { type?: string; tool?: string; server?: string } | undefined;
      const names: Record<string, string> = { commandExecution: "执行命令", fileChange: "修改文件", mcpToolCall: "调用工具", webSearch: "检索资料" };
      if (item?.type && names[item.type]) active.queue.push({ type: "activity", text: `${message.method === "item/started" ? "开始" : "结束"}：${names[item.type]}${item.type === "mcpToolCall" && item.tool ? ` · ${item.tool}` : ""}` });
    }
    if (message.method === "item/completed") {
      const item = message.params?.item as { type?: unknown; savedPath?: unknown } | undefined;
      if (item?.type === "imageGeneration" && typeof item.savedPath === "string" && item.savedPath) {
        active.queue.push({ type: "image", path: item.savedPath });
      }
      return;
    }
    if (message.method === "turn/completed") {
      active.queue.push({ type: "done", fullText: active.fullText, sessionId: active.threadId });
      active.queue.close();
    }
  }

  private failProcess(process: CodexAppServerProcess, reason: string, stderr: string, terminate = false): void {
    if (this.process !== process) return;
    this.process = undefined;
    const suffix = stderr.trim() ? `: ${stderr.trim()}` : "";
    const error = new Error(`Codex app-server ${reason}${suffix}`);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    for (const active of new Set(this.active.values())) {
      active.queue.push({ type: "error", message: error.message, code: "runtime_error" });
      active.queue.close();
    }
    this.active.clear();
    if (terminate) {
      try { process.kill("SIGTERM"); } catch { /* process already ended */ }
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

export type AIAdapterName =
  | "claude-code"
  | "codex"
  | "hermes"
  | "bailian";

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string; sessionId?: string }
  | { type: "error"; message: string };

export interface GenerateArgs {
  prompt: string;
  systemPrompt?: string;
  sessionId?: string;
  scenario?: string;
  signal?: AbortSignal;
}

export interface AIAdapter {
  readonly name: AIAdapterName;
  available(): Promise<boolean>;
  stream(args: GenerateArgs): AsyncIterable<StreamEvent>;
}

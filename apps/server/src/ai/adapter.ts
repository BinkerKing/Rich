export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string; sessionId?: string }
  | { type: "error"; message: string };

export interface GenerateArgs {
  prompt: string;
  systemPrompt?: string;
  sessionId?: string;
  signal?: AbortSignal;
}

export interface AIAdapter {
  readonly name: "claude-code" | "codex" | "hermes";
  available(): Promise<boolean>;
  stream(args: GenerateArgs): AsyncIterable<StreamEvent>;
}

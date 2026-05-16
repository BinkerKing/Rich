export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string; sessionId?: string }
  | { type: "error"; message: string };

export interface GenerateArgs {
  prompt: string;
  sessionId?: string;
  signal?: AbortSignal;
}

export interface AIAdapter {
  readonly name: "claude-code" | "codex";
  available(): Promise<boolean>;
  stream(args: GenerateArgs): AsyncIterable<StreamEvent>;
}

/**
 * Minimal JSON-line structured logger. Writes one JSON object per line to
 * stdout (or a sink injected for tests).
 *
 * Why not pino/winston: this whole file is 30 lines, has zero deps, and the
 * use case is local dev observability. If we ever ship as a hosted service
 * we'll swap this for pino and the call sites won't change.
 */
export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [k: string]: unknown;
}

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bound: Record<string, unknown>): Logger;
}

export type LogSink = (entry: LogEntry) => void;

const stdoutSink: LogSink = (e) => process.stdout.write(JSON.stringify(e) + "\n");

export function createLogger(opts: {
  sink?: LogSink;
  bound?: Record<string, unknown>;
} = {}): Logger {
  const sink = opts.sink ?? stdoutSink;
  const bound = opts.bound ?? {};
  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    sink({ ts: new Date().toISOString(), level, msg, ...bound, ...fields });
  };
  return {
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (more) => createLogger({ sink, bound: { ...bound, ...more } }),
  };
}

/** A logger that discards everything — handy for tests / mocked code paths. */
export const noopLogger: Logger = createLogger({ sink: () => {} });

import { describe, it, expect } from "vitest";
import { createLogger, type LogEntry } from "../src/lib/logger.js";

describe("logger", () => {
  it("writes a JSON entry with timestamp, level, msg, and fields", () => {
    const entries: LogEntry[] = [];
    const log = createLogger({ sink: (e) => entries.push(e) });
    log.info("hello", { reqId: "abc", op: "refine" });
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.level).toBe("info");
    expect(e.msg).toBe("hello");
    expect(e.reqId).toBe("abc");
    expect(e.op).toBe("refine");
    expect(typeof e.ts).toBe("string");
  });

  it("emits at warn and error levels", () => {
    const entries: LogEntry[] = [];
    const log = createLogger({ sink: (e) => entries.push(e) });
    log.warn("careful");
    log.error("bad", { code: 500 });
    expect(entries.map(e => e.level)).toEqual(["warn", "error"]);
    expect(entries[1].code).toBe(500);
  });

  it("child loggers inherit bound fields", () => {
    const entries: LogEntry[] = [];
    const root = createLogger({ sink: (e) => entries.push(e), bound: { app: "ke" } });
    const reqLog = root.child({ reqId: "r1" });
    reqLog.info("a");
    reqLog.info("b", { op: "expand" });
    expect(entries[0].app).toBe("ke");
    expect(entries[0].reqId).toBe("r1");
    expect(entries[1].op).toBe("expand");
  });

  it("call-site fields override bound fields", () => {
    const entries: LogEntry[] = [];
    const root = createLogger({ sink: (e) => entries.push(e), bound: { stage: "a" } });
    root.info("x", { stage: "b" });
    expect(entries[0].stage).toBe("b");
  });
});

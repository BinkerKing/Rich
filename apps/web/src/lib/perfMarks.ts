/**
 * Rich 首页动画展示系统 v0.1 —— T18 首字 SLO 埋点。
 *
 * 拆两层 SLO（PRD 已经写好的约定）：
 *  - L1：用户回车 → Mascot 切到 thinking 表情（用户感知线，目标 ≤ 100ms）
 *  - L2：用户回车 → 第一个 text chunk 到达（工程线，目标 P95 ≤ 300ms warm pool 状态）
 *
 * 用 performance.mark + performance.measure；ready 后上报 /api/signals 作为
 * "chat.first-char-latency" 信号，admin 看板可聚合 P50 / P95。
 */

const PERF_PREFIX = "rich.chat.";

export function markChatSendStart(reqId: string): void {
  if (typeof performance === "undefined") return;
  try { performance.mark(`${PERF_PREFIX}send-${reqId}`); } catch { /* ignore */ }
}

export function markMascotFirstFrame(reqId: string): void {
  if (typeof performance === "undefined") return;
  try {
    performance.mark(`${PERF_PREFIX}mascot-${reqId}`);
    performance.measure(
      `${PERF_PREFIX}L1-mascot-latency`,
      `${PERF_PREFIX}send-${reqId}`,
      `${PERF_PREFIX}mascot-${reqId}`,
    );
  } catch { /* mark 可能丢失，忽略 */ }
}

export function markFirstTextChunk(reqId: string): void {
  if (typeof performance === "undefined") return;
  try {
    performance.mark(`${PERF_PREFIX}first-text-${reqId}`);
    performance.measure(
      `${PERF_PREFIX}L2-first-char-latency`,
      `${PERF_PREFIX}send-${reqId}`,
      `${PERF_PREFIX}first-text-${reqId}`,
    );
    // 算出延迟数字，上报
    const entries = performance.getEntriesByName(`${PERF_PREFIX}L2-first-char-latency`);
    const last = entries[entries.length - 1];
    if (last) {
      void reportLatency("L2", last.duration);
    }
    const l1Entries = performance.getEntriesByName(`${PERF_PREFIX}L1-mascot-latency`);
    const l1Last = l1Entries[l1Entries.length - 1];
    if (l1Last) {
      void reportLatency("L1", l1Last.duration);
    }
  } catch { /* ignore */ }
}

let reportFailed = false;
async function reportLatency(layer: "L1" | "L2", ms: number): Promise<void> {
  if (reportFailed) return;  // 上次失败后这次也跳过（避免 console 爆）
  try {
    await fetch("/api/signals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        type: "perf",
        manual: "chat-first-char",
        data: { layer, latencyMs: Math.round(ms) },
      }),
    });
  } catch {
    reportFailed = true;
  }
}

/** 生成一个轻量 reqId 用于关联本次 chat 的 marks。 */
export function newReqId(): string {
  return `r${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

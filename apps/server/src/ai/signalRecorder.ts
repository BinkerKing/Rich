import type { Signal } from "@ke/domain";
import type { SignalsRepo } from "../repos/SignalsRepo.js";

const REPEAT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const FRUSTRATED_THRESHOLD = 2;          // 3+ ops on same element within window

/**
 * Append a primary signal, then derive secondary signals (repeated_op,
 * frustrated) by looking at recent history for the same element.
 */
export async function recordSignal(repo: SignalsRepo, signal: Signal): Promise<void> {
  await repo.append(signal);

  // Only escalate when the primary is an op completion/failure tied to an element.
  if (!signal.elementId) return;
  if (signal.type !== "op.completed" && signal.type !== "op.failed") return;

  const since = new Date(Date.now() - REPEAT_WINDOW_MS).toISOString();
  const recent = await repo.list({
    elementId: signal.elementId,
    since,
  });
  // Only count primary op events to avoid feedback loop with derived signals.
  const recentOps = recent.filter(s => s.type === "op.completed" || s.type === "op.failed");
  // recent includes the just-appended one, so subtract 1 for "how many came before".
  const priorCount = recentOps.length - 1;

  if (priorCount >= 1) {
    await repo.append({
      ts: new Date().toISOString(),
      type: "user.repeated_op",
      manual: signal.manual,
      elementId: signal.elementId,
      op: signal.op,
      adapter: signal.adapter,
      data: { withinMs: REPEAT_WINDOW_MS, priorCount },
    });
  }
  if (priorCount >= FRUSTRATED_THRESHOLD) {
    await repo.append({
      ts: new Date().toISOString(),
      type: "user.frustrated",
      manual: signal.manual,
      elementId: signal.elementId,
      op: signal.op,
      adapter: signal.adapter,
      data: { withinMs: REPEAT_WINDOW_MS, priorCount },
    });
  }
}

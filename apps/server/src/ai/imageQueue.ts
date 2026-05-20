import type { AIAdapter } from "./adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import { generateImageFor } from "./operations.js";
import { adoptImageIfLocal } from "../lib/imageAssets.js";
import { noopLogger, type Logger } from "../lib/logger.js";

/** Two job shapes:
 *   - "placeholder": legacy image-placeholder block becomes image block on done
 *   - "embed-cover": mindmap-embed block's inline cover transitions through
 *     pending → generating → ready (with src) or failed (with error) */
type Job =
  | {
      kind: "placeholder";
      elementId: string;
      sectionIndex: number;
      blockIndex: number;
      alt: string;
      caption?: string;
      imagePrompt?: string;
      surroundingText: string;
    }
  | {
      kind: "embed-cover";
      elementId: string;
      sectionIndex: number;
      blockIndex: number;
      alt: string;
      caption?: string;
      imagePrompt?: string;
      surroundingText: string;
    };

/**
 * Tiny in-process background queue for image generation. Concurrency=1 keeps
 * codex subprocesses sequential — image_gen is the heaviest op (vs streaming
 * text) and we don't want to fork 6 of them at once.
 *
 * Lifecycle:
 *   1. Text-gen route calls scheduleImagesForElement(elementId) after it
 *      persists new content. The function scans for image-placeholder blocks
 *      and enqueues one job per placeholder, AND immediately marks each
 *      placeholder block with status="pending" + persists, so the frontend
 *      can show a loading state.
 *   2. The worker drains the queue: pops one job, marks it "generating", runs
 *      codex, adopts the returned file into /api/images/<id>/..., rewrites
 *      the block from image-placeholder to image, persists.
 *   3. On error, sets status="failed" + error on the original placeholder.
 *
 * The queue is process-local. Restarting the server drops pending jobs (a
 * follow-up could persist them to disk; not needed for MVP).
 */
class ImageQueue {
  private jobs: Job[] = [];
  private running = false;
  private adapter: AIAdapter | null = null;
  private elements: ElementsRepo | null = null;
  private logger: Logger = noopLogger;

  configure(adapter: AIAdapter, elements: ElementsRepo, logger?: Logger): void {
    this.adapter = adapter;
    this.elements = elements;
    this.logger = logger ?? noopLogger;
  }

  /** Scan an element's content for unstarted image-placeholder blocks, mark
   *  each pending, enqueue a job, and start the worker if idle. */
  async scheduleForElement(elementId: string): Promise<number> {
    if (!this.elements) return 0;
    const el = await this.elements.get(elementId);
    if (!el) return 0;
    const content = el.content as { sections?: Array<{ id: string; blocks: Array<Record<string, unknown>> }> } | undefined;
    const sections = content?.sections;
    if (!Array.isArray(sections)) return 0;

    const newJobs: Job[] = [];
    for (let s = 0; s < sections.length; s++) {
      const blocks = sections[s].blocks;
      if (!Array.isArray(blocks)) continue;
      const surroundingText = sectionContextText(sections[s]);
      for (let b = 0; b < blocks.length; b++) {
        const block = blocks[b];
        if (!block) continue;

        // Path 1: legacy image-placeholder blocks (article content images).
        if (block.style === "image-placeholder") {
          if (block.status === "pending" || block.status === "generating") continue;
          const alt = typeof block.alt === "string" ? block.alt : "";
          if (!alt) continue;
          block.status = "pending";
          newJobs.push({
            kind: "placeholder",
            elementId, sectionIndex: s, blockIndex: b, alt,
            caption: typeof block.caption === "string" ? block.caption : undefined,
            imagePrompt: typeof block.imagePrompt === "string" ? block.imagePrompt : undefined,
            surroundingText,
          });
          continue;
        }

        // Path 2: mindmap-embed blocks with a pending inline cover.
        if (block.style === "mindmap-embed") {
          const cover = (block as Record<string, unknown>).cover as Record<string, unknown> | undefined;
          if (!cover || cover.status !== "pending") continue;
          const alt = typeof cover.alt === "string" ? cover.alt : "";
          if (!alt) continue;
          newJobs.push({
            kind: "embed-cover",
            elementId, sectionIndex: s, blockIndex: b, alt,
            caption: typeof cover.caption === "string" ? cover.caption : undefined,
            imagePrompt: typeof cover.imagePrompt === "string" ? cover.imagePrompt : undefined,
            surroundingText,
          });
        }
      }
    }

    if (newJobs.length === 0) return 0;
    // Persist the "pending" marks so the frontend can show loading immediately.
    await this.elements.put({ ...el, content: { sections } as unknown as typeof el.content });
    this.jobs.push(...newJobs);
    this.logger.info("image-queue.enqueued", { elementId, count: newJobs.length });
    void this.drain();
    return newJobs.length;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    if (!this.adapter || !this.elements) return;
    this.running = true;
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift()!;
        await this.processOne(job).catch(err => {
          this.logger.error("image-queue.job.error", { job, err: String(err) });
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async processOne(job: Job): Promise<void> {
    if (!this.adapter || !this.elements) return;
    // Mark "generating" + persist so the frontend can show the right state.
    const el = await this.elements.get(job.elementId);
    if (!el) return;
    const content = el.content as { sections?: Array<{ id: string; blocks: Array<Record<string, unknown>> }> };
    const block = content?.sections?.[job.sectionIndex]?.blocks?.[job.blockIndex];
    if (!block) return;
    if (job.kind === "placeholder") {
      if (block.style !== "image-placeholder") return;
      block.status = "generating";
    } else {
      if (block.style !== "mindmap-embed") return;
      const cover = (block as Record<string, unknown>).cover as Record<string, unknown> | undefined;
      if (!cover) return;
      cover.status = "generating";
    }
    await this.elements.put({ ...el, content: content as unknown as typeof el.content });

    // Call codex.
    let resultSrc: string | null = null;
    let resultCaption = job.caption ?? "";
    try {
      for await (const ev of generateImageFor(this.adapter, {
        alt: job.alt, caption: job.caption,
        imagePrompt: job.imagePrompt,
        surroundingText: job.surroundingText,
        elementId: job.elementId,
      })) {
        if (ev.type === "done") {
          resultSrc = ev.result.src;
          resultCaption = ev.result.caption ?? resultCaption;
        } else if (ev.type === "error") {
          throw new Error(ev.message);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.markFailed(job, msg);
      return;
    }

    if (!resultSrc) return;
    const publicUrl = await adoptImageIfLocal(job.elementId, resultSrc);
    await this.markDone(job, publicUrl, resultCaption);
    this.logger.info("image-queue.job.done", {
      kind: job.kind, elementId: job.elementId,
      sectionIndex: job.sectionIndex, blockIndex: job.blockIndex,
    });
  }

  private async markFailed(job: Job, msg: string): Promise<void> {
    if (!this.elements) return;
    const el = await this.elements.get(job.elementId);
    if (!el) return;
    const content = el.content as { sections?: Array<{ blocks: Array<Record<string, unknown>> }> };
    const b = content?.sections?.[job.sectionIndex]?.blocks?.[job.blockIndex];
    if (!b) return;
    const trimmedErr = msg.slice(0, 200);
    if (job.kind === "placeholder" && b.style === "image-placeholder") {
      b.status = "failed";
      b.error = trimmedErr;
    } else if (job.kind === "embed-cover" && b.style === "mindmap-embed") {
      const cover = (b as Record<string, unknown>).cover as Record<string, unknown> | undefined;
      if (cover) {
        cover.status = "failed";
        cover.error = trimmedErr;
      }
    }
    await this.elements.put({ ...el, content: content as unknown as typeof el.content });
  }

  private async markDone(job: Job, publicUrl: string, caption: string): Promise<void> {
    if (!this.elements) return;
    const el = await this.elements.get(job.elementId);
    if (!el) return;
    const content = el.content as { sections?: Array<{ blocks: Array<Record<string, unknown>> }> };
    const blocks = content?.sections?.[job.sectionIndex]?.blocks;
    const b = blocks?.[job.blockIndex];
    if (!blocks || !b) return;
    if (job.kind === "placeholder" && b.style === "image-placeholder") {
      // Swap to image block.
      blocks[job.blockIndex] = {
        style: "image",
        src: publicUrl,
        alt: job.alt,
        caption,
      };
    } else if (job.kind === "embed-cover" && b.style === "mindmap-embed") {
      // Update the inline cover field on the embed in place.
      const cover = ((b as Record<string, unknown>).cover ??= {}) as Record<string, unknown>;
      cover.status = "ready";
      cover.src = publicUrl;
      cover.alt = job.alt;
      cover.caption = caption;
      delete cover.error;
    }
    await this.elements.put({ ...el, content: content as unknown as typeof el.content });
  }
}

/** Singleton — server boots once and configures with concrete deps. */
export const imageQueue = new ImageQueue();

/** Pull lead / prose / section title text near a placeholder, used as fallback
 *  context when AI didn't supply imagePrompt. */
function sectionContextText(section: { id: string; blocks: Array<Record<string, unknown>>; title?: string }): string {
  const parts: string[] = [];
  if (typeof section.title === "string") parts.push(section.title);
  for (const block of section.blocks) {
    if (!block) continue;
    if ((block.style === "lead" || block.style === "prose") && typeof block.text === "string") {
      parts.push(block.text);
    } else if (block.style === "callout" && typeof block.body === "string") {
      parts.push(block.body);
    }
  }
  return parts.join("\n").slice(0, 600);
}

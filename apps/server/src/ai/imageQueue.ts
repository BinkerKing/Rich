import type { AIAdapter } from "./adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import { generateImageFor } from "./operations.js";
import { adoptImageIfLocal } from "../lib/imageAssets.js";
import { noopLogger, type Logger } from "../lib/logger.js";

interface PlaceholderJob {
  elementId: string;
  /** Index of the section in element.content.sections that holds the placeholder. */
  sectionIndex: number;
  /** Index of the block within that section. */
  blockIndex: number;
  alt: string;
  caption?: string;
  imagePrompt?: string;
  surroundingText: string;
}

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
  private jobs: PlaceholderJob[] = [];
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

    const newJobs: PlaceholderJob[] = [];
    for (let s = 0; s < sections.length; s++) {
      const blocks = sections[s].blocks;
      if (!Array.isArray(blocks)) continue;
      // Collect surrounding text for this section once (used by all placeholders
      // in the section when imagePrompt is missing).
      const surroundingText = sectionContextText(sections[s]);
      for (let b = 0; b < blocks.length; b++) {
        const block = blocks[b];
        if (!block || block.style !== "image-placeholder") continue;
        // Skip already-pending / already-generating / already-failed — only
        // pick up brand new placeholders.
        if (block.status === "pending" || block.status === "generating") continue;
        const alt = typeof block.alt === "string" ? block.alt : "";
        if (!alt) continue;
        block.status = "pending";
        newJobs.push({
          elementId,
          sectionIndex: s,
          blockIndex: b,
          alt,
          caption: typeof block.caption === "string" ? block.caption : undefined,
          imagePrompt: typeof block.imagePrompt === "string" ? block.imagePrompt : undefined,
          surroundingText,
        });
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

  private async processOne(job: PlaceholderJob): Promise<void> {
    if (!this.adapter || !this.elements) return;
    // Re-read the element each time so we don't clobber concurrent edits.
    const el = await this.elements.get(job.elementId);
    if (!el) return;
    const content = el.content as { sections?: Array<{ id: string; blocks: Array<Record<string, unknown>> }> };
    const block = content?.sections?.[job.sectionIndex]?.blocks?.[job.blockIndex];
    if (!block || block.style !== "image-placeholder") return;
    block.status = "generating";
    await this.elements.put({ ...el, content: content as unknown as typeof el.content });

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
      // Re-read and mark failed.
      const el2 = await this.elements.get(job.elementId);
      if (!el2) return;
      const content2 = el2.content as { sections?: Array<{ blocks: Array<Record<string, unknown>> }> };
      const b2 = content2?.sections?.[job.sectionIndex]?.blocks?.[job.blockIndex];
      if (b2 && b2.style === "image-placeholder") {
        b2.status = "failed";
        b2.error = msg.slice(0, 200);
      }
      await this.elements.put({ ...el2, content: content2 as unknown as typeof el2.content });
      return;
    }

    if (!resultSrc) return;
    // Adopt the local file into our served images dir.
    const publicUrl = await adoptImageIfLocal(job.elementId, resultSrc);
    // Re-read once more and swap the block from image-placeholder → image.
    const el3 = await this.elements.get(job.elementId);
    if (!el3) return;
    const content3 = el3.content as { sections?: Array<{ blocks: Array<Record<string, unknown>> }> };
    const blocks = content3?.sections?.[job.sectionIndex]?.blocks;
    const b3 = blocks?.[job.blockIndex];
    if (!blocks || !b3 || b3.style !== "image-placeholder") return;
    blocks[job.blockIndex] = {
      style: "image",
      src: publicUrl,
      alt: job.alt,
      caption: resultCaption,
    };
    await this.elements.put({ ...el3, content: content3 as unknown as typeof el3.content });
    this.logger.info("image-queue.job.done", { elementId: job.elementId, sectionIndex: job.sectionIndex, blockIndex: job.blockIndex });
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

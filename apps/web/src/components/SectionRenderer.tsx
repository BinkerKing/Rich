import type { ReactNode } from "react";
import type { StyleBlock, DynamicSection, Source, SourcedItem } from "@ke/domain";
import { MermaidDiagram } from "./MermaidDiagram.js";
import { MindmapEmbedCard } from "./MindmapEmbedCard.js";
import { MarkdownView } from "./MarkdownView.js";
import "./SectionRenderer.css";
import "./AttachmentsEditor.css";

/** Per-render context threaded into renderBlock so style-specific blocks
 *  can interact with the host element (open the PPT player, etc). */
interface RenderCtx { elementId?: string }

// ---- source citation ----

function formatPublishedAt(raw?: string): string | null {
  if (!raw) return null;
  // Accept YYYY-MM-DD or full ISO; render as YYYY-MM-DD.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : raw;
}

function SourceLine({ source }: { source?: Source }) {
  if (!source) return null;
  const date = formatPublishedAt(source.publishedAt);
  if (!source.cite && !source.url && !date) return null;
  const label = source.cite ?? source.url ?? "未注明出处";
  const inner = (
    <>
      <span className="sec-source__tag">来源</span>
      <span className="sec-source__cite">{label}</span>
      {date && <span className="sec-source__date">· {date}</span>}
    </>
  );
  return source.url ? (
    <a className="sec-source" href={source.url} target="_blank" rel="noreferrer">{inner}</a>
  ) : (
    <span className="sec-source">{inner}</span>
  );
}

function itemTextOf(item: SourcedItem): string {
  return typeof item === "string" ? item : item.text;
}
function itemSourceOf(item: SourcedItem): Source | undefined {
  return typeof item === "string" ? undefined : item.source;
}

// ---- primitive helpers ----

function Lead({ text }: { text: string }) {
  return <p className="body-lead">{text}</p>;
}

function Prose({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return <>{paragraphs.map((p, i) => <p key={i} className="body-prose">{p}</p>)}</>;
}

type CalloutKind = "tip" | "insight" | "example" | "warning" | "info";
function Callout({ kind, title, children }: { kind: CalloutKind; title?: string; children: ReactNode }) {
  const icons: Record<CalloutKind, string> = {
    tip: "💡", insight: "💎", example: "✦", warning: "⚠", info: "ⓘ",
  };
  return (
    <div className={`callout callout--${kind}`}>
      <span className="callout-icon" aria-hidden="true">{icons[kind]}</span>
      <div className="callout-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

// ---- block dispatcher ----

function renderBlock(block: StyleBlock, key: number, ctx: RenderCtx = {}): ReactNode {
  switch (block.style) {
    case "lead":
      return (
        <div key={key} className="sec-with-source">
          <Lead text={block.text} />
          <SourceLine source={block.source} />
        </div>
      );
    case "prose":
      return (
        <div key={key} className="sec-with-source">
          <Prose text={block.text} />
          <SourceLine source={block.source} />
        </div>
      );
    case "quote":
      return (
        <blockquote key={key} className="sec-quote">
          <p>{block.text}</p>
          {block.cite && <cite>— {block.cite}</cite>}
          <SourceLine source={block.source} />
        </blockquote>
      );
    case "callout":
      return (
        <Callout key={key} kind={block.kind} title={block.title}>
          <Prose text={block.body} />
          <SourceLine source={block.source} />
        </Callout>
      );
    case "check-list":
      return (
        <ul key={key} className={`check-list${block.columns === 2 ? " check-list--grid" : ""}`}>
          {block.items.map((item, i) => (
            <li key={i}>
              <span>{itemTextOf(item)}</span>
              <SourceLine source={itemSourceOf(item)} />
            </li>
          ))}
        </ul>
      );
    case "dot-list":
      return (
        <ul key={key} className="dot-list">
          {block.items.map((item, i) => (
            <li key={i}>
              <span>{itemTextOf(item)}</span>
              <SourceLine source={itemSourceOf(item)} />
            </li>
          ))}
        </ul>
      );
    case "warn-cards":
      return (
        <div key={key} className="warn-grid">
          {block.items.map((item, i) => (
            <div key={i} className="warn-card">
              <span className="warn-card__bar" aria-hidden="true" />
              <p>{itemTextOf(item)}</p>
              <SourceLine source={itemSourceOf(item)} />
            </div>
          ))}
        </div>
      );
    case "example-list":
      return (
        <ol key={key} className="example-list">
          {block.items.map((item, i) => (
            <li key={i} className="example-item">
              <span className="example-num">{String(i + 1).padStart(2, "0")}</span>
              <p>{itemTextOf(item)}</p>
              <SourceLine source={itemSourceOf(item)} />
            </li>
          ))}
        </ol>
      );
    case "mechanism-flow":
      return (
        <ol key={key} className="mechanism-flow mechanism-flow--prose">
          {block.steps.map((step, i) => (
            <li key={i}>
              <span className="mechanism-step-num">{i + 1}</span>
              <div>
                <strong>{step.label}</strong>
                {step.description && <p>{step.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      );
    case "decision-list":
      return (
        <div key={key} className="decision-list">
          {block.decisions.map((d, i) => (
            <article key={i} className="decision-card">
              <header><strong>{d.topic}</strong><span>采用：{d.choice}</span></header>
              {d.rationale && <p>{d.rationale}</p>}
              {d.alternatives && d.alternatives.length > 0 && (
                <ul className="dot-list">
                  {d.alternatives.map(alt => <li key={alt}>备选：{alt}</li>)}
                </ul>
              )}
            </article>
          ))}
        </div>
      );
    case "phase-timeline":
      return (
        <ol key={key} className="phase-timeline">
          {block.phases.map((p, i) => (
            <li key={i}>
              <span className="phase-num">阶段 {i + 1}</span>
              <div>
                <strong>{p.label}</strong>
                <p>{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "kv-table":
      return (
        <table key={key} className="sec-kv-table">
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                <th scope="row">{row.key}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "module-grid":
      return (
        <div key={key} className="module-grid">
          {block.cards.map((c, i) => (
            <article key={i} className="module-card">
              <header>{c.title}</header>
              <p>{c.body}</p>
              {c.focus && <em>{c.focus}</em>}
              <SourceLine source={c.source} />
            </article>
          ))}
        </div>
      );
    case "competitor-table":
      return (
        <table key={key} className="competitor-table">
          <thead><tr><th>竞品</th><th>可借鉴</th></tr></thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}><td><strong>{r.name}</strong></td><td>{r.takeaway}</td></tr>
            ))}
          </tbody>
        </table>
      );
    case "mvp-grid":
      return (
        <div key={key} className="mvp-grid">
          {block.features.map((feat, i) => (
            <article key={i} className="mvp-card">
              <span className="mvp-num">F{i + 1}</span>
              <p>{feat}</p>
            </article>
          ))}
        </div>
      );
    case "diagram":
      return <MermaidDiagram key={key} title={block.title} caption={block.caption} code={block.mermaid} />;
    case "day-schedule":
      return (
        <ol key={key} className="sec-day-schedule">
          {block.days.map((day, i) => (
            <li key={i} className="sec-day-schedule__day">
              <header>
                <span className="sec-day-schedule__num">D{i + 1}</span>
                <strong>{day.label}</strong>
                {day.summary && <em>{day.summary}</em>}
              </header>
              <ul>
                {day.items.map((it, j) => (
                  <li key={j}>
                    {it.time && <span className="sec-day-schedule__time">{it.time}</span>}
                    <span className="sec-day-schedule__what">{it.what}</span>
                    {it.note && <span className="sec-day-schedule__note">{it.note}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      );
    case "budget-table":
      return (
        <div key={key} className="sec-budget">
          <table className="sec-budget__table">
            <thead><tr><th>项目</th><th>数量</th><th>金额</th><th>备注</th></tr></thead>
            <tbody>
              {block.lines.map((line, i) => (
                <tr key={i}>
                  <td>{line.item}</td>
                  <td>{line.qty ?? "—"}</td>
                  <td>{line.cost}</td>
                  <td>{line.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {block.total && <div className="sec-budget__total">合计：{block.total}</div>}
        </div>
      );
    case "checklist-grouped":
      return (
        <div key={key} className="sec-checklist-grouped">
          {block.groups.map((g, i) => (
            <section key={i}>
              <h4>{g.title}</h4>
              <ul className="check-list">
                {g.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>
      );
    case "image-placeholder": {
      // The dedicated image engine processes placeholders in the background.
      // Show a loading state while pending/generating; a failure note if it
      // errored. Idle placeholders (no status) mean image engine hasn't picked
      // them up yet — render as plain placeholder.
      const status = block.status;
      const stateText = status === "generating" ? "AI 正在生成图片…"
        : status === "pending" ? "排队中…"
        : status === "failed" ? `生成失败：${block.error ?? "未知错误"}`
        : "图片占位";
      return (
        <figure
          key={key}
          className={`sec-image-placeholder${status ? ` sec-image-placeholder--${status}` : ""}`}
          aria-label={block.alt}
        >
          <div className="sec-image-placeholder__box">
            <span>{status === "failed" ? "⚠" : status ? "✦" : "🖼"}</span>
            <em>{stateText}</em>
            <small>{block.alt}</small>
          </div>
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    }
    case "image":
      return (
        <figure key={key} className="sec-image">
          <img src={block.src} alt={block.alt} loading="lazy" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case "mindmap-embed":
      // Should never reach here — `renderSectionBlocks` fuses the embed block
      // with its cover image and emits a single MindmapEmbedCard for the
      // whole PPT section. Render an empty fragment defensively.
      return null;
    case "attachments":
      return <AttachmentsView key={key} block={block} />;
    case "markdown":
      return <MarkdownView key={key} text={block.text} title={block.title} />;
    default: {
      // Unknown style — surface as a small warning so users can spot it.
      const k = (block as { style?: string }).style ?? "unknown";
      return (
        <div key={key} className="sec-unknown">
          <strong>未识别样式：{k}</strong>
          <pre>{JSON.stringify(block, null, 2)}</pre>
        </div>
      );
    }
  }
}

/** Render a single dynamic section (title + blocks). Returns the body content; the
 *  containing element is up to the caller (so they can wrap in `<SectionBlock>` for TOC).
 *
 *  Layout heuristic: an `image` block immediately followed by 1-3 text blocks
 *  (lead/prose/callout/check-list/dot-list/kv-table) gets paired into a 2-column
 *  grid (image left, text right), so the panel never leaves giant empty gutters
 *  next to a small image. */
export function renderSectionBlocks(section: DynamicSection, elementId?: string): ReactNode {
  const blocks = section.blocks;
  const ctx: RenderCtx = { elementId };

  // PPT 展示图 section can contain MULTIPLE mindmap-embed blocks — one per
  // deck this element participates in. Each embed carries its own inline
  // cover (cover.src / cover.status), per-deck disable flags, etc. Emit one
  // card per embed; image/image-placeholder blocks (legacy or from the
  // image queue) are NOT rendered separately to avoid a duplicate big image.
  if (section.id === "mindmap-ppt") {
    const embeds = blocks.filter(b => b.style === "mindmap-embed") as Array<Extract<StyleBlock, { style: "mindmap-embed" }>>;
    if (embeds.length === 0) return [];
    return embeds.map((embed, i) => (
      <MindmapEmbedCard key={`embed-${embed.deckRootId ?? i}`} block={embed} elementId={elementId} />
    ));
  }

  const out: ReactNode[] = [];
  const isText = (s?: string) => s === "lead" || s === "prose" || s === "callout"
    || s === "check-list" || s === "dot-list" || s === "kv-table";

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.style === "image" && isText(blocks[i + 1]?.style)) {
      const partners: StyleBlock[] = [];
      while (partners.length < 3 && isText(blocks[i + 1 + partners.length]?.style)) {
        partners.push(blocks[i + 1 + partners.length]);
      }
      out.push(
        <div key={`pair-${i}`} className="sec-image-pair">
          <div className="sec-image-pair__media">{renderBlock(b, i, ctx)}</div>
          <div className="sec-image-pair__text">
            {partners.map((p, j) => renderBlock(p, i + 1 + j, ctx))}
          </div>
        </div>,
      );
      i += partners.length;
      continue;
    }
    out.push(renderBlock(b, i, ctx));
  }
  return out;
}

/** Read-only rendering of an AttachmentsBlock. Reuses the same tree row
 *  styling as the editor; no upload / delete controls. */
function AttachmentsView({ block }: { block: import("@ke/domain").AttachmentsBlock }) {
  const items = block.items ?? [];
  return (
    <div className="sec-attachments att-editor">
      <div className="att-meta">
        {block.source === "linked-folder"
          ? <>📁 链接文件夹{block.folderName ? <> · <strong>{block.folderName}</strong></> : null}</>
          : <>📎 上传附件</>}
        {items.length > 0 && <> · 共 {countAttachmentFiles(items)} 个文件</>}
        {block.scannedAt && <> · 更新于 {block.scannedAt.slice(0, 19).replace("T", " ")}</>}
      </div>
      {items.length === 0 ? (
        <div className="att-meta" style={{ padding: "8px 0", opacity: 0.6 }}>(空)</div>
      ) : (
        <div className="att-tree">
          {items.map((node, i) => <AttachmentViewRow key={i} node={node} depth={0} />)}
        </div>
      )}
    </div>
  );
}
function AttachmentViewRow({ node, depth }: { node: import("@ke/domain").AttachmentNode; depth: number }) {
  if (node.kind === "file") {
    return (
      <div className="att-row att-row--file" style={{ paddingLeft: 8 + depth * 16 }}>
        <span className="att-row__icon" aria-hidden="true">📄</span>
        {node.src ? (
          <a className="att-row__name" href={node.src} download={node.name} title="点击下载">{node.name}</a>
        ) : (
          <span className="att-row__name att-row__name--local" title="本地文件,未上传">{node.name}</span>
        )}
        {typeof node.size === "number" && (
          <span className="att-row__meta">
            {node.size < 1024 ? `${node.size} B`
              : node.size < 1024 * 1024 ? `${(node.size / 1024).toFixed(1)} KB`
              : node.size < 1024 * 1024 * 1024 ? `${(node.size / (1024 * 1024)).toFixed(1)} MB`
              : `${(node.size / (1024 * 1024 * 1024)).toFixed(2)} GB`}
          </span>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="att-row att-row--dir" style={{ paddingLeft: 8 + depth * 16 }}>
        <span className="att-row__icon" aria-hidden="true">▾</span>
        <span className="att-row__icon" aria-hidden="true">📁</span>
        <span className="att-row__name att-row__name--dir">{node.name}</span>
        <span className="att-row__meta">{countAttachmentFiles(node.children)} 个文件</span>
      </div>
      {node.children.map((c, i) => <AttachmentViewRow key={i} node={c} depth={depth + 1} />)}
    </>
  );
}
function countAttachmentFiles(nodes: import("@ke/domain").AttachmentNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.kind === "file") n++;
    else n += countAttachmentFiles(node.children);
  }
  return n;
}

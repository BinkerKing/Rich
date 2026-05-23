import { useEffect, useRef, useState, type RefObject } from "react";
import type { Element, DynamicSection, StyleBlock } from "@ke/domain";
import { api } from "../api/client.js";
import { useStore } from "../state/store.js";
import { AttachmentsEditor } from "./AttachmentsEditor.js";
import { MarkdownView } from "./MarkdownView.js";
import "./EditableBody.css";

interface Props {
  element: Element;
  onExit: () => void;
}

/** Block styles the editor supports as fully editable. Anything else is
 *  rendered as read-only with a delete button (don't surprise users by
 *  dropping unknown content). */
const EDITABLE_STYLES = [
  "lead", "prose", "quote", "callout",
  "dot-list", "check-list", "warn-cards", "example-list", "mvp-grid",
  "kv-table", "mechanism-flow", "phase-timeline", "competitor-table",
  "decision-list", "module-grid", "checklist-grouped",
  "image", "diagram",
  "attachments",
  "markdown",
] as const;
type EditableStyle = (typeof EDITABLE_STYLES)[number];

interface StyleChoice { value: EditableStyle; label: string; hint: string }
const STYLE_CHOICES: StyleChoice[] = [
  // text
  { value: "lead",         label: "起手段落 · Lead", hint: "节首关键句,加粗放大" },
  { value: "prose",        label: "正文段落 · Prose", hint: "普通正文,可多段" },
  { value: "quote",        label: "引用 · Quote", hint: "他人观点 / 名言 / 摘录,可注出处" },
  { value: "callout",      label: "提示卡片 · Callout", hint: "tip / insight / example / warning / info" },
  // simple lists
  { value: "dot-list",     label: "圆点列表", hint: "推荐路径 / 散点条目" },
  { value: "check-list",   label: "勾选清单", hint: "✓ 待办 / 重点检查项" },
  { value: "warn-cards",   label: "警示卡片", hint: "⚠ 易混点 / 风险点(每项一卡)" },
  { value: "example-list", label: "示例列表", hint: "数字编号的范例" },
  { value: "mvp-grid",     label: "MVP 网格", hint: "MVP 功能点,编号卡片" },
  // tables / structured
  { value: "kv-table",            label: "键值表", hint: "两列:左 key 右 value" },
  { value: "mechanism-flow",      label: "机制流程", hint: "编号 步骤 / 阶段,可附说明" },
  { value: "phase-timeline",      label: "阶段时间线", hint: "顺序阶段 · 每段一标题+正文" },
  { value: "competitor-table",    label: "竞品表", hint: "名称 + takeaway" },
  { value: "decision-list",       label: "决策清单", hint: "议题 / 选择 / 理由 / 备选" },
  { value: "module-grid",         label: "模块网格", hint: "卡片网格:标题/正文/焦点" },
  { value: "checklist-grouped",   label: "分组清单", hint: "按主题分组的清单" },
  // media
  { value: "image",        label: "图片", hint: "已有图片 URL,会内嵌" },
  { value: "diagram",      label: "图示 (Mermaid)", hint: "直接写 mermaid 语法,前端渲染" },
  // files
  { value: "attachments",  label: "附件清单 📎", hint: "拖入上传 / 选择本地文件夹解析为清单" },
  // rich text
  { value: "markdown",     label: "Markdown 📝", hint: "用 markdown 语法写,自动渲染标题/列表/代码/表格等" },
];

/**
 * Inline editor for an element's content.sections[]. Each section's title is
 * editable; blocks of the 5 supported styles can be edited inline + reordered
 * (delete only, no drag yet) + appended via a style picker. New sections can
 * be appended at the bottom. All edits are debounced and PUT-ed back to the
 * server; the local store gets the fresh element from the response so the
 * normal (non-edit) renderer stays in sync.
 *
 * Block types this editor doesn't know how to edit (e.g. mechanism-flow,
 * mindmap-embed) are shown as a read-only chip with a delete control — the
 * user can remove them but not modify in-place.
 */
export function EditableBody({ element, onExit }: Props) {
  // Local working copy. Always start from element.content.sections; if the
  // element has legacy fields and no sections we trigger the server-side
  // migration once on entry, then re-pull.
  const [sections, setSections] = useState<DynamicSection[]>(() => {
    const c = element.content as { sections?: DynamicSection[] } | null | undefined;
    return Array.isArray(c?.sections) ? c!.sections! : [];
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const migratedOnce = useRef(false);
  const elements = useStore(s => s.elements);

  // If empty + element has legacy content, migrate once on mount.
  useEffect(() => {
    if (sections.length > 0 || migratedOnce.current) return;
    const c = element.content as Record<string, unknown> | null | undefined;
    const hasLegacy = c && (
      typeof c.oneSentence === "string" ||
      typeof c.coreExplain === "string" ||
      typeof c.whyMatters === "string" ||
      Array.isArray(c.mechanisms) ||
      Array.isArray(c.examples) ||
      Array.isArray(c.misconceptions) ||
      Array.isArray(c.nextSteps) ||
      Array.isArray(c.learningGoals) ||
      Array.isArray(c.keyPoints)
    );
    if (!hasLegacy) return;
    migratedOnce.current = true;
    void (async () => {
      try {
        const next = await api.migrateElementToSections(element.id);
        const nc = next.content as { sections?: DynamicSection[] } | null | undefined;
        if (Array.isArray(nc?.sections)) setSections(nc!.sections!);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [element.id, element.content, sections.length]);

  // Debounced auto-save.
  const saveTimer = useRef<number | null>(null);
  const lastSavedJson = useRef<string>(JSON.stringify(sections));
  useEffect(() => {
    const json = JSON.stringify(sections);
    if (json === lastSavedJson.current) return;
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await api.putElementSections(element.id, sections as unknown[]);
        lastSavedJson.current = json;
        setSaveState("saved");
        setSaveError(null);
        // Refresh local element cache so non-edit views catch up.
        const fresh = await api.getElement(element.id).catch(() => null);
        if (fresh) {
          useStore.setState(s => ({
            elements: new Map(s.elements).set(element.id, fresh),
          }));
        }
        window.setTimeout(() => setSaveState(prev => prev === "saved" ? "idle" : prev), 1500);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        setSaveState("error");
      }
    }, 800);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [sections, element.id]);

  void elements; // future: cross-section validation

  function updateSection(idx: number, patch: Partial<DynamicSection>) {
    setSections(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function deleteSection(idx: number) {
    if (!window.confirm("删除整个章节?")) return;
    setSections(prev => prev.filter((_, i) => i !== idx));
  }
  function moveSection(idx: number, delta: -1 | 1) {
    setSections(prev => {
      const j = idx + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function addSection() {
    const id = `sec-${Date.now().toString(36)}`;
    setSections(prev => [...prev, { id, title: "新章节", blocks: [] }]);
  }
  function updateBlock(secIdx: number, blockIdx: number, next: StyleBlock) {
    setSections(prev => prev.map((s, i) => {
      if (i !== secIdx) return s;
      const blocks = s.blocks.slice();
      blocks[blockIdx] = next;
      return { ...s, blocks };
    }));
  }
  function deleteBlock(secIdx: number, blockIdx: number) {
    setSections(prev => prev.map((s, i) => {
      if (i !== secIdx) return s;
      const blocks = s.blocks.filter((_, j) => j !== blockIdx);
      return { ...s, blocks };
    }));
  }
  function addBlock(secIdx: number, style: EditableStyle) {
    setSections(prev => prev.map((s, i) => {
      if (i !== secIdx) return s;
      return { ...s, blocks: [...s.blocks, freshBlock(style)] };
    }));
  }

  return (
    <div className="eb-shell">
      <header className="eb-toolbar">
        <span className="eb-toolbar__title">编辑模式</span>
        <SaveBadge state={saveState} error={saveError} />
        <button type="button" className="eb-toolbar__exit" onClick={onExit}>
          完成 / 退出编辑 →
        </button>
      </header>
      <p className="eb-toolbar__hint">
        每次改动会在 1 秒后自动保存到此元。复杂模块(机制/图表/PPT 嵌入等)只能整块删除,
        简单块(段落/列表/提示)可直接编辑。
      </p>

      {sections.length === 0 && (
        <div className="eb-empty">
          这个元还没有章节。点下面的「+ 新增章节」开始,或保留空着以后再来。
        </div>
      )}

      <div className="eb-sections">
        {sections.map((s, i) => (
          <SectionEditor
            key={s.id}
            elementId={element.id}
            section={s}
            index={i}
            total={sections.length}
            onUpdate={(patch) => updateSection(i, patch)}
            onDelete={() => deleteSection(i)}
            onMove={(d) => moveSection(i, d)}
            onUpdateBlock={(bi, b) => updateBlock(i, bi, b)}
            onDeleteBlock={(bi) => deleteBlock(i, bi)}
            onAddBlock={(style) => addBlock(i, style)}
          />
        ))}
      </div>

      <button type="button" className="eb-add-section" onClick={addSection}>
        + 新增章节
      </button>
    </div>
  );
}

function SaveBadge({ state, error }: { state: "idle" | "saving" | "saved" | "error"; error: string | null }) {
  if (state === "saving") return <span className="eb-save eb-save--saving">保存中…</span>;
  if (state === "saved") return <span className="eb-save eb-save--saved">已保存 ✓</span>;
  if (state === "error") return <span className="eb-save eb-save--error" title={error ?? undefined}>保存失败</span>;
  return <span className="eb-save eb-save--idle">就绪</span>;
}

interface SectionEditorProps {
  elementId: string;
  section: DynamicSection;
  index: number;
  total: number;
  onUpdate: (patch: Partial<DynamicSection>) => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
  onUpdateBlock: (blockIdx: number, next: StyleBlock) => void;
  onDeleteBlock: (blockIdx: number) => void;
  onAddBlock: (style: EditableStyle) => void;
}

function SectionEditor({
  elementId, section, index, total, onUpdate, onDelete, onMove,
  onUpdateBlock, onDeleteBlock, onAddBlock,
}: SectionEditorProps) {
  const [adderOpen, setAdderOpen] = useState(false);
  return (
    <section className="eb-section">
      <header className="eb-section__head">
        <input
          className="eb-section__title"
          value={section.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="章节标题"
        />
        <div className="eb-section__controls">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="上移">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="下移">↓</button>
          <button type="button" className="eb-section__delete" onClick={onDelete} title="删除整个章节">🗑</button>
        </div>
      </header>
      <div className="eb-blocks">
        {section.blocks.length === 0 && (
          <div className="eb-blocks__empty">章节为空 — 用下面的「+ 模块」加内容。</div>
        )}
        {section.blocks.map((b, j) => (
          <BlockEditor
            key={j}
            elementId={elementId}
            block={b}
            onUpdate={(next) => onUpdateBlock(j, next)}
            onDelete={() => onDeleteBlock(j)}
          />
        ))}
      </div>
      <div className="eb-block-adder">
        {!adderOpen ? (
          <button type="button" className="eb-block-adder__trigger" onClick={() => setAdderOpen(true)}>
            + 添加模块
          </button>
        ) : (
          <div className="eb-block-adder__menu">
            {STYLE_CHOICES.map(c => (
              <button
                key={c.value} type="button"
                className="eb-block-adder__choice"
                onClick={() => { onAddBlock(c.value); setAdderOpen(false); }}
              >
                <strong>{c.label}</strong>
                <em>{c.hint}</em>
              </button>
            ))}
            <button type="button" className="eb-block-adder__cancel" onClick={() => setAdderOpen(false)}>
              取消
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

interface BlockEditorProps {
  elementId: string;
  block: StyleBlock;
  onUpdate: (next: StyleBlock) => void;
  onDelete: () => void;
}

function BlockEditor({ elementId, block, onUpdate, onDelete }: BlockEditorProps) {
  const style = block.style;
  const isEditable = EDITABLE_STYLES.includes(style as EditableStyle);

  return (
    <div className={`eb-block eb-block--${style}${isEditable ? "" : " eb-block--readonly"}`}>
      <div className="eb-block__head">
        <span className="eb-block__style">{styleLabel(style)}</span>
        <button type="button" className="eb-block__delete" onClick={onDelete} title="删除此模块">×</button>
      </div>
      {isEditable ? (
        <EditableBlockBody elementId={elementId} block={block} onUpdate={onUpdate} />
      ) : (
        <div className="eb-block__readonly">
          <em>此类模块当前只能整块删除,无法在编辑器中直接修改 —— 可让 AI 在元详情页中通过反馈调整。</em>
          <pre>{JSON.stringify(stripStyle(block), null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function EditableBlockBody({ elementId, block, onUpdate }: { elementId: string; block: StyleBlock; onUpdate: (b: StyleBlock) => void }) {
  switch (block.style) {
    case "lead":
    case "prose":
      return (
        <textarea
          className="eb-text"
          value={block.text}
          rows={block.style === "lead" ? 2 : 5}
          onChange={e => onUpdate({ ...block, text: e.target.value })}
          placeholder={block.style === "lead" ? "节首关键句…" : "正文…"}
        />
      );

    case "quote":
      return (
        <div className="eb-callout">
          <textarea
            className="eb-text" rows={3} value={block.text}
            onChange={e => onUpdate({ ...block, text: e.target.value })}
            placeholder="引用正文…"
          />
          <input
            value={block.cite ?? ""}
            onChange={e => onUpdate({ ...block, cite: e.target.value || undefined })}
            placeholder="出处 / 作者(可选)"
          />
        </div>
      );

    case "callout": {
      const kinds = ["tip", "insight", "example", "warning", "info"] as const;
      return (
        <div className="eb-callout">
          <div className="eb-callout__head">
            <select
              value={block.kind}
              onChange={e => onUpdate({ ...block, kind: e.target.value as typeof kinds[number] })}
            >
              {kinds.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <input
              value={block.title ?? ""}
              onChange={e => onUpdate({ ...block, title: e.target.value || undefined })}
              placeholder="标题(可选)"
            />
          </div>
          <textarea
            className="eb-text" rows={3} value={block.body}
            onChange={e => onUpdate({ ...block, body: e.target.value })}
            placeholder="正文…"
          />
        </div>
      );
    }

    case "dot-list":
    case "check-list":
    case "warn-cards":
    case "example-list":
      return (
        <ItemListEditor
          items={projectToTextItems(block.items)}
          onChange={next => onUpdate({ ...block, items: next as never })}
          placeholder={
            block.style === "check-list" ? "勾选项…"
            : block.style === "warn-cards" ? "易混点 / 风险点…"
            : block.style === "example-list" ? "示例…"
            : "条目…"
          }
        />
      );

    case "mvp-grid":
      return (
        <ItemListEditor
          items={block.features ?? []}
          onChange={next => onUpdate({ ...block, features: next })}
          placeholder="MVP 功能点…"
        />
      );

    case "kv-table":
      return (
        <RowsEditor<{ key: string; value: string }>
          rows={block.rows ?? []}
          fields={[
            { name: "key",   placeholder: "键",  width: "minmax(120px, 1fr)" },
            { name: "value", placeholder: "值",  width: "minmax(0, 2fr)" },
          ]}
          fresh={() => ({ key: "", value: "" })}
          onChange={next => onUpdate({ ...block, rows: next })}
          addLabel="+ 添加键值"
        />
      );

    case "mechanism-flow":
      return (
        <RowsEditor<{ label: string; description?: string }>
          rows={block.steps ?? []}
          fields={[
            { name: "label",       placeholder: "步骤名 / 阶段名", width: "minmax(140px, 1fr)" },
            { name: "description", placeholder: "说明(可选)",     width: "minmax(0, 2fr)" },
          ]}
          fresh={() => ({ label: "", description: "" })}
          onChange={next => onUpdate({ ...block, steps: next })}
          addLabel="+ 添加步骤"
        />
      );

    case "phase-timeline":
      return (
        <RowsEditor<{ label: string; body: string }>
          rows={block.phases ?? []}
          fields={[
            { name: "label", placeholder: "阶段名",   width: "minmax(120px, 1fr)" },
            { name: "body",  placeholder: "阶段正文", width: "minmax(0, 2fr)", multiline: true },
          ]}
          fresh={() => ({ label: "", body: "" })}
          onChange={next => onUpdate({ ...block, phases: next })}
          addLabel="+ 添加阶段"
        />
      );

    case "competitor-table":
      return (
        <RowsEditor<{ name: string; takeaway: string }>
          rows={block.rows ?? []}
          fields={[
            { name: "name",     placeholder: "竞品名",  width: "minmax(120px, 1fr)" },
            { name: "takeaway", placeholder: "Takeaway",width: "minmax(0, 2fr)" },
          ]}
          fresh={() => ({ name: "", takeaway: "" })}
          onChange={next => onUpdate({ ...block, rows: next })}
          addLabel="+ 添加一行"
        />
      );

    case "decision-list":
      return (
        <RowsEditor<{ topic: string; choice: string; rationale?: string }>
          rows={block.decisions ?? []}
          fields={[
            { name: "topic",     placeholder: "议题",     width: "minmax(120px, 1fr)" },
            { name: "choice",    placeholder: "选择",     width: "minmax(120px, 1fr)" },
            { name: "rationale", placeholder: "理由(可选)", width: "minmax(0, 2fr)", multiline: true },
          ]}
          fresh={() => ({ topic: "", choice: "", rationale: "" })}
          onChange={next => onUpdate({ ...block, decisions: next })}
          addLabel="+ 添加决策"
        />
      );

    case "module-grid":
      return (
        <RowsEditor<{ title: string; body: string; focus?: string }>
          rows={block.cards ?? []}
          fields={[
            { name: "title", placeholder: "卡片标题", width: "minmax(140px, 1fr)" },
            { name: "body",  placeholder: "正文",    width: "minmax(0, 2fr)", multiline: true },
            { name: "focus", placeholder: "焦点关键词(可选)", width: "minmax(120px, 1fr)" },
          ]}
          fresh={() => ({ title: "", body: "", focus: "" })}
          onChange={next => onUpdate({ ...block, cards: next })}
          addLabel="+ 添加卡片"
        />
      );

    case "checklist-grouped":
      return (
        <GroupedChecklistEditor
          groups={block.groups ?? []}
          onChange={next => onUpdate({ ...block, groups: next })}
        />
      );

    case "image":
      return (
        <div className="eb-callout">
          <input
            value={block.src}
            onChange={e => onUpdate({ ...block, src: e.target.value })}
            placeholder="图片 URL(/api/images/... 或 https://...)"
          />
          <input
            value={block.alt}
            onChange={e => onUpdate({ ...block, alt: e.target.value })}
            placeholder="Alt 文本(可访问性)"
          />
          <input
            value={block.caption ?? ""}
            onChange={e => onUpdate({ ...block, caption: e.target.value || undefined })}
            placeholder="图注(可选)"
          />
          {block.src && <img className="eb-image-preview" src={block.src} alt={block.alt} />}
        </div>
      );

    case "diagram":
      return (
        <div className="eb-callout">
          <input
            value={block.title}
            onChange={e => onUpdate({ ...block, title: e.target.value })}
            placeholder="图表标题"
          />
          <input
            value={block.caption ?? ""}
            onChange={e => onUpdate({ ...block, caption: e.target.value || undefined })}
            placeholder="图注(可选)"
          />
          <textarea
            className="eb-text eb-mono" rows={8} value={block.mermaid}
            onChange={e => onUpdate({ ...block, mermaid: e.target.value })}
            placeholder="mermaid 代码,例如:&#10;graph LR&#10;  A[输入] --> B[处理] --> C[输出]"
          />
        </div>
      );

    case "attachments":
      return (
        <AttachmentsEditor
          elementId={elementId}
          block={block}
          onUpdate={onUpdate}
        />
      );

    case "markdown":
      return <MarkdownBlockEditor block={block} onUpdate={onUpdate} />;

    default:
      return null;
  }
}

interface FieldDef {
  name: string;
  placeholder: string;
  width: string;
  multiline?: boolean;
}

/** Generic editor for an array of homogeneous objects with named string fields.
 *  Used by kv-table, mechanism-flow, phase-timeline, competitor-table, etc. */
function RowsEditor<T extends Record<string, string | undefined>>({
  rows, fields, fresh, onChange, addLabel,
}: {
  rows: T[];
  fields: FieldDef[];
  fresh: () => T;
  onChange: (next: T[]) => void;
  addLabel: string;
}) {
  return (
    <div className="eb-rows">
      {rows.map((row, i) => (
        <div
          key={i} className="eb-rows__row"
          style={{ gridTemplateColumns: fields.map(f => f.width).join(" ") + " 28px" }}
        >
          {fields.map(f => (
            f.multiline ? (
              <textarea
                key={f.name} rows={2}
                value={(row[f.name] ?? "") as string}
                onChange={e => {
                  const next = rows.slice();
                  next[i] = { ...row, [f.name]: e.target.value };
                  onChange(next);
                }}
                placeholder={f.placeholder}
              />
            ) : (
              <input
                key={f.name}
                value={(row[f.name] ?? "") as string}
                onChange={e => {
                  const next = rows.slice();
                  next[i] = { ...row, [f.name]: e.target.value };
                  onChange(next);
                }}
                placeholder={f.placeholder}
              />
            )
          ))}
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} title="删除">×</button>
        </div>
      ))}
      <button type="button" className="eb-list__add" onClick={() => onChange([...rows, fresh()])}>
        {addLabel}
      </button>
    </div>
  );
}

function GroupedChecklistEditor({
  groups, onChange,
}: {
  groups: Array<{ title: string; items: string[] }>;
  onChange: (next: Array<{ title: string; items: string[] }>) => void;
}) {
  return (
    <div className="eb-rows">
      {groups.map((g, i) => (
        <div key={i} className="eb-grouped">
          <div className="eb-grouped__head">
            <input
              value={g.title}
              onChange={e => {
                const next = groups.slice();
                next[i] = { ...g, title: e.target.value };
                onChange(next);
              }}
              placeholder="分组标题"
            />
            <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} title="删除整组">×</button>
          </div>
          <ItemListEditor
            items={g.items}
            onChange={items => {
              const next = groups.slice();
              next[i] = { ...g, items };
              onChange(next);
            }}
            placeholder="清单项…"
          />
        </div>
      ))}
      <button type="button" className="eb-list__add" onClick={() => onChange([...groups, { title: "新分组", items: [] }])}>
        + 添加分组
      </button>
    </div>
  );
}

function ItemListEditor({ items, onChange, placeholder }: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="eb-list">
      {items.map((it, i) => (
        <div key={i} className="eb-list__row">
          <input
            value={it}
            onChange={e => {
              const next = items.slice();
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
          />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} title="删除">×</button>
        </div>
      ))}
      <button type="button" className="eb-list__add" onClick={() => onChange([...items, ""])}>
        + 添加一条
      </button>
    </div>
  );
}

/** Project a heterogeneous SourcedItem[] (string | {text,source?}) down to
 *  plain string[] for editing. We lose the source metadata; if the user
 *  wants citations they can use the AI feedback flow. */
function projectToTextItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(it => {
    if (typeof it === "string") return it;
    if (it && typeof it === "object" && typeof (it as { text?: string }).text === "string") {
      return (it as { text: string }).text;
    }
    return "";
  });
}

function freshBlock(style: EditableStyle): StyleBlock {
  switch (style) {
    case "lead":              return { style: "lead", text: "" };
    case "prose":             return { style: "prose", text: "" };
    case "quote":             return { style: "quote", text: "" };
    case "callout":           return { style: "callout", kind: "tip", body: "" };
    case "dot-list":          return { style: "dot-list", items: [] };
    case "check-list":        return { style: "check-list", items: [] };
    case "warn-cards":        return { style: "warn-cards", items: [] };
    case "example-list":      return { style: "example-list", items: [] };
    case "mvp-grid":          return { style: "mvp-grid", features: [] };
    case "kv-table":          return { style: "kv-table", rows: [] };
    case "mechanism-flow":    return { style: "mechanism-flow", steps: [] };
    case "phase-timeline":    return { style: "phase-timeline", phases: [] };
    case "competitor-table":  return { style: "competitor-table", rows: [] };
    case "decision-list":     return { style: "decision-list", decisions: [] };
    case "module-grid":       return { style: "module-grid", cards: [] };
    case "checklist-grouped": return { style: "checklist-grouped", groups: [] };
    case "image":             return { style: "image", src: "", alt: "" };
    case "diagram":           return { style: "diagram", title: "", mermaid: "" };
    case "attachments":       return { style: "attachments", source: "uploaded", items: [] };
    case "markdown":          return { style: "markdown", text: "" };
  }
}

function styleLabel(style: string): string {
  const map: Record<string, string> = {
    lead: "起手段落", prose: "正文段落", callout: "提示卡片",
    "dot-list": "圆点列表", "check-list": "勾选清单",
    quote: "引用", "warn-cards": "警示卡", "example-list": "示例列表",
    "mechanism-flow": "机制流程", "decision-list": "决策清单",
    "phase-timeline": "阶段时间线", "kv-table": "键值表",
    "module-grid": "模块网格", "competitor-table": "竞品表",
    "mvp-grid": "MVP 网格", diagram: "图示",
    "day-schedule": "日程", "budget-table": "预算表",
    "checklist-grouped": "分组清单",
    "image-placeholder": "图片(生成中)", image: "图片",
    "mindmap-embed": "PPT 嵌入卡",
    attachments: "附件清单",
    markdown: "Markdown",
  };
  return map[style] ?? style;
}

function stripStyle<T extends { style: string }>(b: T): Omit<T, "style"> {
  const { style: _s, ...rest } = b;
  void _s;
  return rest;
}

/** Markdown editor with a quick-format toolbar. Inserts markdown markup or
 *  inline HTML around the selected text (or at the caret if no selection)
 *  and restores selection so the user can keep typing. Live preview below. */
type MdBlock = Extract<StyleBlock, { style: "markdown" }>;
function MarkdownBlockEditor({ block, onUpdate }: { block: MdBlock; onUpdate: (b: StyleBlock) => void }) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  function applyWrap(left: string, right: string = left, placeholder = "文字") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const sel = ta.value.slice(start, end);
    const after = ta.value.slice(end);
    const content = sel || placeholder;
    const next = before + left + content + right + after;
    onUpdate({ ...block, text: next });
    // Restore selection on the inserted content.
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = before.length + left.length;
      ta.selectionEnd = before.length + left.length + content.length;
    });
  }
  function applyLinePrefix(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const sel = ta.value.slice(start, end);
    const after = ta.value.slice(end);
    // Find start of the line containing `start`.
    const lineStart = before.lastIndexOf("\n") + 1;
    const head = ta.value.slice(0, lineStart);
    const rest = before.slice(lineStart) + sel;
    const lines = rest.split("\n").map(l => prefix + l).join("\n");
    const next = head + lines + after;
    onUpdate({ ...block, text: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = lineStart + prefix.length;
      ta.selectionEnd = lineStart + lines.length;
    });
  }
  function insertAtCursor(snippet: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(ta.selectionEnd);
    onUpdate({ ...block, text: before + snippet + after });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = before.length + snippet.length;
      ta.selectionStart = ta.selectionEnd = pos;
    });
  }

  return (
    <div className="eb-markdown">
      <input
        value={block.title ?? ""}
        onChange={e => onUpdate({ ...block, title: e.target.value || undefined })}
        placeholder="标签(可选,例如:摘要 / 笔记 / 注意事项)"
      />
      <MarkdownToolbar
        textareaRef={taRef}
        onWrap={applyWrap}
        onLinePrefix={applyLinePrefix}
        onInsert={insertAtCursor}
      />
      <textarea
        ref={taRef}
        className="eb-text eb-mono"
        rows={10}
        value={block.text}
        onChange={e => onUpdate({ ...block, text: e.target.value })}
        placeholder={`# 标题\n\n**加粗** *斜体* \`代码\` ~~删除线~~\n\n直接写 HTML 也行:\n<span style="color:#ff5ed4">粉色文字</span>\n<mark>高亮</mark> <sub>下标</sub> <sup>上标</sup>\n<span style="font-size:1.4em">放大字</span>`}
      />
      <div className="eb-markdown__preview-label">实时预览 ↓</div>
      <MarkdownView text={block.text} title={block.title} />
    </div>
  );
}

const PRESET_COLORS: Array<{ name: string; hex: string }> = [
  { name: "青", hex: "#38f2e6" },
  { name: "蓝", hex: "#6aa8ff" },
  { name: "紫", hex: "#b07cff" },
  { name: "粉", hex: "#ff5ed4" },
  { name: "橙", hex: "#ffa86b" },
  { name: "琥珀", hex: "#ffc44d" },
  { name: "绿", hex: "#4ade80" },
  { name: "红", hex: "#ef4444" },
];

function MarkdownToolbar({
  textareaRef, onWrap, onLinePrefix, onInsert,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  onWrap: (left: string, right?: string, placeholder?: string) => void;
  onLinePrefix: (prefix: string) => void;
  onInsert: (snippet: string) => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  void textareaRef;
  return (
    <div className="eb-md-toolbar">
      <button type="button" onClick={() => onWrap("**", "**", "加粗")} title="加粗 (** **)"><b>B</b></button>
      <button type="button" onClick={() => onWrap("*", "*", "斜体")} title="斜体 (* *)"><i>I</i></button>
      <button type="button" onClick={() => onWrap("~~", "~~", "删除")} title="删除线 (~~ ~~)"><s>S</s></button>
      <button type="button" onClick={() => onWrap("<u>", "</u>", "下划线")} title="下划线 (HTML <u>)" style={{ textDecoration: "underline" }}>U</button>
      <button type="button" onClick={() => onWrap("`", "`", "代码")} title="行内代码 (` `)" className="eb-md-toolbar__mono">`</button>
      <span className="eb-md-toolbar__sep" />

      {/* 颜色 */}
      <div className="eb-md-toolbar__group">
        <button
          type="button"
          className={colorOpen ? "is-active" : ""}
          onClick={() => { setColorOpen(v => !v); setSizeOpen(false); }}
          title="字体颜色 (内嵌 <span style='color:..'>)"
        >🎨</button>
        {colorOpen && (
          <div className="eb-md-toolbar__pop">
            {PRESET_COLORS.map(c => (
              <button
                key={c.hex} type="button"
                className="eb-md-toolbar__swatch"
                style={{ background: c.hex }}
                title={`${c.name} · ${c.hex}`}
                onClick={() => { onWrap(`<span style="color:${c.hex}">`, "</span>", c.name + "字"); setColorOpen(false); }}
              />
            ))}
            <button
              type="button"
              className="eb-md-toolbar__custom"
              title="自定义颜色"
              onClick={() => {
                const hex = window.prompt("自定义颜色 (例如 #38f2e6)", "#38f2e6");
                if (!hex) return;
                onWrap(`<span style="color:${hex}">`, "</span>", "字");
                setColorOpen(false);
              }}
            >自定…</button>
          </div>
        )}
      </div>

      {/* 字号 */}
      <div className="eb-md-toolbar__group">
        <button
          type="button"
          className={sizeOpen ? "is-active" : ""}
          onClick={() => { setSizeOpen(v => !v); setColorOpen(false); }}
          title="字号 (内嵌 font-size)"
        >A↕</button>
        {sizeOpen && (
          <div className="eb-md-toolbar__pop">
            {[
              { lbl: "小", v: "0.85em" },
              { lbl: "中", v: "1em" },
              { lbl: "大", v: "1.25em" },
              { lbl: "特大", v: "1.6em" },
              { lbl: "超大", v: "2em" },
            ].map(s => (
              <button
                key={s.v} type="button"
                className="eb-md-toolbar__size"
                onClick={() => { onWrap(`<span style="font-size:${s.v}">`, "</span>", s.lbl + "字"); setSizeOpen(false); }}
              >{s.lbl}</button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => onWrap("<mark>", "</mark>", "高亮")} title="高亮 (<mark>)">🖍</button>
      <span className="eb-md-toolbar__sep" />

      <button type="button" onClick={() => onLinePrefix("# ")} title="一级标题">H1</button>
      <button type="button" onClick={() => onLinePrefix("## ")} title="二级标题">H2</button>
      <button type="button" onClick={() => onLinePrefix("### ")} title="三级标题">H3</button>
      <button type="button" onClick={() => onLinePrefix("- ")} title="圆点列表">•</button>
      <button type="button" onClick={() => onLinePrefix("1. ")} title="有序列表">1.</button>
      <button type="button" onClick={() => onLinePrefix("- [ ] ")} title="任务清单">☐</button>
      <button type="button" onClick={() => onLinePrefix("> ")} title="引用">❝</button>
      <span className="eb-md-toolbar__sep" />

      <button type="button" onClick={() => onWrap("[", "](https://)", "链接文字")} title="链接">🔗</button>
      <button type="button" onClick={() => onInsert("\n```\n代码\n```\n")} title="代码块">{"</>"}</button>
      <button
        type="button"
        title="表格"
        onClick={() => onInsert("\n| 列1 | 列2 |\n| --- | --- |\n| a   | b   |\n")}
      >▦</button>
      <button type="button" onClick={() => onInsert("\n---\n")} title="分割线">―</button>
    </div>
  );
}

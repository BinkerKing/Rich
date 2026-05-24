import { useRef, useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import type { Element } from "@ke/domain";
import { DraftPrdModal } from "../components/DraftPrdModal.js";
import { ChildElementDrawer } from "../components/ChildElementDrawer.js";
import "./PracticeWorkspace.css";

type TabId = "overview" | "breakdown" | "mockups";

interface Props {
  practiceId: string;
  onBack: () => void;
}

export function PracticeWorkspace({ practiceId, onBack }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const [tab, setTab] = useState<TabId>("overview");
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  const [draftPrdOpen, setDraftPrdOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const practice = elements.get(practiceId);
  if (!practice || practice.type !== "practice") {
    return (
      <div className="pw">
        <button className="pw__back" onClick={onBack}>← 全部项目</button>
        <div className="pw__error">项目不存在或已删除</div>
      </div>
    );
  }

  const isProject = (practice.tags ?? []).includes("实战项目");
  const toggleProjectMode = async (): Promise<void> => {
    setToggling(true);
    try {
      const currentTags = practice.tags ?? [];
      const nextTags = isProject
        ? currentTags.filter(t => t !== "实战项目")
        : ["实战项目", ...currentTags];
      await api.patchElement(practice.id, { tags: nextTags });
      await hydrate();
      // 关闭开关 → 立刻退出工作空间（不再在列表里显示了）
      if (isProject) onBack();
    } catch (e) {
      alert(`切换失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setToggling(false);
    }
  };

  const childIds = relations
    .filter(r => r.kind === "child" && r.from === practiceId)
    .map(r => r.to);
  const children = childIds.map(id => elements.get(id)).filter((e): e is Element => !!e);

  const concepts = children.filter(c => c.type === "concept");
  const cases = children.filter(c => c.type === "case");
  const prds = children.filter(c => c.type === "product-design");
  const steps = children.filter(c => c.type === "step");
  const stepDone = steps.filter(s => s.status === "done").length;

  return (
    <div className="pw">
      <div className="pw__top">
        <button className="pw__back" onClick={onBack}>← 全部项目</button>
        <div className="pw__title">{practice.title}</div>
        {practice.subtitle && <span className="pw__subtitle">{practice.subtitle}</span>}
        <div style={{ flex: 1 }} />
        <button
          className={`pw__toggle ${isProject ? "is-on" : "is-off"}`}
          disabled={toggling}
          title={isProject ? "关闭后从 项目实战 列表移除（仍在知识树）" : "打开后在 项目实战 列表显示"}
          onClick={() => void toggleProjectMode()}>
          {toggling ? "…" : isProject ? "✓ 在 项目实战 中" : "+ 加入 项目实战"}
        </button>
      </div>

      <div className="pw__tabs">
        {(["overview", "breakdown", "mockups"] as TabId[]).map(t => (
          <button key={t}
            className={`pw__tab ${tab === t ? "is-active" : ""}`}
            onClick={() => setTab(t)}>
            {t === "overview" ? "总览" : t === "breakdown" ? "拆解" : "效果图"}
          </button>
        ))}
      </div>

      <div className="pw__body">
        {tab === "overview" && (
          <OverviewTab concepts={concepts.length} cases={cases.length}
            prds={prds.length} steps={steps.length} stepDone={stepDone}
            practice={practice} />
        )}
        {tab === "breakdown" && (
          <BreakdownTab
            practiceId={practiceId}
            concepts={concepts}
            cases={cases}
            prds={prds}
            steps={steps}
            onOpenChild={setOpenChildId}
            onDraftPrd={() => setDraftPrdOpen(true)} />
        )}
        {tab === "mockups" && (
          <MockupsTab practice={practice} />
        )}
      </div>

      {openChildId && (
        <ChildElementDrawer
          elementId={openChildId}
          onClose={() => setOpenChildId(null)} />
      )}
      {draftPrdOpen && (
        <DraftPrdModal
          practice={practice}
          children={children}
          onClose={() => setDraftPrdOpen(false)} />
      )}
    </div>
  );
}

// ===================================================================
// Tab 1: 总览
// ===================================================================
function OverviewTab({ concepts, cases, prds, steps, stepDone, practice }: {
  concepts: number; cases: number; prds: number; steps: number; stepDone: number;
  practice: Element;
}): ReactNode {
  const stepPct = steps === 0 ? 0 : Math.round((stepDone / steps) * 100);
  return (
    <div className="pw-overview">
      <div className="pw-overview__kpis">
        <div className="pw-kpi"><div className="pw-kpi__num">{concepts}</div><div className="pw-kpi__label">知识点</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{cases}</div><div className="pw-kpi__label">需求分析</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{prds}</div><div className="pw-kpi__label">PRD</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{stepDone}/{steps}</div><div className="pw-kpi__label">开发任务</div></div>
      </div>
      {steps > 0 && (
        <div className="pw-overview__progress">
          <div className="pw-overview__progress-label">开发任务进度 {stepPct}%</div>
          <div className="pw-overview__progress-bar"><span style={{ width: `${stepPct}%` }} /></div>
        </div>
      )}
      <div className="pw-overview__meta">
        <span>创建于 {new Date(practice.metadata.createdAt).toLocaleDateString("zh-CN")}</span>
        <span>最近更新 {new Date(practice.metadata.updatedAt).toLocaleDateString("zh-CN")}</span>
      </div>
    </div>
  );
}

// ===================================================================
// Tab 2: 拆解（4 组 + step 看板）
// ===================================================================
function BreakdownTab({
  practiceId, concepts, cases, prds, steps,
  onOpenChild, onDraftPrd,
}: {
  practiceId: string;
  concepts: Element[]; cases: Element[]; prds: Element[]; steps: Element[];
  onOpenChild: (id: string) => void;
  onDraftPrd: () => void;
}): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const [newTitle, setNewTitle] = useState<Record<string, string>>({});

  const addChild = async (type: "concept" | "case" | "product-design" | "step"): Promise<void> => {
    const title = (newTitle[type] ?? "").trim();
    if (!title) return;
    try {
      await api.createPracticeChild({ practiceId, type, title });
      setNewTitle(s => ({ ...s, [type]: "" }));
      await hydrate();
    } catch (e) {
      alert(`新增失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const setStatus = async (id: string, status: "todo" | "doing" | "done"): Promise<void> => {
    try {
      await api.patchElement(id, { status });
      await hydrate();
    } catch (e) {
      alert(`修改状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const Group = ({ icon, label, type, items, extraButton }: {
    icon: string; label: string;
    type: "concept" | "case" | "product-design";
    items: Element[]; extraButton?: ReactNode;
  }): ReactNode => (
    <div className="pw-bd-group">
      <div className="pw-bd-group__head">
        <span>{icon} {label} ({items.length})</span>
        <div className="pw-bd-group__actions">
          {extraButton}
          <input className="pw-bd-input"
            placeholder={`+ 新增${label}`}
            value={newTitle[type] ?? ""}
            onChange={e => setNewTitle(s => ({ ...s, [type]: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") void addChild(type); }} />
        </div>
      </div>
      {items.map(it => (
        <button key={it.id} className="pw-bd-item" onClick={() => onOpenChild(it.id)}>
          <span className="pw-bd-item__title">{it.title}</span>
          {it.subtitle && <span className="pw-bd-item__sub">{it.subtitle}</span>}
        </button>
      ))}
      {items.length === 0 && <div className="pw-bd-empty">暂无</div>}
    </div>
  );

  // Step kanban
  const todo = steps.filter(s => (s.status ?? "todo") === "todo");
  const doing = steps.filter(s => s.status === "doing");
  const done = steps.filter(s => s.status === "done");

  return (
    <div className="pw-bd">
      <Group icon="📚" label="知识点" type="concept" items={concepts} />
      <Group icon="🎯" label="需求分析" type="case" items={cases} />
      <Group icon="📄" label="PRD" type="product-design" items={prds}
        extraButton={
          <button className="pw-bd-ai" onClick={onDraftPrd}>🪄 让 Rich 起草</button>
        } />

      <div className="pw-bd-group">
        <div className="pw-bd-group__head">
          <span>⚙️ 开发任务 ({steps.length})</span>
          <input className="pw-bd-input"
            placeholder="+ 新增任务"
            value={newTitle.step ?? ""}
            onChange={e => setNewTitle(s => ({ ...s, step: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") void addChild("step"); }} />
        </div>
        <div className="pw-bd-kanban">
          {([
            { id: "todo", label: "todo", items: todo },
            { id: "doing", label: "doing", items: doing },
            { id: "done", label: "done", items: done },
          ] as const).map(col => (
            <div key={col.id} className={`pw-bd-col pw-bd-col--${col.id}`}>
              <div className="pw-bd-col__head">{col.label} ({col.items.length})</div>
              {col.items.map(s => (
                <div key={s.id} className="pw-bd-task">
                  <button className="pw-bd-task__title" onClick={() => onOpenChild(s.id)}>
                    {s.title}
                  </button>
                  <div className="pw-bd-task__actions">
                    {(["todo","doing","done"] as const).map(st => (
                      <button key={st}
                        className={`pw-bd-task__chip ${(s.status ?? "todo") === st ? "is-active" : ""}`}
                        onClick={() => void setStatus(s.id, st)}>
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {col.items.length === 0 && <div className="pw-bd-empty">空</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// Tab 3: 效果图（网格画廊 + 上传 + 全屏看图）
// ===================================================================
function MockupsTab({ practice }: { practice: Element }): ReactNode {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const hydrate = useStore(s => s.hydrate);

  const images: Array<{ src: string; caption?: string }> =
    (practice.content as { images?: Array<{ src: string; caption?: string }> } | undefined)?.images ?? [];

  const onPick = (): void => fileRef.current?.click();

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      // 复用现有 image 上传 API（实战项目把所有效果图存为 practice.content.images）
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/images/${encodeURIComponent(practice.id)}/upload`, {
        method: "POST", body: fd,
      });
      if (!r.ok) throw new Error(`upload failed: ${r.status}`);
      const { src } = await r.json() as { src: string };
      // 把这张图加进 practice.content.images
      const nextContent = {
        ...(practice.content as Record<string, unknown> ?? {}),
        images: [...images, { src, caption: f.name }],
      };
      await api.patchElement(practice.id, { content: nextContent });
      await hydrate();
    } catch (err) {
      alert(`上传失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="pw-mk">
      <div className="pw-mk__head">
        <span>效果图 ({images.length})</span>
        <button className="pw-mk__upload" onClick={onPick} disabled={uploading}>
          {uploading ? "上传中…" : "+ 上传"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onUpload} />
      </div>
      {images.length === 0 ? (
        <div className="pw-mk__empty">还没有效果图。点 +上传 加一张。</div>
      ) : (
        <div className="pw-mk__grid">
          {images.map((img, i) => (
            <button key={i} className="pw-mk__cell" onClick={() => setFullscreen(i)}>
              <img src={img.src} alt={img.caption ?? `mockup-${i}`} />
              {img.caption && <div className="pw-mk__caption">{img.caption}</div>}
            </button>
          ))}
        </div>
      )}
      {fullscreen !== null && images[fullscreen] && (
        <div className="pw-mk__fs" onClick={() => setFullscreen(null)}>
          <img src={images[fullscreen].src} alt={images[fullscreen].caption ?? ""} />
        </div>
      )}
    </div>
  );
}

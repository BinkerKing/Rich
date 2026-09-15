import { useEffect, useRef, useState, type UIEvent } from "react";
import { FileText, Pencil, Save, X } from "lucide-react";
import { api, type ProjectDescription } from "../../api/client.js";
import { Alert, Badge, Button, DocumentLayout, EmptyState, MetaText, PageHeader, Prose, ScrollArea, Separator, Skeleton, TableOfContents } from "../../ui/index.js";
import { ProjectRichTextEditor } from "./ProjectManagementModules.js";

type DescriptionHeading = { id: string; title: string; level: number };

export function ProjectDescriptionSection({ projectId }: { projectId: string }) {
  const [description, setDescription] = useState<ProjectDescription | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headings, setHeadings] = useState<DescriptionHeading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const documentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDescription(null);
    setEditing(false);
    setError(null);
    void api.getProjectDescription(projectId)
      .then(next => {
        if (cancelled) return;
        setDescription(next);
        setDraft(next.html);
      })
      .catch(errorValue => {
        if (!cancelled) setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
      });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    const next = Array.from(documentRef.current?.querySelectorAll<HTMLElement>("h1, h2, h3") ?? []).map((heading, index) => {
      const id = `project-description-heading-${index}`;
      heading.id = id;
      return { id, title: heading.textContent?.trim() || `章节 ${index + 1}`, level: Number(heading.tagName.slice(1)) };
    });
    setHeadings(next);
    setActiveHeadingId(next[0]?.id ?? null);
  }, [description?.html, editing]);

  const beginEdit = () => {
    setDraft(description?.html ?? "");
    setEditing(true);
    setError(null);
  };
  const cancelEdit = () => {
    setDraft(description?.html ?? "");
    setEditing(false);
    setError(null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveProjectDescription(projectId, draft);
      setDescription(saved);
      setDraft(saved.html);
      setEditing(false);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    } finally {
      setBusy(false);
    }
  };
  const updateActiveHeading = (_event: UIEvent<HTMLDivElement>) => {
    const visibleHeadings = Array.from(documentRef.current?.querySelectorAll<HTMLElement>("h1, h2, h3") ?? []);
    const active = visibleHeadings.reduce<HTMLElement | undefined>((current, heading) => heading.getBoundingClientRect().top <= 144 ? heading : current, undefined) ?? visibleHeadings[0];
    if (active) setActiveHeadingId(active.id);
  };

  return (
    <div className={`prj-pm-description${editing ? " is-editing" : ""}`}>
      <PageHeader
        icon={<FileText aria-hidden="true" />}
        title="项目说明"
        description="记录项目背景、架构、运行方式和重要约束，供项目成员与 AI 快速了解上下文。"
        meta={<><Badge>项目说明</Badge><Separator className="h-4 w-px" />{description?.updatedAt && <MetaText>最后保存：{formatProjectDescriptionTime(description.updatedAt)}</MetaText>}</>}
        actions={editing ? <><Button variant="secondary" className="prj-pm-description__action gap-1.5" onClick={cancelEdit} disabled={busy}><X size={15} aria-hidden="true" />取消</Button><Button variant="secondary" className="prj-pm-description__action gap-1.5" onClick={() => void save()} disabled={busy}><Save size={15} aria-hidden="true" />{busy ? "保存中…" : "保存"}</Button></> : <Button variant="secondary" className="prj-pm-description__action gap-1.5" onClick={beginEdit}><Pencil size={15} aria-hidden="true" />{description?.text ? "编辑" : "开始填写"}</Button>}
      />

      {error && <Alert role="alert">{error}</Alert>}
      <ScrollArea className="prj-pm-description__body" onScroll={updateActiveHeading}>
        {description === null && !error ? <Skeleton className="h-[360px] w-full" /> : editing ? (
          <ProjectRichTextEditor projectId={`${projectId}-description`} value={draft} onChange={setDraft} />
        ) : description?.text ? (
          <DocumentLayout aside={headings.length > 0 ? <TableOfContents items={headings} activeId={activeHeadingId} onSelect={heading => document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "start" })} label="项目说明目录" /> : undefined}>
            <Prose ref={documentRef} dangerouslySetInnerHTML={{ __html: description.html }} />
          </DocumentLayout>
        ) : (
          <EmptyState icon={<FileText aria-hidden="true" />} title="还没有项目说明" description="可以自由记录项目背景、业务目标、技术架构、数据库、启动方式、当前进度及注意事项。" action={<Button variant="secondary" className="prj-pm-description__action gap-1.5" onClick={beginEdit}><Pencil size={15} aria-hidden="true" />开始填写</Button>} />
        )}
      </ScrollArea>
    </div>
  );
}

function formatProjectDescriptionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
